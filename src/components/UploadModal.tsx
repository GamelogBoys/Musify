import React, { useState, useRef } from "react";
import { Upload, X, Music, Disc, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Track } from "../types";

interface UploadModalProps {
  onClose: () => void;
  onUploadSuccess: (track: Track) => void;
  userId?: string;
  userDisplayName?: string;
}

export default function UploadModal({ onClose, onUploadSuccess, userId, userDisplayName }: UploadModalProps) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState(userDisplayName || "Independent Artist");
  const [genre, setGenre] = useState("Independent Hi-Fi");
  const [description, setDescription] = useState("");
  const [sampleRate, setSampleRate] = useState("96"); // Default 96 kHz
  const [bitDepth, setBitDepth] = useState("24"); // Default 24 bit
  const [coverUrl, setCoverUrl] = useState("");
  
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBase64, setAudioBase64] = useState<string>("");
  const [coverBase64, setCoverBase64] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [successInfo, setSuccessInfo] = useState<Track | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-calculated Bitrate
  const calculatedBitrate = Math.round((Number(sampleRate) * Number(bitDepth) * 2)); // Dynamic stereo estimation in kbps

  // Handle Drag Events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processAudioFile(e.dataTransfer.files[0]);
    }
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processAudioFile(e.target.files[0]);
    }
  };

  const processAudioFile = (file: File) => {
    const isAudio = file.type.startsWith("audio/") || 
                    file.name.endsWith(".wav") || 
                    file.name.endsWith(".mp3") || 
                    file.name.endsWith(".flac") || 
                    file.name.endsWith(".m4a");
    if (!isAudio) {
      setErrorMessage("Please select a valid high-fidelity audio container (.mp3, .wav, .flac, .m4a).");
      return;
    }

    if (file.size > 26 * 1024 * 1024) {
      setErrorMessage("File exceeds 26MB. Please upload compressed high-fidelity MP3s or smaller WAV fragments for standard streaming speeds.");
      return;
    }

    setErrorMessage("");
    setAudioFile(file);

    // Convert file to Base64 in chunked state
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result && typeof reader.result === "string") {
        setAudioBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Convert Cover Art File to Base64
  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith("image/")) {
        setErrorMessage("Please select a valid image file for cover art.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result && typeof reader.result === "string") {
          setCoverBase64(reader.result);
          setCoverUrl(""); // override url value
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger file submission to custom server.ts /api/upload
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) {
      setErrorMessage("Track title and artist name are required.");
      return;
    }
    if (!audioFile || !audioBase64) {
      setErrorMessage("A high-fidelity audio source file must be selected/dropped.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);
    setErrorMessage("");

    try {
      const payload = {
        title,
        artist,
        genre,
        audioData: audioBase64,
        audioFileName: audioFile.name,
        sampleRate: Number(sampleRate),
        bitDepth: Number(bitDepth),
        bitrate: calculatedBitrate,
        coverUrl: coverBase64 || coverUrl || undefined,
        description: description.trim() || undefined,
        publisherId: userId || "guest"
      };

      setUploadProgress(45);
      
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setUploadProgress(85);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to catalog track onto the audio server.");
      }

      const result = await response.json();
      setUploadProgress(100);

      if (result.success && result.track) {
        setSuccessInfo(result.track);
        onUploadSuccess(result.track);
      } else {
        throw new Error("Invalid response received from the upload stream.");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected network error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md transition-all duration-300 overflow-y-auto" id="artist_upload_hub">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col my-8 animate-fade-in text-zinc-100">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-cyan-400" />
            <h2 className="font-display font-bold text-base tracking-wide uppercase">
              Independent Artist Upload Hub
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            disabled={isUploading}
            id="close_upload_modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Dynamic Body */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          {successInfo ? (
            /* Success Dashboard */
            <div className="flex flex-col items-center justify-center text-center py-10 gap-6 animate-scale-up">
              <div className="w-16 h-16 rounded-full bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-10 h-10 text-cyan-400" />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-display font-semibold text-lg text-zinc-150">
                  Track Mastered & Published!
                </h3>
                <p className="text-zinc-400 text-xs max-w-sm">
                  Your High-Fidelity track is now actively patched into the listener stream with linear range seek support.
                </p>
              </div>

              {/* Publish card */}
              <div className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 flex items-center gap-4 w-full max-w-md text-left">
                <img
                  src={successInfo.coverUrl}
                  alt={successInfo.title}
                  className="w-16 h-16 rounded-lg object-cover bg-zinc-800 border border-zinc-800"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-display font-semibold text-sm truncate text-zinc-100">
                    {successInfo.title}
                  </div>
                  <div className="text-zinc-400 text-xs mt-0.5 truncate">
                    {successInfo.artist}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-mono text-[9px] bg-cyan-950/60 border border-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded tracking-wide uppercase">
                      {successInfo.sampleRate} kHz / {successInfo.bitDepth}-bit
                    </span>
                    <span className="font-mono text-[9px] text-zinc-500">
                      {successInfo.bitrate} kbps
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    // Reset upload state
                    setTitle("");
                    setArtist("");
                    setGenre("Independent Hi-Fi");
                    setDescription("");
                    setAudioFile(null);
                    setAudioBase64("");
                    setCoverBase64("");
                    setCoverUrl("");
                    setSuccessInfo(null);
                  }}
                  className="px-4 py-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-750 text-xs font-mono rounded-lg transition-all cursor-pointer"
                >
                  Publish Another
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-600 text-zinc-950 text-xs font-sans font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Return to Studio
                </button>
              </div>
            </div>
          ) : (
            /* Upload Formulation Form */
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {errorMessage && (
                <div className="bg-red-950/60 border border-red-500/30 text-red-300 p-3.5 rounded-xl text-xs font-mono">
                  {errorMessage}
                </div>
              )}

              {/* Music Dropzone */}
              <div className="flex flex-col gap-1.5">
                <label className="font-display font-medium text-xs tracking-wider uppercase text-zinc-400">
                  High-Fidelity Source Master (.wav, .flac, .mp3)
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                    isDragOver
                      ? "border-cyan-400 bg-cyan-950/15"
                      : audioFile
                      ? "border-emerald-500/40 bg-emerald-950/5 hover:border-emerald-500/50"
                      : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-950/70"
                  }`}
                  id="dropzone_audio"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAudioSelect}
                    accept="audio/*"
                    className="hidden"
                  />
                  
                  {audioFile ? (
                    <div className="flex flex-col items-center text-center gap-1.5 animate-scale-up">
                      <div className="w-10 h-10 rounded-full bg-emerald-950/80 border border-emerald-500/20 flex items-center justify-center">
                        <Music className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div className="font-display font-semibold text-xs text-zinc-200 truncate max-w-md">
                        {audioFile.name}
                      </div>
                      <div className="font-mono text-[9px] text-zinc-500">
                        File Size: {(audioFile.size / (1024 * 1024)).toFixed(2)} MB • Container Ready
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center gap-1">
                      <div className="w-10 h-10 rounded-full bg-zinc-905 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-zinc-400" />
                      </div>
                      <div className="font-display font-semibold text-xs text-zinc-300 mt-1">
                        Drag & Drop or Click to Select Audio File
                      </div>
                      <p className="text-[10px] text-zinc-500 max-w-xs leading-relaxed">
                        Lossless WAV/FLAC files or 320kbps MP3 limits are recommended to unlock full spectrum precision. (Max 26MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Form elements row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="input_title" className="font-display font-medium text-xs tracking-wider uppercase text-zinc-400">
                    Track Title *
                  </label>
                  <input
                    type="text"
                    id="input_title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Echoes of Andromeda"
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-zinc-150"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="input_artist" className="font-display font-medium text-xs tracking-wider uppercase text-zinc-400">
                    Artist / Publisher *
                  </label>
                  <input
                    type="text"
                    id="input_artist"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="e.g. Nova Eclipse"
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-zinc-150"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="select_genre" className="font-display font-medium text-xs tracking-wider uppercase text-zinc-400">
                    Genre Section
                  </label>
                  <select
                    id="select_genre"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-zinc-200"
                  >
                    <option value="Independent Hi-Fi">Independent Hi-Fi</option>
                    <option value="Ambient Chill">Ambient Chill</option>
                    <option value="Synthwave / IDM">Synthwave / IDM</option>
                    <option value="Acoustic / Folk">Acoustic / Folk</option>
                    <option value="Classical / Cinematic">Classical / Cinematic</option>
                    <option value="Deep Tech / Techno">Deep Tech / Techno</option>
                    <option value="Modern Jazz / Blues">Modern Jazz / Blues</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="input_cover_url" className="font-display font-medium text-xs tracking-wider uppercase text-zinc-400">
                    Cover Album Image
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="input_cover_url"
                      value={coverUrl}
                      onChange={(e) => {
                        setCoverUrl(e.target.value);
                        setCoverBase64(""); // erase base64 if url entered
                      }}
                      placeholder="HTTPS image URL or upload file"
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-zinc-150"
                    />
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs rounded-lg border border-zinc-750 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Browse
                    </button>
                    <input
                      type="file"
                      ref={coverInputRef}
                      onChange={handleCoverSelect}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  {coverBase64 && (
                    <span className="font-mono text-[9px] text-emerald-400 flex items-center gap-1">
                      ✓ Custom local cover loaded.
                    </span>
                  )}
                </div>
              </div>

              {/* Master Settings Selector details */}
              <div className="border border-zinc-850 bg-zinc-900/60 p-4 rounded-xl flex flex-col gap-4">
                <div className="flex items-center gap-1.5">
                  <Disc className="w-4 h-4 text-cyan-400" />
                  <span className="font-display font-bold text-xs tracking-wider uppercase text-zinc-200">
                    Precision Sound Specifications (DSP Setup)
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="select_sample_rate" className="font-mono text-[10px] text-zinc-400">SAMPLE FREQUENCY</label>
                    <select
                      id="select_sample_rate"
                      value={sampleRate}
                      onChange={(e) => setSampleRate(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="44.1">44.1 kHz (CD Redbook)</option>
                      <option value="48">48.0 kHz (Studio Broadcast)</option>
                      <option value="96">96.0 kHz (High-Res Master)</option>
                      <option value="192">192.0 kHz (Ultra High-Res Ultra)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="select_bit_depth" className="font-mono text-[10px] text-zinc-400">QUANTIZATION DEPTH</label>
                    <select
                      id="select_bit_depth"
                      value={bitDepth}
                      onChange={(e) => setBitDepth(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="16">16-bit Lossless</option>
                      <option value="24">24-bit Studio Master</option>
                      <option value="32">32-bit Floating Point</option>
                    </select>
                  </div>

                  <div className="col-span-2 md:col-span-1 flex flex-col justify-end bg-zinc-950 border border-zinc-850 rounded-lg p-2 text-center h-full">
                    <span className="font-mono text-[8px] text-zinc-500 uppercase tracking-widest block mb-0.5">ESTIMATED BITRATE</span>
                    <span className="font-mono text-xs font-bold text-cyan-400">
                      {calculatedBitrate} kbps
                    </span>
                  </div>
                </div>
                <div className="font-mono text-[9px] text-zinc-500 leading-normal">
                  * Note: Sample rates represent simulated DAC clock levels used for downstream DSP filter interpolation.
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="input_description" className="font-display font-medium text-xs tracking-wider uppercase text-zinc-400">
                  Acoustic & Artistic Notes (Description)
                </label>
                <textarea
                  id="input_description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Recreated purely from organic analog synths with spatial stereo pan details modeling field depths."
                  rows={2}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 text-zinc-150 resize-none"
                />
              </div>

              {/* Submit / Upload Loading Bar */}
              <div className="mt-2 flex flex-col gap-2">
                {isUploading && (
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center font-mono text-[9px] text-zinc-400">
                      <span>Transcoding and publishing to disk...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    {/* Retro cyan progress rail */}
                    <div className="w-full bg-zinc-950 border border-zinc-850 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-indigo-505 h-full rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isUploading}
                  id="submit_upload_form"
                  className={`w-full py-3 rounded-xl border font-semibold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isUploading
                      ? "bg-zinc-850 border-zinc-800 text-zinc-500"
                      : "bg-cyan-500 hover:bg-cyan-600 border-cyan-400 text-zinc-950 shadow-lg shadow-cyan-500/10 hover:-translate-y-0.5 active:translate-y-0"
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                      MASTERING IN PROGRESS
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-zinc-950" />
                      PUBLISH STUDIO MASTER
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
