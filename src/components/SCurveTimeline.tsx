import React, { useState, useMemo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { 
  Monitor, Globe, Clock, Plus, Terminal, MessageSquare, 
  Trash2, Video, ChevronDown, ChevronUp, ExternalLink 
} from "lucide-react";

export interface ActivityNode {
  id: number;
  app_name: string;
  window_title: string;
  start_time: string;
  duration: number;
  source: string;
  url?: string;
  icon_url?: string;
  domain_tag?: string;
  notes?: string;
}

export interface SubSessionEvent {
  id: number;
  session_type: string;
  parent_app_name?: string;
  title: string;
  primary_uri?: string;
  icon_url?: string;
  context_tag?: string;
  metadata?: string;
  timestamp: string;
}

interface SCurveTimelineProps {
  activities: ActivityNode[];
  subSessionEvents: SubSessionEvent[];
  onAddJournal: (activity: ActivityNode) => void;
  onDeleteLog: (id: number) => void;
}

  isGroupedSession: boolean;
  id: number;
  app_name: string;
  window_title: string;
  start_time: string;
  duration: number;
  source: string;
  url?: string;
  icon_url?: string;
  domain_tag?: string;
  notes?: string;
  originalActivities: ActivityNode[];
  subEvents: SubSessionEvent[];
}

// Brand SVG Icons
const VSCodeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" className={props.className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.984 6.304l-2.928-2.616a.434.434 0 00-.575-.02L9.208 11.536 2.896 6.744a.435.435 0 00-.575.02L.016 8.92a.428.428 0 00-.01.597l5.968 5.768L.006 21.056a.43.43 0 00.01.6l2.304 2.152a.434.434 0 00.576-.02l6.312-4.792 11.272 7.864a.434.434 0 00.576-.02l2.928-2.616a.434.434 0 00.048-.568l-8.528-9.08 8.528-9.08a.434.434 0 00-.048-.568z" fill="#007ACC"/>
    <path d="M18.8 17.512V11.2l-4.712 3.584 4.712 2.728z" fill="#0065A9"/>
  </svg>
);

const GenericCodeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" className={props.className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="url(#code-editor-grad)"/>
    <path d="M8 8L4 12L8 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 8L20 12L16 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 6L10 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <defs>
      <linearGradient id="code-editor-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#a855f7"/>
        <stop offset="1" stopColor="#6366f1"/>
      </linearGradient>
    </defs>
  </svg>
);

const FigmaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 38 57" fill="none" className={props.className} xmlns="http://www.w3.org/2000/svg">
    <path d="M19 0C13.75 0 9.5 4.25 9.5 9.5C9.5 14.75 13.75 19 19 19H28.5V9.5C28.5 4.25 24.25 0 19 0Z" fill="#F24E1E"/>
    <path d="M9.5 28.5C9.5 23.25 13.75 19 19 19H28.5V38H19C13.75 38 9.5 33.75 9.5 28.5Z" fill="#A259FF"/>
    <path d="M9.5 47.5C9.5 42.25 13.75 38 19 38C24.25 38 28.5 42.25 28.5 47.5C28.5 52.75 24.25 57 19 57C13.75 57 9.5 52.75 9.5 47.5Z" fill="#0ACF83"/>
    <path d="M9.5 9.5C9.5 14.75 13.75 19 19 19V9.5C19 4.25 14.75 0 9.5 0C4.25 0 0 4.25 0 9.5C0 14.75 4.25 19 9.5 19Z" fill="#FF7262"/>
    <path d="M0 28.5C0 23.25 4.25 19 9.5 19V38C4.25 38 0 33.75 0 28.5Z" fill="#1ABCFE"/>
  </svg>
);

const SpotifyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" className={props.className} fill="#1DB954" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.894-.982-.336.076-.67-.135-.746-.472-.076-.336.136-.67.472-.746 3.855-.88 7.15-.51 9.82 1.127.295.18.387.563.208.866zm1.224-2.728c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.082-1.182-.413.125-.85-.107-.975-.52-.125-.413.107-.85.52-.975 3.678-1.117 8.243-.574 11.35 1.335.368.226.488.708.26 1.082zm.105-2.835C14.692 8.71 9.373 8.535 6.29 9.47c-.475.145-.978-.124-1.124-.6-.145-.475.124-.978.6-1.124 3.548-1.076 9.413-.876 13.12 1.325.428.254.57.805.316 1.233-.254.428-.805.57-1.233.316z"/>
  </svg>
);

const SlackIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" className={props.className} xmlns="http://www.w3.org/2000/svg">
    <g fill="none" fillRule="evenodd">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52z" fill="#36C5F0"/>
      <path d="M6.302 15.165a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.044a2.528 2.528 0 0 1-2.52 2.522H8.822a2.528 2.528 0 0 1-2.52-2.522v-5.044z" fill="#36C5F0"/>
      <path d="M8.822 5.042a2.528 2.528 0 0 1-2.52-2.52 2.528 2.528 0 0 1 2.52-2.522 2.528 2.528 0 0 1 2.522 2.522v2.52h-2.522z" fill="#2EB67D"/>
      <path d="M8.822 6.302a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52H3.778a2.528 2.528 0 0 1-2.52-2.52V8.822a2.528 2.528 0 0 1 2.52-2.52h5.044z" fill="#2EB67D"/>
      <path d="M18.958 8.822a2.528 2.528 0 0 1 2.52-2.52 2.528 2.528 0 0 1 2.522 2.52 2.528 2.528 0 0 1-2.522 2.522h-2.52V8.822z" fill="#ECB22E"/>
      <path d="M17.698 8.822a2.528 2.528 0 0 1-2.52 2.52h-5.043a2.528 2.528 0 0 1-2.52-2.52V3.778a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.52 2.52v5.044z" fill="#ECB22E"/>
      <path d="M15.178 18.958a2.528 2.528 0 0 1 2.52 2.522 2.528 2.528 0 0 1-2.52 2.52 2.528 2.528 0 0 1-2.522-2.52v-2.522h2.522z" fill="#E01E5A"/>
      <path d="M15.178 17.698a2.528 2.528 0 0 1-2.522-2.52v-5.043a2.528 2.528 0 0 1 2.522-2.52h5.044a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.52h-5.044z" fill="#E01E5A"/>
    </g>
  </svg>
);

const DiscordIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 127.14 96.36" className={props.className} fill="#5865F2" xmlns="http://www.w3.org/2000/svg">
    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.88,6.83,77.19,77.19,0,0,0,49.58,0,105.15,105.15,0,0,0,19.14,8.07C2.7,32.48-1.86,56.13.3,79.24A107.4,107.4,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.88-.65,1.72-1.34,2.51-2a76.68,76.68,0,0,0,72.63,0c.79.71,1.63,1.4,2.51,2a68.1,68.1,0,0,1-10.5,5,77.06,77.06,0,0,0,6.63,10.85,107.32,107.32,0,0,0,31.75-17.12C129.87,50.75,124.93,27.25,107.7,8.07ZM42.45,65.69C33.18,65.69,25.5,57.17,25.5,46.72S33.18,27.75,42.45,27.75,59.4,36.27,59.4,46.72,51.72,65.69,42.45,65.69Zm42.24,0C75.42,65.69,67.74,57.17,67.74,46.72S75.42,27.75,84.69,27.75,101.64,36.27,101.64,46.72,94,65.69,84.69,65.69Z"/>
  </svg>
);

const ChromeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" className={props.className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="4" fill="#4285F4"/>
    <path d="M12 2a10 10 0 0 0-7.68 3.6L9.6 13.8a4 4 0 0 1 2.4-3.8h10A10 10 0 0 0 12 2z" fill="#EA4335"/>
    <path d="M4.32 5.6A10 10 0 0 0 12 22a4 4 0 0 1-3.6-2.6L4.32 5.6z" fill="#34A853"/>
    <path d="M12 22a10 10 0 0 0 9.68-7.4H11.6a4 4 0 0 1-3.2 4.8l3.6 2.6z" fill="#FBBC05"/>
  </svg>
);

const BraveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" className={props.className} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm3.89 12.83c.47-.46.71-1.09.71-1.89l.01-2.6a3.27 3.27 0 0 0-.9-2.22l-1.39-1.35c-.65-.63-1.5-.96-2.42-.96l-2.41.01c-.91.01-1.76.36-2.4 1l-1.33 1.39c-.61.64-.93 1.48-.92 2.39l.02 2.58c0 .8.25 1.43.73 1.88l2.9 2.76c.64.6 1.48.92 2.37.91h2.15c.87.01 1.7-.3 2.33-.89l2.59-2.99zM12 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill="#FB542B"/>
  </svg>
);

const resolveIconSrc = (src?: string): string => {
  if (!src) return "";
  if (/^(https?:|data:|asset:|tauri:)/i.test(src)) return src;
  if (src.startsWith("/")) return convertFileSrc(src);
  return src;
};

const IconImage: React.FC<{ src: string; fallback: React.ReactNode }> = ({ src, fallback }) => {
  const [failed, setFailed] = React.useState(false);
  if (failed || !src) return <>{fallback}</>;

  return (
    <img
      src={resolveIconSrc(src)}
      className="w-full h-full rounded object-contain bg-black/5 dark:bg-white/10 p-0.5"
      onError={() => setFailed(true)}
      alt=""
    />
  );
};

interface AppIconProps {
  appName: string;
  url?: string;
  iconUrl?: string;
  domainTag?: string;
  source: string;
  className?: string;
  showBadge?: boolean;
}

const AppIcon: React.FC<AppIconProps> = ({ appName, url, iconUrl, domainTag, source, className = "w-5 h-5", showBadge = false }) => {
  const isBrowser = source.toLowerCase() === "browser";
  const nameLower = appName.toLowerCase();

  let mainIcon: React.ReactNode;
  let browserIconNode: React.ReactNode | null = null;

  // Resolve browser brand icon for badges
  if (nameLower.includes("chrome")) {
    browserIconNode = <ChromeIcon className="w-2.5 h-2.5" />;
  } else if (nameLower.includes("brave")) {
    browserIconNode = <BraveIcon className="w-2.5 h-2.5" />;
  } else if (nameLower.includes("firefox")) {
    browserIconNode = <Globe className="w-2.5 h-2.5 text-orange-500" />;
  } else if (isBrowser) {
    browserIconNode = <Globe className="w-2.5 h-2.5 text-blue-400" />;
  }

  // Resolve main icon
  if (isBrowser) {
    let faviconSrc = iconUrl;
    if (!faviconSrc) {
      const domain = domainTag || (url ? extractDomain(url) : "");
      if (domain) {
        faviconSrc = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      }
    }

    mainIcon = faviconSrc ? (
      <IconImage src={faviconSrc} fallback={<Globe className="w-full h-full text-blue-400" />} />
    ) : (
      <Globe className="w-full h-full text-blue-400" />
    );
  } else if (iconUrl) {
    mainIcon = <IconImage src={iconUrl} fallback={<Monitor className="w-full h-full text-zinc-400 dark:text-zinc-500" />} />;
  } else {
    // Check known desktop apps
    if (
      nameLower === "code" ||
      nameLower === "code-oss" ||
      nameLower.includes("vscode") ||
      nameLower.includes("visual-studio-code") ||
      nameLower.includes("visual studio code")
    ) {
      mainIcon = <VSCodeIcon className="w-full h-full" />;
    } else if (
      nameLower.includes("cursor") || 
      nameLower.includes("antigravity") || 
      nameLower.includes("windsurf") || 
      nameLower.includes("intellij") || 
      nameLower.includes("sublime") ||
      nameLower.includes("studio") ||
      nameLower.includes("eclipse") ||
      nameLower.includes("atom") ||
      nameLower.includes("neovim") ||
      nameLower.includes("vim") ||
      nameLower.includes("emacs") ||
      nameLower.includes("clion") ||
      nameLower.includes("webstorm") ||
      nameLower.includes("pycharm") ||
      nameLower.includes("rider")
    ) {
      mainIcon = <GenericCodeIcon className="w-full h-full" />;
    } else if (
      nameLower.includes("terminal") || 
      nameLower.includes("bash") || 
      nameLower.includes("zsh") || 
      nameLower.includes("kitty") || 
      nameLower.includes("alacritty") || 
      nameLower.includes("console")
    ) {
      mainIcon = <Terminal className="w-full h-full text-emerald-500" />;
    } else if (nameLower.includes("spotify") || nameLower.includes("music") || nameLower.includes("rhythmbox")) {
      mainIcon = <SpotifyIcon className="w-full h-full" />;
    } else if (
      nameLower.includes("slack") || 
      nameLower.includes("discord") || 
      nameLower.includes("signal") || 
      nameLower.includes("whatsapp") || 
      nameLower.includes("telegram")
    ) {
      if (nameLower.includes("slack")) {
        mainIcon = <SlackIcon className="w-full h-full" />;
      } else if (nameLower.includes("discord")) {
        mainIcon = <DiscordIcon className="w-full h-full" />;
      } else {
        mainIcon = <MessageSquare className="w-full h-full text-indigo-400" />;
      }
    } else if (nameLower.includes("figma") || nameLower.includes("gimp") || nameLower.includes("inkscape") || nameLower.includes("photoshop")) {
      mainIcon = <FigmaIcon className="w-full h-full" />;
    } else if (nameLower.includes("zoom") || nameLower.includes("meet") || nameLower.includes("teams") || nameLower.includes("video")) {
      mainIcon = <Video className="w-full h-full text-red-400" />;
    } else if (nameLower.includes("chrome") || nameLower.includes("firefox") || nameLower.includes("brave") || nameLower.includes("browser")) {
      if (nameLower.includes("chrome")) {
        mainIcon = <ChromeIcon className="w-full h-full" />;
      } else if (nameLower.includes("brave")) {
        mainIcon = <BraveIcon className="w-full h-full" />;
      } else {
        mainIcon = <Globe className="w-full h-full text-blue-500" />;
      }
    } else {
      mainIcon = <Monitor className="w-full h-full text-zinc-400 dark:text-zinc-500" />;
    }
  }

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {mainIcon}
      {showBadge && isBrowser && browserIconNode && (
        <div className="absolute -bottom-1.5 -right-1.5 bg-[var(--timeline-anchor-bg)] border border-[var(--border-color)] rounded-full p-0.5 shadow-sm flex items-center justify-center">
          {browserIconNode}
        </div>
      )}
    </div>
  );
};

const extractDomain = (url?: string): string => {
  if (!url) return "";
  try {
    let host = url;
    if (url.startsWith("https://")) {
      host = url.substring(8);
    } else if (url.startsWith("http://")) {
      host = url.substring(7);
    }
    const end = host.indexOf("/");
    const query = host.indexOf("?");
    const colon = host.indexOf(":");
    let limit = host.length;
    if (end !== -1) limit = Math.min(limit, end);
    if (query !== -1) limit = Math.min(limit, query);
    if (colon !== -1) limit = Math.min(limit, colon);
    
    let hostname = host.substring(0, limit);
    if (hostname.startsWith("www.")) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch {
    return "";
  }
};

export const SCurveTimeline: React.FC<SCurveTimelineProps> = ({ 
  activities, 
  subSessionEvents, 
  onAddJournal, 
  onDeleteLog 
}) => {
  const rowHeight = 250;
  const width = 800;
  const colXs = [130, 400, 670];
  const colPercentages = ['16.25%', '50%', '83.75%'];

  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);

  // Group consecutive browser/editor usages together
  const processedNodes = useMemo(() => {
    const isBrowserApp = (appName: string): boolean => {
      const lower = appName.toLowerCase();
      return lower.includes("chrome") ||
             lower.includes("firefox") ||
             lower.includes("brave") ||
             lower.includes("safari") ||
             lower.includes("opera") ||
             lower.includes("edge") ||
             lower.includes("chromium");
    };

    const nodes: TimelineNode[] = [];
    let currentGroup: TimelineNode | null = null;

    activities.forEach((activity) => {
      const isBrowser = activity.source.toLowerCase() === "browser" || isBrowserApp(activity.app_name);
      const isEditor = activity.source.toLowerCase() === "editor";
      const isGroupable = isBrowser || isEditor;

      if (isGroupable) {
        // Group by app_name and source
        if (currentGroup && currentGroup.source === (isBrowser ? "Browser" : "Editor") && currentGroup.app_name === activity.app_name) {
          currentGroup.duration += activity.duration;
          currentGroup.originalActivities.push(activity);
          if (activity.notes) {
            currentGroup.notes = currentGroup.notes 
              ? `${currentGroup.notes} | ${activity.notes}` 
              : activity.notes;
          }
        } else {
          if (currentGroup) nodes.push(currentGroup);
          
          currentGroup = {
            isGroupedSession: true,
            id: activity.id,
            app_name: activity.app_name,
            window_title: `${activity.app_name} Session`,
            start_time: activity.start_time,
            duration: activity.duration,
            source: isBrowser ? "Browser" : "Editor",
            notes: activity.notes,
            originalActivities: [activity],
            subEvents: [],
          };
        }
      } else {
        if (currentGroup) {
          nodes.push(currentGroup);
          currentGroup = null;
        }
        nodes.push({
          isGroupedSession: false,
          id: activity.id,
          app_name: activity.app_name,
          window_title: activity.window_title,
          start_time: activity.start_time,
          duration: activity.duration,
          source: activity.source,
          url: activity.url,
          icon_url: activity.icon_url,
          domain_tag: activity.domain_tag,
          notes: activity.notes,
          originalActivities: [activity],
          subEvents: [],
        });
      }
    });

    if (currentGroup) {
      nodes.push(currentGroup);
    }

    // Assign overlapping sub session events to each group node
    nodes.forEach((node) => {
      if (node.isGroupedSession) {
        const groupStart = new Date(node.start_time).getTime();
        const groupEnd = groupStart + node.duration * 1000;
        
        node.subEvents = subSessionEvents.filter((event) => {
          if (event.session_type !== node.source) return false;
          if (node.source === "Editor" && event.parent_app_name !== node.app_name) return false;
          
          const eventTime = new Date(event.timestamp).getTime();
          // Filter events falling within this group session (+/- 5 second tolerance)
          return eventTime >= groupStart - 5000 && eventTime <= groupEnd + 5000;
        });
      }
    });

    return nodes;
  }, [activities, subSessionEvents]);

  // Helper to calculate coordinates of node at index with coordinate shifting
  const getBaseNodeCoords = (index: number) => {
    const r = Math.floor(index / 3);
    const isRowEven = r % 2 === 0;
    const col = isRowEven ? (index % 3) : (2 - (index % 3));
    const x = colXs[col];
    const y = r * rowHeight + 80;
    return { x, y, r, isRowEven, col };
  };

  const getNodeCoords = (index: number) => {
    const base = getBaseNodeCoords(index);
    let offset = 0;
    if (expandedGroupId !== null) {
      const expandedIndex = processedNodes.findIndex(n => n.id === expandedGroupId);
      if (expandedIndex !== -1 && index > expandedIndex) {
        offset = 220; // Shift subsequent nodes down by 220px to prevent layout shift
      }
    }
    return { ...base, y: base.y + offset };
  };

  // Generate continuous cubic Bézier path for the S-Curve
  const generatePath = () => {
    if (processedNodes.length === 0) return `M ${width / 2} 50 L ${width / 2} 400`;
    if (processedNodes.length === 1) return `M ${colXs[0]} 80 L ${colXs[0]} 80`;
    
    let d = `M ${colXs[0]} 80`; // Start at the first node
    
    const coords = processedNodes.map((_, i) => getNodeCoords(i));
    
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      
      if (curr.r === next.r) {
        // Horizontal line in the same row
        d += ` L ${next.x} ${next.y}`;
      } else {
        // Transition to next row (180-degree U-turn)
        const isRightTurn = curr.isRowEven;
        const cpX1 = isRightTurn ? width - 20 : 20;
        const cpX2 = isRightTurn ? width - 20 : 20;
        
        d += ` C ${cpX1} ${curr.y}, ${cpX2} ${next.y}, ${next.x} ${next.y}`;
      }
    }
    return d;
  };

  const getFormatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const getFormatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return "00:00";
    }
  };

  const totalHeight = processedNodes.length === 0 
    ? 400 
    : Math.ceil(processedNodes.length / 3) * rowHeight + 80 + (expandedGroupId !== null ? 220 : 0);

  return (
    <div className="relative w-full max-h-[calc(100vh-180px)] overflow-y-auto overflow-x-hidden py-10 px-4 select-none flex justify-center">
      {processedNodes.length === 0 ? (
        <div className="text-center py-20 glass-card rounded-2xl p-8 max-w-md mx-auto">
          <Clock className="w-12 h-12 text-violet-400 mx-auto mb-4 animate-pulse" />
          <h3 className="text-xl font-semibold text-[var(--text-color)]">No activity recorded yet</h3>
          <p className="text-sm text-[var(--text-muted)] mt-2">
            Make sure window focus tracking is active or browse tabs in Chrome with the companion extension enabled.
          </p>
        </div>
      ) : (
        <div className="relative w-full max-w-4xl" style={{ height: `${totalHeight}px` }}>
          {/* Timeline SVG */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${width} ${totalHeight}`}
            preserveAspectRatio="none"
            fill="none"
          >
            {/* Background path line */}
            <path
              d={generatePath()}
              stroke="var(--timeline-bg-path)"
              strokeWidth="4"
              strokeLinecap="round"
            />
            {/* Glow primary active curve */}
            <path
              d={generatePath()}
              stroke="url(#timeline-grad)"
              strokeWidth="4"
              strokeLinecap="round"
              className="timeline-glow opacity-80"
            />
            
            <defs>
              <linearGradient id="timeline-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>

          {/* Interactive nodes along the curve */}
          {processedNodes.map((node, index) => {
            const { y: nodeY, col } = getNodeCoords(index);
            const isBrowser = node.source.toLowerCase() === "browser";
            const isExpanded = expandedGroupId === node.id;

            // Compute unique domains for subtext
            const uniqueDomains = Array.from(
              new Set(node.originalActivities.map(a => a.domain_tag || extractDomain(a.url)).filter(Boolean))
            ).slice(0, 3).join(", ");
            const domainsText = uniqueDomains 
              ? `${uniqueDomains}${node.originalActivities.length > 3 ? "..." : ""}` 
              : "Multiple tabs";

            return (
              <React.Fragment key={node.id || index}>
                {/* Visual anchor point circle */}
                <div
                  className="absolute z-20 w-9 h-9 rounded-full border-2 border-violet-500 bg-[var(--timeline-anchor-bg)] flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer shadow-[0_0_12px_rgba(139,92,246,0.3)] transition-transform duration-300 hover:scale-125"
                  style={{ left: colPercentages[col], top: `${nodeY}px` }}
                  title={`${node.app_name}: ${node.window_title}`}
                  onClick={() => {
                    if (node.isGroupedSession) {
                      setExpandedGroupId(isExpanded ? null : node.id);
                    }
                  }}
                >
                  <AppIcon 
                    appName={String(node.app_name)} 
                    url={node.url || (node.originalActivities[0] && node.originalActivities[0].url)} 
                    iconUrl={node.icon_url || (node.originalActivities[0] && node.originalActivities[0].icon_url)} 
                    domainTag={node.domain_tag || (node.originalActivities[0] && node.originalActivities[0].domain_tag)}
                    source={node.source} 
                    className="w-5 h-5" 
                    showBadge={true}
                  />
                </div>

                {/* Glassmorphic Activity Card hanging from the node */}
                <div
                  className={`absolute glass-card rounded-xl p-3.5 shadow-xl text-left z-10 transition-all duration-300 ${
                    node.isGroupedSession ? 'cursor-pointer hover:border-violet-500/50' : ''
                  }`}
                  style={{
                    left: colPercentages[col],
                    top: `${nodeY + 22}px`,
                    transform: 'translateX(-50%)',
                    width: '28%',
                    minWidth: '160px',
                    maxWidth: '260px'
                  }}
                  onClick={(e) => {
                    if (node.isGroupedSession) {
                      const target = e.target as HTMLElement;
                      if (!target.closest('button') && !target.closest('a')) {
                        setExpandedGroupId(isExpanded ? null : node.id);
                      }
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1 overflow-hidden max-w-[130px]">
                      <AppIcon 
                        appName={String(node.app_name)} 
                        url={node.url || (node.originalActivities[0] && node.originalActivities[0].url)} 
                        iconUrl={node.icon_url || (node.originalActivities[0] && node.originalActivities[0].icon_url)} 
                        domainTag={node.domain_tag || (node.originalActivities[0] && node.originalActivities[0].domain_tag)}
                        source={node.source} 
                        className="w-4 h-4 shrink-0" 
                        showBadge={true}
                      />
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full truncate ${
                        isBrowser 
                          ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/30' 
                          : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/30'
                      }`}>
                        {node.isGroupedSession 
                          ? `${node.subEvents.length} items`
                          : (node.domain_tag || extractDomain(node.url)) || node.app_name
                        }
                      </span>
                    </div>
                    <div className="flex items-center text-[10px] text-[var(--text-muted)] gap-0.5 shrink-0">
                      <Clock className="w-2.5 h-2.5 text-violet-400" />
                      <span>{getFormatDuration(node.duration)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-start gap-1">
                    <h4 className="text-xs font-semibold text-[var(--text-color)] line-clamp-2 mb-1 flex-1" title={String(node.window_title)}>
                      {node.isGroupedSession ? `${node.app_name} Session` : node.window_title}
                    </h4>
                    {node.isGroupedSession && (
                      <span className="text-[var(--text-muted)] mt-0.5">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] text-blue-500 dark:text-blue-400 line-clamp-1 mb-1.5 select-all hover:underline cursor-pointer">
                    {node.isGroupedSession ? (isBrowser ? domainsText : "Multiple files") : node.url}
                  </p>

                  {node.notes && (
                    <div className="mt-1.5 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-[10px] italic text-[var(--text-color)] select-text leading-snug line-clamp-3">
                      "{node.notes}"
                    </div>
                  )}

                  {/* Expanded Accordion list for sub sessions */}
                  {node.isGroupedSession && isExpanded && (
                    <div className="mt-2.5 pt-2 border-t border-[var(--border-color)] max-h-[160px] overflow-y-auto pr-1 select-text custom-scrollbar space-y-1.5">
                      {node.subEvents.length === 0 ? (
                        <span className="text-[9px] text-[var(--text-muted)] italic block py-1 text-center">No nested events recorded</span>
                      ) : (
                        node.subEvents.map((event, idx) => {
                          // Calculate duration
                          let dur = 0;
                          if (idx < node.subEvents.length - 1) {
                            const t1 = new Date(event.timestamp).getTime();
                            const t2 = new Date(node.subEvents[idx + 1].timestamp).getTime();
                            dur = Math.max(0, (t2 - t1) / 1000);
                          } else {
                            // Last event: cap at the group's end time
                            const t1 = new Date(event.timestamp).getTime();
                            const groupStart = new Date(node.start_time).getTime();
                            const groupEnd = groupStart + node.duration * 1000;
                            dur = Math.max(0, (groupEnd - t1) / 1000);
                          }

                          const formattedDur = dur > 0 ? getFormatDuration(Math.round(dur)) : "1s";

                          return (
                            <div 
                              key={event.id || idx} 
                              className="flex items-center justify-between gap-2 text-[10px] p-1.5 rounded bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                            >
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                <AppIcon
                                  appName={event.parent_app_name || node.app_name}
                                  url={event.primary_uri}
                                  iconUrl={event.icon_url}
                                  domainTag={event.context_tag}
                                  source={event.session_type}
                                  className="w-3.5 h-3.5 shrink-0"
                                  showBadge={false}
                                />
                                <div className="flex flex-col overflow-hidden">
                                  <span className="font-semibold text-[var(--text-color)] truncate max-w-[110px]" title={event.title}>
                                    {event.title}
                                  </span>
                                  <span className="text-[8px] text-[var(--text-muted)] truncate max-w-[110px]">
                                    {event.context_tag || extractDomain(event.primary_uri)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[8px] font-mono text-[var(--text-muted)] bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">
                                  {formattedDur}
                                </span>
                                {event.primary_uri && event.primary_uri.startsWith("http") && (
                                  <a
                                    href={event.primary_uri}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-0.5 text-blue-500 hover:bg-blue-500/10 rounded transition-colors"
                                    title="Open Link"
                                  >
                                    <ExternalLink className="w-3 h-3 text-blue-500" />
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-[var(--border-color)]">
                    <span className="text-[9px] text-[var(--text-muted)] font-mono">
                      {getFormatTime(node.start_time)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (node.isGroupedSession) {
                            if (window.confirm("Delete this session and all its sub-events?")) {
                              node.originalActivities.forEach(act => {
                                if (act.id) onDeleteLog(act.id);
                              });
                            }
                          } else {
                            if (node.id && window.confirm("Delete this activity log?")) {
                              onDeleteLog(node.id);
                            }
                          }
                        }}
                        disabled={!node.id}
                        className="p-1 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-50 transition-colors cursor-pointer"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          // For grouped browser card, pass the first original activity log
                          onAddJournal(node.originalActivities[0] || (node as any));
                        }}
                        className="p-1 rounded text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors cursor-pointer"
                        title={node.notes ? "Edit Note" : "Reflect"}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
