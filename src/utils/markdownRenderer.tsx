import React from "react";
import { ExternalLink, Tag, ChevronRight, Clock, Rocket, Calendar, Sparkles } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

interface MarkdownRendererProps {
  content: string;
  onWikilinkClick?: (target: string) => void;
  className?: string;
}

interface ParsedFrontmatter {
  [key: string]: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onWikilinkClick,
  className = "",
}) => {
  const handleSafeOpenUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        openUrl(url);
      } else {
        console.warn("Blocked untrusted protocol in markdown link:", parsed.protocol);
      }
    } catch {
      console.warn("Invalid or relative URL in markdown link:", url);
    }
  };

  const { frontmatter, renderedNodes, hasKpis, displayFmEntries } = React.useMemo(() => {
    // Extract and parse frontmatter if present
    let rawBody = content;
    const fm: ParsedFrontmatter = {};

    if (content.startsWith("---")) {
      const endMatch = content.indexOf("\n---", 3);
      if (endMatch !== -1) {
        const fmLines = content.substring(3, endMatch).split("\n");
        fmLines.forEach((line) => {
          const colonIdx = line.indexOf(":");
          if (colonIdx !== -1) {
            const key = line.substring(0, colonIdx).trim();
            const val = line.substring(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
            if (key && val) {
              fm[key] = val;
            }
          }
        });
        rawBody = content.substring(endMatch + 4).trim();
      }
    }

    // Render inline formatting: wikilinks, links, code, bold, italic
    const renderInline = (text: string): React.ReactNode[] => {
      // Regex matches:
      // 1: [[target|alias]] or [[target\|alias]] or [[target]]
      // 2: [text](url)
      // 3: `code`
      // 4: **bold**
      // 5: *italic*
      const inlineRegex = /\[\[(.*?)(?:\\?\|(.*?))?\]\]|\[(.*?)\]\((.*?)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
      const elements: React.ReactNode[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = inlineRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          elements.push(text.substring(lastIndex, match.index));
        }

        if (match[1] !== undefined) {
          // [[wikilink]]
          const target = match[1].replace(/\\\|/g, "|").trim();
          const alias = (match[2] ? match[2].replace(/\\\|/g, "|").trim() : null) || target;
          elements.push(
            <button
              key={`wiki-${match.index}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onWikilinkClick?.(target);
              }}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md bg-violet-500/15 hover:bg-violet-500/25 text-violet-600 dark:text-violet-400 font-semibold text-xs transition-colors cursor-pointer border border-violet-500/20"
              title={`Jump to note: ${target}`}
            >
              <span className="opacity-70 text-[10px]">[[</span>
              <span>{alias}</span>
              <span className="opacity-70 text-[10px]">]]</span>
            </button>
          );
        } else if (match[3] !== undefined && match[4] !== undefined) {
          // [text](url) with safe protocol verification
          const label = match[3];
          const href = match[4];
          elements.push(
            <a
              key={`link-${match.index}`}
              href={href}
              onClick={(e) => {
                e.preventDefault();
                handleSafeOpenUrl(href);
              }}
              className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-medium cursor-pointer"
            >
              <span>{label}</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>
          );
        } else if (match[5] !== undefined) {
          // `code`
          elements.push(
            <code
              key={`code-${match.index}`}
              className="px-1.5 py-0.5 mx-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono text-xs border border-zinc-300/50 dark:border-zinc-700/50"
            >
              {match[5]}
            </code>
          );
        } else if (match[6] !== undefined) {
          // **bold**
          elements.push(
            <strong key={`bold-${match.index}`} className="font-bold text-[var(--text-color)]">
              {match[6]}
            </strong>
          );
        } else if (match[7] !== undefined) {
          // *italic*
          elements.push(
            <em key={`em-${match.index}`} className="italic">
              {match[7]}
            </em>
          );
        }

        lastIndex = inlineRegex.lastIndex;
      }

      if (lastIndex < text.length) {
        elements.push(text.substring(lastIndex));
      }

      return elements;
    };

    const lines = rawBody.split("\n");
    const nodes: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          nodes.push(
            <pre
              key={`code-block-${i}`}
              className="p-3 my-2 rounded-xl bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto border border-zinc-800 leading-relaxed shadow-inner"
            >
              <code>{codeBuffer.join("\n")}</code>
            </pre>
          );
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      const trimmed = line.trim();

      if (!trimmed) {
        nodes.push(<div key={`sp-${i}`} className="h-2" />);
        continue;
      }

      // Interactive Breadcrumbs: > [[index|...]] > [[...]] > ...
      if (trimmed.startsWith("> [[") || (trimmed.startsWith(">") && trimmed.includes("[[") && trimmed.includes(" > "))) {
        const trail = trimmed.replace(/^>\s*/, "");
        const segments = trail.split(/\s*>\s*/);
        nodes.push(
          <div
            key={`bc-${i}`}
            className="flex items-center flex-wrap gap-1 px-3 py-1.5 my-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs"
          >
            {segments.map((seg, si) => (
              <React.Fragment key={si}>
                {si > 0 && <ChevronRight className="w-3.5 h-3.5 opacity-40 text-violet-400 shrink-0" />}
                <span className="font-medium text-[var(--text-color)]">{renderInline(seg)}</span>
              </React.Fragment>
            ))}
          </div>
        );
        continue;
      }

      // Markdown Table Parser (handles escaped pipes \| within cells)
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        const tableLines: string[] = [];
        let j = i;
        while (j < lines.length && lines[j].trim().startsWith("|") && lines[j].trim().endsWith("|")) {
          tableLines.push(lines[j].trim());
          j++;
        }

        if (tableLines.length >= 2 && tableLines[1].replace(/[\s|:-]/g, "") === "") {
          const splitRow = (rowStr: string) => {
            const inner = rowStr.replace(/^\|/, "").replace(/\|$/, "");
            return inner.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
          };

          const headers = splitRow(tableLines[0]);
          const dataRows = tableLines.slice(2).map(splitRow);

          nodes.push(
            <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-xl border border-[var(--border-color)] shadow-xs">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--border-color)]/30 border-b border-[var(--border-color)] text-[var(--text-color)] font-semibold">
                    {headers.map((h, hi) => (
                      <th key={hi} className="px-3.5 py-2.5 font-bold tracking-tight">
                        {renderInline(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]/40 bg-[var(--card-bg)]">
                  {dataRows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-[var(--border-color)]/20 transition-colors">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-3.5 py-2 text-[var(--text-color)] leading-normal">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );

          i = j - 1;
          continue;
        }
      }

      // Executive Synthesis Block: ## 🧠 Executive Synthesis
      if (trimmed.startsWith("## 🧠 Executive Synthesis")) {
        let synthesisText = "";
        let j = i + 1;
        while (j < lines.length && !lines[j].trim().startsWith("#")) {
          const nextTrimmed = lines[j].trim();
          if (nextTrimmed) {
            synthesisText += (synthesisText ? "\n\n" : "") + nextTrimmed;
          }
          j++;
        }

        nodes.push(
          <div key={`exec-synthesis-${i}`} className="my-4 p-4 rounded-2xl bg-linear-to-br from-amber-500/10 via-violet-500/5 to-transparent border border-amber-500/30 shadow-xs">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-500 font-bold text-xs flex items-center gap-1">
                🧠 Executive Synthesis
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">High-Impact Briefing</span>
            </div>
            <div className="text-xs text-[var(--text-color)] leading-relaxed italic">
              {renderInline(synthesisText || "No synthesis generated yet.")}
            </div>
          </div>
        );

        i = j - 1;
        continue;
      }

      // Headers
      if (trimmed.startsWith("### ")) {
        nodes.push(
          <h3 key={`h3-${i}`} className="text-sm font-bold text-[var(--text-color)] mt-3 mb-1 flex items-center gap-1.5">
            {renderInline(trimmed.substring(4))}
          </h3>
        );
      } else if (trimmed.startsWith("## ")) {
        nodes.push(
          <h2 key={`h2-${i}`} className="text-base font-bold text-[var(--text-color)] mt-4 mb-1.5 pb-1 border-b border-[var(--border-color)]">
            {renderInline(trimmed.substring(3))}
          </h2>
        );
      } else if (trimmed.startsWith("# ")) {
        nodes.push(
          <h1 key={`h1-${i}`} className="text-lg font-extrabold text-[var(--text-color)] mb-2 tracking-tight">
            {renderInline(trimmed.substring(2))}
          </h1>
        );
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        nodes.push(
          <li key={`li-${i}`} className="ml-4 list-disc text-xs text-[var(--text-color)] leading-relaxed my-0.5">
            {renderInline(trimmed.substring(2))}
          </li>
        );
      } else if (trimmed.startsWith("> ")) {
        nodes.push(
          <blockquote
            key={`bq-${i}`}
            className="border-l-3 border-violet-500/60 bg-violet-500/5 px-3 py-1.5 my-1.5 rounded-r-lg text-xs italic text-[var(--text-muted)]"
          >
            {renderInline(trimmed.substring(2))}
          </blockquote>
        );
      } else {
        nodes.push(
          <p key={`p-${i}`} className="text-xs text-[var(--text-color)] leading-relaxed my-1">
            {renderInline(line)}
          </p>
        );
      }
    }

    const isPeriodic = fm.type === "periodic" || !!fm.period;
    const hasKpiStrip = !!fm.active_duration || !!fm.top_project || isPeriodic;
    const kpiKeys = new Set(["active_duration", "top_project", "period", "total_seconds", "sessions_count", "active_days", "weeks_count", "type"]);
    const displayEntries = Object.entries(fm).filter(([k]) => !kpiKeys.has(k));

    return {
      frontmatter: fm,
      renderedNodes: nodes,
      hasKpis: hasKpiStrip,
      displayFmEntries: displayEntries,
    };
  }, [content, onWikilinkClick]);

  return (
    <div className={`markdown-renderer space-y-1 ${className}`}>
      {/* Top Executive KPI Strip */}
      {hasKpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 p-3 rounded-2xl bg-[var(--bg-color)]/60 border border-[var(--border-color)]">
          {frontmatter.active_duration && (
            <div className="flex flex-col p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                <span>Active Time</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-color)]">{frontmatter.active_duration}</div>
            </div>
          )}
          {frontmatter.top_project && (
            <div className="flex flex-col p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                <Rocket className="w-3.5 h-3.5 text-violet-500" />
                <span>Top Project</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-color)] truncate">{frontmatter.top_project}</div>
            </div>
          )}
          {frontmatter.period && (
            <div className="flex flex-col p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                <Calendar className="w-3.5 h-3.5 text-sky-500" />
                <span>Review Horizon</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-color)] capitalize">{frontmatter.period} Review</div>
            </div>
          )}
          {(frontmatter.sessions_count || frontmatter.active_days || frontmatter.weeks_count) && (
            <div className="flex flex-col p-2.5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                <span>Coverage</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-color)]">
                {frontmatter.sessions_count
                  ? `${frontmatter.sessions_count} sessions`
                  : frontmatter.active_days
                  ? `${frontmatter.active_days} active days`
                  : `${frontmatter.weeks_count} weeks`}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Render Remaining Frontmatter as interactive metadata chips */}
      {displayFmEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-3 mb-3 border-b border-[var(--border-color)]">
          {displayFmEntries.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--bg-color)]/80 border border-[var(--border-color)] text-[11px] font-medium text-[var(--text-muted)]"
            >
              <Tag className="w-3 h-3 opacity-60 text-violet-500" />
              <span className="font-semibold text-[var(--text-color)]">{k}:</span>
              <span>{v}</span>
            </span>
          ))}
        </div>
      )}

      {/* Render Document Body */}
      <div className="markdown-body space-y-1">{renderedNodes}</div>
    </div>
  );
};
