
import React, { useState } from 'react';
import { SimulationConfig } from './types';
import MetaballCanvas from './components/MetaballCanvas';
import Controls from './components/Controls';

const App: React.FC = () => {
  const [config, setConfig] = useState<SimulationConfig>({
    particleCount: 32,
    baseRadius: 42,
    speed: 1.2,
    motionRange: 140,
    dispersion: 0.35,
    threshold: 1.1,
    edgeLevel: 0.7,
    pixelStep: 1,
    gridSize: 80,
    gridGap: 2,
    dotScale: 1.05,
    enableHalftone: true,
    motionMode: 'random',
    characterText: 'META',
    imageSource: null,
    imageScale: 1.0,
    patternScale: 1.0,
    offsetX: 0,
    offsetY: 0,
    oscSpeed: 1.8,
    oscAmplitude: 160,
    crossRotation: 0,
    mainColor: '#ffffff',
    gradientColorEnd: '#ef4444',
    tintMode: 'single',
    breathSpeed: 2.5,
    breathRange: 0.5,
    dotShape: 'roundedRect',
    mixedShapes: ['circle', 'heart', 'star', 'music'],
    charEnableGlare: false, 
    charFlicker: 0.15,
    charStatic: 0.1,
    charDisplace: 0.05, 
    charFontSize: 180,
    audioSensitivity: 1.8,
    audioSmoothing: 0.85,
    audioReactiveRadius: true,
    audioReactiveGrid: false,
    audioGridSensitivity: 1.2,
  });

  const [panelVisible, setPanelVisible] = useState(true);
  const [activePreset, setActivePreset] = useState<number>(1);

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative font-sans">
      {/* Immersive Background Canvas */}
      <MetaballCanvas config={config} />

      {/* Floating Toggle Button */}
      <button 
        onClick={() => setPanelVisible(!panelVisible)}
        className="absolute top-6 left-6 z-50 w-10 h-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center hover:bg-white/20 transition-all shadow-2xl"
        title={panelVisible ? "Hide Panel" : "Show Panel"}
      >
        <div className={`transition-transform duration-300 ${panelVisible ? 'rotate-180' : 'rotate-0'}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </button>

      {/* Floating Control Panel */}
      <aside 
        className={`absolute top-0 left-0 h-full w-[350px] z-40 bg-black/30 border-r border-white/5 transition-transform duration-500 ease-out overflow-y-auto custom-scrollbar shadow-2xl ${panelVisible ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="pt-20 pb-12">
           <Controls 
             config={config} 
             onChange={setConfig} 
             activePreset={activePreset} 
             onPresetChange={setActivePreset} 
           />
        </div>
      </aside>

      {/* Subtle Floating Status Badges */}
      <div className="absolute bottom-6 left-6 flex gap-3 pointer-events-none z-30">
        <div className="px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-2 shadow-2xl">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: config.mainColor }}></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">
            {config.motionMode}
          </span>
        </div>
        <div className="px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full flex items-center gap-2 shadow-2xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {config.enableHalftone ? `GRID_${config.dotShape}` : 'RAW_FLUID'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default App;
