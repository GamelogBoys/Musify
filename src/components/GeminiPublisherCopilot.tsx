import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, ChevronRight, Copy, Check, Send, 
  Layers, Megaphone, Newspaper, Radio, AlertCircle, HelpCircle, FileText
} from "lucide-react";

interface Track {
  id: string;
  title: string;
  artist: string;
  genre: string;
  url: string;
  coverUrl: string;
  description?: string;
}

interface GeminiPublisherCopilotProps {
  tracks: Track[];
  currentTrack: Track | null;
}

type ModeOption = "marketing" | "critic" | "press" | "pitch" | "chat";

export default function GeminiPublisherCopilot({ tracks, currentTrack }: GeminiPublisherCopilotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<ModeOption>("marketing");
  const [selectedTrackId, setSelectedTrackId] = useState<string>("active");
  const [customPrompt, setCustomPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [responseHtml, setResponseHtml] = useState<string>("");
  const [isCopied, setIsCopied] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [isConfigError, setIsConfigError] = useState(false);

  // Determine track context
  const getSelectedTrack = (): Track | null => {
    if (selectedTrackId === "active") {
      return currentTrack;
    }
    return tracks.find(t => t.id === selectedTrackId) || null;
  };

  const handleCopy = () => {
    if (!responseHtml) return;
    navigator.clipboard.writeText(responseHtml);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const executeAnalysis = async () => {
    const track = getSelectedTrack();
    if (!track && activeMode !== "chat") {
      setErrorText("Please select or play a high-fidelity track to analyze first.");
      return;
    }

    setIsLoading(true);
    setErrorText("");
    setIsConfigError(false);
    setResponseHtml("");

    try {
      const response = await fetch("/api/gemini/publisher-tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option: activeMode,
          title: track?.title || "High-Fidelity Project Concept",
          genre: track?.genre || "Independent Audio",
          description: track?.description || customPrompt || "No description loaded.",
          customPrompt: activeMode === "chat" ? customPrompt : undefined
        })
      });

      const data = await response.json();
      if (!response.ok) {
        if (data.isConfigError) {
          setIsConfigError(true);
          throw new Error(data.error || "Gemini API key is not configured.");
        }
        throw new Error(data.error || "Server failed to retrieve response from Gemini.");
      }

      setResponseHtml(data.text || "");
      if (activeMode === "chat") {
        setCustomPrompt("");
      }
    } catch (err: any) {
      console.error("Gemini Copilot Error:", err);
      setErrorText(err.message || "An exception occurred during Gemini generation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 1. Floating Sparkle Gemini Bubble on the Right Siderail */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
        <button
          id="gemini_floating_trigger"
          onClick={() => setIsOpen(!isOpen)}
          className="bg-gradient-to-br from-indigo-600 via-purple-600 to-amber-500 p-3.5 rounded-l-2xl shadow-[0_0_25px_rgba(147,51,234,0.4)] flex items-center gap-2 text-white hover:scale-105 active:scale-95 transition-all duration-300 font-medium overflow-hidden border-y border-l border-purple-400 group cursor-pointer"
        >
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          >
            <Sparkles className="h-5 w-5 fill-amber-200 text-amber-100 group-hover:scale-110 transition-transform" />
          </motion.div>
          <span className="hidden md:inline font-sans text-xs tracking-wider font-semibold uppercase pr-1">
            Gemini Studio
          </span>
          <ChevronRight className={`h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* 2. Slide-out Copilot Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 180 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] max-w-full bg-zinc-950/98 border-l border-zinc-800 shadow-[20px_0_50px_rgba(0,0,0,0.8)] z-50 flex flex-col pt-20 pl-4 pr-4 pb-4 select-none"
            id="gemini_sidebar_drawer"
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-zinc-900">
              <div className="flex items-center gap-2.5">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl border border-indigo-400/30">
                  <Sparkles className="h-5 w-5 text-amber-200 fill-amber-200/50" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
                    Artist Copilot
                  </h3>
                  <p className="text-[10px] text-zinc-400">Powered by Gemini 3.5-flash</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 text-xs px-2.5 py-1 rounded-md border border-zinc-800 hover:bg-zinc-900 transition cursor-pointer"
              >
                Close Drawer
              </button>
            </div>

            {/* Scrollable parameters form */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4">
              
              {/* Target Audio Track selection */}
              <div className="bg-zinc-900/40 border border-zinc-900 p-3 rounded-xl">
                <label className="text-[11px] font-sans text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Analyze Track Selection:
                </label>
                <div className="relative">
                  <select
                    value={selectedTrackId}
                    onChange={(e) => setSelectedTrackId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-purple-500 transition"
                  >
                    <option value="active">
                      Currently Playing {currentTrack ? `(${currentTrack.title})` : "(None)"}
                    </option>
                    {tracks.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.title} — {t.genre}
                      </option>
                    ))}
                  </select>
                </div>
                {getSelectedTrack() && (
                  <div className="flex items-center gap-2 mt-2 bg-zinc-950 p-2 rounded-lg border border-zinc-900">
                    <img
                      src={getSelectedTrack()?.coverUrl}
                      alt="Cover"
                      className="w-8 h-8 rounded object-cover border border-zinc-800"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-zinc-200 truncate">{getSelectedTrack()?.title}</p>
                      <p className="text-[10px] text-purple-400">{getSelectedTrack()?.genre}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Tabs for copywriting or mix critical review */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-sans text-zinc-400 uppercase tracking-wider block">
                  Select Analytical Assistant Tool:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setActiveMode("marketing")}
                    className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition cursor-pointer border ${
                      activeMode === "marketing"
                        ? "bg-purple-950/40 text-purple-300 border-purple-500/50"
                        : "bg-zinc-900/30 text-zinc-400 border-transparent hover:bg-zinc-900"
                    }`}
                  >
                    <Megaphone className="h-3.5 w-3.5 text-purple-400" />
                    <span>Promo & Kit</span>
                  </button>
                  
                  <button
                    onClick={() => setActiveMode("critic")}
                    className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition cursor-pointer border ${
                      activeMode === "critic"
                        ? "bg-indigo-950/40 text-indigo-300 border-indigo-500/50"
                        : "bg-zinc-900/30 text-zinc-400 border-transparent hover:bg-zinc-900"
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Mix Critique</span>
                  </button>

                  <button
                    onClick={() => setActiveMode("press")}
                    className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition cursor-pointer border ${
                      activeMode === "press"
                        ? "bg-amber-950/30 text-amber-300 border-amber-500/50"
                        : "bg-zinc-900/30 text-zinc-400 border-transparent hover:bg-zinc-900"
                    }`}
                  >
                    <Newspaper className="h-3.5 w-3.5 text-amber-400" />
                    <span>Press Article</span>
                  </button>

                  <button
                    onClick={() => setActiveMode("pitch")}
                    className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs transition cursor-pointer border ${
                      activeMode === "pitch"
                        ? "bg-emerald-950/30 text-emerald-300 border-emerald-500/50"
                        : "bg-zinc-900/30 text-zinc-400 border-transparent hover:bg-zinc-900"
                    }`}
                  >
                    <Radio className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Curator Pitch</span>
                  </button>
                </div>
              </div>

              {/* Description override or Free-text chat input */}
              <div className="bg-zinc-900/40 p-3 rounded-xl border border-zinc-900">
                <label className="text-[11px] font-sans text-zinc-400 uppercase tracking-wider block mb-1">
                  {activeMode === "chat" ? "Ask Gemini anything about music production:" : "Customize or overwrite track concepts (Optional):"}
                </label>
                <div className="relative">
                  <textarea
                    rows={activeMode === "chat" ? 4 : 2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder={
                      activeMode === "chat"
                        ? "Write a custom music production question (e.g. 'How do I glue my sub-bass with transient acoustic kick drums?')"
                        : "Specify instrumentation, lyric concepts, custom mood preferences, or sound references..."
                    }
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 transition placeholder:text-zinc-600 resize-none"
                  />
                  {activeMode === "chat" && (
                    <button
                      onClick={executeAnalysis}
                      disabled={isLoading || !customPrompt.trim()}
                      className="absolute bottom-2.5 right-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white p-1.5 rounded-lg transition"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Generate standard prompts button */}
              {activeMode !== "chat" && (
                <button
                  onClick={executeAnalysis}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 hover:opacity-90 disabled:opacity-50 text-white font-medium text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.99] cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Synthesizing intelligence...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 fill-amber-200 border-none" />
                      <span>Generate with Gemini AI</span>
                    </>
                  )}
                </button>
              )}

              {/* Response Block */}
              <AnimatePresence>
                {(responseHtml || errorText || isLoading) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden mt-4"
                  >
                    {/* Panel Header */}
                    <div className="bg-zinc-950/70 py-2 px-3 border-b border-zinc-800 flex justify-between items-center">
                      <span className="text-[10px] font-sans text-purple-400 font-semibold tracking-wider uppercase flex items-center gap-1">
                        <Sparkles className="h-3 w-3 animate-pulse text-amber-300 fill-amber-300" />
                        Gemini response
                      </span>
                      {responseHtml && (
                        <button
                          onClick={handleCopy}
                          className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1 text-[10px] cursor-pointer"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy Text</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Result Content Area */}
                    <div className="p-3 text-xs text-zinc-300 font-sans leading-relaxed max-h-[300px] overflow-y-auto whitespace-pre-wrap select-text">
                      {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-8 space-y-3">
                          <div className="flex space-x-1.5">
                            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce"></div>
                          </div>
                          <p className="text-[11px] text-zinc-400 font-medium tracking-wide">
                            Demanding creative spectrum synthesis...
                          </p>
                        </div>
                      ) : errorText ? (
                        <div className="space-y-2">
                          <div className="flex items-start gap-2 text-red-400 bg-red-950/20 p-2.5 rounded-lg border border-red-900/30">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-[11px]">Generation Halted</p>
                              <p className="text-[10px] leading-normal">{errorText}</p>
                            </div>
                          </div>

                          {isConfigError && (
                            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-2 text-[11px]">
                              <p className="text-zinc-300">
                                This app includes server-side Gemini intelligence. To activate, specify your Gemini API key in Settings:
                              </p>
                              <div className="bg-zinc-900 p-2 rounded font-mono text-[10px] text-amber-300">
                                GEMINI_API_KEY=&lt;yourkeyhere&gt;
                              </div>
                              <p className="text-zinc-400 text-[10px]">
                                Your API key is safely held on the server and is never exposed to the web browser.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="prose prose-invert prose-xs text-zinc-300 select-text">
                          {responseHtml}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* Instruction tooltip / branding label */}
            <div className="pt-2 text-center text-[10px] text-zinc-600 flex items-center justify-center gap-1.5 select-none hover:text-zinc-400">
              <Sparkles className="h-3 w-3 text-zinc-500 fill-zinc-500/20" />
              <span>Full-Stack Spatial Copilot</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
