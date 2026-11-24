import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Headphones, ExternalLink, Radio, FolderOpen, Music, Check, X,
  Play, Compass, HardDrive, Bookmark, Plus, Trash2
} from "lucide-react";
import { sound } from "../utils/sound";

interface FocusSoundtrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSoundtrackTitle?: (title: string) => void;
}

interface LocalMusicTrack {
  name: string;
  path: string;
  extension: string;
  size_mb: number;
}

interface CuratedStream {
  id: string;
  title: string;
  artist: string;
  category: string;
  url: string;
  badge: string;
}

const STREAMING_APPS = [
  {
    name: "Spotify Web",
    url: "https://open.spotify.com",
    badge: "Music & Podcasts",
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  {
    name: "YouTube Music",
    url: "https://music.youtube.com",
    badge: "Official Audio",
    color: "text-rose-400 border-rose-500/30 bg-rose-500/10",
  },
  {
    name: "Apple Music",
    url: "https://music.apple.com",
    badge: "Spatial & Lossless",
    color: "text-pink-400 border-pink-500/30 bg-pink-500/10",
  },
];

const CURATED_STREAMS: CuratedStream[] = [
  {
    id: "lofi-girl",
    title: "Lofi Girl · Beats to Relax / Study",
    artist: "Lofi Girl 24/7 Radio",
    category: "Lofi",
    url: "https://www.youtube.com/watch?v=rFZHOHl-L8A",
    badge: "Live 24/7",
  },
  {
    id: "binaural-40hz",
    title: "Deep Focus 40Hz Gamma Flow",
    artist: "Brainwave Audio",
    category: "Binaural",
    url: "https://www.youtube.com/watch?v=WPni755-Krg",
    badge: "Focus Resonance",
  },
  {
    id: "velvet-rain",
    title: "Nocturnal Rain & Soft Thunder",
    artist: "Ambient Nature Audio",
    category: "Nature",
    url: "https://www.youtube.com/watch?v=mPZkdNFkNps",
    badge: "Organic Rain",
  },
  {
    id: "classical-piano",
    title: "Peaceful Classical Piano Flow",
    artist: "Chopin, Debussy & Satie",
    category: "Acoustic",
    url: "https://www.youtube.com/watch?v=jgpJVI3tDbY",
    badge: "Pure Piano",
  },
];

export function FocusSoundtrackModal({ isOpen, onClose, onSelectSoundtrackTitle }: FocusSoundtrackModalProps) {
  const [activeTab, setActiveTab] = useState<"local" | "streaming">("local");
  const [musicDir, setMusicDir] = useState<string>("");
  const [localTracks, setLocalTracks] = useState<LocalMusicTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [lastLaunched, setLastLaunched] = useState<string | null>(null);

  // Custom Bookmark State
  const [customTitle, setCustomTitle] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [savedCustomBookmark, setSavedCustomBookmark] = useState<{ title: string; url: string } | null>(null);
  const [showAddCustom, setShowAddCustom] = useState(false);

  // On open, discover default music directory and list actual local tracks
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadMusic = async () => {
      setIsLoadingTracks(true);
      try {
        const defaultDir = await invoke<string>("get_default_music_dir");
        if (isMounted && defaultDir) {
          setMusicDir(defaultDir);
          const tracks = await invoke<LocalMusicTrack[]>("list_local_music_tracks", { folderPath: defaultDir });
          if (isMounted) {
            setLocalTracks(tracks);
            if (tracks.length === 0) {
              setActiveTab("streaming");
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load local music tracks:", err);
      } finally {
        if (isMounted) setIsLoadingTracks(false);
      }

      if (typeof window !== "undefined") {
        const savedUrl = localStorage.getItem("lifemirror_soundtrack_custom_url");
        const savedName = localStorage.getItem("lifemirror_soundtrack_custom_title");
        if (savedUrl && savedName) {
          setSavedCustomBookmark({ title: savedName, url: savedUrl });
        }
      }
    };

    loadMusic();
    return () => { isMounted = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenMusicFolder = async () => {
    try {
      sound.playClick();
      await invoke("open_system_path", { path: musicDir });
      setLastLaunched("Music Folder");
    } catch (err) {
      console.warn("Failed to open music directory:", err);
    }
  };

  const handlePlayLocalTrack = async (track: LocalMusicTrack) => {
    try {
      sound.playClick();
      setSelectedTrack(track.name);
      setLastLaunched(track.name);
      if (typeof window !== "undefined") {
        localStorage.setItem("lifemirror_soundtrack_title", track.name);
      }
      if (onSelectSoundtrackTitle) {
        onSelectSoundtrackTitle(track.name);
      }
      await invoke("open_system_path", { path: track.path });
    } catch (err) {
      console.warn("Failed to launch local track:", err);
    }
  };

  const handleLaunchExternal = async (title: string, url: string) => {
    try {
      sound.playClick();
      setSelectedTrack(title);
      setLastLaunched(title);
      if (typeof window !== "undefined") {
        localStorage.setItem("lifemirror_soundtrack_title", title);
      }
      if (onSelectSoundtrackTitle) {
        onSelectSoundtrackTitle(title);
      }
      await openUrl(url);
    } catch (err) {
      console.warn("Failed to open external url:", err);
    }
  };

  const handleSaveCustomBookmark = () => {
    if (!customUrl.trim() || !customTitle.trim()) return;
    const bookmark = { title: customTitle.trim(), url: customUrl.trim() };
    setSavedCustomBookmark(bookmark);
    if (typeof window !== "undefined") {
      localStorage.setItem("lifemirror_soundtrack_custom_url", bookmark.url);
      localStorage.setItem("lifemirror_soundtrack_custom_title", bookmark.title);
    }
    setShowAddCustom(false);
    setCustomTitle("");
    setCustomUrl("");
  };

  const handleClearCustomBookmark = () => {
    setSavedCustomBookmark(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("lifemirror_soundtrack_custom_url");
      localStorage.removeItem("lifemirror_soundtrack_custom_title");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-zinc-950/95 border border-violet-500/30 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Glow ambient background aura */}
        <div className="absolute -top-28 -left-28 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -right-28 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300">
              <Headphones className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Focus Soundtrack Companion</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Immerse your craft in high-fidelity local audio or your favorite streaming player.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Controller Tab Bar */}
        <div className="relative flex items-center gap-1.5 p-1 my-3 bg-zinc-900/70 border border-white/5 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveTab("local");
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "local"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Local Music Sanctum</span>
            {localTracks.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeTab === "local" ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-400"
              }`}>
                {localTracks.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setActiveTab("streaming");
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === "streaming"
                ? "bg-violet-600 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Streaming & Curated Radio</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="relative flex-1 overflow-y-auto custom-scrollbar pr-1 py-1 space-y-4 min-h-[300px]">
          {activeTab === "local" ? (
            /* Local Sanctum View */
            <div className="space-y-3">
              {/* Directory Bar */}
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 truncate min-w-0">
                  <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-zinc-500 block">
                      Local Library Directory
                    </span>
                    <span className="text-xs font-mono text-zinc-300 truncate block">
                      {musicDir || "Scanning /home/$USER/Music..."}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenMusicFolder}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
                  title="Open folder in system file manager (Nautilus/Files)"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Open Folder</span>
                </button>
              </div>

              {/* Tracks List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400 font-mono">
                    Offline Audio Library ({localTracks.length} Tracks Found)
                  </span>
                  <span className="text-[10px] text-zinc-500">1-click to play in native media player</span>
                </div>

                {isLoadingTracks ? (
                  <div className="py-8 text-center text-xs text-zinc-500 italic">
                    Reading audio files from your Music directory...
                  </div>
                ) : localTracks.length === 0 ? (
                  <div className="p-6 rounded-xl bg-zinc-900/30 border border-white/5 text-center space-y-2">
                    <Music className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-xs font-medium text-zinc-300">No Audio Files Found in Music Folder</p>
                    <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                      Place your favorite .mp3, .flac, or .wav focus tracks in <code className="text-zinc-400">{musicDir}</code> or explore the Streaming tab.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                    {localTracks.map((track) => {
                      const isSelected = selectedTrack === track.name;
                      return (
                        <div
                          key={track.path}
                          onClick={() => handlePlayLocalTrack(track)}
                          className={`group p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                            isSelected
                              ? "bg-violet-600/20 border-violet-500/50 shadow-xs"
                              : "bg-zinc-900/40 hover:bg-zinc-900/80 border-white/5 hover:border-violet-500/30"
                          }`}
                        >
                          <div className="flex items-center gap-3 truncate min-w-0">
                            <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-mono text-zinc-400 group-hover:bg-violet-600 group-hover:text-white transition-colors shrink-0">
                              <Play className="w-3 h-3" />
                            </div>
                            <div className="truncate min-w-0">
                              <div className="text-xs font-medium text-white group-hover:text-violet-200 truncate">
                                {track.name}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                                {track.extension.toUpperCase()} · {track.size_mb} MB
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-semibold text-zinc-500 group-hover:text-violet-300 flex items-center gap-1 transition-colors">
                              <span>Play in System Player</span>
                              <ExternalLink className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Streaming & Curated View */
            <div className="space-y-4">
              {/* Quick Streaming Apps */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400 font-mono block mb-2">
                  Launch Streaming Application
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {STREAMING_APPS.map((app) => (
                    <button
                      key={app.name}
                      type="button"
                      onClick={() => handleLaunchExternal(app.name, app.url)}
                      className={`p-3 rounded-xl border flex flex-col justify-between transition-all cursor-pointer hover:scale-[1.02] ${app.color}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-white">{app.name}</span>
                        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                      </div>
                      <span className="text-[10px] opacity-80 font-mono">{app.badge}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Curated Deep Work Radios */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400 font-mono block mb-2">
                  Curated Focus Radios (1-Click YouTube Streams)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CURATED_STREAMS.map((stream) => (
                    <button
                      key={stream.id}
                      type="button"
                      onClick={() => handleLaunchExternal(stream.title, stream.url)}
                      className="group text-left p-3 rounded-xl bg-zinc-900/40 hover:bg-zinc-900/80 border border-white/5 hover:border-violet-500/30 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-zinc-800 text-zinc-300 border border-white/5">
                          {stream.badge}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-violet-400 transition-colors shrink-0" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-violet-200 line-clamp-1">
                          {stream.title}
                        </div>
                        <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                          <Radio className="w-3 h-3 text-violet-400/80 shrink-0" />
                          <span className="truncate">{stream.artist}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Stream Bookmark */}
              <div className="p-3.5 rounded-xl bg-zinc-900/50 border border-white/5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                    <span>Personal Focus Bookmark</span>
                  </div>
                  {!savedCustomBookmark && !showAddCustom && (
                    <button
                      type="button"
                      onClick={() => setShowAddCustom(true)}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold text-violet-400 hover:text-white bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/20 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Bookmark</span>
                    </button>
                  )}
                </div>

                {savedCustomBookmark ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-950/80 border border-violet-500/20">
                    <div className="flex items-center gap-2.5 truncate min-w-0">
                      <Music className="w-4 h-4 text-violet-400 shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-medium text-white truncate">{savedCustomBookmark.title}</div>
                        <div className="text-[10px] font-mono text-zinc-500 truncate">{savedCustomBookmark.url}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLaunchExternal(savedCustomBookmark.title, savedCustomBookmark.url)}
                        className="px-2.5 py-1 rounded bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <span>Launch</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={handleClearCustomBookmark}
                        className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Remove bookmark"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : showAddCustom ? (
                  <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="Bookmark Title (e.g. My Deep House Set, Ambient Station)"
                      className="w-full px-3 py-1.5 text-xs bg-zinc-950/80 border border-white/10 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="https://youtube.com/watch?v=... or https://open.spotify.com/..."
                        className="flex-1 px-3 py-1.5 text-xs bg-zinc-950/80 border border-white/10 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/60"
                      />
                      <button
                        type="button"
                        onClick={handleSaveCustomBookmark}
                        disabled={!customTitle.trim() || !customUrl.trim()}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer transition-all"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddCustom(false)}
                        className="px-2 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-400">
                    No custom bookmark saved. You can save your personal YouTube playlist or radio URL for 1-click access.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
          <div>
            {lastLaunched && (
              <span className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                <Check className="w-3.5 h-3.5" />
                <span>Active Companion: <strong className="text-white">{lastLaunched}</strong></span>
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
