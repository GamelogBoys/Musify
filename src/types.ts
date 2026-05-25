export interface Track {
  id: string;
  title: string;
  artist: string;
  genre: string;
  url: string;
  sampleRate: number; // kHz, e.g. 44.1, 48, 96, 192
  bitDepth: number;   // bits, e.g. 16, 24, 32
  bitrate: number;    // kbps, e.g. 1411, 2304, 320
  duration: number;   // seconds
  coverUrl: string;
  description: string;
  isLocal: boolean;
  publisherId?: string;
  createdAt?: string;
}

export type EqualizerPreset = "Flat" | "Bass Booster" | "Treble Booster" | "Acoustic" | "Vocal Booster";

export interface EqualizerBand {
  frequency: number;
  gain: number; // dB (-12 to 12)
  type: BiquadFilterType;
  label: string;
}

export interface SpatialSettings {
  panning: number; // -1 to 1 (left to right)
  reverbLevel: number; // 0 to 1 (room blend simulation)
  pitchRate: number; // 0.5 to 2.0 (playback speed)
}

export interface AudioPerformanceStats {
  latency: number; // ms
  bufferSize: number;
  channels: number;
  outputSampleRate: number;
  qualityLevel: "Lossless" | "Studio Master" | "Ultra-HD" | "CD Quality" | "Standard MP3";
}
