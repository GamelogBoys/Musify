import { Sliders, Zap } from "lucide-react";
import { EqualizerBand, EqualizerPreset } from "../types";

interface EqualizerSettingsProps {
  bands: EqualizerBand[];
  activePreset: EqualizerPreset;
  onBandChange: (index: number, newGain: number) => void;
  onPresetSelect: (preset: EqualizerPreset) => void;
}

export default function EqualizerSettings({
  bands,
  activePreset,
  onBandChange,
  onPresetSelect,
}: EqualizerSettingsProps) {
  const presets: { name: EqualizerPreset; desc: string }[] = [
    { name: "Flat", desc: "No color, fully linear response" },
    { name: "Bass Booster", desc: "Rich low-end for punchy drum transients" },
    { name: "Treble Booster", desc: "Enhanced air and vocal clarity" },
    { name: "Acoustic", desc: "Balanced presence tailored for real wood instruments" },
    { name: "Vocal Booster", desc: "Crisp dialog and vocal separation in the mid-range" },
  ];

  // Dynamically calculate interactive response curve coordinates
  const getCurvePath = () => {
    const width = 360;
    const height = 64;
    const padding = 20;
    const usableW = width - padding * 2;
    const centerY = height / 2;

    const points = bands.map((band, idx) => {
      const x = padding + (idx / (bands.length - 1)) * usableW;
      // Convert -12dB...12dB to centerY - height/2...centerY + height/2
      const offset = (band.gain / 12) * (height / 2 - 4);
      const y = centerY - offset;
      return { x, y };
    });

    // Create complex cubic bezier curve elements
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX1 = p0.x + (p1.x - p0.x) / 2;
      const cpY1 = p0.y;
      const cpX2 = p0.x + (p1.x - p0.x) / 2;
      const cpY2 = p1.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
    }
    return d;
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800/85 rounded-xl p-5 flex flex-col gap-5 h-full relative overflow-hidden" id="equalizer_panel">
      {/* Decorative metal screw decals on audio gear corners */}
      <div className="absolute top-2.5 left-2.5 w-1.5 h-1.5 rounded-full bg-zinc-800 border border-zinc-700/50 shadow-inner"></div>
      <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-zinc-800 border border-zinc-700/50 shadow-inner"></div>
      <div className="absolute bottom-2.5 left-2.5 w-1.5 h-1.5 rounded-full bg-zinc-800 border border-zinc-700/50 shadow-inner"></div>
      <div className="absolute bottom-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-zinc-800 border border-zinc-700/50 shadow-inner"></div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold text-zinc-150 text-sm tracking-wide uppercase">
            5-Band Paramount Equalizer
          </h3>
        </div>
        <span className="font-mono text-[9px] text-zinc-500 bg-zinc-900 border border-zinc-800/80 px-2 py-0.5 rounded uppercase">
          Signal Chain: Active
        </span>
      </div>

      {/* Realtime DSP Equalization Curve Display */}
      <div className="bg-zinc-950 border border-zinc-800/60 rounded-lg p-3 relative h-20 flex flex-col justify-center overflow-hidden">
        <div className="absolute inset-0 grid grid-rows-3 grid-cols-5 pointer-events-none opacity-20">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="border-b border-r border-zinc-700/45"></div>
          ))}
        </div>
        
        {/* Plot actual response curve */}
        <svg className="w-full h-full absolute inset-0 overflow-visible" preserveAspectRatio="none" viewBox="0 0 360 64">
          {/* Flatline center guide */}
          <line x1="0" y1="32" x2="360" y2="32" stroke="rgba(34, 211, 238, 0.15)" strokeDasharray="4 4" strokeWidth="1" />
          
          {/* Active curve shadow glow */}
          <path d={getCurvePath()} fill="none" stroke="rgba(14, 165, 233, 0.25)" strokeWidth="6" className="blur-[3px]" />
          {/* Active curve */}
          <path d={getCurvePath()} fill="none" stroke="url(#eqGlow)" strokeWidth="2.5" />
          
          {/* Glowing anchors */}
          {bands.map((band, idx) => {
            const width = 360;
            const usableW = width - 40;
            const x = 20 + (idx / (bands.length - 1)) * usableW;
            const y = 32 - (band.gain / 12) * 28;
            return (
              <g key={idx}>
                <circle cx={x} cy={y} r="4.5" fill="#09090b" stroke="rgb(34, 211, 238)" strokeWidth="2" className="cursor-pointer" />
                <circle cx={x} cy={y} r="1.5" fill="rgb(34, 211, 238)" />
              </g>
            );
          })}

          <defs>
            <linearGradient id="eqGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute bottom-1 w-full left-0 right-0 px-5 flex justify-between font-mono text-[8px] text-zinc-600 pointer-events-none">
          {bands.map((b) => (
            <span key={b.frequency}>{b.label}</span>
          ))}
        </div>
        <div className="absolute top-1 left-2.5 font-mono text-[8px] text-cyan-400 pointer-events-none flex items-center gap-1">
          <Zap className="w-2.5 h-2.5 animate-pulse" />
          DSP GAIN RESPONSE (dB)
        </div>
      </div>

      {/* Preset Selectors */}
      <div className="flex flex-wrap gap-1.5" id="equalizer_presets">
        {presets.map((p) => {
          const isActive = activePreset === p.name;
          return (
            <button
              key={p.name}
              id={`preset_${p.name.replace(/\s+/g, '_').toLowerCase()}`}
              title={p.desc}
              onClick={() => onPresetSelect(p.name)}
              className={`px-2.5 py-1 text-[10px] font-mono tracking-wide rounded-md border transition-all cursor-pointer ${
                isActive
                  ? "bg-cyan-500/10 border-cyan-500/55 text-cyan-400 shadow-sm"
                  : "bg-zinc-900 border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900/60"
              }`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-5 gap-3.5 flex-1 items-stretch py-2" id="equalizer_sliders">
        {bands.map((band, idx) => (
          <div key={band.frequency} className="flex flex-col items-center justify-between gap-2.5 h-full">
            {/* Decibel value indicator */}
            <span className="font-mono text-[9px] text-zinc-400 font-medium bg-zinc-900 px-1 py-0.5 rounded shadow-sm">
              {band.gain > 0 ? `+${band.gain}` : band.gain}
              <span className="text-[7px] text-zinc-500 ml-0.5">dB</span>
            </span>

            {/* Fader Track */}
            <div className="relative group w-6 flex-1 flex justify-center bg-zinc-900/60 rounded-full py-2 border border-zinc-800/40">
              <input
                type="range"
                id={`slider_${band.frequency}`}
                min="-12"
                max="12"
                step="1"
                value={band.gain}
                onChange={(e) => onBandChange(idx, Number(e.target.value))}
                className="accent-cyan-400 h-full w-2 cursor-col-resize cursor-row-resize"
                style={{
                  writingMode: "sideways-lr",
                  WebkitAppearance: "slider-vertical",
                }}
              />
            </div>

            {/* Label and frequency */}
            <div className="text-center">
              <div className="font-display font-medium text-[9px] text-zinc-300 antialiased truncate w-14">
                {band.label}
              </div>
              <div className="font-mono text-[8px] text-zinc-500 mt-0.5">
                {band.frequency >= 1000 ? `${band.frequency / 1000}kHz` : `${band.frequency}Hz`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
