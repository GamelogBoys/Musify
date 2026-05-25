import { Compass, Sparkles, Zap } from "lucide-react";
import { SpatialSettings } from "../types";

interface SpatialEffectsProps {
  settings: SpatialSettings;
  onChange: (key: keyof SpatialSettings, value: number) => void;
}

export default function SpatialEffects({ settings, onChange }: SpatialEffectsProps) {
  return (
    <div className="bg-zinc-950 border border-zinc-800/85 rounded-xl p-5 flex flex-col gap-4.5 h-full relative" id="spatial_effects_panel">
      {/* Decorative corners */}
      <div className="absolute top-2.5 left-2.5 w-1.5 h-1.5 rounded-full bg-zinc-800 border border-zinc-700/50"></div>
      <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-zinc-800 border border-zinc-700/50"></div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-indigo-400" />
          <h3 className="font-display font-semibold text-zinc-150 text-sm tracking-wide uppercase">
            Acoustic Spatializer & Pitch
          </h3>
        </div>
        <span className="font-mono text-[9px] text-zinc-500 bg-zinc-900 border border-zinc-800/80 px-2 py-0.5 rounded uppercase">
          Stereo Expander
        </span>
      </div>

      <div className="flex flex-col gap-4.5 mt-2">
        {/* 1. Binaural Panning Slider */}
        <div className="flex flex-col gap-2 bg-zinc-900/40 border border-zinc-900/80 rounded-lg p-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-display font-medium text-zinc-300 flex items-center gap-1.5">
              Stereo Balance
            </span>
            <span className="font-mono text-[10px] text-indigo-400 font-semibold">
              {settings.panning === 0
                ? "CENTER"
                : settings.panning < 0
                ? `L ${Math.abs(Math.round(settings.panning * 100))}%`
                : `R ${Math.round(settings.panning * 100)}%`}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[9px] text-zinc-500 font-medium">L</span>
            <input
              type="range"
              id="slider_panning"
              min="-1"
              max="1"
              step="0.05"
              value={settings.panning}
              onChange={(e) => onChange("panning", Number(e.target.value))}
              className="flex-1 accent-indigo-400 h-1.5 cursor-pointer rounded-full bg-zinc-850"
            />
            <span className="font-mono text-[9px] text-zinc-500 font-medium">R</span>
          </div>
          <p className="font-mono text-[8.5px] text-zinc-500">
            Calibrates signals between the left and right speakers for dual-channel field separation.
          </p>
        </div>

        {/* 2. Feedback Wet Delay Reverb Simulation */}
        <div className="flex flex-col gap-2 bg-zinc-900/40 border border-zinc-900/80 rounded-lg p-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-display font-medium text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Ambient Feedback Reverb
            </span>
            <span className="font-mono text-[10px] text-indigo-400 font-semibold">
              {Math.round(settings.reverbLevel * 100)}% <span className="text-[8px] text-zinc-500">WET</span>
            </span>
          </div>
          <input
            type="range"
            id="slider_reverb"
            min="0"
            max="1"
            step="0.02"
            value={settings.reverbLevel}
            onChange={(e) => onChange("reverbLevel", Number(e.target.value))}
            className="w-full accent-indigo-400 h-1.5 cursor-pointer rounded-full bg-zinc-850"
          />
          <p className="font-mono text-[8.5px] text-zinc-500">
            Feeds audio into a feedback loop to simulate acoustic decay (perfect for testing room response).
          </p>
        </div>

        {/* 3. Tape Pitch / Playback Rate */}
        <div className="flex flex-col gap-2 bg-zinc-900/40 border border-zinc-900/80 rounded-lg p-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-display font-medium text-zinc-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              Varispeed Pitch Engine
            </span>
            <span className="font-mono text-[10px] text-indigo-400 font-semibold">
              {settings.pitchRate.toFixed(2)}x
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[9px] text-zinc-500">SLO</span>
            <input
              type="range"
              id="slider_pitch"
              min="0.5"
              max="2"
              step="0.05"
              value={settings.pitchRate}
              onChange={(e) => onChange("pitchRate", Number(e.target.value))}
              className="flex-1 accent-indigo-400 h-1.5 cursor-pointer rounded-full bg-zinc-850"
            />
            <span className="font-mono text-[9px] text-zinc-500">FST</span>
          </div>
          <p className="font-mono text-[8.5px] text-zinc-500">
            Dynamically shifts sample-rate clock, scaling speed and audio pitch relative to each other.
          </p>
        </div>
      </div>
    </div>
  );
}
