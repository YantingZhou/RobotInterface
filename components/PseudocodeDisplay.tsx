
import React from 'react';
import { SimulationConfig } from '../types';

interface Props {
  config: SimulationConfig;
}

const PseudocodeDisplay: React.FC<Props> = ({ config }) => {
  const getCode = () => {
    const hex = config.mainColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    return `/**
 * METABALL STUDIO EXPORT (v2.4.1)
 * Halftone support including Gear, EV Car, Eye, and XPENG logo.
 */

int MAX_PARTICLES = 100;
int activeCount;
float ballRadius, simSpeed, threshold, edgeLevel, motionRange, dispersion;
int gridSize, gridGap;
float oscSpeed, oscAmp, crossRot, offX, offY;
float breathSpeed, breathRange;
color mainColor = color(${r}, ${g}, ${b});
String mode = "${config.motionMode.toUpperCase()}";
String shapeMode = "${config.dotShape}";
boolean halftoneEnabled = ${config.enableHalftone};

class Particle {
  float x, y, radius, noiseX, noiseY, baseR, scale;
  Particle() {
    scale = random(0.8, 1.2);
    noiseX = random(1000); noiseY = random(1000);
    radius = ballRadius * scale;
  }
}

Particle[] particles;
float time = 0;

void setup() {
  size(600, 600);
  activeCount = ${config.particleCount};
  ballRadius = ${config.baseRadius};
  simSpeed = ${config.speed};
  threshold = ${config.threshold};
  edgeLevel = ${config.edgeLevel};
  motionRange = ${config.motionRange};
  dispersion = ${config.dispersion};
  gridSize = ${config.gridSize};
  gridGap = ${config.gridGap};
  oscSpeed = ${config.oscSpeed};
  oscAmp = ${config.oscAmplitude};
  crossRot = ${config.crossRotation};
  breathSpeed = ${config.breathSpeed};
  breathRange = ${config.breathRange};
  offX = ${config.offsetX}; offY = ${config.offsetY};

  particles = new Particle[MAX_PARTICLES];
  for (int i = 0; i < MAX_PARTICLES; i++) particles[i] = new Particle();
}

void draw() {
  background(0);
  time += 0.01 * simSpeed;
  
  // Movement Logic (Simplified for export)
  for (int i = 0; i < activeCount; i++) {
    Particle p = particles[i];
    // Motion mode calculations...
  }

  if (halftoneEnabled) {
    int g = max(4, gridSize);
    for (int x = g/2; x < width; x += g) {
      for (int y = g/2; y < height; y += g) {
        float f = 0;
        for (int i=0; i<activeCount; i++) {
          float d2 = sq(x-particles[i].x) + sq(y-particles[i].y);
          if (d2 > 0) f += sq(particles[i].radius) / d2;
        }
        float n = mapToThresh(f);
        if (n > 0.05) {
          float sz = (g - gridGap) * pow(n, 0.6);
          fill(mainColor);
          drawShape(x, y, sz, shapeMode);
        }
      }
    }
  }
}

void drawShape(float x, float y, float sz, String s) {
  pushMatrix();
  translate(x, y);
  if (s.equals("circle")) ellipse(0, 0, sz, sz);
  else if (s.equals("xpeng")) {
    float h = sz * 0.5;
    float gx = h * 0.08;
    float gy = h * 0.08;
    // Top Right
    beginShape(); vertex(gx, -gy); vertex(h*0.9, -h*0.45); vertex(h*0.45, -gy); endShape(CLOSE);
    // Bottom Right
    beginShape(); vertex(gx, gy); vertex(h*0.9, h*0.45); vertex(h*0.45, gy); endShape(CLOSE);
    // Top Left
    beginShape(); vertex(-gx, -gy); vertex(-h*0.9, -h*0.45); vertex(-h*0.45, -gy); endShape(CLOSE);
    // Bottom Left
    beginShape(); vertex(-gx, gy); vertex(-h*0.9, h*0.45); vertex(-h*0.45, gy); endShape(CLOSE);
  }
  else if (s.equals("gear")) {
    for(int i=0; i<8; i++) { rotate(PI/4); rect(-sz*0.1, -sz*0.5, sz*0.2, sz*0.15); }
    ellipse(0, 0, sz*0.7, sz*0.7);
  }
  else {
    rect(-sz/2, -sz/2, sz, sz, sz*0.2);
  }
  popMatrix();
}

float mapToThresh(float v) {
  float minT = threshold-edgeLevel; float maxT = threshold+edgeLevel;
  if (v > maxT) return 1.0; if (v < minT) return 0.0;
  return (v-minT)/(maxT-minT);
}`;
  };

  const downloadPDE = () => {
    const blob = new Blob([getCode()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MetaballSimulation.pde';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 font-mono text-[11px] overflow-hidden shadow-inner h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: config.mainColor }}></div>
           <h3 className="text-zinc-400 font-bold uppercase tracking-wider">Processing Export Logic</h3>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              navigator.clipboard.writeText(getCode());
              alert("Logic copied!");
            }}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1 rounded text-[10px] transition-all active:scale-95 border border-zinc-700"
          >
            Copy
          </button>
          <button 
            onClick={downloadPDE}
            className="text-white px-3 py-1 rounded text-[10px] transition-all active:scale-95 border border-white/10"
            style={{ backgroundColor: config.mainColor }}
          >
            Export .pde
          </button>
        </div>
      </div>
      <pre className="text-blue-200/60 leading-relaxed overflow-x-auto max-h-[400px] custom-scrollbar selection:bg-blue-500/30">
        {getCode()}
      </pre>
    </div>
  );
};

export default PseudocodeDisplay;
