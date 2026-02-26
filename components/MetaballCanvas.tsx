import React, { useRef, useEffect, useState } from 'react';
import { SimulationConfig, Particle, MathPattern } from '../types';
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

  // Horizontal Rectangle Aspect Ratio: 2:1
  const TARGET_RATIO = 2;

  const [dimensions, setDimensions] = useState({
    width: window.innerHeight * 2,
    height: window.innerHeight
  });

  const customIconImgsRef = useRef<(HTMLImageElement | null)[]>(Array(10).fill(null));
  const libraryIconImgRef = useRef<HTMLImageElement | null>(null);
  const hmsLowIconRef = useRef<HTMLImageElement | null>(null);
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
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

  const lerpColor = (c1: { r: number, g: number, b: number }, c2: { r: number, g: number, b: number }, t: number) => ({
    r: Math.floor(c1.r + (c2.r - c1.r) * t),
    g: Math.floor(c1.g + (c2.g - c1.g) * t),
    b: Math.floor(c1.b + (c2.b - c1.b) * t),
  });

  const hash = (i: number, j: number) => Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;

  useEffect(() => {
    const loadImage = (src: string, callback: (img: HTMLImageElement) => void) => {
      if (imageCacheRef.current.has(src)) {
        callback(imageCacheRef.current.get(src)!);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        imageCacheRef.current.set(src, img);
        callback(img);
      };
      img.onerror = (e) => {
        console.error(`Failed to load icon: ${src}`, e);
      };
      img.src = src;
    };

    config.customIconSources.forEach((src, idx) => {
      if (src) {
        loadImage(src, (img) => { customIconImgsRef.current[idx] = img; });
      } else {
        customIconImgsRef.current[idx] = null;
      }
    });

    // Fallback: If legacy activeLibraryIcon is set but not in sources, try to load it into slot 0
    // This maintains backward compatibility if Controls logic pushes solely to activeLibraryIcon
    if (config.activeLibraryIcon && !config.customIconSources[0]) {
      loadImage(config.activeLibraryIcon, (img) => {
        libraryIconImgRef.current = img;
        if (!customIconImgsRef.current[0]) customIconImgsRef.current[0] = img;
      });
    } else {
      libraryIconImgRef.current = null;
    }

    loadImage('/icon/warning.png', (img) => {
      hmsLowIconRef.current = img;
    });
  }, [config.customIconSources, config.activeLibraryIcon]);

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
      vx: 0, vy: 0,
      noiseX: Math.random() * 1000, noiseY: Math.random() * 1000,
      radius: config.baseRadius, scale: 0.8 + Math.random() * 0.4,
      angle: Math.random() * Math.PI * 2,
      z: 1,
      id: i,
      lx: (Math.random() - 0.5) * 20,
      ly: (Math.random() - 0.5) * 20,
      lz: (Math.random() - 0.5) * 20 + 20
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
    } else if (config.motionMode === 'simAudio') {
      aBass = (noiseRef.current.noise(t * 2.0) + 0.5) * 0.5 * config.audioSensitivity;
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

    const dt = 1.0; // Normalizing dt to 1.0 as the original code expects for its physics
    const flockSnapshot = config.motionMode === 'pattern' && config.pattern === MathPattern.FLOCK ? [...particlesRef.current] : [];

    const rotate3D = (x: number, y: number, z: number, rx: number, ry: number) => {
      let x1 = x * Math.cos(ry) - z * Math.sin(ry);
      let z1 = x * Math.sin(ry) + z * Math.cos(ry);
      let y2 = y * Math.cos(rx) - z1 * Math.sin(rx);
      let z2 = y * Math.sin(rx) + z1 * Math.cos(rx);
      return { x: x1, y: y2, z: z2 };
    };

    particlesRef.current.forEach((p, i) => {
      const r = (smoothedParams.current.baseRadius * viewScale) * p.scale;
      const pMod = i / particlesRef.current.length;
      let tx = p.x, ty = p.y;
      let hasTarget = false;
      let springStrength = 4.0;
      let damping = 0.92;

      if (config.motionMode === 'audio' || config.motionMode === 'simAudio') {
        const react = config.motionMode === 'audio'
          ? (dataArrayRef.current ? dataArrayRef.current[Math.floor(pMod * dataArrayRef.current.length)] / 255 : 0)
          : (noiseRef.current.noise(t * 4.0 + i) + 1) * 0.5;

        p.radius = config.audioReactiveRadius ? r * (1 + react * config.audioSensitivity) : r;
        const angle = (pMod * Math.PI * 2);
        const rad = (smoothedParams.current.baseRadius * 5 * viewScale) * smoothedParams.current.patternScale;
        tx = virtualCX + Math.cos(angle) * rad;
        ty = virtualCY + Math.sin(angle) * rad;
        hasTarget = true;
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
        hasTarget = true;
      } else if (config.motionMode === 'breath') {
        const osc = Math.sin(t * config.breathSpeed + p.noiseX);
        p.radius = r * (1.0 + osc * config.breathRange);
        tx = virtualCX + noiseRef.current.noise(t * 0.2 + p.noiseX) * 100 * viewScale * smoothedParams.current.patternScale;
        ty = virtualCY + noiseRef.current.noise(t * 0.2 + p.noiseY) * 100 * viewScale * smoothedParams.current.patternScale;
        hasTarget = true;
      } else if (config.motionMode === 'pattern') {
        const patternScale = smoothedParams.current.patternScale * viewScale;
        const cx = virtualCX;
        const cy = virtualCY;
        const count = particlesRef.current.length;

        switch (config.pattern) {
          case MathPattern.VORTEX: {
            hasTarget = true;
            const angleSpeed = 0.5;
            const orbitRadius = Math.min(width, height) * 0.35 * patternScale;
            const angle = (p.id / count) * Math.PI * 2 * 3 + t * angleSpeed;
            const spiralR = orbitRadius + Math.sin(angle * 2 + t) * 50 * patternScale;
            tx = cx + Math.cos(angle) * spiralR;
            ty = cy + Math.sin(angle) * spiralR;
            tx += Math.cos(t * 2 + p.id) * 30 * patternScale;
            ty += Math.sin(t * 3 + p.id) * 30 * patternScale;
            springStrength = 2.0; damping = 0.95; p.z = 1 + Math.sin(angle) * 0.2;
            break;
          }
          case MathPattern.WAVE: {
            hasTarget = true;
            const spacing = (width * patternScale) / (count - 1);
            const waveX = p.id * spacing;
            const phase = waveX * 0.01 + t;
            tx = cx - (width * patternScale) / 2 + waveX;
            ty = cy + Math.sin(phase) * (height * 0.25 * patternScale) + Math.cos(phase * 2) * 50 * patternScale;
            springStrength = 4.0; p.z = 1 + Math.cos(phase) * 0.2;
            break;
          }
          case MathPattern.PHYLLOTAXIS: {
            hasTarget = true;
            const angle = p.id * 137.5 * (Math.PI / 180);
            const spread = r * 1.5 * patternScale;
            const rad = spread * Math.sqrt(p.id) * (1 + Math.sin(t * 0.5) * 0.1);
            const rotation = t * 0.1;
            tx = cx + rad * Math.cos(angle + rotation);
            ty = cy + rad * Math.sin(angle + rotation);
            springStrength = 4.0; p.z = 1 + (count - p.id) / count * 0.5;
            break;
          }
          case MathPattern.GRID_WAVE: {
            hasTarget = true;
            const cols = Math.ceil(Math.sqrt(count));
            const rows = Math.ceil(count / cols);
            const padding = Math.min(width, height) / cols * 0.8 * patternScale;
            const offsetX = cx - (cols * padding) / 2 + padding / 2;
            const offsetY = cy - (rows * padding) / 2 + padding / 2;
            const col = p.id % cols; const row = Math.floor(p.id / cols);
            const distCenter = Math.sqrt(Math.pow(col - cols / 2, 2) + Math.pow(row - rows / 2, 2));
            const zOff = Math.sin(distCenter * 0.8 - t * 3);
            tx = offsetX + col * padding; ty = offsetY + row * padding + zOff * 20 * patternScale;
            p.z = 1 + zOff * 0.3; springStrength = 5.0;
            break;
          }
          case MathPattern.TUNNEL: {
            const maxDist = Math.max(width, height) * 0.8 * patternScale;
            const dx = p.x - cx; const dy = p.y - cy; const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist || dist < 10) {
              const angle = Math.random() * Math.PI * 2;
              p.x = cx + Math.cos(angle) * 10; p.y = cy + Math.sin(angle) * 10;
              p.vx = Math.cos(angle) * 50; p.vy = Math.sin(angle) * 50; p.z = 0.1;
            } else {
              const angle = Math.atan2(dy, dx); const speed = dist * 2 * 0.01;
              p.vx += Math.cos(angle + t) * speed * 20; p.vy += Math.sin(angle + t) * speed * 20;
              p.z = dist / (200 * patternScale);
            }
            damping = 0.95; break;
          }
          case MathPattern.DNA_HELIX: {
            hasTarget = true;
            const pairId = Math.floor(p.id / 2); const strand = p.id % 2 === 0 ? 1 : -1;
            const yPos = (pairId / (count / 2)) * (height * 0.8 * patternScale) - (height * 0.4 * patternScale);
            const xAmp = width * 0.15 * patternScale; const rot = t * 2 + yPos * 0.01;
            tx = cx + Math.sin(rot) * xAmp * strand; ty = cy + yPos;
            const depth = Math.cos(rot) * strand; p.z = 1 + depth * 0.4; springStrength = 6.0;
            break;
          }
          case MathPattern.SPHERE: {
            hasTarget = true;
            const phi = Math.acos(1 - 2 * (p.id + 0.5) / count);
            const theta = Math.PI * (1 + Math.sqrt(5)) * (p.id + 0.5);
            const spinR = Math.min(width, height) * 0.35 * patternScale;
            const sx = spinR * Math.sin(phi) * Math.cos(theta);
            const sy = spinR * Math.sin(phi) * Math.sin(theta);
            const sz = spinR * Math.cos(phi);
            const rot = rotate3D(sx, sy, sz, t * 0.5, t * 0.3);
            const perspective = 500 / (500 - rot.z);
            tx = cx + rot.x * perspective; ty = cy + rot.y * perspective;
            p.z = perspective; springStrength = 4.0;
            break;
          }
          case MathPattern.LISSAJOUS: {
            hasTarget = true;
            const A = width * 0.35 * patternScale; const B = height * 0.35 * patternScale;
            const delta = p.id * (Math.PI / count) * 2;
            tx = cx + A * Math.sin(t + delta); ty = cy + B * Math.sin(2 * t + delta) * 0.5;
            const lz = Math.cos(3 * t + delta) * 100 * patternScale;
            const perspective = 500 / (500 - lz);
            tx = (tx - cx) * perspective + cx; ty = (ty - cy) * perspective + cy;
            p.z = perspective; break;
          }
          case MathPattern.TORUS: {
            hasTarget = true;
            const R = Math.min(width, height) * 0.25 * patternScale;
            const tr = Math.min(width, height) * 0.1 * patternScale;
            const rings = 20; const ringSize = Math.ceil(count / rings);
            const u = (p.id % rings) / rings * Math.PI * 2;
            const v = Math.floor(p.id / rings) / ringSize * Math.PI * 2;
            const animU = u + t; const animV = v + t * 2;
            let tax = (R + tr * Math.cos(animV)) * Math.cos(animU);
            let tay = (R + tr * Math.cos(animV)) * Math.sin(animU);
            let taz = tr * Math.sin(animV);
            const rot = rotate3D(tax, tay, taz, t * 0.4, t * 0.2);
            const scale = 500 / (500 - rot.z);
            tx = cx + rot.x * scale; ty = cy + rot.y * scale; p.z = scale;
            break;
          }
          case MathPattern.ATOMIC: {
            hasTarget = true;
            const shell = (p.id % 3) + 1; const ar = shell * 80 * patternScale;
            const speed = (4 - shell) * 1.5; const planeTiltX = p.id * 123.45; const planeTiltY = p.id * 67.89;
            const angle = t * speed + p.id;
            let ax = ar * Math.cos(angle); let ay = ar * Math.sin(angle);
            const rot = rotate3D(ax, ay, 0, planeTiltX, planeTiltY);
            const globalRot = rotate3D(rot.x, rot.y, rot.z, t * 0.2, t * 0.1);
            const scale = 500 / (500 - globalRot.z);
            tx = cx + globalRot.x * scale; ty = cy + globalRot.y * scale;
            p.z = scale; springStrength = 3.0;
            break;
          }
          case MathPattern.FLOW_FIELD: {
            const flowScale = 0.005 / patternScale;
            const angle = Math.sin(p.x * flowScale + t * 0.5) + Math.cos(p.y * flowScale + t * 0.5);
            const fieldForce = 2000 * patternScale;
            p.vx += Math.cos(angle * Math.PI) * fieldForce * 0.01;
            p.vy += Math.sin(angle * Math.PI) * fieldForce * 0.01;
            damping = 0.94; p.z = 1; break;
          }
          case MathPattern.GALAXY: {
            hasTarget = true;
            const arms = 3; const armIdx = p.id % arms;
            const partIdx = Math.floor(p.id / arms); const maxP = Math.floor(count / arms);
            const gr = (partIdx / maxP) * (Math.min(width, height) * 0.45 * patternScale);
            const angle = armIdx * (Math.PI * 2 / arms) + (gr * 0.01 * 2 / patternScale) - t;
            const noise = (Math.sin(p.id * 99) * 20 * patternScale);
            tx = cx + Math.cos(angle) * (gr + noise); ty = cy + Math.sin(angle) * (gr + noise);
            const tilt = rotate3D(tx - cx, ty - cy, 0, 1.0, 0);
            tx = cx + tilt.x; ty = cy + tilt.y; p.z = 1 + (tilt.z / 500); springStrength = 3.0;
            break;
          }
          case MathPattern.ROSE_CURVE: {
            hasTarget = true;
            const k = 4; const rs = Math.min(width, height) * 0.4 * patternScale;
            const theta = (p.id / count) * Math.PI * 2 * 2 + t * 0.5;
            const rr = rs * Math.cos(k * theta);
            tx = cx + rr * Math.cos(theta); ty = cy + rr * Math.sin(theta);
            p.z = 1 + Math.sin(theta * k * 2) * 0.3; springStrength = 3.0; break;
          }
          case MathPattern.LORENTZ: {
            hasTarget = true;
            const sigma = 10; const rho = 28; const beta = 8 / 3;
            const dxL = sigma * (p.ly! - p.lx!);
            const dyL = p.lx! * (rho - p.lz!) - p.ly!;
            const dzL = p.lx! * p.ly! - beta * p.lz!;
            p.lx! += dxL * 0.01; p.ly! += dyL * 0.01; p.lz! += dzL * 0.01;
            const ls = 15 * patternScale;
            const rot = rotate3D(p.lx!, p.ly!, p.lz! - 25, t * 0.3, t * 0.2);
            tx = cx + rot.x * ls; ty = cy + rot.y * ls; p.z = 1 + rot.z / 50; springStrength = 10.0;
            break;
          }
          case MathPattern.SPIROGRAPH: {
            hasTarget = true;
            const SR = Math.min(width, height) * 0.25 * patternScale;
            const sr = SR * 0.6; const sd = sr * 0.8;
            const theta = (p.id / count) * Math.PI * 2 * 10 + t;
            const diff = SR - sr;
            const sx = diff * Math.cos(theta) + sd * Math.cos((diff / sr) * theta);
            const sy = diff * Math.sin(theta) - sd * Math.sin((diff / sr) * theta);
            tx = cx + sx; ty = cy + sy; p.z = 1 + Math.sin(theta) * 0.2; springStrength = 4.0;
            break;
          }
          case MathPattern.CHLADNI: {
            const cs = 0.01 / patternScale;
            const xx = (p.x - cx) * cs; const yy = (p.y - cy) * cs;
            const n = 2; const m = 5;
            const val = Math.cos(n * xx) * Math.cos(m * yy) - Math.cos(m * xx) * Math.cos(n * yy);
            const delta = 0.01;
            const valX = Math.cos(n * (xx + delta)) * Math.cos(m * yy) - Math.cos(m * (xx + delta)) * Math.cos(n * yy);
            const valY = Math.cos(n * xx) * Math.cos(m * (yy + delta)) - Math.cos(m * xx) * Math.cos(n * (yy + delta));
            const gradX = (valX - val) / delta; const gradY = (valY - val) / delta;
            p.vx += -2 * val * gradX * 50 * patternScale; p.vy += -2 * val * gradY * 50 * patternScale;
            p.vx -= (p.x - cx) * 0.01; p.vy -= (p.y - cy) * 0.01; damping = 0.9; break;
          }
          case MathPattern.AMOEBA: {
            hasTarget = true;
            const angle = (p.id / count) * Math.PI * 2;
            const arad = (Math.min(width, height) * 0.25 * patternScale) +
              Math.sin(angle * 3 + t) * 30 * patternScale +
              Math.sin(angle * 7 - t * 2) * 15 * patternScale +
              Math.cos(angle * 2 + t * 0.5) * 40 * patternScale;
            tx = cx + Math.cos(angle + t * 0.2) * arad; ty = cy + Math.sin(angle + t * 0.2) * arad;
            p.z = 1 + Math.sin(angle * 5 + t) * 0.1; springStrength = 5.0; break;
          }
          case MathPattern.FLOCK: {
            const perception = 200 * patternScale;
            let sx = 0, sy = 0, tot = 0, avx = 0, avy = 0, cmx = 0, cmy = 0;
            for (let other of flockSnapshot) {
              if (other.id !== p.id) {
                const d = Math.sqrt((p.x - other.x) ** 2 + (p.y - other.y) ** 2);
                if (d < perception) {
                  sx += (p.x - other.x) / (d ** 2 + 0.1); sy += (p.y - other.y) / (d ** 2 + 0.1);
                  avx += other.vx; avy += other.vy; cmx += other.x; cmy += other.y; tot++;
                }
              }
            }
            if (tot > 0) {
              p.vx += (sx / tot) * 80 * patternScale; p.vy += (sy / tot) * 80 * patternScale;
              p.vx += ((avx / tot) - p.vx) * 0.02; p.vy += ((avy / tot) - p.vy) * 0.02;
              p.vx += ((cmx / tot) - p.x) * 0.01; p.vy += ((cmy / tot) - p.y) * 0.01;
            }
            const margin = 100 * patternScale;
            if (p.x < cx - width / 2 + margin) p.vx += 1; if (p.x > cx + width / 2 - margin) p.vx -= 1;
            if (p.y < cy - height / 2 + margin) p.vy += 1; if (p.y > cy + height / 2 - margin) p.vy -= 1;
            p.vx += (Math.random() - 0.5) * 0.5; p.vy += (Math.random() - 0.5) * 0.5;
            damping = 0.98; p.z = 1; break;
          }
          case MathPattern.MITOSIS: {
            hasTarget = true;
            const split = (Math.sin(t * 0.5) + 1) * 0.5;
            const sep = split * (width * 0.4 * patternScale);
            const targetCX = (p.id % 2 === 0) ? cx - sep / 2 : cx + sep / 2;
            const sysAngle = t * 0.2; const relX = targetCX - cx;
            const finalCX = cx + relX * Math.cos(sysAngle);
            const finalCY = cy + relX * Math.sin(sysAngle);
            const blobAngle = p.id * 10 + t;
            const blobR = (80 + Math.sin(p.id * 5 + t * 2) * 20) * patternScale;
            tx = finalCX + Math.cos(blobAngle) * blobR; ty = finalCY + Math.sin(blobAngle) * blobR;
            springStrength = 3.0; p.z = 1; break;
          }
          case MathPattern.LINEAR_MITOSIS: {
            hasTarget = true;
            const split = (Math.sin(t * 0.8) + 1) * 0.5;
            const sep = split * (width * config.linearMitosisRange * patternScale);
            const side = (p.id % 2 === 0) ? -1 : 1;
            const clusterCX = cx + (side * sep / 2);
            const internalAngle = (Math.floor(p.id / 2) / (count / 2)) * Math.PI * 2;
            const internalR = 70 * patternScale;
            tx = clusterCX + Math.cos(internalAngle) * internalR;
            ty = cy + Math.sin(internalAngle) * internalR;
            springStrength = 4.0; p.z = 1; break;
          }
          case MathPattern.HEARTBEAT: {
            hasTarget = true;
            const u = (p.id / count) * Math.PI * 2; const hs = 12 * patternScale;
            let hx = 16 * Math.pow(Math.sin(u), 3);
            let hy = -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u));
            const beat = 1 + Math.pow(Math.sin(t * 3), 63) * 0.3 + Math.sin(t * 3) * 0.1;
            hx *= hs * beat; hy *= hs * beat;
            const rot = rotate3D(hx, hy, 0, 0, t * 0.5);
            tx = cx + rot.x; ty = cy + rot.y; p.z = 1 + (Math.sin(u) * 0.2 + rot.z * 0.01) * beat;
            springStrength = 5.0; break;
          }
          case MathPattern.SUPER_ELLIPSE: {
            hasTarget = true;
            const pmSpeed = 1.5;
            const cycle = t * pmSpeed;
            const val = Math.sin(cycle);

            let n = 2;
            let r_se = Math.min(width, height) * 0.25 * patternScale;
            let cyOffset = 0;

            if (val < 0) {
              const k = -val;
              cyOffset = -config.superEllipseRange * k * patternScale;
              n = 1 + k;
            } else {
              const k = val;
              cyOffset = config.superEllipseRange * k * patternScale;
              n = 1;
              r_se = r_se * (1 - k);
            }

            const theta = (p.id / count) * Math.PI * 2;
            const cos = Math.cos(theta);
            const sin = Math.sin(theta);
            const x = r_se * Math.sign(cos) * Math.pow(Math.abs(cos), 2 / n);
            const y = r_se * Math.sign(sin) * Math.pow(Math.abs(sin), 2 / n);

            tx = cx + x;
            ty = cy + cyOffset + y;

            p.z = 1 + (1 - r_se / (Math.min(width, height) * 0.25 * patternScale + 0.001)) * 0.5 + Math.sin(theta * 5 + t) * 0.1;
            springStrength = 6.0;
            break;
          }
        }
      } else {
        p.radius = r;
        const drift = config.motionRange * viewScale * smoothedParams.current.patternScale;
        tx = virtualCX + noiseRef.current.noise(t * 0.3 + p.noiseX) * drift;
        ty = virtualCY + noiseRef.current.noise(t * 0.3 + p.noiseY) * drift;
        hasTarget = true;
      }

      if (hasTarget) {
        const dx = tx - p.x; const dy = ty - p.y;
        p.vx += dx * springStrength * 0.01;
        p.vy += dy * springStrength * 0.01;
      }

      p.vx *= damping; p.vy *= damping;
      p.x += p.vx; p.y += p.vy;

      if (!hasTarget && config.motionMode === 'pattern') {
        const margin = 100 * viewScale;
        if (p.x < -margin) p.x = width + margin; if (p.x > width + margin) p.x = -margin;
        if (p.y < -margin) p.y = height + margin; if (p.y > height + margin) p.y = -margin;
      }

      p.scale = (config.motionMode === 'pattern') ? p.z : 1.0;
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
          const dens = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255 * (data[idx + 3] / 255);
          const inf = dens * smoothedParams.current.threshold * 1.5 * (1 + pulse);
          norm = inf > maxT ? 1 : (inf > minT ? (inf - minT) / (maxT - minT) : 0);
        }
      } else {
        let inf = 0;
        for (const p of particlesRef.current) {
          const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
          if (d2 > 0) inf += (p.radius * p.radius) / d2;
        }
        norm = inf > maxT ? 1 : (inf > minT ? (inf - minT) / (maxT - minT) : 0);
      }
      return norm;
    };

    if (config.enableHalftone) {
      let baseGridSize = smoothedParams.current.gridSize;

      if (config.syncGridSize && config.motionMode === 'pattern') {
        let factor = 0;
        let active = false;

        if (config.pattern === MathPattern.LINEAR_MITOSIS) {
          factor = (Math.sin(t * 0.8) + 1) * 0.5;
          active = true;
        } else if (config.pattern === MathPattern.SUPER_ELLIPSE) {
          const pmSpeed = 1.5;
          const val = Math.sin(t * pmSpeed);
          // For Super Ellipse: clusters are "expanded" when val < 0 (n increases) or val is near -1
          // They are "shrunk" when val > 0 (n=1, r_se decreases)
          // Let's map expansion (max size) to val = -1 and shrinkage (min size) to val = 1
          factor = (val + 1) * 0.5; // val=-1 -> factor=0 (max size), val=1 -> factor=1 (min size)
          // Wait, users prompt said: 120 (max) when expand, 80 (min) when shrink.
          // In my previous implementation: baseGridSize = 120 + (80 - 120) * eased;
          // So if factor=0, baseGridSize=120. If factor=1, baseGridSize=80.
          // This mapping is consistent. factor=0 (expanded), factor=1 (shrunk)
          active = true;
        }

        if (active) {
          let eased = factor;
          const it = config.interpolationType;
          if (it === 'easeIn') eased = factor * factor;
          else if (it === 'easeOut') eased = 1 - Math.pow(1 - factor, 2);
          else if (it === 'easeInOut') eased = factor < 0.5 ? 2 * factor * factor : 1 - Math.pow(-2 * factor + 2, 2) / 2;
          else if (it === 'step') eased = factor < 0.5 ? 0 : 1;

          baseGridSize = config.maxGridSize + (config.minGridSize - config.maxGridSize) * eased;
        }
      }

      if ((config.motionMode === 'audio' || config.motionMode === 'simAudio') && config.audioReactiveGrid) {
        baseGridSize *= (1 + aBass * config.audioGridSensitivity * 0.15);
      }

      const gSize = Math.max(4, baseGridSize) * viewScale;
      const gap = config.gridGap * viewScale;
      const halfCols = Math.ceil(centerX / gSize);
      const halfRows = Math.ceil(centerY / gSize);
      const maxRadius = Math.sqrt(centerX ** 2 + centerY ** 2);

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
              const d = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) / maxRadius;
              const prob = Math.min(1.0, config.hmsDistribution * Math.pow(d, 4.5 - config.hmsDistribution));
              if (hash(i, j) < prob) tShape = 'HMS';
            }

            if (config.hmsLowEnabled && tShape === config.dotShape) {
              const d = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) / maxRadius;
              const prob = Math.min(1.0, config.hmsLowDistribution * Math.pow(d, 4.5 - config.hmsLowDistribution));
              if (hash(i + 500, j + 500) < prob) tShape = 'HMS_LOW';
            }

            if (config.chargingEnabled && tShape !== 'HMS' && tShape !== 'HMS_LOW') {
              const d = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2) / maxRadius;
              const prob = Math.min(1.0, config.chargingDistribution * Math.pow(d, 4.5 - config.chargingDistribution));
              if (hash(i + 1000, j + 1000) < prob) tShape = 'CHARGING';
            }

            if (tShape === 'mixed') {
              const shapesToCheck = config.mixedShapes && config.mixedShapes.length > 0 ? config.mixedShapes : ['roundedRect'];
              tShape = (shapesToCheck[Math.floor(hash(i, j) * shapesToCheck.length)] || 'roundedRect') as SimulationConfig['dotShape'];
            }

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
            const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            const gradRadius = Math.min(width, height) / 2;
            let color = config.tintMode === 'gradient' ? lerpColor(cMain, cEnd, Math.min(1, distFromCenter / gradRadius)) : cMain;

            const isWhite = config.mainColor.toLowerCase() === '#ffffff' || config.mainColor.toLowerCase() === '#fff';
            const boost = isWhite ? 0 : 0.4;
            const r = Math.min(255, color.r + (255 - color.r) * norm * boost);
            const g = Math.min(255, color.g + (255 - color.g) * norm * boost);
            const b = Math.min(255, color.b + (255 - color.b) * norm * boost);

            const shape = cellShapesRef.current.get(key) || tShape;

            if (shape === 'HMS') {
              ctx.fillStyle = config.hmsColor; ctx.strokeStyle = config.hmsColor;
            } else if (shape === 'HMS_LOW') {
              ctx.fillStyle = config.hmsLowColor; ctx.strokeStyle = config.hmsLowColor;
            } else if (shape === 'CHARGING') {
              ctx.fillStyle = config.chargingColor; ctx.strokeStyle = config.chargingColor;
            } else {
              ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.strokeStyle = `rgb(${r},${g},${b})`;
            }

            ctx.lineWidth = Math.max(1, sz * 0.1);
            ctx.beginPath();
            if (shape === 'circle') ctx.arc(x, y, sz / 2, 0, Math.PI * 2);
            else if (shape === 'cross') { const th = sz * 0.3; ctx.fillRect(x - sz / 2, y - th / 2, sz, th); ctx.fillRect(x - th / 2, y - sz / 2, th, sz); }
            else if (shape === 'minus') { const th = sz * 0.25; ctx.fillRect(x - sz / 2, y - th / 2, sz, th); }
            else if (shape === 'divide') {
              const th = sz * 0.15; const dotR = sz * 0.12;
              ctx.fillRect(x - sz / 2, y - th / 2, sz, th);
              ctx.beginPath(); ctx.arc(x, y - sz * 0.35, dotR, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(x, y + sz * 0.35, dotR, 0, Math.PI * 2); ctx.fill();
            }
            else if (shape === 'triangle') { ctx.moveTo(x, y - sz * 0.45); ctx.lineTo(x - sz / 2, y + sz * 0.45); ctx.lineTo(x + sz / 2, y + sz * 0.45); ctx.closePath(); }
            else if (shape === 'hexagon') {
              ctx.save(); ctx.translate(x, y); ctx.beginPath();
              for (let k = 0; k < 6; k++) { const angle = k * Math.PI / 3; ctx.lineTo(Math.cos(angle) * sz / 2, Math.sin(angle) * sz / 2); }
              ctx.closePath(); ctx.fill(); ctx.restore();
            }
            else if (shape === 'smiley') {
              ctx.arc(x, y, sz / 2, 0, Math.PI * 2); ctx.stroke();
              ctx.beginPath(); ctx.arc(x - sz * 0.15, y - sz * 0.1, sz * 0.05, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(x + sz * 0.15, y - sz * 0.1, sz * 0.05, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.arc(x, y + sz * 0.05, sz * 0.2, 0, Math.PI); ctx.stroke();
            } else if (shape === 'heart') {
              const h = sz * 0.5; ctx.moveTo(x, y + h * 0.5);
              ctx.bezierCurveTo(x - h, y - h * 0.2, x - h * 0.5, y - h, x, y - h * 0.2);
              ctx.bezierCurveTo(x + h * 0.5, y - h, x + h, y - h * 0.2, x, y + h * 0.5);
            } else if (shape === 'star') {
              let rot = Math.PI / 2 * 3; let step = Math.PI / 5; ctx.moveTo(x, y - sz / 2);
              for (let k = 0; k < 5; k++) {
                ctx.lineTo(x + Math.cos(rot) * sz / 2, y + Math.sin(rot) * sz / 2); rot += step;
                ctx.lineTo(x + Math.cos(rot) * sz / 4, y + Math.sin(rot) * sz / 4); rot += step;
              }
            } else if (shape === 'music') {
              ctx.save(); ctx.translate(x, y);
              const noteHeadW = sz * 0.18; const noteHeadH = sz * 0.12; const stemH = sz * 0.55;
              ctx.save(); ctx.rotate(-Math.PI / 8);
              ctx.beginPath(); ctx.ellipse(-sz * 0.2, sz * 0.25, noteHeadW, noteHeadH, 0, 0, Math.PI * 2); ctx.fill();
              ctx.beginPath(); ctx.ellipse(sz * 0.1, sz * 0.25, noteHeadW, noteHeadH, 0, 0, Math.PI * 2); ctx.fill();
              ctx.restore();
              ctx.fillRect(-sz * 0.03, -sz * 0.3, sz * 0.08, stemH); ctx.fillRect(sz * 0.27, -sz * 0.3, sz * 0.08, stemH);
              ctx.beginPath(); ctx.moveTo(-sz * 0.03, -sz * 0.3); ctx.lineTo(sz * 0.35, -sz * 0.3); ctx.lineTo(sz * 0.35, -sz * 0.18); ctx.lineTo(-sz * 0.03, -sz * 0.18); ctx.closePath(); ctx.fill();
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
            } else if (shape === 'HMS_LOW') {
              const img = hmsLowIconRef.current;
              if (img && osCtx) {
                const ratio = Math.min(sz / img.width, sz / img.height);
                const dw = Math.ceil(img.width * ratio); const dh = Math.ceil(img.height * ratio);
                if (dw > 0 && dh > 0) {
                  osC.width = dw; osC.height = dh; osCtx.clearRect(0, 0, dw, dh); osCtx.drawImage(img, 0, 0, dw, dh);
                  osCtx.globalCompositeOperation = 'source-in'; ctx.fillStyle = config.hmsLowColor; osCtx.fillStyle = config.hmsLowColor; osCtx.fillRect(0, 0, dw, dh);
                  osCtx.globalCompositeOperation = 'source-over'; ctx.drawImage(osC, x - dw / 2, y - dh / 2);
                }
              } else {
                const th = sz * 0.2; ctx.save(); ctx.translate(x, y);
                ctx.fillRect(-th / 2, -sz * 0.45, th, sz * 0.6);
                ctx.beginPath(); ctx.arc(0, sz * 0.35, th / 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
              }
            } else if (shape === 'electric' || shape === 'CHARGING') {
              ctx.save(); ctx.translate(x, y); ctx.beginPath();
              ctx.moveTo(sz * 0.1, -sz * 0.5); ctx.lineTo(-sz * 0.4, sz * 0.05); ctx.lineTo(sz * 0.1, sz * 0.05);
              ctx.lineTo(-sz * 0.1, sz * 0.5); ctx.lineTo(sz * 0.35, -sz * 0.05); ctx.lineTo(-sz * 0.1, -sz * 0.05);
              ctx.closePath(); ctx.fill(); ctx.restore();
            } else if (shape === 'eye') {
              ctx.ellipse(x, y, sz * 0.5, sz * 0.3, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, sz * 0.2, 0, Math.PI * 2); ctx.fill();
            } else if (shape === 'xpeng') {
              const g = sz * 0.045;
              const drawWing = (dirX: number, dirY: number) => {
                ctx.save(); ctx.translate(x + g * dirX, y + g * dirY); ctx.scale(dirX, dirY); ctx.beginPath();
                ctx.moveTo(0, 0); ctx.lineTo(0, sz * 0.15); ctx.lineTo(sz * 0.48, sz * 0.38); ctx.lineTo(sz * 0.22, 0); ctx.closePath(); ctx.fill(); ctx.restore();
              };
              drawWing(1, -1); drawWing(-1, -1); drawWing(1, 1); drawWing(-1, 1);
            } else if (shape && shape.startsWith('custom') && osCtx) {
              const idx = parseInt(shape.replace('custom', '')) - 1;

              // Prioritize specific custom slot over general library fallback
              let img = customIconImgsRef.current[idx];
              if (!img && idx === 0) {
                img = libraryIconImgRef.current;
              }

              if (img) {
                const ratio = Math.min(sz / img.width, sz / img.height);
                const dw = Math.ceil(img.width * ratio); const dh = Math.ceil(img.height * ratio);
                if (dw > 0 && dh > 0) {
                  osC.width = dw; osC.height = dh; osCtx.clearRect(0, 0, dw, dh); osCtx.drawImage(img, 0, 0, dw, dh);
                  osCtx.globalCompositeOperation = 'source-in'; osCtx.fillStyle = `rgb(${r},${g},${b})`; osCtx.fillRect(0, 0, dw, dh);
                  osCtx.globalCompositeOperation = 'source-over'; ctx.drawImage(osC, x - dw / 2, y - dh / 2);
                }
              } else { ctx.roundRect(x - sz / 2, y - sz / 2, sz, sz, sz * 0.3); ctx.fill(); }
            } else { ctx.roundRect(x - sz / 2, y - sz / 2, sz, sz, sz * 0.3); }
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
            const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
            const gradRadius = Math.min(width, height) / 2;
            let color = config.tintMode === 'gradient' ? lerpColor(cMain, cEnd, Math.min(1, distFromCenter / gradRadius)) : cMain;
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
        className="relative bg-zinc-900 shadow-2xl overflow-hidden border border-zinc-700"
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