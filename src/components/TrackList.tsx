import { Search, Music, Disc, ChevronRight, Play, Pause, Radio } from "lucide-react";
import { Track } from "../types";
import { useState } from "react";

interface TrackListProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onTrackSelect: (track: Track) => void;
}

export default function TrackList({ tracks, currentTrack, isPlaying, onTrackSelect }: TrackListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string>("All");

  const genres = ["All", ...Array.from(new Set(tracks.map((t) => t.genre)))];

  const filteredTracks = tracks.filter((track) => {
    const matchesSearch =
      track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = selectedGenre === "All" || track.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  return (
    <div className="bg-zinc-950 border border-zinc-800/85 rounded-xl p-5 flex flex-col gap-4 h-full relative" id="track_list_panel">
      {/* Decals */}
      <div className="absolute top-2.5 left-2.5 w-1.5 h-1.5 rounded-full bg-zinc-800 border border-zinc-700/50"></div>
      <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-zinc-800 border border-zinc-700/50"></div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Disc className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: isPlaying ? "4s" : "0s" }} />
          <h3 className="font-display font-semibold text-zinc-150 text-sm tracking-wide uppercase">
            Acoustic Track Monitor ({tracks.length})
          </h3>
        </div>
        <span className="font-mono text-[9px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">
          STATUS: ONLINE
        </span>
      </div>

      {/* Modern Search Field */}
      <div className="relative" id="track_search_bar">
        <Search className="absolute left-3 top-2.5 w-4.5 h-4.5 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          id="search_tracks_input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Query by track title, independent artist, or gear specs..."
          className="w-full bg-zinc-900 border border-zinc-800/80 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-cyan-500 text-zinc-150 placeholder-zinc-500"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-2 text-zinc-500 hover:text-zinc-300 text-[10px] font-mono"
          >
            CLEAR
          </button>
        )}
      </div>

      {/* Genre Filter Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 select-none" id="genre_filters">
        {genres.map((genre) => (
          <button
            key={genre}
            id={`filter_genre_${genre.replace(/\s+/g, '_').toLowerCase()}`}
            onClick={() => setSelectedGenre(genre)}
            className={`px-3 py-1 font-mono text-[9px] tracking-wider rounded-md border whitespace-nowrap transition-all cursor-pointer ${
              selectedGenre === genre
                ? "bg-cyan-500/10 border-cyan-500/50 text-cyan-400"
                : "bg-zinc-900/60 border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
            }`}
          >
            {genre.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tracks Listing scrollable surface */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-[220px]" id="tracks_container">
        {filteredTracks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-2">
            <Music className="w-8 h-8 text-zinc-700" />
            <div className="text-zinc-450 text-xs font-display">No high-res signals fit current range parameters.</div>
            <p className="text-[10px] text-zinc-500">Reset query or publish a new master!</p>
          </div>
        ) : (
          filteredTracks.map((track) => {
            const isCurrent = currentTrack?.id === track.id;
            const isTrackPlaying = isCurrent && isPlaying;

            return (
              <div
                key={track.id}
                id={`track_item_${track.id}`}
                onClick={() => onTrackSelect(track)}
                className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer flex gap-3 items-center group relative overflow-hidden ${
                  isCurrent
                    ? "bg-zinc-900 border-cyan-500/40 shadow-md shadow-cyan-500/5"
                    : "bg-zinc-900/30 border-zinc-900 hover:bg-zinc-900/70 hover:border-zinc-800/80"
                }`}
              >
                {/* Active Neon vertical accent bar */}
                {isCurrent && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-cyan-400 to-indigo-505"></div>
                )}

                {/* Album Cover Art */}
                <div className="w-12 h-12 rounded-md overflow-hidden relative border border-zinc-800 bg-zinc-950 flex-shrink-0">
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  {/* Hover play dynamic mask */}
                  <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity duration-300 ${isCurrent ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                    {isTrackPlaying ? (
                      <Pause className="w-4 h-4 text-cyan-400 animate-pulse fill-cyan-400" />
                    ) : (
                      <Play className="w-4 h-4 text-cyan-400 fill-cyan-400" />
                    )}
                  </div>
                </div>

                {/* Information */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`font-display font-semibold text-xs truncate ${isCurrent ? "text-cyan-400" : "text-zinc-250 group-hover:text-zinc-100"}`}>
                      {track.title}
                    </h4>
                    <span className="font-mono text-[8px] text-zinc-500 whitespace-nowrap flex-shrink-0">
                      {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="text-zinc-400 text-[11px] truncate mt-0.5 font-medium flex justify-between items-center">
                    <span>{track.artist}</span>
                    <span className="text-[9px] text-zinc-500 font-normal italic pr-1">{track.genre}</span>
                  </div>

                  {/* Tech badging */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`font-mono text-[8.5px] border px-1.5 py-0.5 rounded-sm flex-shrink-0 tracking-wide font-semibold ${
                      track.isLocal 
                        ? "bg-purple-950/40 border-purple-800/40 text-purple-400"
                        : "bg-cyan-950/40 border-cyan-800/40 text-cyan-400"
                    }`}>
                      {track.isLocal ? "ARTIST PUBLISH" : "DEMO RECORD"}
                    </span>
                    <span className="font-mono text-[8.5px] text-zinc-500 bg-zinc-950/50 border border-zinc-850 px-1.5 py-0.5 rounded-sm">
                      {track.sampleRate} kHz / {track.bitDepth}-bit
                    </span>
                    <span className="font-mono text-[8.5px] text-zinc-500">
                      {track.bitrate} kbps
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0 text-zinc-650 group-hover:text-zinc-400 transition-colors">
                  {isTrackPlaying ? (
                    <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
