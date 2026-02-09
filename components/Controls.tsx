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
    if (key === 'patternScale') {
      const inverseRadius = Math.max(10, Math.min(100, (42 / val)));
      nextConfig.baseRadius = Number(inverseRadius.toFixed(1));
    }
    onChange(nextConfig);
  };

  const applyVAState = (stateNum: number) => {
    onPresetChange(stateNum);
    const presets: Record<number, Partial<SimulationConfig>> = {
      1: { motionMode: 'random', mainColor: '#ffffff', tintMode: 'single', dotShape: 'roundedRect', speed: 1.2, patternScale: 1.0, baseRadius: 42, gridSize: 80, threshold: 1.1, edgeLevel: 0.7 },
      2: { motionMode: 'cross', mainColor: '#3b82f6', tintMode: 'gradient', gradientColorEnd: '#ef4444', dotShape: 'cross', speed: 2.0, patternScale: 1.3, oscAmplitude: 240, particleCount: 10, baseRadius: 32.3, gridSize: 80, threshold: 1.2, edgeLevel: 0.5 },
      3: { motionMode: 'breath', mainColor: '#10b981', tintMode: 'single', dotShape: 'mixed', mixedShapes: ['circle', 'smiley', 'xpeng', 'hexagon'], speed: 2.5, patternScale: 0.8, baseRadius: 52, gridSize: 80, threshold: 1.0, edgeLevel: 0.8 },
      4: { motionMode: 'character', characterText: 'IRON', mainColor: '#ffffff', tintMode: 'single', dotShape: 'roundedRect', charFontSize: 220, patternScale: 1.0, baseRadius: 42, gridSize: 20, threshold: 1.1, edgeLevel: 0.3, charPulseSpeed: 1.5, charPulseIntensity: 0.2 },
      5: { motionMode: 'audio', mainColor: '#f59e0b', tintMode: 'single', dotShape: 'star', audioSensitivity: 2.5, audioReactiveRadius: true, audioReactiveGrid: true, audioGridSensitivity: 1.5, patternScale: 1.2, baseRadius: 35, gridSize: 80, threshold: 1.1, edgeLevel: 0.6 },
    };
    if (presets[stateNum]) onChange({ ...config, ...presets[stateNum] });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        update('imageSource', re.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCustomIconUpload = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        const newSources = [...config.customIconSources];
        newSources[index] = re.target?.result as string;
        update('customIconSources', newSources);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleShapeClick = (shape: SimulationConfig['dotShape']) => {
    if (config.dotShape === 'mixed') {
      const exists = config.mixedShapes.includes(shape as any);
      const nextShapes = exists ? config.mixedShapes.filter(s => s !== shape) : [...config.mixedShapes, shape as any];
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
      if (!config.mixedShapes.includes(config.dotShape as any)) update('mixedShapes', [config.dotShape as any]);
    }
  };

  const shapes: Array<Exclude<SimulationConfig['dotShape'], 'mixed' | 'HMS' | 'CHARGING'>> = [
    'roundedRect', 'circle', 'hexagon', 'cross', 'minus', 'divide', 'triangle', 'smiley', 'heart', 'star', 
    'music', 'gear', 'question', 'errorCross', 'electric', 'eye', 'xpeng', 
    'custom1', 'custom2', 'custom3', 'custom4'
  ];

  const getIcon = (s: string) => {
    switch(s) {
      case 'xpeng': return '🦋'; case 'music': return '♫'; case 'star': return '⭐';
      case 'heart': return '❤️'; case 'eye': return '👁️'; case 'gear': return '⚙️';
      case 'smiley': return '😊'; case 'cross': return '✚'; case 'triangle': return '▲';
      case 'circle': return '●'; case 'roundedRect': return '■'; case 'question': return '❓';
      case 'errorCross': return '❌'; case 'HMS': return '❌'; case 'electric': return '⚡'; case 'hexagon': return '⬢';
      case 'minus': return '➖'; case 'divide': return '➗';
      case 'custom1': return '➊'; case 'custom2': return '➋'; case 'custom3': return '➌'; case 'custom4': return '➍';
      default: return '●';
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="px-6 mb-4">
        <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">
          R02 <span style={{ color: config.mainColor }}>INTERFACE DEMO</span>
        </h2>
        <div className="h-px w-full bg-gradient-to-r from-white/20 to-transparent mt-2"></div>
      </div>

      <section>
        <h3 className="px-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-white/20 rounded-full"></div> VA States
        </h3>
        <div className="px-6 flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={() => applyVAState(n)} className={`flex-1 py-3 text-xs font-black rounded-lg border transition-all ${activePreset === n ? 'bg-white/10 text-white shadow-xl' : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'}`} style={activePreset === n ? { borderColor: config.mainColor, color: config.mainColor } : {}}>{n}</button>
          ))}
        </div>
        <ControlItem label="Switching Speed" value={config.transitionSpeed} min={0.01} max={1.0} step={0.01} onChange={(v) => update('transitionSpeed', v)} description="Global transition smoothness between states." color={config.mainColor} />
      </section>

      <section>
        <h3 className="px-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-red-600 rounded-full animate-pulse"></div> HMS Module
        </h3>
        <div className="px-6 py-4 mb-4 bg-red-500/5 rounded-xl border border-red-500/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center bg-red-600 rounded text-white text-xs font-bold">❌</div>
              <div>
                <span className="text-[10px] font-black text-white uppercase tracking-widest block">HMS Overlay</span>
                <span className="text-[8px] text-zinc-500 font-bold uppercase">Static Red Cross</span>
              </div>
            </div>
            <button 
              onClick={() => update('hmsEnabled', !config.hmsEnabled)}
              className={`w-12 h-6 rounded-full relative transition-all ${config.hmsEnabled ? 'bg-red-600' : 'bg-zinc-800'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.hmsEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          
          {config.hmsEnabled && (
            <div className="space-y-4 pt-2 border-t border-white/5">
              <ControlItem 
                label="HMS Distribution" 
                value={config.hmsDistribution} 
                min={0.5} max={3.0} step={0.01} 
                onChange={(v) => update('hmsDistribution', v)} 
                description="Low: Canvas edges only. High: Extends toward center. Includes stochastic noise." 
                color="#dc2626" 
              />
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="px-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div> Charging Module
        </h3>
        <div className="px-6 py-4 mb-4 bg-green-500/5 rounded-xl border border-green-500/10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center bg-green-600 rounded text-white text-xs font-bold">⚡</div>
              <div>
                <span className="text-[10px] font-black text-white uppercase tracking-widest block">Charging Overlay</span>
                <span className="text-[8px] text-zinc-500 font-bold uppercase">Static Green Bolt</span>
              </div>
            </div>
            <button 
              onClick={() => update('chargingEnabled', !config.chargingEnabled)}
              className={`w-12 h-6 rounded-full relative transition-all ${config.chargingEnabled ? 'bg-green-600' : 'bg-zinc-800'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.chargingEnabled ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          
          {config.chargingEnabled && (
            <div className="space-y-4 pt-2 border-t border-white/5">
              <ControlItem 
                label="Charge Distribution" 
                value={config.chargingDistribution} 
                min={0.5} max={3.0} step={0.01} 
                onChange={(v) => update('chargingDistribution', v)} 
                description="Low: Canvas edges only. High: Extends toward center. Probabilistic bolt overlay." 
                color="#22c55e" 
              />
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="px-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-white/20 rounded-full"></div> Motion Patterns
        </h3>
        <div className="px-6 grid grid-cols-3 gap-1 mb-6">
          {(['random', 'cross', 'breath', 'character', 'audio', 'image'] as const).map(mode => (
            <button key={mode} onClick={() => update('motionMode', mode)} className={`py-2.5 text-[9px] font-black uppercase rounded-lg border transition-all ${config.motionMode === mode ? 'bg-white/10 border-white/20 text-white shadow-xl' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'}`} style={config.motionMode === mode ? { color: config.mainColor, borderColor: `${config.mainColor}44` } : {}}>{mode}</button>
          ))}
        </div>

        {config.motionMode === 'image' && (
          <div className="px-6 py-4 mb-4 bg-white/5 rounded-xl space-y-4 border border-white/5">
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-1 bg-blue-400 rounded-full"></span> Image Raster Source
            </h4>
            <div className="space-y-4 px-2">
              <label className="flex flex-col items-center justify-center h-24 bg-black/40 border border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/30 transition-all overflow-hidden relative group">
                {config.imageSource ? (
                  <>
                    <img src={config.imageSource} className="absolute inset-0 w-full h-full object-contain opacity-40 group-hover:opacity-60 transition-opacity" alt="Preview" />
                    <span className="relative z-10 text-[8px] font-black uppercase text-white bg-black/60 px-2 py-1 rounded">Change Image/GIF</span>
                  </>
                ) : (
                  <>
                    <span className="text-[14px] font-black text-white/40 mb-1">UPLOAD</span>
                    <span className="text-[8px] font-black text-zinc-500 uppercase">PNG / GIF Morphology</span>
                  </>
                )}
                <input type="file" accept="image/png,image/gif,image/jpeg" className="hidden" onChange={handleImageUpload} />
              </label>
              <ControlItem label="Image Scale" value={config.imageScale} min={0.1} max={3.0} step={0.01} onChange={(v) => update('imageScale', v)} description="Adjust the coverage of the source image." color={config.mainColor} />
              
              <div className="border-t border-white/5 pt-4 space-y-2">
                <ControlItem label="Pulse Speed" value={config.charPulseSpeed} min={0} max={10} step={0.1} onChange={(v) => update('charPulseSpeed', v)} description="Frequency of the fluid expansion cycle." color={config.mainColor} />
                <ControlItem label="Pulse Intensity" value={config.charPulseIntensity} min={0} max={1.0} step={0.01} onChange={(v) => update('charPulseIntensity', v)} description="Depth of the breathing effect." color={config.mainColor} />
              </div>
            </div>
          </div>
        )}

        {config.motionMode === 'character' && (
          <div className="px-6 py-4 mb-4 bg-white/5 rounded-xl space-y-4 border border-white/5">
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-1 bg-purple-400 rounded-full"></span> Character Input
            </h4>
            <div className="space-y-4 px-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block">Text Content</label>
                <input 
                  type="text" 
                  value={config.characterText} 
                  maxLength={10}
                  onChange={(e) => update('characterText', e.target.value.toUpperCase())}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-white/30 transition-colors"
                  placeholder="ENTER TEXT..."
                />
              </div>
              <ControlItem label="Font Size" value={config.charFontSize} min={50} max={400} step={1} onChange={(v) => update('charFontSize', v)} description="Dimensions of the character matrix." color={config.mainColor} />
              <div className="border-t border-white/5 pt-4 space-y-2">
                <ControlItem label="Pulse Speed" value={config.charPulseSpeed} min={0} max={10} step={0.1} onChange={(v) => update('charPulseSpeed', v)} description="Frequency of the fluid expansion cycle." color={config.mainColor} />
                <ControlItem label="Pulse Intensity" value={config.charPulseIntensity} min={0} max={1.0} step={0.01} onChange={(v) => update('charPulseIntensity', v)} description="Depth of the breathing effect." color={config.mainColor} />
              </div>
            </div>
          </div>
        )}

        {config.motionMode === 'audio' && (
          <div className="px-6 py-4 mb-4 bg-white/5 rounded-xl space-y-4 border border-white/5">
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-1 bg-yellow-400 rounded-full"></span> Audio Settings
            </h4>
            <div className="space-y-4">
               <div className="flex items-center justify-between px-2">
                 <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Reactive Grid</span>
                 <button 
                  onClick={() => update('audioReactiveGrid', !config.audioReactiveGrid)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${config.audioReactiveGrid ? 'bg-white/20' : 'bg-black/40'}`}
                 >
                   <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${config.audioReactiveGrid ? 'right-1 bg-white' : 'left-1 bg-zinc-600'}`} />
                 </button>
               </div>
               
               <ControlItem label="Audio Sensitivity" value={config.audioSensitivity} min={0.1} max={10.0} step={0.1} onChange={(v) => update('audioSensitivity', v)} description="How strongly the visual reacts to sound." color={config.mainColor} />
               {config.audioReactiveGrid && (
                 <ControlItem label="Grid Sensitivity" value={config.audioGridSensitivity} min={0.1} max={5.0} step={0.1} onChange={(v) => update('audioGridSensitivity', v)} description="Scaling of the raster grid by audio." color={config.mainColor} />
               )}
            </div>
          </div>
        )}

        <div className="bg-white/5 py-4 mt-2">
          <ControlItem label="Overall Speed" value={config.speed} min={0.1} max={10.0} step={0.1} onChange={(v) => update('speed', v)} description="Global timeline tempo." color={config.mainColor} />
          <ControlItem label="Pattern Scale" value={config.patternScale} min={0.1} max={5.0} step={0.1} onChange={(v) => update('patternScale', v)} description="Overall pattern size." color={config.mainColor} />
          <ControlItem label="Global Scale" value={config.baseRadius} min={10} max={100} step={0.5} onChange={(v) => update('baseRadius', v)} description="Metaball node size." color={config.mainColor} />
        </div>
      </section>

      <section>
        <h3 className="px-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-white/20 rounded-full"></div> Visual Filter
        </h3>
        <ControlItem label="Threshold" value={config.threshold} min={0.1} max={3.0} step={0.1} onChange={(v) => update('threshold', v)} description="Fluid surface tension (Metaball size)." color={config.mainColor} />
        <ControlItem label="Edge Level" value={config.edgeLevel} min={0.01} max={1.5} step={0.01} onChange={(v) => update('edgeLevel', v)} description="Softness of the fluid edges." color={config.mainColor} />
      </section>

      <section>
        <h3 className="px-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-white/20 rounded-full"></div> Color & Tint
        </h3>
        <div className="px-6 mb-6">
          <div className="flex gap-2 mb-4 bg-white/5 p-1 rounded-lg">
            <button onClick={() => update('tintMode', 'single')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded transition-all ${config.tintMode === 'single' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}>Single</button>
            <button onClick={() => update('tintMode', 'gradient')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded transition-all ${config.tintMode === 'gradient' ? 'bg-white/10 text-white' : 'text-zinc-500'}`}>Gradient</button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{config.tintMode === 'gradient' ? 'Center' : 'Main Color'}</span>
                <input type="color" value={config.mainColor} onChange={(e) => update('mainColor', e.target.value)} className="w-full h-10 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden" />
             </div>
             {config.tintMode === 'gradient' && (
               <div className="space-y-2">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Edge</span>
                  <input type="color" value={config.gradientColorEnd} onChange={(e) => update('gradientColorEnd', e.target.value)} className="w-full h-10 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden" />
               </div>
             )}
          </div>
        </div>
      </section>

      <section>
        <h3 className="px-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 mb-4 flex items-center gap-2">
          <div className="w-1 h-1 bg-white/20 rounded-full"></div> Morphology
        </h3>
        
        <div className="px-6 mb-4">
          <button onClick={toggleMixedMode} className={`w-full py-2.5 text-[9px] font-black uppercase rounded-lg border transition-all ${config.dotShape === 'mixed' ? 'bg-white/10 border-white/20 text-white shadow-xl' : 'bg-transparent border-white/5 text-zinc-600 hover:text-zinc-400'}`} style={config.dotShape === 'mixed' ? { color: config.mainColor, borderColor: `${config.mainColor}44` } : {}}>{config.dotShape === 'mixed' ? 'Mixed Mode: Active' : 'Enter Mixed Mode'}</button>
        </div>

        <div className="px-6 grid grid-cols-6 gap-1 mb-6">
          {shapes.map(s => {
            const isSelected = config.dotShape === 'mixed' ? config.mixedShapes.includes(s) : config.dotShape === s;
            return (
              <button key={s} onClick={() => handleShapeClick(s as SimulationConfig['dotShape'])} className={`py-2 text-[16px] rounded-lg border transition-all ${isSelected ? 'bg-white/10 border-white/20 shadow-xl' : 'bg-transparent border-transparent text-zinc-600 hover:text-zinc-400'}`} style={isSelected ? { color: config.mainColor, borderColor: `${config.mainColor}44` } : {}} title={s}>{getIcon(s)}</button>
            );
          })}
        </div>

        <div className="px-6 mb-6">
          <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-3 italic">Custom Icon Slots (PNG)</label>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map(idx => (
              <label key={idx} className="flex flex-col items-center justify-center h-20 bg-white/5 border border-dashed border-white/10 rounded-xl cursor-pointer hover:border-white/30 transition-all overflow-hidden relative group">
                {config.customIconSources[idx] && <img src={config.customIconSources[idx]!} className="absolute inset-0 w-full h-full object-contain opacity-20 group-hover:opacity-40 transition-opacity" alt={`Slot ${idx+1}`} />}
                <span className="text-[14px] font-black text-white/40 mb-1 relative z-10">{idx + 1}</span>
                <span className="text-[8px] font-black text-zinc-500 uppercase relative z-10">
                  {config.customIconSources[idx] ? 'Replace' : 'Upload'}
                </span>
                <input type="file" accept="image/png" className="hidden" onChange={handleCustomIconUpload(idx)} />
              </label>
            ))}
          </div>
        </div>

        <div className="px-6 mb-6">
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-3">Raster Engine</span>
          <button onClick={() => update('enableHalftone', !config.enableHalftone)} className={`w-full h-10 rounded-xl border transition-all uppercase text-[9px] font-black ${config.enableHalftone ? 'bg-white/10 border-white/20 text-white' : 'bg-transparent border-white/5 text-zinc-600'}`} style={config.enableHalftone ? { color: config.mainColor } : {}}>{config.enableHalftone ? 'ON' : 'OFF'}</button>
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