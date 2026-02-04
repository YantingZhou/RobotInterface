
import React from 'react';
import { SimulationConfig } from '../types';

interface Props {
  config: SimulationConfig;
  onChange: (newConfig: SimulationConfig) => void;
  activePreset: number;
  onPresetChange: (n: number) => void;
}

const ControlItem: React.FC<{
  label: string; value: number; min: number; max: number; step: number;
  onChange: (val: number) => void; description: string; color?: string;
}> = ({ label, value, min, max, step, onChange, description, color = '#3b82f6' }) => (
  <div className="mb-6 px-6">
    <div className="flex justify-between items-center mb-1">
      <label className="text-xs font-black text-zinc-400 uppercase tracking-widest">{label}</label>
      <span className="text-[10px] font-mono bg-white/5 px-2 py-0.5 rounded text-white border border-white/5">{value}</span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white hover:bg-white/20 transition-colors"
      style={{ accentColor: color }}
    />
    <p className="text-[9px] text-zinc-600 mt-2 font-medium leading-tight">{description}</p>
  </div>
);

const Controls: React.FC<Props> = ({ config, onChange, activePreset, onPresetChange }) => {
  const update = (key: keyof SimulationConfig, val: any) => {
    let nextConfig = { ...config, [key]: val };

    // Implementation of link: Pattern Scale up -> Global Scale (baseRadius) down
    if (key === 'patternScale') {
      const inverseRadius = Math.max(10, Math.min(100, (42 / val)));
      nextConfig.baseRadius = Number(inverseRadius.toFixed(1));
    }

    onChange(nextConfig);
  };

  const applyVAState = (stateNum: number) => {
    onPresetChange(stateNum);
    const presets: Record<number, Partial<SimulationConfig>> = {
      1: { 
        motionMode: 'random', mainColor: '#ffffff', tintMode: 'single', 
        dotShape: 'roundedRect', speed: 1.2, patternScale: 1.0, 
        baseRadius: 42, gridSize: 80 
      },
      2: { 
        motionMode: 'cross', mainColor: '#3b82f6', tintMode: 'gradient', 
        gradientColorEnd: '#ef4444', dotShape: 'cross', speed: 2.0, 
        patternScale: 1.3, oscAmplitude: 240, particleCount: 10, 
        baseRadius: 32.3, gridSize: 80 
      },
      3: { 
        motionMode: 'breath', mainColor: '#10b981', tintMode: 'single', 
        dotShape: 'mixed', mixedShapes: ['circle', 'smiley', 'xpeng'],
        speed: 2.5, patternScale: 0.8, baseRadius: 52, gridSize: 80 
      },
      4: { 
        motionMode: 'character', characterText: 'IRON', mainColor: '#ffffff', 
        tintMode: 'single', dotShape: 'roundedRect', charFontSize: 220, 
        patternScale: 1.0, baseRadius: 42, gridSize: 20 
      },
      5: { 
        motionMode: 'audio', mainColor: '#f59e0b', tintMode: 'single', 
        dotShape: 'star', audioSensitivity: 2.5, audioReactiveRadius: true, 
        patternScale: 1.2, baseRadius: 35, gridSize: 80 
      },
    };
    if (presets[stateNum]) {
      onChange({ ...config, ...presets[stateNum] });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => update('imageSource', re.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleShapeClick = (shape: SimulationConfig['dotShape']) => {
    if (config.dotShape === 'mixed') {
      const exists = config.mixedShapes.includes(shape as any);
      const nextShapes = exists 
        ? config.mixedShapes.filter(s => s !== shape)
        : [...config.mixedShapes, shape as any];
      if (nextShapes.length === 0) return;
      update('mixedShapes', nextShapes);
    } else {
      update('dotShape', shape);
    }
  };

  const toggleMixedMode = () => {
    if (config.dotShape === 'mixed') {
      const fallback = config.mixedShapes.length > 0 ? config.mixedShapes[0] : 'roundedRect';
      update('dotShape', fallback as SimulationConfig['dotShape']);
    } else {
      update('dotShape', 'mixed');
      if (!config.mixedShapes.includes(config.dotShape as any)) {
        update('mixedShapes', [config.dotShape as any]);
      }
    }
  };

  const shapes: Array<Exclude<SimulationConfig['dotShape'], 'mixed'>> = [
    'roundedRect', 'circle', 'cross', 'triangle', 'smiley', 'heart', 'star', 
    'music', 'gear', 'evCar', 'eye', 'xpeng'
  ];

  const getIcon = (s: string) => {
    switch(s) {
      case 'xpeng': return '🦋';
      case 'music': return '♫';
      case 'star': return '⭐';
      case 'heart': return '❤️';
      case 'eye': return '👁️';
      case 'gear': return '⚙️';
      case 'smiley': return '😊';
      case 'evCar': return '🚗';
      case 'cross': return '✚';
      case 'triangle': return '▲';
      case 'circle': return '●';
      case 'roundedRect': return '■';
      default: return '●';
    }
  };

  return (
    <div className="space-y-8">
      {/* Title Section */}
      <div className="px-6 mb-4">
        <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">
          R02 <span style={{ color: config.mainColor }}>INTERFACE DEMO</span>
        </h2>
        <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent mt-2"></div>
      </div>

      {/* VA States Section */}
      <section>
        <h3 className="px-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-white/20 rounded-full"></div> VA States
        </h3>
        <div className="px-6 flex gap-2">
          {[1, 2, 3, 4, 5].map(n => (
            <button 
              key={n} 
              onClick={() => applyVAState(n)}
              className={`flex-1 py-3 text-xs font-black rounded-lg border transition-all ${activePreset === n ? 'bg-white/10 text-white shadow-xl' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}`}
              style={activePreset === n ? { borderColor: config.mainColor, color: config.mainColor } : {}}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="px-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-white/20 rounded-full"></div> Motion Patterns
        </h3>
        <div className="px-6 grid grid-cols-3 gap-1 mb-6">
          {(['random', 'cross', 'breath', 'character', 'audio', 'image'] as const).map(mode => (
            <button 
              key={mode} onClick={() => update('motionMode', mode)}
              className={`py-2.5 text-[9px] font-black uppercase rounded-lg border transition-all ${config.motionMode === mode ? 'bg-white/10 border-white/20 text-white shadow-xl' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'}`}
              style={config.motionMode === mode ? { color: config.mainColor, borderColor: `${config.mainColor}44` } : {}}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Dynamic Motion Parameters Section */}
        <div className="bg-white/5 py-4 mt-2">
          <h4 className="px-6 text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-4 italic">Pattern Dynamics</h4>
          
          <ControlItem label="Overall Speed" value={config.speed} min={0.1} max={5.0} step={0.1} onChange={(v) => update('speed', v)} description="Global timeline tempo." color={config.mainColor} />
          
          <div className="space-y-2 mb-4">
            <ControlItem label="Pattern Scale" value={config.patternScale} min={0.1} max={5.0} step={0.1} onChange={(v) => update('patternScale', v)} description="Overall pattern size." color={config.mainColor} />
            <ControlItem label="Global Scale" value={config.baseRadius} min={10} max={100} step={0.5} onChange={(v) => update('baseRadius', v)} description="Metaball node size." color={config.mainColor} />
          </div>

          <div className="grid grid-cols-2 gap-0">
            <ControlItem label="Offset X" value={config.offsetX} min={-500} max={500} step={1} onChange={(v) => update('offsetX', v)} description="Horizontal shift." color={config.mainColor} />
            <ControlItem label="Offset Y" value={config.offsetY} min={-500} max={500} step={1} onChange={(v) => update('offsetY', v)} description="Vertical shift." color={config.mainColor} />
          </div>

          {config.motionMode === 'random' && (
            <ControlItem label="Random Range" value={config.motionRange} min={10} max={600} step={1} onChange={(v) => update('motionRange', v)} description="Maximum drift spread." color={config.mainColor} />
          )}

          {config.motionMode === 'cross' && (
            <>
              <ControlItem label="Osc Speed" value={config.oscSpeed} min={0.1} max={10.0} step={0.1} onChange={(v) => update('oscSpeed', v)} description="Oscillation frequency." color={config.mainColor} />
              <ControlItem label="Osc Amplitude" value={config.oscAmplitude} min={10} max={400} step={1} onChange={(v) => update('oscAmplitude', v)} description="Travel distance." color={config.mainColor} />
            </>
          )}

          {config.motionMode === 'breath' && (
            <>
              <ControlItem label="Pulse Rate" value={config.breathSpeed} min={0.1} max={10.0} step={0.1} onChange={(v) => update('breathSpeed', v)} description="Breathing frequency." color={config.mainColor} />
              <ControlItem label="Pulse Range" value={config.breathRange} min={0.1} max={2.0} step={0.1} onChange={(v) => update('breathRange', v)} description="Expansion intensity." color={config.mainColor} />
            </>
          )}

          {config.motionMode === 'character' && (
            <>
              <div className="px-6 mb-4">
                <textarea value={config.characterText} onChange={(e) => update('characterText', e.target.value)} className="w-full h-20 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/30 transition-all font-black uppercase italic" style={{ color: config.mainColor }} />
              </div>
              <ControlItem label="Flicker" value={config.charFlicker} min={0} max={1.0} step={0.05} onChange={(v) => update('charFlicker', v)} description="Light instability." color={config.mainColor} />
              <ControlItem label="Font Size" value={config.charFontSize} min={50} max={400} step={1} onChange={(v) => update('charFontSize', v)} description="Character scale." color={config.mainColor} />
            </>
          )}

          {config.motionMode === 'audio' && (
            <div className="px-6 space-y-4 mb-4">
               <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-[11px] font-black text-zinc-500 uppercase">Reactive Radius</span>
                  <button onClick={() => update('audioReactiveRadius', !config.audioReactiveRadius)} className={`w-10 h-5 rounded-full relative transition-all ${config.audioReactiveRadius ? '' : 'bg-zinc-800'}`} style={config.audioReactiveRadius ? {backgroundColor: config.mainColor} : {}}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.audioReactiveRadius ? 'left-5.5' : 'left-0.5'}`}></div>
                  </button>
               </div>
               <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-[11px] font-black text-zinc-500 uppercase">Reactive Grid</span>
                  <button onClick={() => update('audioReactiveGrid', !config.audioReactiveGrid)} className={`w-10 h-5 rounded-full relative transition-all ${config.audioReactiveGrid ? '' : 'bg-zinc-800'}`} style={config.audioReactiveGrid ? {backgroundColor: config.mainColor} : {}}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${config.audioReactiveGrid ? 'left-5.5' : 'left-0.5'}`}></div>
                  </button>
               </div>
               <ControlItem label="Audio Gain" value={config.audioSensitivity} min={0.1} max={5.0} step={0.1} onChange={(v) => update('audioSensitivity', v)} description="Microphone gain." color={config.mainColor} />
            </div>
          )}

          {config.motionMode === 'image' && (
            <>
              <div className="px-6 mb-6">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">Source Image</label>
                <label className="w-full flex flex-col items-center justify-center h-24 bg-black/40 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-white/30 transition-all group overflow-hidden relative">
                  {config.imageSource && <img src={config.imageSource} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="Preview" />}
                  <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white z-10 transition-colors">
                    {config.imageSource ? 'Change Source' : 'Upload Image'}
                  </span>
                  <input type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={handleImageUpload} />
                </label>
              </div>
              <ControlItem label="Source Scale" value={config.imageScale} min={0.1} max={4.0} step={0.1} onChange={(v) => update('imageScale', v)} description="Density zoom." color={config.mainColor} />
            </>
          )}
        </div>
      </section>

      <section className="bg-white/5 py-6">
        <ControlItem label="Fluid Complexity" value={config.particleCount} min={4} max={100} step={1} onChange={(v) => update('particleCount', v)} description="Number of metaball nodes." color={config.mainColor} />
        <ControlItem label="Viscosity Threshold" value={config.threshold} min={0.1} max={10.0} step={0.1} onChange={(v) => update('threshold', v)} description="Fluid fusion baseline." color={config.mainColor} />
        <ControlItem label="Viscosity Softness" value={config.edgeLevel} min={0.01} max={2.0} step={0.01} onChange={(v) => update('edgeLevel', v)} description="Blur intensity." color={config.mainColor} />
      </section>

      <section>
        <h3 className="px-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-white/20 rounded-full"></div> Morphology
        </h3>
        
        <div className="px-6 mb-4">
          <button 
            onClick={toggleMixedMode}
            className={`w-full py-2.5 text-[9px] font-black uppercase rounded-lg border transition-all ${config.dotShape === 'mixed' ? 'bg-white/10 border-white/20 text-white shadow-xl' : 'bg-transparent border-white/5 text-zinc-600 hover:text-zinc-400'}`}
            style={config.dotShape === 'mixed' ? { color: config.mainColor, borderColor: `${config.mainColor}44` } : {}}
          >
            {config.dotShape === 'mixed' ? 'Mixed Mode: Active' : 'Enter Mixed Mode'}
          </button>
        </div>

        <div className="px-6 grid grid-cols-4 gap-1 mb-6">
          {shapes.map(s => {
            const isSelected = config.dotShape === 'mixed' ? config.mixedShapes.includes(s) : config.dotShape === s;
            return (
              <button 
                key={s} 
                onClick={() => handleShapeClick(s as SimulationConfig['dotShape'])} 
                className={`py-3 text-[18px] rounded-xl border transition-all ${isSelected ? 'bg-white/10 border-white/20 shadow-xl' : 'bg-transparent border-transparent text-zinc-600 hover:text-zinc-400'}`}
                style={isSelected ? { color: config.mainColor, borderColor: `${config.mainColor}44` } : {}}
                title={s}
              >
                {getIcon(s)}
              </button>
            );
          })}
        </div>

        <div className="px-6 mb-6 grid grid-cols-2 gap-4">
           <div className="space-y-2">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Main Tint</span>
              <input type="color" value={config.mainColor} onChange={(e) => update('mainColor', e.target.value)} className="w-full h-10 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden" />
           </div>
           <div className="space-y-2">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Raster Engine</span>
              <button onClick={() => update('enableHalftone', !config.enableHalftone)} className={`w-full h-10 rounded-xl border transition-all uppercase text-[9px] font-black ${config.enableHalftone ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-zinc-600'}`} style={config.enableHalftone ? { color: config.mainColor } : {}}>
                {config.enableHalftone ? 'ON' : 'OFF'}
              </button>
           </div>
        </div>

        {config.enableHalftone && (
          <div className="border-t border-white/10 pt-6">
            <ControlItem label="Raster Grid" value={config.gridSize} min={10} max={120} step={1} onChange={(v) => update('gridSize', v)} description="Centric spatial resolution." color={config.mainColor} />
            <ControlItem label="Raster Gap" value={config.gridGap} min={0} max={40} step={1} onChange={(v) => update('gridGap', v)} description="Spacing between elements." color={config.mainColor} />
          </div>
        )}
      </section>
    </div>
  );
};

export default Controls;
