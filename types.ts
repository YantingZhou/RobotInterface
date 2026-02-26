export interface SimulationConfig {
  particleCount: number;
  baseRadius: number;
  speed: number;
  motionRange: number;
  dispersion: number;
  threshold: number;
  edgeLevel: number;
  pixelStep: number;
  gridSize: number;
  gridGap: number;
  dotScale: number;
  enableHalftone: boolean;
  motionMode: 'random' | 'cross' | 'breath' | 'character' | 'audio' | 'simAudio' | 'image' | 'pattern';
  pattern: MathPattern;
  characterText: string;
  imageSource: string | null;
  imageScale: number;
  patternScale: number; // Added to control the size of the overall pattern
  offsetX: number;
  offsetY: number;
  oscSpeed: number;
  oscAmplitude: number;
  crossRotation: number;
  transitionSpeed: number; // New parameter for switching smoothness
  mainColor: string;
  gradientColorEnd: string;
  tintMode: 'single' | 'gradient';
  breathSpeed: number;
  breathRange: number;
  dotShape: 'roundedRect' | 'circle' | 'cross' | 'minus' | 'divide' | 'triangle' | 'wire' | 'mixed' | 'smiley' | 'heart' | 'star' | 'diamond' | 'hexagon' | 'sun' | 'music' | 'question' | 'errorCross' | 'gear' | 'evCar' | 'eye' | 'xpeng' | 'electric' | 'custom1' | 'custom2' | 'custom3' | 'custom4' | 'custom5' | 'custom6' | 'custom7' | 'custom8' | 'custom9' | 'custom10' | 'HMS' | 'HMS_LOW' | 'CHARGING';
  // Use a refined type for mixedShapes to ensure they match valid dot shapes
  mixedShapes: ('roundedRect' | 'circle' | 'cross' | 'minus' | 'divide' | 'triangle' | 'wire' | 'smiley' | 'heart' | 'star' | 'diamond' | 'hexagon' | 'sun' | 'music' | 'question' | 'errorCross' | 'gear' | 'evCar' | 'eye' | 'xpeng' | 'electric' | 'custom1' | 'custom2' | 'custom3' | 'custom4' | 'custom5' | 'custom6' | 'custom7' | 'custom8' | 'custom9' | 'custom10' | 'HMS' | 'HMS_LOW' | 'CHARGING')[];
  customIconSources: (string | null)[]; // Deprecated for Icon Library
  activeLibraryIcon: string | null; // Path to the currently selected library icon
  // Character Mode Specific Effects
  charEnableGlare: boolean;
  charFlicker: number;
  charStatic: number;
  charDisplace: number;
  charFontSize: number;
  charPulseSpeed: number;
  charPulseIntensity: number;
  // Audio Mode Specific Effects
  audioSensitivity: number;
  audioSmoothing: number;
  audioReactiveRadius: boolean;
  audioReactiveGrid: boolean;
  audioGridSensitivity: number;
  // HMS Specific Module
  hmsEnabled: boolean;
  hmsDistribution: number;
  // Charging Specific Module
  chargingEnabled: boolean;
  chargingDistribution: number;
  superEllipseRange: number;
  syncGridSize: boolean;
  minGridSize: number;
  maxGridSize: number;
  interpolationType: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step';
  linearMitosisRange: number;
  hmsColor: string;
  hmsLowEnabled: boolean;
  hmsLowDistribution: number;
  hmsLowColor: string;
  chargingColor: string;
}

export enum MathPattern {
  VORTEX = 'vortex',
  WAVE = 'wave',
  PHYLLOTAXIS = 'phyllotaxis',
  GRID_WAVE = 'grid_wave',
  TUNNEL = 'tunnel',
  DNA_HELIX = 'dna_helix',
  SPHERE = 'sphere',
  LISSAJOUS = 'lissajous',
  TORUS = 'torus',
  ATOMIC = 'atomic',
  FLOW_FIELD = 'flow_field',
  GALAXY = 'galaxy',
  ROSE_CURVE = 'rose_curve',
  LORENTZ = 'lorentz',
  SPIROGRAPH = 'spirograph',
  CHLADNI = 'chladni',
  AMOEBA = 'amoeba',
  FLOCK = 'flock',
  MITOSIS = 'mitosis',
  LINEAR_MITOSIS = 'linear_mitosis',
  HEARTBEAT = 'heartbeat',
  SUPER_ELLIPSE = 'super_ellipse'
}

export interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  noiseX: number;
  noiseY: number;
  radius: number;
  scale: number;
  angle: number;
  z: number;
  lx?: number;
  ly?: number;
  lz?: number;
  id: number;
}