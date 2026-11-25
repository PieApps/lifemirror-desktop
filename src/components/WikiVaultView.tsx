import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import {
  Folder, FileText, Search, Plus, ExternalLink,
  Edit2, Check, RefreshCw, Copy, CheckCheck, BookOpen,
  ChevronRight, ArrowLeft, Trash2, Calendar, FolderOpen,
  Sparkles, Layers, Compass
} from "lucide-react";
import { MarkdownRenderer } from "../utils/markdownRenderer";
import { ConfirmModal } from "./ConfirmModal";
import { MemoirModal } from "./MemoirModal";

export interface VaultFileItem {
  name: string;
  relative_path: string;
  category: string; // "projects" | "topics" | "sessions" | "periodic" | "root"
  updated_at: string;
  size: number;
}

export interface VaultStructure {
  vault_path: string;
  files: VaultFileItem[];
}

interface NoteDisplayInfo {
  title: string;
  badge: string;
  badgeColor: string;
}

export function getNoteDisplayInfo(file: VaultFileItem): NoteDisplayInfo {
  const stem = file.name.replace(/\.md$/, "");

  if (file.category === "periodic") {
    if (stem.startsWith("daily_")) {
      const datePart = stem.replace("daily_", "");
      try {
        const [y, m, d] = datePart.split("-").map(Number);
        const dateObj = new Date(y, m - 1, d);
        if (!isNaN(dateObj.getTime())) {
          const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });
          const month = dateObj.toLocaleDateString("en-US", { month: "short" });
          return {
            title: `${weekday}, ${month} ${d} Review`,
            badge: "☀️ Daily",
            badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
          };
        }
      } catch {
        // fallback
      }
      return {
        title: `Daily Review (${datePart})`,
        badge: "☀️ Daily",
        badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
      };
    }

    if (stem.startsWith("weekly_")) {
      const weekPart = stem.replace("weekly_", "");
      const match = weekPart.match(/(\d{4})-W(\d{2})/);
      if (match) {
        return {
          title: `Week ${parseInt(match[2], 10)} Review`,
          badge: "📅 Weekly",
          badgeColor: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
        };
      }
      return {
        title: `Weekly Review (${weekPart})`,
        badge: "📅 Weekly",
        badgeColor: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
      };
    }

    if (stem.startsWith("monthly_")) {
      const monthPart = stem.replace("monthly_", "");
      try {
        const [y, m] = monthPart.split("-").map(Number);
        const dateObj = new Date(y, m - 1, 1);
        if (!isNaN(dateObj.getTime())) {
          const monthName = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
          return {
            title: `${monthName} Review`,
            badge: "🗓️ Monthly",
            badgeColor: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
          };
        }
      } catch {
        // fallback
      }
      return {
        title: `Monthly Review (${monthPart})`,
        badge: "🗓️ Monthly",
        badgeColor: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
      };
    }
  }

  if (file.category === "sessions") {
    const parts = stem.split("_");
    let timeLabel = "";
    const nameParts = [...parts];

    if (parts[0] && /^\d{8}$/.test(parts[0])) {
      nameParts.shift();
    }
    if (nameParts[0] && /^\d{4,6}$/.test(nameParts[0])) {
      const rawTime = nameParts.shift()!;
      timeLabel = `${rawTime.slice(0, 2)}:${rawTime.slice(2, 4)}`;
    }

    const cleanTitle = nameParts
      .join(" ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "Session Note";

    return {
      title: timeLabel ? `${timeLabel} – ${cleanTitle}` : cleanTitle,
      badge: "⏱️ Session",
      badgeColor: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    };
  }

  if (file.category === "projects") {
    const cleanTitle = stem.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      title: cleanTitle,
      badge: "🚀 Project",
      badgeColor: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
    };
  }

  if (file.category === "topics") {
    const cleanTitle = stem.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      title: cleanTitle,
      badge: "💡 Topic",
      badgeColor: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    };
  }

  if (file.name === "index.md") {
    return {
      title: "Knowledge Vault Index",
      badge: "🏠 Hub",
      badgeColor: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
    };
  }

  if (file.name === "log.md") {
    return {
      title: "Master Activity Log",
      badge: "📜 Log",
      badgeColor: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
    };
  }

  return {
    title: stem,
    badge: file.category,
    badgeColor: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30",
  };
}

interface WikiVaultViewProps {
  onBackToTimeline?: () => void;
  initialRelativePath?: string;
}

export const WikiVaultView: React.FC<WikiVaultViewProps> = ({ onBackToTimeline, initialRelativePath }) => {
  const [vaultPath, setVaultPath] = useState<string>("");
  const [files, setFiles] = useState<VaultFileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<VaultFileItem | null>(null);
  const [content, setContent] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [shelf, setShelf] = useState<"all" | "chronicles" | "craft" | "ideas">("all");
  
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedText, setEditedText] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newNoteTitle, setNewNoteTitle] = useState<string>("");
  const [newNoteCategory, setNewNoteCategory] = useState<"projects" | "topics">("projects");
  const [isMemoirModalOpen, setIsMemoirModalOpen] = useState<boolean>(false);

  // Deletion and clearing modal states
  const [noteToDelete, setNoteToDelete] = useState<VaultFileItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isClearVaultModalOpen, setIsClearVaultModalOpen] = useState<boolean>(false);

  // Resizable sidebar state (min 220px, max 600px, persisted)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("lifemirror_vault_sidebar_width");
      return saved ? Math.max(220, Math.min(600, parseInt(saved, 10))) : 280;
    } catch {
      return 280;
    }
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);

  const startResizingSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = document.getElementById("vault-split-container");
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = Math.max(220, Math.min(600, e.clientX - rect.left));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      localStorage.setItem("lifemirror_vault_sidebar_width", String(sidebarWidth));
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizingSidebar, sidebarWidth]);

  // Active load guard to prevent race conditions during rapid file selection
  const activeLoadPathRef = useRef<string>("");

  // Load vault file index
  const loadVaultStructure = useCallback(async (preferredFileRelPath?: string) => {
    setIsLoading(true);
    try {
      const res = await invoke<VaultStructure>("list_vault_files");
      setVaultPath(res.vault_path);
      setFiles(res.files);

      // Select initial file: either preferred/initial, or index.md, or first file
      const targetPath = preferredFileRelPath || initialRelativePath;
      let targetFile: VaultFileItem | undefined;
      if (targetPath) {
        targetFile = res.files.find(
          (f) => f.relative_path.toLowerCase() === targetPath.toLowerCase() ||
                 f.relative_path.toLowerCase() === `${targetPath.toLowerCase()}.md` ||
                 f.name.toLowerCase() === targetPath.toLowerCase()
        );
      }

      if (!targetFile && res.files.length > 0) {
        targetFile = res.files.find((f) => f.relative_path === "index.md") || res.files[0];
      }

      if (targetFile) {
        setSelectedFile(targetFile);
        await loadFileContent(targetFile.relative_path);
      }
    } catch (err) {
      console.error("Failed to list vault structure:", err);
    } finally {
      setIsLoading(false);
    }
  }, [initialRelativePath]);

  const loadFileContent = async (relativePath: string) => {
    activeLoadPathRef.current = relativePath;
    setIsLoadingContent(true);
    try {
      const text = await invoke<string>("read_vault_file", { relativePath });
      if (activeLoadPathRef.current === relativePath) {
        setContent(text);
        setEditedText(text);
        setIsEditing(false);
      }
    } catch (err) {
      if (activeLoadPathRef.current === relativePath) {
        console.error("Failed to read vault file:", err);
        setContent(`# Error\nCould not load \`${relativePath}\`.`);
      }
    } finally {
      if (activeLoadPathRef.current === relativePath) {
        setIsLoadingContent(false);
      }
    }
  };

  useEffect(() => {
    loadVaultStructure();
  }, [loadVaultStructure]);

  const handleSelectFile = (file: VaultFileItem) => {
    setSelectedFile(file);
    loadFileContent(file.relative_path);
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    try {
      await invoke("write_vault_file", {
        relativePath: selectedFile.relative_path,
        content: editedText,
      });
      setContent(editedText);
      setIsEditing(false);
      // Reload structure to update timestamps/size
      loadVaultStructure(selectedFile.relative_path);
    } catch (err) {
      console.error("Failed to write vault file:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleWikilinkNavigation = (target: string) => {
    let clean = target.trim();
    if (clean.endsWith(".md")) {
      clean = clean.substring(0, clean.length - 3);
    }

    // Try finding exact match or by name
    const match = files.find(
      (f) =>
        f.relative_path.replace(/\.md$/, "").toLowerCase() === clean.toLowerCase() ||
        f.name.replace(/\.md$/, "").toLowerCase() === clean.toLowerCase()
    );

    if (match) {
      handleSelectFile(match);
    } else {
      // If not found, open modal to create it
      setNewNoteTitle(clean.split("/").pop() || clean);
      setNewNoteCategory(clean.startsWith("topics") ? "topics" : "projects");
      setIsCreatingNew(true);
    }
  };

  const handleCreateNewNote = async () => {
    const slug = newNoteTitle.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) return;

    const relPath = `${newNoteCategory}/${slug}.md`;
    const initialTemplate = `---
title: "${newNoteTitle.trim()}"
category: ${newNoteCategory}
created: "${new Date().toISOString().split("T")[0]}"
---

# ${newNoteTitle.trim()}

## Overview
Enter context, objectives, and research notes for this ${newNoteCategory === "projects" ? "project" : "topic"}.

## Key Milestones & Knowledge
- Document important breakthroughs and findings.

## Connected Notes
- [[index]] — Knowledge Vault Index
`;

    try {
      await invoke("write_vault_file", {
        relativePath: relPath,
        content: initialTemplate,
      });
      setIsCreatingNew(false);
      setNewNoteTitle("");
      await loadVaultStructure(relPath);
    } catch (err) {
      console.error("Failed to create new note:", err);
    }
  };

  const handleOpenInObsidian = async () => {
    if (!vaultPath) return;
    try {
      if (selectedFile) {
        const fullFilePath = `${vaultPath.replace(/[\\\/]$/, "")}/${selectedFile.relative_path}`;
        await openPath(fullFilePath);
      } else {
        await openPath(vaultPath);
      }
    } catch (err) {
      console.error("Failed to open external editor:", err);
    }
  };

  const handleCopy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const chroniclesCount = useMemo(() => files.filter((f) => f.category === "periodic").length, [files]);
  const craftCount = useMemo(() => files.filter((f) => f.category === "projects" || f.category === "sessions").length, [files]);
  const ideasCount = useMemo(() => files.filter((f) => f.category === "topics" || f.category === "root").length, [files]);

  const latestChronicle = useMemo(() => {
    const periodicFiles = files.filter((f) => f.category === "periodic");
    return periodicFiles.sort((a, b) => b.name.localeCompare(a.name))[0] || null;
  }, [files]);

  const filteredFiles = useMemo(() => {
    return files.filter((f) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.relative_path.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesShelf =
        shelf === "all" ||
        (shelf === "chronicles" && f.category === "periodic") ||
        (shelf === "craft" && (f.category === "projects" || f.category === "sessions")) ||
        (shelf === "ideas" && (f.category === "topics" || f.category === "root"));

      return matchesSearch && matchesShelf;
    });
  }, [files, searchQuery, shelf]);

  return (
    <div className="wiki-vault-container h-full flex flex-col bg-[var(--card-bg)] rounded-3xl border border-[var(--border-color)] overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-3.5 sm:p-5 border-b border-[var(--border-color)] flex items-center justify-between gap-2 sm:gap-3 bg-[var(--bg-color)]/30 min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <span className="p-2 rounded-xl bg-violet-500/10 text-violet-500 shrink-0">
            <BookOpen className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[var(--text-color)] whitespace-nowrap">
                Knowledge Vault
              </h2>
              <span className="hidden md:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 shrink-0">
                Personal Library
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>100% On-Device</span>
              <span className="hidden lg:inline"> · Encrypted & Offline</span>
              {vaultPath && (
                <button
                  type="button"
                  onClick={() => openPath(vaultPath).catch((err) => console.warn("Failed to open vault directory:", err))}
                  className="p-0.5 hover:text-violet-400 transition-colors cursor-pointer ml-1"
                  title={`Open folder: ${vaultPath}`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end">
          {onBackToTimeline && (
            <button
              onClick={onBackToTimeline}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)] text-xs text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors cursor-pointer shadow-xs"
              title="Return to S-Curve Timeline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Timeline</span>
            </button>
          )}

          <button
            onClick={async () => {
              try {
                await invoke("sync_vault_all");
              } catch (e) {
                console.warn("Failed to sync vault:", e);
              }
              await loadVaultStructure(selectedFile?.relative_path);
            }}
            className="p-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)] hover:border-zinc-400/50 text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors cursor-pointer shadow-xs"
            title="Refresh & Sync Vault"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-violet-500" : ""}`} />
          </button>

          <button
            onClick={() => setIsClearVaultModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/15 text-xs font-semibold text-red-600 dark:text-red-400 transition-colors cursor-pointer shadow-xs"
            title="Archive existing notes to .trash/ and reset vault index"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Clear</span>
          </button>

          <button
            onClick={() => setIsMemoirModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 text-xs font-semibold text-violet-700 dark:text-violet-300 hover:text-violet-900 dark:hover:text-white transition-all shadow-xs cursor-pointer shrink-0"
            title="Compile archival Living Memoir from your vault notes"
          >
            <BookOpen className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="hidden 2xl:inline">Bind Memoir</span>
          </button>

          <button
            onClick={handleOpenInObsidian}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-color)] hover:border-violet-500/40 text-xs font-semibold text-[var(--text-color)] transition-colors shadow-xs cursor-pointer shrink-0"
            title="Open Vault or Active Note in Obsidian / System Default Editor"
          >
            <ExternalLink className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
            <span className="hidden 2xl:inline">Open in Obsidian</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Left Explorer | Flexible Divider Bar | Right Reader/Editor */}
      <div id="vault-split-container" className="flex-1 flex overflow-hidden relative">
        {/* Left Explorer Sidebar */}
        <div 
          style={{ width: `${sidebarWidth}px` }}
          className="border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-color)]/20 shrink-0 select-none"
        >
          {/* Search Bar & Add Button */}
          <div className="p-3 border-b border-[var(--border-color)] space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)] text-[var(--text-color)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>

            {/* The Three Sacred Shelves — 2x2 Grid for Zero Truncation */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[var(--surface-color)] rounded-xl border border-[var(--border-color)] text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setShelf("all")}
                className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-between gap-1 min-w-0 ${
                  shelf === "all"
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10"
                }`}
                title="All notes in vault"
              >
                <span className="truncate">All Notes</span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                  shelf === "all" ? "bg-white/20 text-white" : "bg-[var(--border-color)] text-[var(--text-muted)]"
                }`}>
                  {files.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShelf("chronicles")}
                className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-between gap-1 min-w-0 ${
                  shelf === "chronicles"
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10"
                }`}
                title="Daily, weekly, and monthly chronicles"
              >
                <span className="truncate">Chronicles</span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                  shelf === "chronicles" ? "bg-white/20 text-white" : "bg-amber-500/15 text-amber-500 dark:text-amber-400"
                }`}>
                  {chroniclesCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShelf("craft")}
                className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-between gap-1 min-w-0 ${
                  shelf === "craft"
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10"
                }`}
                title="Projects and deep session chapters"
              >
                <span className="truncate">Craft & Code</span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                  shelf === "craft" ? "bg-white/20 text-white" : "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
                }`}>
                  {craftCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShelf("ideas")}
                className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer flex items-center justify-between gap-1 min-w-0 ${
                  shelf === "ideas"
                    ? "bg-violet-600 text-white shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-zinc-500/10"
                }`}
                title="Topics and knowledge index"
              >
                <span className="truncate">Ideas & Topics</span>
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                  shelf === "ideas" ? "bg-white/20 text-white" : "bg-sky-500/15 text-sky-500 dark:text-sky-400"
                }`}>
                  {ideasCount}
                </span>
              </button>
            </div>

            <button
              onClick={() => setIsCreatingNew(true)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 font-semibold text-xs transition-colors border border-violet-500/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Note</span>
            </button>
          </div>

          {/* Files List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredFiles.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)] italic">
                {searchQuery ? "No matching notes found." : "No notes in this category."}
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = selectedFile?.relative_path === file.relative_path;
                const displayInfo = getNoteDisplayInfo(file);
                return (
                  <div
                    key={file.relative_path}
                    onClick={() => handleSelectFile(file)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 group cursor-pointer ${
                      isSelected
                        ? "bg-violet-600 text-white shadow-md shadow-violet-500/20 font-semibold"
                        : "hover:bg-[var(--border-color)]/50 text-[var(--text-color)]"
                    }`}
                  >
                    <span className={`p-1 rounded-lg shrink-0 mt-0.5 ${isSelected ? "bg-white/20 text-white" : "text-violet-500 bg-violet-500/10"}`}>
                      {file.category === "projects" ? (
                        <Folder className="w-3.5 h-3.5" />
                      ) : file.category === "periodic" ? (
                        <Calendar className="w-3.5 h-3.5" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate font-medium flex items-center justify-between">
                        <span className="truncate">{displayInfo.title}</span>
                        {file.category !== "root" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setNoteToDelete(file);
                              setIsDeleteModalOpen(true);
                            }}
                            className={`p-1 rounded hover:bg-red-500/20 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1 cursor-pointer ${isSelected ? "hover:bg-white/20 text-white" : ""}`}
                            title="Move to trash"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                        <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold ${isSelected ? "bg-white/20 text-white border-white/30" : displayInfo.badgeColor}`}>
                          {displayInfo.badge}
                        </span>
                        <span className={`truncate ${isSelected ? "text-white/80" : "text-[var(--text-muted)] font-mono"}`}>
                          {file.updated_at || "recently"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Flexible Width Resizer Bar */}
        <div
          onMouseDown={startResizingSidebar}
          className={`w-1.5 relative group cursor-col-resize select-none shrink-0 transition-colors z-10 flex items-center justify-center ${
            isResizingSidebar
              ? "bg-violet-600 shadow-sm"
              : "hover:bg-violet-500/60 bg-[var(--border-color)]/60"
          }`}
          title="Drag to resize sidebar width"
        >
          {/* Expanded hit region for easy grabbing */}
          <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize" />
        </div>

        {/* Center/Right Pane: Document Reader & Editor */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-color)]/10 min-w-0 @container">
          {selectedFile ? (
            <>
              {/* Document Header & Actions */}
              <div className="p-3 sm:p-4 border-b border-[var(--border-color)] flex items-center justify-between gap-3 bg-[var(--card-bg)]">
                <div className="min-w-0">
                  {(() => {
                    const currentDisplay = getNoteDisplayInfo(selectedFile);
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono mb-0.5">
                        <span className="capitalize">{selectedFile.category}</span>
                        <ChevronRight className="w-3 h-3 opacity-60" />
                        <span className="text-[var(--text-color)] font-semibold truncate">{currentDisplay.title}</span>
                        <span className={`ml-1 px-1.5 py-0.2 rounded border text-[9px] font-bold ${currentDisplay.badgeColor}`}>
                          {currentDisplay.badge}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedFile.category !== "root" && (
                    <button
                      onClick={() => {
                        setNoteToDelete(selectedFile);
                        setIsDeleteModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg border border-red-500/20 text-red-500/80 hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer mr-1"
                      title="Move Note to Trash (.trash/)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={handleCopy}
                    className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-[var(--border-color)] transition-colors cursor-pointer"
                    title="Copy Markdown"
                  >
                    {copySuccess ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>

                  {isEditing ? (
                    <button
                      onClick={handleSaveFile}
                      disabled={isSaving}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSaving ? "Saving..." : "Save"}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border-color)] hover:bg-[var(--border-color)] text-xs font-medium text-[var(--text-color)] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-violet-500" />
                      <span>Edit Note</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Document Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                {isLoadingContent ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3 text-xs text-[var(--text-muted)]">
                    <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading note content...</span>
                  </div>
                ) : isEditing ? (
                  <textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="w-full h-full min-h-[500px] p-4 text-xs font-mono rounded-2xl bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none custom-scrollbar"
                    placeholder="Write Markdown..."
                  />
                ) : (
                  <div className="max-w-3xl mx-auto p-6 rounded-3xl bg-[var(--card-bg)] border border-[var(--border-color)] shadow-xs">
                    <MarkdownRenderer
                      content={content}
                      onWikilinkClick={handleWikilinkNavigation}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col items-center justify-center text-left max-w-4xl mx-auto custom-scrollbar animate-in fade-in duration-300">
              {/* Distinguished Sanctuary Header */}
              <div className="w-full text-center mb-8">
                <div className="inline-flex p-3 rounded-2xl bg-violet-500/10 border border-violet-500/25 text-violet-400 mb-3 shadow-xs">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-color)] tracking-tight">Personal Library Sanctuary</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
                  Your private, offline knowledge vault. 100% on-device, encrypted, and curated from the rhythm of your craft.
                </p>
              </div>

              {/* Latest Chronicle Hero Card */}
              {latestChronicle && (
                <div className="w-full mb-8 p-5 rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent relative overflow-hidden shadow-xs">
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Latest Chronicle</span>
                      </div>
                      <h3 className="text-base font-bold text-[var(--text-color)] truncate">
                        {getNoteDisplayInfo(latestChronicle).title}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] font-mono">
                        {latestChronicle.updated_at || "Recently recorded"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSelectFile(latestChronicle)}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-500/20 transition-all cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Open Chronicle ▶
                    </button>
                  </div>
                </div>
              )}

              {/* Three Collection Showcase Cards — Responsive with Container Queries */}
              <div className="grid grid-cols-1 @[620px]:grid-cols-3 gap-3.5 w-full mb-8">
                {/* Shelf 1: Chronicles */}
                <div
                  onClick={() => setShelf("chronicles")}
                  className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)]/60 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-bold text-[var(--text-color)] flex items-center gap-1.5 min-w-0">
                        <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="truncate">Chronicles</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                        {chroniclesCount} notes
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Daily reviews, weekly syntheses, and monthly milestones.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-violet-400 mt-3 group-hover:translate-x-1 transition-transform inline-block">
                    Browse Chronicles →
                  </span>
                </div>

                {/* Shelf 2: Craft */}
                <div
                  onClick={() => setShelf("craft")}
                  className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)]/60 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-bold text-[var(--text-color)] flex items-center gap-1.5 min-w-0">
                        <Layers className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="truncate">Craft & Code</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                        {craftCount} notes
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Active projects and focused deep work session chapters.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-violet-400 mt-3 group-hover:translate-x-1 transition-transform inline-block">
                    Browse Craft →
                  </span>
                </div>

                {/* Shelf 3: Ideas */}
                <div
                  onClick={() => setShelf("ideas")}
                  className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)]/60 hover:border-violet-500/40 hover:bg-violet-500/5 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-bold text-[var(--text-color)] flex items-center gap-1.5 min-w-0">
                        <Compass className="w-4 h-4 text-sky-500 shrink-0" />
                        <span className="truncate">Ideas & Topics</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
                        {ideasCount} notes
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Topic references, concept notes, and library index.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-violet-400 mt-3 group-hover:translate-x-1 transition-transform inline-block">
                    Browse Ideas →
                  </span>
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="flex items-center gap-2.5 flex-wrap justify-center pt-4 border-t border-[var(--border-color)] w-full">
                <button
                  onClick={() => {
                    setNewNoteCategory("projects");
                    setIsCreatingNew(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-color)] hover:border-violet-500/40 bg-[var(--card-bg)] hover:bg-violet-500/10 text-xs font-semibold text-[var(--text-color)] transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 text-violet-400" />
                  <span>New Project Note</span>
                </button>
                <button
                  onClick={() => {
                    setNewNoteCategory("topics");
                    setIsCreatingNew(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-color)] hover:border-violet-500/40 bg-[var(--card-bg)] hover:bg-violet-500/10 text-xs font-semibold text-[var(--text-color)] transition-all cursor-pointer shadow-xs"
                >
                  <Compass className="w-3.5 h-3.5 text-sky-400" />
                  <span>New Topic Note</span>
                </button>
                <button
                  onClick={handleOpenInObsidian}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--border-color)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-color)] transition-all cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-violet-400" />
                  <span>Open Folder in Obsidian</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Note Dialog */}
      {isCreatingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--card-bg)] border border-[var(--border-color)] rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-color)] flex items-center gap-2">
              <Plus className="w-4 h-4 text-violet-500" />
              <span>Create New Vault Note</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewNoteCategory("projects")}
                    className={`py-1.5 px-3 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                      newNoteCategory === "projects"
                        ? "bg-violet-600 text-white border-violet-600"
                        : "border-[var(--border-color)] text-[var(--text-color)]"
                    }`}
                  >
                    🚀 Project
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewNoteCategory("topics")}
                    className={`py-1.5 px-3 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                      newNoteCategory === "topics"
                        ? "bg-violet-600 text-white border-violet-600"
                        : "border-[var(--border-color)] text-[var(--text-color)]"
                    }`}
                  >
                    💡 Topic / Guide
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] block mb-1">Note Title</label>
                <input
                  type="text"
                  placeholder="e.g. lifemirror-desktop or tauri-ipc"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--bg-color)] border border-[var(--border-color)] text-[var(--text-color)] focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewNoteTitle("");
                }}
                className="px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-color)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateNewNote}
                disabled={!newNoteTitle.trim()}
                className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Create Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal: Delete Note */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Move Note to Trash"
        message={`Move "${noteToDelete?.name}" to the vault trash (.trash/)? Any references in index.md and log.md will be cleanly removed.`}
        onConfirm={async () => {
          if (!noteToDelete) return;
          try {
            await invoke("delete_vault_file", { relativePath: noteToDelete.relative_path });
            setIsDeleteModalOpen(false);
            setNoteToDelete(null);
            setSelectedFile(null);
            setContent("");
            await loadVaultStructure();
          } catch (err) {
            console.error("Failed to delete note:", err);
          }
        }}
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setNoteToDelete(null);
        }}
      />

      {/* Confirm Modal: Clear Vault */}
      <ConfirmModal
        isOpen={isClearVaultModalOpen}
        title="Clear & Archive Vault"
        message="This will archive all current notes (projects, topics, sessions, periodic) into a timestamped snapshot in .trash/ and reset your vault index. Your encrypted SQLite database history is completely untouched. Are you sure you want to proceed?"
        onConfirm={async () => {
          try {
            await invoke("clear_and_archive_vault");
            setIsClearVaultModalOpen(false);
            setSelectedFile(null);
            setContent("");
            await loadVaultStructure();
          } catch (err) {
            console.error("Failed to clear vault:", err);
          }
        }}
        onCancel={() => setIsClearVaultModalOpen(false)}
      />

      {/* Living Memoir Anthology Modal */}
      <MemoirModal
        isOpen={isMemoirModalOpen}
        onClose={() => setIsMemoirModalOpen(false)}
        vaultFiles={files}
        onSaveToVault={async (relativePath, content) => {
          await invoke("write_vault_file", { relativePath, content });
          await loadVaultStructure(relativePath);
        }}
      />
    </div>
  );
};
