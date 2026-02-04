
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
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const currentGridSizeRef = useRef<number>(config.gridSize);
  const gridSignalSmoothRef = useRef<number>(0);
  const cellShapesRef = useRef<Map<string, SimulationConfig['dotShape']>>(new Map());
  const cellProgressRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
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

  const lerpColor = (c1: {r: number, g: number, b: number}, c2: {r: number, g: number, b: number}, t: number) => ({
    r: Math.floor(c1.r + (c2.r - c1.r) * t),
    g: Math.floor(c1.g + (c2.g - c1.g) * t),
    b: Math.floor(c1.b + (c2.b - c1.b) * t),
  });

  const hash = (i: number, j: number) => Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;

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
    if (config.motionMode !== 'image' || !config.imageSource) return;
    const img = new Image();
    img.onload = () => {
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
  }, [config.imageSource, config.motionMode, config.imageScale]);

  useEffect(() => {
    const count = Math.max(config.particleCount, 4);
    particlesRef.current = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      targetX: 0, targetY: 0,
      noiseX: Math.random() * 1000, noiseY: Math.random() * 1000,
      radius: config.baseRadius, scale: 0.8 + Math.random() * 0.4,
    }));
  }, [config.particleCount, dimensions]);

  const updateAndRender = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const centerX = width / 2; const centerY = height / 2;
    const virtualCX = centerX + config.offsetX; const virtualCY = centerY + config.offsetY;
    const cMain = hexToRgb(config.mainColor); const cEdge = hexToRgb(config.gradientColorEnd);

    timeRef.current += 0.01 * config.speed;
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

    currentGridSizeRef.current += (config.gridSize - currentGridSizeRef.current) * 0.15;

    particlesRef.current.forEach((p, i) => {
      const r = config.baseRadius * p.scale;
      const pMod = i / particlesRef.current.length;
      
      if (config.motionMode === 'audio') {
        const react = dataArrayRef.current ? dataArrayRef.current[Math.floor(pMod * dataArrayRef.current.length)] / 255 : 0;
        p.radius = config.audioReactiveRadius ? r * (1 + react * config.audioSensitivity) : r;
        
        // Removed dynamic rotation (domFreq based) as requested to avoid glitching
        // Using static pMod-based angle for a stable ring arrangement
        const angle = (pMod * Math.PI * 2);
        
        // Link Global Scale (baseRadius) to the ring radius so it controls the "whole graphic size"
        const rad = (config.baseRadius * 5) * config.patternScale;
        
        p.x = virtualCX + Math.cos(angle) * rad;
        p.y = virtualCY + Math.sin(angle) * rad;
      } else if (config.motionMode === 'cross') {
        const osc = Math.sin(t * config.oscSpeed); const amp = config.oscAmplitude * config.patternScale;
        const rot = config.crossRotation * (Math.PI / 180) + (t * 0.3);
        let lx = 0, ly = 0;
        if (i === 0) lx = -amp * Math.abs(osc); else if (i === 1) lx = amp * Math.abs(osc);
        else if (i === 2) ly = -amp * Math.abs(osc); else if (i === 3) ly = amp * Math.abs(osc);
        p.x = virtualCX + (lx * Math.cos(rot) - ly * Math.sin(rot));
        p.y = virtualCY + (lx * Math.sin(rot) + ly * Math.cos(rot));
        p.radius = r;
      } else if (config.motionMode === 'breath') {
        const osc = Math.sin(t * config.breathSpeed + p.noiseX);
        p.radius = r * (1.0 + osc * config.breathRange);
        p.x = virtualCX + noiseRef.current.noise(t * 0.2 + p.noiseX) * 100 * config.patternScale;
        p.y = virtualCY + noiseRef.current.noise(t * 0.2 + p.noiseY) * 100 * config.patternScale;
      } else {
        p.radius = r;
        const drift = config.motionRange * config.patternScale;
        p.x = virtualCX + noiseRef.current.noise(t * 0.3 + p.noiseX) * drift;
        p.y = virtualCY + noiseRef.current.noise(t * 0.3 + p.noiseY) * drift;
      }
    });

    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);

    const getInfluence = (x: number, y: number) => {
      let norm = 0; const minT = config.threshold - config.edgeLevel; const maxT = config.threshold + config.edgeLevel;
      const sx = ((x - virtualCX) / config.patternScale) + 300; 
      const sy = ((y - virtualCY) / config.patternScale) + 300;
      
      if (config.motionMode === 'character' && textDensityRef.current) {
        if (sx >= 0 && sx < 600 && sy >= 0 && sy < 600) {
          const charV = textDensityRef.current[(Math.floor(sy) * 600 + Math.floor(sx)) * 4] / 255;
          const inf = charV * config.threshold * 1.5;
          norm = inf > maxT ? 1 : (inf > minT ? (inf - minT) / (maxT - minT) : 0);
        }
      } else if (config.motionMode === 'image' && imageDensityRef.current) {
        if (sx >= 0 && sx < 600 && sy >= 0 && sy < 600) {
          const idx = (Math.floor(sy) * 600 + Math.floor(sx)) * 4;
          const dens = (0.299 * imageDensityRef.current[idx] + 0.587 * imageDensityRef.current[idx+1] + 0.114 * imageDensityRef.current[idx+2]) / 255 * (imageDensityRef.current[idx+3] / 255);
          const inf = dens * config.threshold * 1.5;
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
      const gSize = Math.max(4, currentGridSizeRef.current);
      const gap = config.gridGap;
      const halfCols = Math.ceil(centerX / gSize);
      const halfRows = Math.ceil(centerY / gSize);
      
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
            if (tShape === 'mixed') tShape = (config.mixedShapes[Math.floor(hash(i, j) * config.mixedShapes.length)] || 'roundedRect') as SimulationConfig['dotShape'];
            
            let curShape = cellShapesRef.current.get(key);
            let prog = cellProgressRef.current.get(key) ?? 1.0;
            if (curShape !== tShape) {
              prog = Math.max(0, prog - 0.2);
              if (prog <= 0) { cellShapesRef.current.set(key, tShape); prog = 0.01; }
            } else { prog = Math.min(1.0, prog + 0.15); }
            cellProgressRef.current.set(key, prog);

            const sz = Math.max(0, (gSize - gap) * Math.pow(norm, 0.6) * config.dotScale * prog * (config.motionMode === 'audio' ? (1 + aBass * 0.2) : 1));
            let color = config.tintMode === 'gradient' ? lerpColor(cMain, cEdge, Math.min(1, Math.sqrt((x-centerX)**2 + (y-centerY)**2) / (width/2))) : cMain;
            
            // Refined color boost logic: if color is white, avoid derivation that might look reddish
            const isWhite = config.mainColor.toLowerCase() === '#ffffff' || config.mainColor.toLowerCase() === '#fff';
            const boost = isWhite ? 0 : 0.4;
            const r = Math.min(255, color.r + (255 - color.r) * norm * boost);
            const g = Math.min(255, color.g + (255 - color.g) * norm * boost);
            const b = Math.min(255, color.b + (255 - color.b) * norm * boost);
            
            ctx.fillStyle = `rgb(${r},${g},${b})`; 
            ctx.strokeStyle = `rgb(${r},${g},${b})`;
            ctx.lineWidth = 1.2;

            const shape = cellShapesRef.current.get(key);
            ctx.beginPath();
            if (shape === 'circle') ctx.arc(x, y, sz/2, 0, Math.PI*2);
            else if (shape === 'cross') { const th = sz*0.25; ctx.fillRect(x-sz/2, y-th/2, sz, th); ctx.fillRect(x-th/2, y-sz/2, th, sz); }
            else if (shape === 'triangle') { ctx.moveTo(x, y-sz*0.45); ctx.lineTo(x-sz/2, y+sz*0.45); ctx.lineTo(x+sz/2, y+sz*0.45); ctx.closePath(); }
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
              ctx.arc(x-sz*0.1, y+sz*0.2, sz*0.15, 0, Math.PI*2); ctx.fill();
              ctx.beginPath(); ctx.rect(x+sz*0.05, y-sz*0.3, sz*0.05, sz*0.5); ctx.fill();
              ctx.beginPath(); ctx.rect(x-sz*0.1, y-sz*0.3, sz*0.2, sz*0.1);
            } else if (shape === 'gear') {
              ctx.arc(x, y, sz*0.3, 0, Math.PI*2); ctx.stroke();
              for(let k=0; k<8; k++){ ctx.beginPath(); ctx.arc(x+Math.cos(k*Math.PI/4)*sz*0.4, y+Math.sin(k*Math.PI/4)*sz*0.4, sz*0.08, 0, Math.PI*2); ctx.fill(); }
            } else if (shape === 'eye') {
              ctx.ellipse(x, y, sz*0.5, sz*0.3, 0, 0, Math.PI*2); ctx.stroke();
              ctx.beginPath(); ctx.arc(x, y, sz*0.2, 0, Math.PI*2); ctx.fill();
            } else if (shape === 'xpeng') {
              const s = sz * 0.5; const gX = s * 0.08; const gY = s * 0.08;
              ctx.moveTo(x+gX, y-gY); ctx.lineTo(x+s*0.9, y-s*0.45); ctx.lineTo(x+s*0.45, y-gY); ctx.fill();
              ctx.moveTo(x+gX, y+gY); ctx.lineTo(x+s*0.9, y+s*0.45); ctx.lineTo(x+s*0.45, y+gY); ctx.fill();
              ctx.moveTo(x-gX, y-gY); ctx.lineTo(x-s*0.9, y-s*0.45); ctx.lineTo(x-s*0.45, y-gY); ctx.fill();
              ctx.moveTo(x-gX, y+gY); ctx.lineTo(x-s*0.9, y+s*0.45); ctx.lineTo(x-s*0.45, y+gY);
            } else {
              ctx.roundRect(x-sz/2, y-sz/2, sz, sz, sz*0.3);
            }
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
            let color = config.tintMode === 'gradient' ? lerpColor(cMain, cEdge, Math.min(1, Math.sqrt((x-centerX)**2 + (y-centerY)**2) / (width/2))) : cMain;
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
    <div className="fixed inset-0 bg-black overflow-hidden">
      <canvas ref={canvasRef} width={dimensions.width} height={dimensions.height} className="w-full h-full block" />
    </div>
  );
};

export default MetaballCanvas;
