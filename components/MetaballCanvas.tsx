import React, { useRef, useEffect, useState } from 'react';
import { SimulationConfig, Particle } from '../types';
import { SimpleNoise } from '../utils/noise';

interface Props {
  config: SimulationConfig;
}

const MetaballCanvas: React.FC<Props> = ({ config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const noiseRef = useRef(new SimpleNoise());
  const timeRef = useRef(0);
  const frameIdRef = useRef<number | null>(null);
  const textDensityRef = useRef<Uint8ClampedArray | null>(null);
  const imageDensityRef = useRef<Uint8ClampedArray | null>(null);
  
  // High-frequency sampling canvas for Image/GIF mode
  const samplingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const playingImgRef = useRef<HTMLImageElement | null>(null);
  
  // To ensure the GIF actually plays, we sometimes need it in the DOM
  const hiddenImgContainerRef = useRef<HTMLDivElement | null>(null);

  // Reference height for normalizing scaling (e.g., 800px)
  const REF_HEIGHT = 800;
  
  // Square Aspect Ratio: 1:1
  const TARGET_RATIO = 1;
  
  const [dimensions, setDimensions] = useState({ 
    width: window.innerHeight, 
    height: window.innerHeight 
  });

  const customIconImgsRef = useRef<(HTMLImageElement | null)[]>([null, null, null, null]);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const smoothedParams = useRef({
    baseRadius: config.baseRadius,
    speed: config.speed,
    patternScale: config.patternScale,
    gridSize: config.gridSize,
    oscAmplitude: config.oscAmplitude,
    threshold: config.threshold,
    edgeLevel: config.edgeLevel,
    colorMain: { r: 255, g: 255, b: 255 },
    colorEnd: { r: 239, g: 68, b: 68 } 
  });

  const cellShapesRef = useRef<Map<string, SimulationConfig['dotShape']>>(new Map());
  const cellProgressRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const handleResize = () => {
      const newHeight = window.innerHeight;
      const newWidth = newHeight * TARGET_RATIO;
      setDimensions({ width: newWidth, height: newHeight });
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  };

  const lerp = (start: number, end: number, amt: number) => start + (end - start) * amt;

  const lerpColor = (c1: {r: number, g: number, b: number}, c2: {r: number, g: number, b: number}, t: number) => ({
    r: Math.floor(c1.r + (c2.r - c1.r) * t),
    g: Math.floor(c1.g + (c2.g - c1.g) * t),
    b: Math.floor(c1.b + (c2.b - c1.b) * t),
  });

  const hash = (i: number, j: number) => Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;

  useEffect(() => {
    config.customIconSources.forEach((src, idx) => {
      if (src) {
        const img = new Image();
        img.onload = () => { customIconImgsRef.current[idx] = img; };
        img.src = src;
      } else {
        customIconImgsRef.current[idx] = null;
      }
    });
  }, [config.customIconSources]);

  useEffect(() => {
    if (config.motionMode === 'audio' && !audioContextRef.current) {
      const initAudio = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          streamRef.current = stream;
          const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
          const context = new AudioContextClass();
          const source = context.createMediaStreamSource(stream);
          const analyzer = context.createAnalyser();
          analyzer.fftSize = 256;
          source.connect(analyzer);
          audioContextRef.current = context;
          analyzerRef.current = analyzer;
          dataArrayRef.current = new Uint8Array(analyzer.frequencyBinCount);
        } catch (err) { console.error("Audio init failed:", err); }
      };
      initAudio();
    }
  }, [config.motionMode]);

  useEffect(() => {
    const off = document.createElement('canvas');
    off.width = 600; off.height = 600;
    const ctx = off.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 600, 600);
    ctx.font = `900 ${config.charFontSize}px "Inter", "Arial Black", sans-serif`;
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(config.characterText || 'META', 300, 300);
    textDensityRef.current = ctx.getImageData(0, 0, 600, 600).data;
  }, [config.characterText, config.charFontSize]);

  useEffect(() => {
    if (!config.imageSource) {
      playingImgRef.current = null;
      imageDensityRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      playingImgRef.current = img;
      // Initialize image density mapping
      const off = document.createElement('canvas');
      off.width = 600; off.height = 600;
      const ctx = off.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 600, 600);
      const baseRatio = Math.min(600 / img.width, 600 / img.height);
      const ratio = baseRatio * config.imageScale;
      const w = img.width * ratio; const h = img.height * ratio;
      ctx.drawImage(img, (600 - w) / 2, (600 - h) / 2, w, h);
      imageDensityRef.current = ctx.getImageData(0, 0, 600, 600).data;
    };
    img.src = config.imageSource;
  }, [config.imageSource, config.imageScale]);

  useEffect(() => {
    const count = Math.max(config.particleCount, 4);
    particlesRef.current = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      targetX: Math.random() * dimensions.width,
      targetY: Math.random() * dimensions.height,
      noiseX: Math.random() * 1000, noiseY: Math.random() * 1000,
      radius: config.baseRadius, scale: 0.8 + Math.random() * 0.4,
    }));
  }, [config.particleCount, dimensions]);

  const updateAndRender = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    const viewScale = height / REF_HEIGHT;
    const centerX = width / 2; const centerY = height / 2;
    const virtualCX = centerX + config.offsetX * viewScale; 
    const virtualCY = centerY + config.offsetY * viewScale;
    
    const tMain = hexToRgb(config.mainColor);
    const tEdge = hexToRgb(config.gradientColorEnd);
    const lerpAmt = config.transitionSpeed;

    smoothedParams.current.baseRadius = lerp(smoothedParams.current.baseRadius, config.baseRadius, lerpAmt);
    smoothedParams.current.speed = lerp(smoothedParams.current.speed, config.speed, lerpAmt);
    smoothedParams.current.patternScale = lerp(smoothedParams.current.patternScale, config.patternScale, lerpAmt);
    smoothedParams.current.gridSize = lerp(smoothedParams.current.gridSize, config.gridSize, lerpAmt);
    smoothedParams.current.oscAmplitude = lerp(smoothedParams.current.oscAmplitude, config.oscAmplitude, lerpAmt);
    smoothedParams.current.threshold = lerp(smoothedParams.current.threshold, config.threshold, lerpAmt);
    smoothedParams.current.edgeLevel = lerp(smoothedParams.current.edgeLevel, config.edgeLevel, lerpAmt);
    
    smoothedParams.current.colorMain.r = lerp(smoothedParams.current.colorMain.r, tMain.r, lerpAmt);
    smoothedParams.current.colorMain.g = lerp(smoothedParams.current.colorMain.g, tMain.g, lerpAmt);
    smoothedParams.current.colorMain.b = lerp(smoothedParams.current.colorMain.b, tMain.b, lerpAmt);

    smoothedParams.current.colorEnd.r = lerp(smoothedParams.current.colorEnd.r, tEdge.r, lerpAmt);
    smoothedParams.current.colorEnd.g = lerp(smoothedParams.current.colorEnd.g, tEdge.g, lerpAmt);
    smoothedParams.current.colorEnd.b = lerp(smoothedParams.current.colorEnd.b, tEdge.b, lerpAmt);

    const cMain = smoothedParams.current.colorMain;
    const cEnd = smoothedParams.current.colorEnd;

    timeRef.current += 0.01 * smoothedParams.current.speed;
    const t = timeRef.current;

    let aBass = 0;
    if (config.motionMode === 'audio' && analyzerRef.current && dataArrayRef.current) {
      analyzerRef.current.getByteFrequencyData(dataArrayRef.current);
      const len = dataArrayRef.current.length;
      for (let i = 0; i < len; i++) {
        if (i < len * 0.2) aBass += dataArrayRef.current[i];
      }
      aBass = (aBass / (len * 0.2 * 255)) * config.audioSensitivity;
    }

    // REAL-TIME GIF SAMPLING: Update imageDensityRef every frame in Image mode
    if (config.motionMode === 'image' && playingImgRef.current && (playingImgRef.current.complete || playingImgRef.current.naturalWidth > 0)) {
      if (!samplingCanvasRef.current) {
        samplingCanvasRef.current = document.createElement('canvas');
        samplingCanvasRef.current.width = 600;
        samplingCanvasRef.current.height = 600;
      }
      const sCanvas = samplingCanvasRef.current;
      const sCtx = sCanvas.getContext('2d', { willReadFrequently: true });
      if (sCtx) {
        sCtx.fillStyle = '#000';
        sCtx.fillRect(0, 0, 600, 600);
        const img = playingImgRef.current;
        const baseRatio = Math.min(600 / img.width, 600 / img.height);
        const ratio = baseRatio * config.imageScale;
        const w = img.width * ratio; const h = img.height * ratio;
        sCtx.drawImage(img, (600 - w) / 2, (600 - h) / 2, w, h);
        imageDensityRef.current = sCtx.getImageData(0, 0, 600, 600).data;
      }
    }

    particlesRef.current.forEach((p, i) => {
      const r = (smoothedParams.current.baseRadius * viewScale) * p.scale;
      const pMod = i / particlesRef.current.length;
      let tx = p.x, ty = p.y;
      
      if (config.motionMode === 'audio') {
        const react = dataArrayRef.current ? dataArrayRef.current[Math.floor(pMod * dataArrayRef.current.length)] / 255 : 0;
        p.radius = config.audioReactiveRadius ? r * (1 + react * config.audioSensitivity) : r;
        const angle = (pMod * Math.PI * 2);
        const rad = (smoothedParams.current.baseRadius * 5 * viewScale) * smoothedParams.current.patternScale;
        tx = virtualCX + Math.cos(angle) * rad;
        ty = virtualCY + Math.sin(angle) * rad;
      } else if (config.motionMode === 'cross') {
        const osc = Math.sin(t * config.oscSpeed); 
        const amp = smoothedParams.current.oscAmplitude * viewScale * smoothedParams.current.patternScale;
        const rot = config.crossRotation * (Math.PI / 180) + (t * 0.3);
        let lx = 0, ly = 0;
        if (i === 0) lx = -amp * Math.abs(osc); else if (i === 1) lx = amp * Math.abs(osc);
        else if (i === 2) ly = -amp * Math.abs(osc); else if (i === 3) ly = amp * Math.abs(osc);
        tx = virtualCX + (lx * Math.cos(rot) - ly * Math.sin(rot));
        ty = virtualCY + (lx * Math.sin(rot) + ly * Math.cos(rot));
        p.radius = r;
      } else if (config.motionMode === 'breath') {
        const osc = Math.sin(t * config.breathSpeed + p.noiseX);
        p.radius = r * (1.0 + osc * config.breathRange);
        tx = virtualCX + noiseRef.current.noise(t * 0.2 + p.noiseX) * 100 * viewScale * smoothedParams.current.patternScale;
        ty = virtualCY + noiseRef.current.noise(t * 0.2 + p.noiseY) * 100 * viewScale * smoothedParams.current.patternScale;
      } else {
        p.radius = r;
        const drift = config.motionRange * viewScale * smoothedParams.current.patternScale;
        tx = virtualCX + noiseRef.current.noise(t * 0.3 + p.noiseX) * drift;
        ty = virtualCY + noiseRef.current.noise(t * 0.3 + p.noiseY) * drift;
      }

      p.x = lerp(p.x, tx, lerpAmt);
      p.y = lerp(p.y, ty, lerpAmt);
    });

    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);

    const getInfluence = (x: number, y: number) => {
      let norm = 0; 
      const minT = smoothedParams.current.threshold - smoothedParams.current.edgeLevel; 
      const maxT = smoothedParams.current.threshold + smoothedParams.current.edgeLevel;
      const sx = ((x - virtualCX) / (smoothedParams.current.patternScale * viewScale)) + 300; 
      const sy = ((y - virtualCY) / (smoothedParams.current.patternScale * viewScale)) + 300;
      
      const pulse = Math.sin(t * config.charPulseSpeed) * config.charPulseIntensity;

      if (config.motionMode === 'character' && textDensityRef.current) {
        if (sx >= 0 && sx < 600 && sy >= 0 && sy < 600) {
          const charV = textDensityRef.current[(Math.floor(sy) * 600 + Math.floor(sx)) * 4] / 255;
          const inf = charV * smoothedParams.current.threshold * 1.5 * (1 + pulse);
          norm = inf > maxT ? 1 : (inf > minT ? (inf - minT) / (maxT - minT) : 0);
        }
      } else if (config.motionMode === 'image' && imageDensityRef.current) {
        if (sx >= 0 && sx < 600 && sy >= 0 && sy < 600) {
          const idx = (Math.floor(sy) * 600 + Math.floor(sx)) * 4;
          const data = imageDensityRef.current;
          const dens = (0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2]) / 255 * (data[idx+3] / 255);
          const inf = dens * smoothedParams.current.threshold * 1.5 * (1 + pulse);
          norm = inf > maxT ? 1 : (inf > minT ? (inf - minT) / (maxT - minT) : 0);
        }
      } else {
        let inf = 0;
        for (const p of particlesRef.current) {
          const d2 = (x - p.x)**2 + (y - p.y)**2;
          if (d2 > 0) inf += (p.radius * p.radius) / d2;
        }
        norm = inf > maxT ? 1 : (inf > minT ? (inf - minT) / (maxT - minT) : 0);
      }
      return norm;
    };

    if (config.enableHalftone) {
      let baseGridSize = smoothedParams.current.gridSize;
      if (config.motionMode === 'audio' && config.audioReactiveGrid) {
        baseGridSize *= (1 + aBass * config.audioGridSensitivity * 0.15);
      }

      const gSize = Math.max(4, baseGridSize) * viewScale;
      const gap = config.gridGap * viewScale;
      const halfCols = Math.ceil(centerX / gSize);
      const halfRows = Math.ceil(centerY / gSize);
      const maxRadius = Math.sqrt(centerX**2 + centerY**2);
      
      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const osC = offscreenCanvasRef.current;
      const osCtx = osC.getContext('2d');

      for (let j = -halfRows; j <= halfRows; j++) {
        const y = centerY + j * gSize;
        if (y < -gSize || y > height + gSize) continue;
        for (let i = -halfCols; i <= halfCols; i++) {
          const x = centerX + i * gSize;
          if (x < -gSize || x > width + gSize) continue;
          
          const norm = getInfluence(x, y);
          if (norm > 0.05) {
            const key = `${i},${j}`;
            let tShape: SimulationConfig['dotShape'] = config.dotShape;
            
            if (config.hmsEnabled) {
              const d = Math.sqrt((x - centerX)**2 + (y - centerY)**2) / maxRadius;
              const threshold = 1.0 - config.hmsDistribution;
              if (d > threshold) {
                const distanceFactor = threshold >= 1.0 ? 0 : (d - threshold) / (1.0 - threshold + 0.0001);
                const randomNoise = hash(i, j);
                const finalProb = (distanceFactor * 0.6 + 0.4) * config.hmsDistribution * 1.1;
                if (randomNoise < finalProb) tShape = 'HMS';
              }
            }

            if (config.chargingEnabled && tShape !== 'HMS') {
              const d = Math.sqrt((x - centerX)**2 + (y - centerY)**2) / maxRadius;
              const threshold = 1.0 - config.chargingDistribution;
              if (d > threshold) {
                const distanceFactor = threshold >= 1.0 ? 0 : (d - threshold) / (1.0 - threshold + 0.0001);
                const randomNoise = hash(i + 1000, j + 1000); 
                const finalProb = (distanceFactor * 0.6 + 0.4) * config.chargingDistribution * 1.1;
                if (randomNoise < finalProb) tShape = 'CHARGING';
              }
            }

            if (tShape === 'mixed') tShape = (config.mixedShapes[Math.floor(hash(i, j) * config.mixedShapes.length)] || 'roundedRect') as SimulationConfig['dotShape'];
            
            let curShape = cellShapesRef.current.get(key);
            let prog = cellProgressRef.current.get(key) ?? 1.0;
            if (!curShape) {
              cellShapesRef.current.set(key, tShape);
              curShape = tShape;
            }
            if (curShape !== tShape) {
              prog = Math.max(0, prog - lerpAmt);
              if (prog <= 0) { cellShapesRef.current.set(key, tShape); prog = 0.01; }
            } else { 
              prog = Math.min(1.0, prog + lerpAmt); 
            }
            cellProgressRef.current.set(key, prog);

            const sz = Math.max(0, (gSize - gap) * Math.pow(norm, 0.6) * config.dotScale * prog * (config.motionMode === 'audio' ? (1 + aBass * 0.2) : 1));
            let color = config.tintMode === 'gradient' ? lerpColor(cMain, cEnd, Math.min(1, Math.sqrt((x-centerX)**2 + (y-centerY)**2) / (width/2))) : cMain;
            
            const isWhite = config.mainColor.toLowerCase() === '#ffffff' || config.mainColor.toLowerCase() === '#fff';
            const boost = isWhite ? 0 : 0.4;
            const r = Math.min(255, color.r + (255 - color.r) * norm * boost);
            const g = Math.min(255, color.g + (255 - color.g) * norm * boost);
            const b = Math.min(255, color.b + (255 - color.b) * norm * boost);
            
            const shape = cellShapesRef.current.get(key) || tShape;

            if (shape === 'HMS') {
              ctx.fillStyle = '#ff0000'; ctx.strokeStyle = '#ff0000';
            } else if (shape === 'CHARGING') {
              ctx.fillStyle = '#00ff00'; ctx.strokeStyle = '#00ff00';
            } else {
              ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.strokeStyle = `rgb(${r},${g},${b})`;
            }

            ctx.lineWidth = Math.max(1, sz * 0.1);
            ctx.beginPath();
            if (shape === 'circle') ctx.arc(x, y, sz/2, 0, Math.PI*2);
            else if (shape === 'cross') { const th = sz*0.3; ctx.fillRect(x-sz/2, y-th/2, sz, th); ctx.fillRect(x-th/2, y-sz/2, th, sz); }
            else if (shape === 'minus') { const th = sz*0.25; ctx.fillRect(x-sz/2, y-th/2, sz, th); }
            else if (shape === 'divide') { 
              const th = sz*0.15; const dotR = sz*0.12; 
              ctx.fillRect(x-sz/2, y-th/2, sz, th);
              ctx.beginPath(); ctx.arc(x, y - sz*0.35, dotR, 0, Math.PI*2); ctx.fill();
              ctx.beginPath(); ctx.arc(x, y + sz*0.35, dotR, 0, Math.PI*2); ctx.fill();
            }
            else if (shape === 'triangle') { ctx.moveTo(x, y-sz*0.45); ctx.lineTo(x-sz/2, y+sz*0.45); ctx.lineTo(x+sz/2, y+sz*0.45); ctx.closePath(); }
            else if (shape === 'hexagon') {
              ctx.save(); ctx.translate(x, y); ctx.beginPath();
              for (let k = 0; k < 6; k++) { const angle = k * Math.PI / 3; ctx.lineTo(Math.cos(angle) * sz/2, Math.sin(angle) * sz/2); }
              ctx.closePath(); ctx.fill(); ctx.restore();
            }
            else if (shape === 'smiley') {
              ctx.arc(x, y, sz/2, 0, Math.PI*2); ctx.stroke();
              ctx.beginPath(); ctx.arc(x-sz*0.15, y-sz*0.1, sz*0.05, 0, Math.PI*2); ctx.fill();
              ctx.beginPath(); ctx.arc(x+sz*0.15, y-sz*0.1, sz*0.05, 0, Math.PI*2); ctx.fill();
              ctx.beginPath(); ctx.arc(x, y+sz*0.05, sz*0.2, 0, Math.PI); ctx.stroke();
            } else if (shape === 'heart') {
              const h = sz * 0.5; ctx.moveTo(x, y + h*0.5);
              ctx.bezierCurveTo(x - h, y - h*0.2, x - h*0.5, y - h, x, y - h*0.2);
              ctx.bezierCurveTo(x + h*0.5, y - h, x + h, y - h*0.2, x, y + h*0.5);
            } else if (shape === 'star') {
              let rot = Math.PI/2*3; let step=Math.PI/5; ctx.moveTo(x, y-sz/2);
              for(let k=0; k<5; k++){
                ctx.lineTo(x+Math.cos(rot)*sz/2, y+Math.sin(rot)*sz/2); rot+=step;
                ctx.lineTo(x+Math.cos(rot)*sz/4, y+Math.sin(rot)*sz/4); rot+=step;
              }
            } else if (shape === 'music') {
              ctx.save(); ctx.translate(x, y);
              const noteHeadW = sz * 0.18; const noteHeadH = sz * 0.12; const stemH = sz * 0.55;
              ctx.save(); ctx.rotate(-Math.PI/8);
              ctx.beginPath(); ctx.ellipse(-sz*0.2, sz*0.25, noteHeadW, noteHeadH, 0, 0, Math.PI*2); ctx.fill();
              ctx.beginPath(); ctx.ellipse(sz*0.1, sz*0.25, noteHeadW, noteHeadH, 0, 0, Math.PI*2); ctx.fill();
              ctx.restore();
              ctx.fillRect(-sz*0.03, -sz*0.3, sz*0.08, stemH); ctx.fillRect(sz*0.27, -sz*0.3, sz*0.08, stemH);
              ctx.beginPath(); ctx.moveTo(-sz*0.03, -sz*0.3); ctx.lineTo(sz*0.35, -sz*0.3); ctx.lineTo(sz*0.35, -sz*0.18); ctx.lineTo(-sz*0.03, -sz*0.18); ctx.closePath(); ctx.fill();
              ctx.restore();
            } else if (shape === 'gear') {
              const outerRadius = sz * 0.5; const innerRadius = sz * 0.22; const toothHeight = sz * 0.15; const numTeeth = 8;
              for (let k = 0; k < numTeeth; k++) {
                const angle = (k / numTeeth) * Math.PI * 2; const nextAngle = ((k + 0.5) / numTeeth) * Math.PI * 2;
                ctx.lineTo(x + Math.cos(angle) * outerRadius, y + Math.sin(angle) * outerRadius);
                ctx.lineTo(x + Math.cos(nextAngle) * (outerRadius - toothHeight), y + Math.sin(nextAngle) * (outerRadius - toothHeight));
              }
              ctx.closePath(); ctx.fill(); ctx.globalCompositeOperation = 'destination-out';
              ctx.beginPath(); ctx.arc(x, y, innerRadius, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
            } else if (shape === 'question') {
              const r = sz * 0.25; const centerX = x; const centerY = y - sz * 0.1;
              ctx.arc(centerX, centerY, r, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(centerX, centerY + sz * 0.35); ctx.stroke();
              ctx.beginPath(); ctx.arc(centerX, centerY + sz * 0.5, sz * 0.08, 0, Math.PI * 2); ctx.fill();
            } else if (shape === 'errorCross' || shape === 'HMS') {
              const w = sz * 0.25; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
              ctx.fillRect(-sz * 0.5, -w * 0.5, sz, w); ctx.fillRect(-w * 0.5, -sz * 0.5, w, sz); ctx.restore();
            } else if (shape === 'electric' || shape === 'CHARGING') {
              ctx.save(); ctx.translate(x, y); ctx.beginPath();
              ctx.moveTo(sz * 0.1, -sz * 0.5); ctx.lineTo(-sz * 0.4, sz * 0.05); ctx.lineTo(sz * 0.1, sz * 0.05);
              ctx.lineTo(-sz * 0.1, sz * 0.5); ctx.lineTo(sz * 0.35, -sz * 0.05); ctx.lineTo(-sz * 0.1, -sz * 0.05);
              ctx.closePath(); ctx.fill(); ctx.restore();
            } else if (shape === 'eye') {
              ctx.ellipse(x, y, sz*0.5, sz*0.3, 0, 0, Math.PI*2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, sz*0.2, 0, Math.PI*2); ctx.fill();
            } else if (shape === 'xpeng') {
              const g = sz * 0.045;
              const drawWing = (dirX: number, dirY: number) => {
                ctx.save(); ctx.translate(x + g * dirX, y + g * dirY); ctx.scale(dirX, dirY); ctx.beginPath();
                ctx.moveTo(0, 0); ctx.lineTo(0, sz * 0.15); ctx.lineTo(sz * 0.48, sz * 0.38); ctx.lineTo(sz * 0.22, 0); ctx.closePath(); ctx.fill(); ctx.restore();
              };
              drawWing(1, -1); drawWing(-1, -1); drawWing(1, 1); drawWing(-1, 1);
            } else if (shape && shape.startsWith('custom') && osCtx) {
               const idx = parseInt(shape.replace('custom', '')) - 1;
               const img = customIconImgsRef.current[idx];
               if (img) {
                 const ratio = Math.min(sz / img.width, sz / img.height);
                 const dw = Math.ceil(img.width * ratio); const dh = Math.ceil(img.height * ratio);
                 if (dw > 0 && dh > 0) {
                   osC.width = dw; osC.height = dh; osCtx.clearRect(0, 0, dw, dh); osCtx.drawImage(img, 0, 0, dw, dh);
                   osCtx.globalCompositeOperation = 'source-in'; osCtx.fillStyle = `rgb(${r},${g},${b})`; osCtx.fillRect(0, 0, dw, dh);
                   osCtx.globalCompositeOperation = 'source-over'; ctx.drawImage(osC, x - dw / 2, y - dh / 2);
                 }
               } else { ctx.roundRect(x-sz/2, y-sz/2, sz, sz, sz*0.3); ctx.fill(); }
            } else { ctx.roundRect(x-sz/2, y-sz/2, sz, sz, sz*0.3); }
            ctx.fill();
          }
        }
      }
    } else {
      const step = 4;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const norm = getInfluence(x, y);
          if (norm > 0.05) {
            let color = config.tintMode === 'gradient' ? lerpColor(cMain, cEnd, Math.min(1, Math.sqrt((x-centerX)**2 + (y-centerY)**2) / (width/2))) : cMain;
            ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
            ctx.fillRect(x, y, step, step);
          }
        }
      }
    }
    frameIdRef.current = requestAnimationFrame(updateAndRender);
  };

  useEffect(() => {
    frameIdRef.current = requestAnimationFrame(updateAndRender);
    return () => { if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current); };
  }, [config, dimensions]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden flex items-center justify-center">
      {/* Hidden container to force GIF animation playback in some browsers */}
      <div ref={hiddenImgContainerRef} className="hidden pointer-events-none opacity-0 overflow-hidden w-0 h-0">
        {config.imageSource && <img src={config.imageSource} alt="GIF Source" />}
      </div>
      
      <div 
        className="relative bg-zinc-900 shadow-2xl overflow-hidden"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <canvas 
          ref={canvasRef} 
          width={dimensions.width} 
          height={dimensions.height} 
          className="w-full h-full block" 
        />
      </div>
    </div>
  );
};

export default MetaballCanvas;