export type ActivityCategory = "development" | "communication" | "browser" | "entertainment" | "other";

export interface CategoryInfo {
  name: string;
  color: string;
  bgClass: string;
  borderClass: string;
}

export const CATEGORIES: Record<ActivityCategory, CategoryInfo> = {
  development: {
    name: "Development",
    color: "#a855f7", // violet-500
    bgClass: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300",
    borderClass: "border-purple-200 dark:border-purple-800/30",
  },
  communication: {
    name: "Communication",
    color: "#f43f5e", // rose-500
    bgClass: "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300",
    borderClass: "border-rose-200 dark:border-rose-800/30",
  },
  browser: {
    name: "Browser & Research",
    color: "#3b82f6", // blue-500
    bgClass: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-200 dark:border-blue-800/30",
  },
  entertainment: {
    name: "Entertainment & Media",
    color: "#eab308", // amber-500
    bgClass: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200 dark:border-amber-800/30",
  },
  other: {
    name: "Other Activities",
    color: "#6b7280", // gray-500
    bgClass: "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300",
    borderClass: "border-zinc-200 dark:border-zinc-700/50",
  },
};

/**
 * Maps an application name and optional browser URL or window title
 * into one of the predefined categories.
 */
export function mapAppToCategory(
  appName: string,
  windowTitle: string = "",
  url: string = ""
): ActivityCategory {
  const app = appName.toLowerCase();
  const title = windowTitle.toLowerCase();
  const urlStr = url ? url.toLowerCase() : "";

  // Check Development applications
  if (
    app.includes("code") ||
    app.includes("cursor") ||
    app.includes("terminal") ||
    app.includes("alacritty") ||
    app.includes("kitty") ||
    app.includes("intellij") ||
    app.includes("webstorm") ||
    app.includes("pycharm") ||
    app.includes("clion") ||
    app.includes("rider") ||
    app.includes("neovim") ||
    app.includes("vim") ||
    app.includes("emacs") ||
    app.includes("sublime") ||
    app.includes("studio") ||
    app.includes("bash") ||
    app.includes("zsh")
  ) {
    return "development";
  }

  // Check Communication applications
  if (
    app.includes("slack") ||
    app.includes("discord") ||
    app.includes("teams") ||
    app.includes("zoom") ||
    app.includes("meet") ||
    app.includes("whatsapp") ||
    app.includes("signal") ||
    app.includes("telegram") ||
    app.includes("outlook") ||
    app.includes("thunderbird") ||
    app.includes("mail") ||
    app.includes("chat")
  ) {
    return "communication";
  }

  // Check Entertainment & Media
  if (
    app.includes("spotify") ||
    app.includes("music") ||
    app.includes("rhythmbox") ||
    app.includes("netflix") ||
    app.includes("vlc") ||
    app.includes("mpv") ||
    urlStr.includes("youtube.com") ||
    urlStr.includes("netflix.com") ||
    urlStr.includes("spotify.com") ||
    urlStr.includes("twitch.tv") ||
    title.includes("youtube") ||
    title.includes("netflix")
  ) {
    return "entertainment";
  }

  // Check Browser
  if (
    app.includes("chrome") ||
    app.includes("firefox") ||
    app.includes("brave") ||
    app.includes("safari") ||
    app.includes("opera") ||
    app.includes("chromium") ||
    app.includes("edge") ||
    app.includes("browser") ||
    app.includes("globe")
  ) {
    return "browser";
  }

  return "other";
}
