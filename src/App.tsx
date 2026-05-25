import { useState, useEffect, useRef } from "react";
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
  Upload, Disc, Radio, Activity, Sparkles, AlertCircle, Info, Music
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { Track, EqualizerBand, EqualizerPreset, SpatialSettings, AudioPerformanceStats } from "./types";
import VisualizerCanvas from "./components/VisualizerCanvas";
import EqualizerSettings from "./components/EqualizerSettings";
import SpatialEffects from "./components/SpatialEffects";
import TrackList from "./components/TrackList";
import UploadModal from "./components/UploadModal";

// Interactive Supabase and telemetry analytics components
import { logPlayEvent } from "./supabase";
import AuthWidget from "./components/AuthWidget";
import GrowthGraph from "./components/GrowthGraph";
import GeminiPublisherCopilot from "./components/GeminiPublisherCopilot";

const DEFAULT_FALLBACK_TRACKS: Track[] = [
  {
    id: "fallback-sh-1",
    title: "Vapor Synth Horizon",
    artist: "Helix Collective",
    genre: "Ambient Synthwave",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    sampleRate: 96,
    bitDepth: 24,
    bitrate: 1411,
    duration: 372,
    coverUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80",
    description: "Analog vintage synthesizer signals modulated with high-precision studio mastering filters.",
    isLocal: false
  },
  {
    id: "fallback-sh-2",
    title: "Asymptotic Cyber Drift",
    artist: "Dyna-DAMP DSP Group",
    genre: "Glitch Hop / Electro",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    sampleRate: 48,
    bitDepth: 24,
    bitrate: 1411,
    duration: 423,
    coverUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=80",
    description: "High-transient acoustic drums and custom wavetable leads, optimized for stereophonic panning tests.",
    isLocal: false
  },
  {
    id: "fallback-sh-3",
    title: "Neon Echo Chambers",
    artist: "Resonance Theory",
    genre: "Experimental / Ambient",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    sampleRate: 192,
    bitDepth: 32,
    bitrate: 2304,
    duration: 302,
    coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&auto=format&fit=crop&q=80",
    description: "Sub-harmonic acoustic patterns perfect for dynamic parametric equalizer adjustments.",
    isLocal: false
  }
];

export default function App() {
  // Playlist State
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [errorText, setErrorText] = useState("");

  // Authenticated Profile State
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<"acc" | "publisher acc" | null>(null);

  // De-duplicating Playback Ref for statistics logs
  const recordedTrackRef = useRef<string | null>(null);

  // Record safe play telemetry write into secure Supabase database
  const recordPlayEvent = async (track: Track | null) => {
    if (!track) return;
    if (recordedTrackRef.current === track.id) return;

    recordedTrackRef.current = track.id;

    try {
      await logPlayEvent(
        track.id,
        track.title,
        track.publisherId || "guest",
        firebaseUser?.uid || "guest"
      );
    } catch (err: any) {
      console.warn("Supabase bypass: guest-mode play event bypassed.", err.message);
    }
  };


  // Playback Progress States
  const [progress, setProgress] = useState(0);
  const [currentTimeValue, setCurrentTimeValue] = useState(0);
  const [durationValue, setDurationValue] = useState(0);

  // Audio Pipeline References
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const bandsRef = useRef<BiquadFilterNode[]>([]);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const delayRef = useRef<DelayNode | null>(null);
  const feedbackRef = useRef<GainNode | null>(null);
  const delayGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Synchronized state for components
  const [rendererAnalyser, setRendererAnalyser] = useState<AnalyserNode | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);

  // volume state (0 to 1)
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);

  // DSP Configuration States
  const [equalizerBands, setEqualizerBands] = useState<EqualizerBand[]>([
    { frequency: 60, gain: 0, type: "peaking", label: "Bass-Sub" },
    { frequency: 230, gain: 0, type: "peaking", label: "Bass" },
    { frequency: 910, gain: 0, type: "peaking", label: "Midrange" },
    { frequency: 4000, gain: 0, type: "peaking", label: "Upper Mid" },
    { frequency: 14000, gain: 0, type: "peaking", label: "Treble-Air" }
  ]);
  const [activePreset, setActivePreset] = useState<EqualizerPreset>("Flat");
  
  const [spatialSettings, setSpatialSettings] = useState<SpatialSettings>({
    panning: 0,
    reverbLevel: 0.15,
    pitchRate: 1.0
  });

  const [performanceStats, setPerformanceStats] = useState<AudioPerformanceStats>({
    latency: 0,
    bufferSize: 2048,
    channels: 2,
    outputSampleRate: 44100,
    qualityLevel: "standard" as any
  });

  // UI Modes
  const [visMode, setVisMode] = useState<"spectrum" | "oscilloscope" | "phase">("spectrum");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [audioEngineStatus, setAudioEngineStatus] = useState<"OFFLINE" | "STABLE" | "HIGH_RES">("OFFLINE");

  // Fetch Tracks on Mount
  useEffect(() => {
    async function loadTracks() {
      try {
        const response = await fetch("/api/tracks");
        if (!response.ok) {
          throw new Error("Could not fetch database signals.");
        }
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setTracks(data);
          setCurrentTrack(data[0]);
        } else {
          setTracks(DEFAULT_FALLBACK_TRACKS);
          setCurrentTrack(DEFAULT_FALLBACK_TRACKS[0]);
        }
      } catch (err: any) {
        console.error("Failed to load tracks from API:", err);
        setErrorText("Serving high-fidelity fallback signals (Server offline or booting).");
        setTracks(DEFAULT_FALLBACK_TRACKS);
        setCurrentTrack(DEFAULT_FALLBACK_TRACKS[0]);
      }
    }
    loadTracks();
  }, []);

  // Initialize Audio Logic
  const initializeAudio = () => {
    if (audioContextRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass({ latencyHint: "interactive" });
      audioContextRef.current = ctx;

      const audio = audioRef.current || new Audio();
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      // Create graph nodes
      const source = ctx.createMediaElementSource(audio);
      sourceRef.current = source;

      // 1. Five peak-parametric Equalizer bands
      const bands = equalizerBands.map((band) => {
        const node = ctx.createBiquadFilter();
        node.type = band.type;
        node.frequency.value = band.frequency;
        node.Q.value = 1.0;
        node.gain.value = band.gain;
        return node;
      });
      bandsRef.current = bands;

      // 2. Stereo Panner for space separation
      const panner = ctx.createStereoPanner();
      panner.pan.value = spatialSettings.panning;
      pannerRef.current = panner;

      // 3. Reverb simulation delay lines
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.35; // 350ms ambient delay
      delayRef.current = delay;

      const feedback = ctx.createGain();
      feedback.gain.value = 0.45; // loop decay factor
      feedbackRef.current = feedback;

      const delayGain = ctx.createGain();
      delayGain.gain.value = spatialSettings.reverbLevel * 0.4; // blend factor mapping
      delayGainRef.current = delayGain;

      // wire up reverb feedback loop: delay -> feedback -> delay
      delay.connect(feedback);
      feedback.connect(delay);

      // 4. Spectrum Analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;

      // Chaining nodes sequence:
      // Source -> filter1 -> filter2 -> filter3 -> filter4 -> filter5 -> panner -> analyser -> Destination
      source.connect(bands[0]);
      for (let i = 0; i < bands.length - 1; i++) {
        bands[i].connect(bands[i + 1]);
      }
      bands[bands.length - 1].connect(panner);

      // Dry path: Panner directly into Analyser
      panner.connect(analyser);

      // Parallel Spatial Path: Panner -> Delay Line -> Feedback -> delayGain -> Analyser
      panner.connect(delay);
      feedback.connect(delayGain);
      delayGain.connect(analyser);

      // Finally target physical speakers
      analyser.connect(ctx.destination);

      // Sync active states
      setRendererAnalyser(analyser);
      
      const isHighRes = (currentTrack?.sampleRate || 44.1) > 48;
      setAudioEngineStatus(isHighRes ? "HIGH_RES" : "STABLE");

      // Update system specs state
      setPerformanceStats({
        latency: Math.round(ctx.baseLatency ? ctx.baseLatency * 1000 : 8.5),
        bufferSize: 512,
        channels: ctx.destination.numberOfInputs || 2,
        outputSampleRate: ctx.sampleRate,
        qualityLevel: isHighRes ? "Studio Master" : "CD Quality"
      });
    } catch (e) {
      console.error("Failed to construct audio hardware interfaces:", e);
      setErrorText("Your browser security prevents Web Audio direct DAC connections.");
    }
  };

  // Listen for audio player events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isSeeking && audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTimeValue(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDurationValue(audio.duration || 0);
    };

    const handleEnded = () => {
      handleNextTrack();
    };

    const handleCanPlay = () => {
      setIsLoadingAudio(false);
    };

    const handleError = () => {
      setIsLoadingAudio(false);
      const audioInput = audioRef.current;
      if (audioInput && audioInput.crossOrigin === "anonymous") {
        console.warn("CORS check failed for track URL. Activating safe compatibility playback mode...");
        audioInput.removeAttribute("crossorigin");
        audioInput.crossOrigin = null;
        setErrorText("Visualizer restricted due to lack of CORS headers, but playing track in safe compatibility mode!");
        
        audioInput.load();
        audioInput.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.error("Safe bypass playback failed too:", err);
          setErrorText("This track's audio signal is currently inaccessible.");
          setIsPlaying(false);
        });
      } else {
        setErrorText("Stream timed out or audio signal is inaccessible.");
        setIsPlaying(false);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("error", handleError);
    };
  }, [currentTrack, isSeeking]);

  // Handle Play Action
  const togglePlay = async () => {
    if (!currentTrack) return;

    try {
      if (!audioContextRef.current) {
        initializeAudio();
      }

      // Resume context if suspended by browser
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }

      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        if (!audio.src || audio.src !== currentTrack.url) {
          setIsLoadingAudio(true);
          audio.crossOrigin = "anonymous";
          audio.src = currentTrack.url;
          audio.load();
        }
        audio.playbackRate = spatialSettings.pitchRate;
        audio.volume = isMuted ? 0 : volume;
        
        await audio.play();
        setIsPlaying(true);
        setErrorText("");
        
        // Log telemetry play event for the current track
        recordPlayEvent(currentTrack);
      }
    } catch (err: any) {
      console.error("Playback execution error:", err);
      setIsPlaying(false);
    }
  };

  // Change Track
  const handleTrackSelect = async (track: Track) => {
    setCurrentTrack(track);
    setIsLoadingAudio(true);
    setErrorText("");

    if (!audioContextRef.current) {
      initializeAudio();
    }

    // Force context active
    if (audioContextRef.current && audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    const audio = audioRef.current;
    if (audio) {
      audio.crossOrigin = "anonymous";
      audio.src = track.url;
      audio.load();
      audio.playbackRate = spatialSettings.pitchRate;
      audio.volume = isMuted ? 0 : volume;

      // Reset unique tracker ref for the fresh track, then issue play telemetry log
      recordedTrackRef.current = null;

      if (isPlaying) {
        try {
          await audio.play();
          recordPlayEvent(track);
        } catch (e) {
          console.warn("Autoplay blocked:", e);
          setIsPlaying(false);
        }
      } else {
        // Auto-start play when selecting a new track
        try {
          await audio.play();
          setIsPlaying(true);
          recordPlayEvent(track);
        } catch (e) {
          console.warn("Autoplay blocked:", e);
        }
      }
    }

    // Update Telemetry info based on track quality
    const isHighRes = track.sampleRate > 48;
    setAudioEngineStatus(isHighRes ? "HIGH_RES" : "STABLE");
    if (audioContextRef.current) {
      setPerformanceStats((prev) => ({
        ...prev,
        qualityLevel: isHighRes ? "Studio Master" : "CD Quality"
      }));
    }
  };

  // Progress Seek Fader
  const handleProgressChange = (newValue: number) => {
    const audio = audioRef.current;
    if (audio && audio.duration) {
      audio.currentTime = (newValue / 100) * audio.duration;
      setProgress(newValue);
      setCurrentTimeValue(audio.currentTime);
    }
  };

  // Audio Volume Change
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (newVol > 0) setIsMuted(false);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = newVol;
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (isMuted) {
      setIsMuted(false);
      setVolume(prevVolume);
      if (audio) audio.volume = prevVolume;
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      setVolume(0);
      if (audio) audio.volume = 0;
    }
  };

  // Filter Band Fader changed
  const handleBandGainChange = (index: number, newGain: number) => {
    const updated = [...equalizerBands];
    updated[index].gain = newGain;
    setEqualizerBands(updated);
    setActivePreset("Flat"); // broke preset

    // Push into active hardware filter channel immediately
    const filterNode = bandsRef.current[index];
    if (filterNode && audioContextRef.current) {
      filterNode.gain.setValueAtTime(newGain, audioContextRef.current.currentTime);
    }
  };

  // Selector Preset
  const handlePresetSelect = (preset: EqualizerPreset) => {
    setActivePreset(preset);
    let values = [0, 0, 0, 0, 0];

    switch (preset) {
      case "Flat":
        values = [0, 0, 0, 0, 0];
        break;
      case "Bass Booster":
        values = [9, 6, 2, 0, 0]; // Low heavy boost
        break;
      case "Treble Booster":
        values = [-2, 0, 1, 5, 8]; // High airy air
        break;
      case "Acoustic":
        values = [4, 2, 1, 3, 3]; // Presence wood curves
        break;
      case "Vocal Booster":
        values = [-4, -2, 5, 6, 1]; // vocal focal midrange lines
        break;
    }

    const updated = equalizerBands.map((band, idx) => {
      const node = bandsRef.current[idx];
      if (node && audioContextRef.current) {
        node.gain.setValueAtTime(values[idx], audioContextRef.current.currentTime);
      }
      return { ...band, gain: values[idx] };
    });

    setEqualizerBands(updated);
  };

  // Acoustic Spatializer Adjustments
  const handleSpatialChange = (key: keyof SpatialSettings, value: number) => {
    setSpatialSettings((prev) => ({ ...prev, [key]: value }));

    if (key === "panning") {
      if (pannerRef.current && audioContextRef.current) {
        pannerRef.current.pan.setValueAtTime(value, audioContextRef.current.currentTime);
      }
    } else if (key === "reverbLevel") {
      if (delayGainRef.current && audioContextRef.current) {
        // Map 0...1 to 0..0.45 safe level range for delay wetness
        delayGainRef.current.gain.setValueAtTime(value * 0.45, audioContextRef.current.currentTime);
      }
    } else if (key === "pitchRate") {
      if (audioRef.current) {
        audioRef.current.playbackRate = value;
      }
    }
  };

  // Track Transport
  const handleNextTrack = () => {
    if (tracks.length === 0 || !currentTrack) return;
    const index = tracks.findIndex((t) => t.id === currentTrack.id);
    const nextIdx = (index + 1) % tracks.length;
    handleTrackSelect(tracks[nextIdx]);
  };

  const handlePrevTrack = () => {
    if (tracks.length === 0 || !currentTrack) return;
    const index = tracks.findIndex((t) => t.id === currentTrack.id);
    const prevIdx = index === 0 ? tracks.length - 1 : index - 1;
    handleTrackSelect(tracks[prevIdx]);
  };

  // Add Uploaded Track to Playlist
  const handleUploadSuccess = (newTrack: Track) => {
    setTracks((prev) => [newTrack, ...prev]);
    setCurrentTrack(newTrack);
    // Instant playback of newly uploaded tracks
    handleTrackSelect(newTrack);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans" id="app_root_frame">
      <audio ref={audioRef} style={{ display: "none" }} />
      
      {/* 1. Header Toolbar */}
      <header className="border-b border-zinc-900 bg-zinc-950 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 select-none">
        
        {/* Left Side: Brand info with subtle visual flashing indicator */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            {/* Spinning glowing status node */}
            <span className="absolute inset-0 w-8 h-8 rounded-full bg-cyan-500/20 pulsing-glow animate-pulse"></span>
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow">
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div>
            <h1 className="font-display font-black tracking-tight text-base uppercase text-zinc-100 flex items-center gap-1.5 antialiased" id="musify_logo">
              MUSIFY <span className="text-cyan-400">HI-RES</span>
            </h1>
            <p className="font-mono text-[9px] tracking-widest text-zinc-500 uppercase">
              STUDIO HIGH-FI RAW AUDIO
            </p>
          </div>
        </div>

        {/* Telemetry Core System Status display */}
        <div className="flex flex-wrap items-center gap-3.5 bg-zinc-900/60 border border-zinc-850 px-4 py-2 rounded-xl">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${audioEngineStatus !== "OFFLINE" ? "bg-emerald-400 animate-pulse" : "bg-zinc-650"}`}></span>
            <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
              DAC ENGINE:{" "}
              {audioEngineStatus === "OFFLINE" && <span className="text-zinc-550">OFFLINE</span>}
              {audioEngineStatus === "STABLE" && <span className="text-cyan-400">44.1K ACTIVE</span>}
              {audioEngineStatus === "HIGH_RES" && <span className="text-indigo-400">96K HIGH-RES DIRECT-D/A</span>}
            </span>
          </div>

          <div className="h-3.5 w-[1px] bg-zinc-800 hidden md:block"></div>

          <div className="font-mono text-[9px] text-zinc-500 hidden md:flex gap-3">
            <span>CH: <strong className="text-zinc-300">{performanceStats.channels} L/R</strong></span>
            <span>SYSTEM OUT: <strong className="text-zinc-300">{performanceStats.outputSampleRate}Hz</strong></span>
            <span>DSP LATENCY: <strong className="text-zinc-300">{performanceStats.latency}ms</strong></span>
          </div>
        </div>

        {/* Identity & Actions Container */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto" id="identity_actions_toolbar">
          <AuthWidget onUserChange={(user, role) => {
            setFirebaseUser(user);
            setUserRole(role);
          }} />

          {/* Action button: conditional on publisher role */}
          {userRole === "publisher acc" ? (
            <button
              onClick={() => {
                setIsUploadOpen(true);
                setErrorText("");
              }}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-zinc-950 font-sans font-bold text-xs uppercase rounded-xl shadow-lg shadow-cyan-500/10 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-1.5 w-full sm:w-auto justify-center cursor-pointer font-semibold"
              id="btn_open_upload"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2.5]" id="upload_icon_nav"/>
              Publish Track Art
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1 font-mono text-[8.5px] text-zinc-550 border border-zinc-900 px-3 py-2 rounded-xl">
              <span>Gain Publisher Role to Upload</span>
            </div>
          )}
        </div>
      </header>

      {/* 2. Central Station Matrix Grid */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* LEFT COLUMN: Deck playback, visualizer (Takes 7 Cols on desktop) */}
        <section className="lg:col-span-7 flex flex-col gap-5 justify-between" id="audio_processing_rack">
          
          {/* Empty Awaiting Master State Banner */}
          {!currentTrack && (
            <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-4 relative overflow-hidden h-full min-h-[220px]" id="empty_track_board">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-[40px] pointer-events-none"></div>
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-850 flex items-center justify-center relative shadow-md">
                <span className="absolute inset-0 w-full h-full rounded-full bg-cyan-500/10 animate-ping"></span>
                <Music className="w-6 h-6 text-cyan-400" />
              </div>
              <div className="space-y-1">
                <h2 className="font-display font-black text-xs tracking-widest uppercase text-zinc-300">
                  Awaiting Signal Transmission
                </h2>
                <p className="text-zinc-500 text-[11px] max-w-sm leading-relaxed font-sans">
                  Musify is operating in local high-res mode. Click <span className="text-cyan-400 font-bold">Publish Track Art</span> at the top right to upload and broadcast your studio files.
                </p>
              </div>
            </div>
          )}

          {/* Active Audio Card Header & Info */}
          {currentTrack && (
            <div className="bg-zinc-950 border border-zinc-800/85 rounded-xl p-5 flex flex-col sm:flex-row gap-5 items-center relative overflow-hidden" id="active_track_board">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-[40px] pointer-events-none"></div>

              {/* Cover Art layout */}
              <div className="w-32 h-32 rounded-lg overflow-hidden relative shadow-md border border-zinc-900 group flex-shrink-0 bg-zinc-950">
                <img
                  src={currentTrack.coverUrl}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                
                {isLoadingAudio && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin"></div>
                  </div>
                )}
              </div>

              {/* Specifications and dynamic notes */}
              <div className="flex-1 min-w-0 text-center sm:text-left flex flex-col">
                <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap">
                  <span className="font-mono text-[9px] bg-cyan-950/50 border border-cyan-800/40 text-cyan-400 px-2 py-0.5 rounded uppercase tracking-wide font-bold">
                    {currentTrack.isLocal ? "Independent Upload" : "Standard Reference Track"}
                  </span>
                  
                  {/* Glowing ultra-hifi badge */}
                  {(currentTrack.sampleRate >= 96) && (
                    <span className="font-mono text-[9px] bg-amber-950/50 border border-amber-800/40 text-amber-400 px-2 py-0.5 rounded uppercase tracking-wide font-semibold flex items-center gap-1 shadow-sm">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                      GOLD-GRADE MASTER
                    </span>
                  )}
                </div>

                <h2 className="font-display font-black text-xl text-zinc-100 tracking-tight mt-2.5 truncate">
                  {currentTrack.title}
                </h2>
                
                <h3 className="text-zinc-400 text-xs mt-0.5 font-medium">
                  {currentTrack.artist}
                </h3>

                <p className="text-zinc-500 text-[10.5px] mt-2.5 leading-relaxed font-normal min-h-[38px] line-clamp-2">
                  {currentTrack.description}
                </p>

                {/* Specific format tech line */}
                <div className="mt-2.5 flex items-center justify-center sm:justify-start gap-4 font-mono text-[9px] text-zinc-500 border-t border-zinc-900 pt-2.5">
                  <div className="flex flex-col">
                    <span className="text-[7.5px] uppercase text-zinc-650">A/D Sampling</span>
                    <span className="text-zinc-350 font-bold mt-0.5">{currentTrack.sampleRate} kHz</span>
                  </div>
                  <div className="h-6 w-[1.5px] bg-zinc-900"></div>
                  <div className="flex flex-col">
                    <span className="text-[7.5px] uppercase text-zinc-650">Quantization</span>
                    <span className="text-zinc-350 font-bold mt-0.5">{currentTrack.bitDepth} Bits</span>
                  </div>
                  <div className="h-6 w-[1.5px] bg-zinc-900"></div>
                  <div className="flex flex-col">
                    <span className="text-[7.5px] uppercase text-zinc-650">Band Bitrate</span>
                    <span className="text-zinc-350 font-bold mt-0.5">{currentTrack.bitrate} kbps</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Core Visualizer Box */}
          <div className="bg-zinc-950 border border-zinc-800/85 rounded-xl p-5 flex-1 flex flex-col gap-4 min-h-[310px]" id="visualizer_monitor">
            <div className="flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="font-display font-semibold text-xs text-zinc-200 tracking-wider uppercase">
                  Telemetry Oscilloscope & Spectrum
                </span>
              </div>
              
              {/* Dynamic canvas view-mode switcher */}
              <div className="flex items-center bg-zinc-900 border border-zinc-850 p-0.5 rounded-lg text-[10px] font-mono">
                {(["spectrum", "oscilloscope", "phase"] as const).map((mode) => (
                  <button
                    key={mode}
                    id={`btn_vis_${mode}`}
                    onClick={() => setVisMode(mode)}
                    className={`px-2.5 py-1 rounded transition-colors uppercase cursor-pointer ${
                      visMode === mode
                        ? "bg-zinc-800 text-cyan-400 font-bold shadow-sm"
                        : "text-zinc-500 hover:text-zinc-350"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Canvas wrapper */}
            <div className="flex-1 min-h-[220px]">
              <VisualizerCanvas
                analyserNode={rendererAnalyser}
                isPlaying={isPlaying}
                mode={visMode}
              />
            </div>
          </div>

          {/* Master Deck Transport Controls */}
          <div className="bg-zinc-950 border border-zinc-800/85 rounded-xl p-5 flex flex-col gap-4 select-none" id="deck_transport_rack">
            
            {/* Timeline Progress dragging bar */}
            <div className="flex items-center gap-3.5">
              <span className="font-mono text-[9px] text-zinc-400 w-9 text-right tabular-nums">
                {formatTime(currentTimeValue)}
              </span>

              {/* Progress input line */}
              <div className="flex-1 relative group py-2">
                <input
                  type="range"
                  id="seek_slider"
                  min="0"
                  max="100"
                  value={progress}
                  onMouseDown={() => setIsSeeking(true)}
                  onTouchStart={() => setIsSeeking(true)}
                  onMouseUp={() => setIsSeeking(false)}
                  onTouchEnd={() => setIsSeeking(false)}
                  onChange={(e) => handleProgressChange(Number(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 rounded-full bg-zinc-850 cursor-pointer flex items-center"
                />
                
                {/* Visual Glow Rail Overlay */}
                <div 
                  className="absolute left-0 top-[15px] bg-gradient-to-r from-cyan-500 to-indigo-505 h-1.5 rounded-full pointer-events-none group-hover:block transition-all"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>

              <span className="font-mono text-[9px] text-zinc-400 w-9 text-left tabular-nums">
                {formatTime(durationValue)}
              </span>
            </div>

            {/* Error messaging line */}
            <AnimatePresence>
              {errorText && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-red-950/50 border border-red-500/20 rounded-lg p-2.5 text-red-300 text-[10px] font-mono flex items-center gap-2"
                >
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  <span>{errorText}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Physical Transport deck keys */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Skip keys / playing */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevTrack}
                  className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-cyan-400 active:scale-95 duration-100 transition-all flex items-center justify-center cursor-pointer hover:border-zinc-700"
                  title="Previous reference file"
                  id="btn_prev_track"
                >
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>

                {/* Big play button with glowing drop shadow when powering on */}
                <button
                  onClick={togglePlay}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer border ${
                    isPlaying
                      ? "bg-cyan-500 text-zinc-950 border-cyan-400 shadow-md shadow-cyan-500/25"
                      : "bg-zinc-90 w-14 border-zinc-800 text-zinc-100 hover:text-cyan-400 hover:border-cyan-500/40"
                  }`}
                  title={isPlaying ? "Suspend Deck output" : "Engage D/A hardware play"}
                  id="btn_play_pause"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 stroke-[2.5px] fill-current" />
                  ) : (
                    <Play className="w-6 h-6 stroke-[2.5px] translate-x-0.5 fill-current" />
                  )}
                </button>

                <button
                  onClick={handleNextTrack}
                  className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-cyan-400 active:scale-95 duration-100 transition-all flex items-center justify-center cursor-pointer hover:border-zinc-700"
                  title="Next reference file"
                  id="btn_next_track"
                >
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
              </div>

              {/* Volume rack faders */}
              <div className="flex items-center gap-2.5 w-full sm:w-auto" id="volume_control_rack">
                <button
                  onClick={toggleMute}
                  className="text-zinc-400 hover:text-cyan-400 cursor-pointer p-1"
                  id="btn_mute_toggle"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                
                <input
                  type="range"
                  id="slider_volume"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full sm:w-28 accent-cyan-400 h-1 rounded-full bg-zinc-850 cursor-pointer"
                />

                <span className="font-mono text-[9px] text-zinc-500 w-8">
                  {isMuted ? "MUT" : `${Math.round(volume * 100)}%`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Parametric Equalizer, Spatial, Tracklist (Takes 5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-5 justify-between">
          
          {/* Real-time Publisher Analytics telemetry cockpit */}
          {userRole === "publisher acc" && firebaseUser && (
            <div className="flex-shrink-0" id="rack_publisher_analytics">
              <GrowthGraph userId={firebaseUser.uid} />
            </div>
          )}

          {/* Track Monitor Rack (Available signals list) */}
          <div className="flex-1 min-h-[300px]" id="rack_available_tracks">
            <TrackList
              tracks={tracks}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onTrackSelect={handleTrackSelect}
            />
          </div>

          {/* 5-Band Equalizer rack unit */}
          <div className="flex-1" id="rack_parametric_eq">
            <EqualizerSettings
              bands={equalizerBands}
              activePreset={activePreset}
              onBandChange={handleBandGainChange}
              onPresetSelect={handlePresetSelect}
            />
          </div>

          {/* Panner / Varispeed Pitch and Spatial effects rack */}
          <div className="flex-shrink-0" id="rack_spatializer">
            <SpatialEffects
              settings={spatialSettings}
              onChange={handleSpatialChange}
            />
          </div>
        </section>
      </main>

      {/* 3. Footer Credit / Safety Warnings */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-6 text-center text-zinc-650 font-mono text-[8.5px] select-none flex flex-col md:flex-row justify-between items-center gap-2">
        <span>© 2026 MUSIFY HI-RES LABS INC. ALL INDEPENDENT ART WORK AND METADATA IS LOCALLY DEPLOYED AND RENDERED ACTIVE.</span>
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3 text-zinc-600" />
          Web Audio Core: Node-cascade network initialized safely.
        </span>
      </footer>

      {/* 4. Independent Artist Upload Panel Drawer (Portal Modal) */}
      <AnimatePresence>
        {isUploadOpen && (
          <UploadModal
            onClose={() => setIsUploadOpen(false)}
            onUploadSuccess={handleUploadSuccess}
            userId={firebaseUser?.uid}
            userDisplayName={firebaseUser?.displayName}
          />
        )}
      </AnimatePresence>

      {/* 5. Music Publisher Copilot Drawer (Side expansion) */}
      {userRole === "publisher acc" && (
        <GeminiPublisherCopilot
          tracks={tracks}
          currentTrack={currentTrack}
        />
      )}
    </div>
  );
}
