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
  motionMode: 'random' | 'cross' | 'breath' | 'character' | 'audio' | 'image';
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
  dotShape: 'roundedRect' | 'circle' | 'cross' | 'minus' | 'divide' | 'triangle' | 'wire' | 'mixed' | 'smiley' | 'heart' | 'star' | 'diamond' | 'hexagon' | 'sun' | 'music' | 'question' | 'errorCross' | 'gear' | 'evCar' | 'eye' | 'xpeng' | 'electric' | 'custom1' | 'custom2' | 'custom3' | 'custom4' | 'HMS' | 'CHARGING';
  // Use a refined type for mixedShapes to ensure they match valid dot shapes
  mixedShapes: ('roundedRect' | 'circle' | 'cross' | 'minus' | 'divide' | 'triangle' | 'wire' | 'smiley' | 'heart' | 'star' | 'diamond' | 'hexagon' | 'sun' | 'music' | 'question' | 'errorCross' | 'gear' | 'evCar' | 'eye' | 'xpeng' | 'electric' | 'custom1' | 'custom2' | 'custom3' | 'custom4' | 'HMS' | 'CHARGING')[];
  customIconSources: (string | null)[]; // For user uploaded morphology icons (4 slots)
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
}

export interface Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  noiseX: number;
  noiseY: number;
  radius: number;
  scale: number;
}