import { formatDuration } from "./formatDuration";

export interface PostcardData {
  dateStr: string;
  periodType?: "day" | "week" | "month";
  totalFocusSeconds: number;
  episodesCount: number;
  activitiesCount: number;
  purityScore?: number;
  highlights: Array<{
    title: string;
    app: string;
    duration: number;
  }>;
  biographerQuote?: string;
}

export async function generateFlowPostcard(data: PostcardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const width = 1200;
  const height = 675;
  canvas.width = width;
  canvas.height = height;

  const isWeekly = data.periodType === "week";
  const isMonthly = data.periodType === "month";

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to obtain 2D canvas context");
  }

  // 1. Deep Obsidian Background
  ctx.fillStyle = "#09090b";
  ctx.fillRect(0, 0, width, height);

  // 2. Cosmic Ambient Aurora Gradients
  const gradTopRight = ctx.createRadialGradient(width - 150, 150, 10, width - 150, 150, 500);
  gradTopRight.addColorStop(0, "rgba(139, 92, 246, 0.28)");
  gradTopRight.addColorStop(0.5, "rgba(99, 102, 241, 0.12)");
  gradTopRight.addColorStop(1, "rgba(9, 9, 11, 0)");
  ctx.fillStyle = gradTopRight;
  ctx.fillRect(0, 0, width, height);

  const gradBottomLeft = ctx.createRadialGradient(200, height - 120, 10, 200, height - 120, 450);
  gradBottomLeft.addColorStop(0, isWeekly ? "rgba(168, 85, 247, 0.25)" : "rgba(245, 158, 11, 0.22)");
  gradBottomLeft.addColorStop(0.5, "rgba(244, 63, 94, 0.08)");
  gradBottomLeft.addColorStop(1, "rgba(9, 9, 11, 0)");
  ctx.fillStyle = gradBottomLeft;
  ctx.fillRect(0, 0, width, height);

  // Outer border stroke
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  // 3. Header Ribbon
  ctx.fillStyle = isWeekly ? "rgba(168, 85, 247, 0.15)" : "rgba(245, 158, 11, 0.15)";
  ctx.strokeStyle = isWeekly ? "rgba(168, 85, 247, 0.4)" : "rgba(245, 158, 11, 0.4)";
  ctx.lineWidth = 1.5;
  const badgeX = 50;
  const badgeY = 50;
  const badgeW = isWeekly ? 330 : 280;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, 28, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isWeekly ? "#c084fc" : "#fbbf24";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  const badgeLabel = isWeekly
    ? "🌟 LIFEMIRROR WEEKLY OPUS • TAPESTRY"
    : isMonthly
    ? "🌌 LIFEMIRROR MONTHLY OPUS"
    : "🌅 LIFEMIRROR RETROSPECTIVE";
  ctx.fillText(badgeLabel, badgeX + 16, badgeY + 18);

  // Formatted Date
  let formattedDate = data.dateStr;
  if (!isWeekly && !isMonthly) {
    try {
      const d = new Date(data.dateStr + "T12:00:00");
      formattedDate = d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {}
  } else if (isWeekly) {
    formattedDate = `Week Review · ${data.dateStr}`;
  } else if (isMonthly) {
    formattedDate = `Month Review · ${data.dateStr}`;
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 32px system-ui, -apple-system, sans-serif";
  ctx.fillText(formattedDate, 50, 125);

  // Privacy signature on top right
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "right";
  ctx.fillText("100% OFFLINE • ENCRYPTED SILICON", width - 50, 68);
  ctx.textAlign = "left";

  // 4. Glowing Serpentine River Line
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(50, 185);
  ctx.bezierCurveTo(350, 150, 450, 220, 750, 185);
  ctx.bezierCurveTo(900, 165, 1050, 205, width - 50, 185);
  ctx.lineWidth = 5;
  const riverGrad = ctx.createLinearGradient(50, 0, width - 50, 0);
  riverGrad.addColorStop(0, isWeekly ? "#a855f7" : "#f59e0b");
  riverGrad.addColorStop(0.5, "#6366f1");
  riverGrad.addColorStop(1, "#38bdf8");
  ctx.strokeStyle = riverGrad;
  ctx.shadowColor = "rgba(168, 85, 247, 0.6)";
  ctx.shadowBlur = 18;
  ctx.stroke();

  // Milestone orbs along the river
  const orbs = [
    { x: 180, y: 175, color: "#fbbf24" },
    { x: 480, y: 195, color: "#c084fc" },
    { x: 820, y: 180, color: "#818cf8" },
    { x: 1050, y: 195, color: "#38bdf8" },
  ];
  orbs.forEach((orb) => {
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = orb.color;
    ctx.shadowColor = orb.color;
    ctx.shadowBlur = 14;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(orb.x, orb.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 0;
    ctx.fill();
  });
  ctx.restore();

  // 5. Stat Pods
  const statY = 225;
  const statWidth = 350;
  const statHeight = 85;
  const stats = [
    { label: isWeekly ? "WEEKLY FLOW" : "FOCUSED FLOW", val: formatDuration(data.totalFocusSeconds), col: "#fbbf24" },
    { label: isWeekly ? "WEEKLY CHAPTERS" : "CHAPTERS SCULPTED", val: String(data.episodesCount), col: "#a855f7" },
    { label: isWeekly ? "WEEKLY PURITY" : "FLOW PURITY", val: `${data.purityScore || 92}%`, col: "#34d399" },
  ];

  stats.forEach((st, i) => {
    const sx = 50 + i * (statWidth + 25);
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(sx, statY, statWidth, statHeight, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
    ctx.fillText(st.label, sx + 20, statY + 28);

    ctx.fillStyle = st.col;
    ctx.font = "900 30px monospace";
    ctx.fillText(st.val, sx + 20, statY + 65);
  });

  // 6. Sculpted Chapters Highlights List
  const chapY = 335;
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("KEY CRAFT CHAPTERS", 50, chapY + 12);

  const topHighlights = (data.highlights || []).slice(0, 3);
  topHighlights.forEach((h, i) => {
    const cy = chapY + 24 + i * 54;
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(50, cy, width - 100, 44, 12);
    ctx.fill();
    ctx.stroke();

    // Chapter badge
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 12px monospace";
    ctx.fillText(`#${i + 1}`, 68, cy + 27);

    // Chapter title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
    let title = h.title;
    if (title.length > 55) title = title.substring(0, 52) + "...";
    ctx.fillText(title, 110, cy + 27);

    // App and duration on right
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "12px monospace";
    ctx.fillText(h.app, width - 160, cy + 27);

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 13px monospace";
    ctx.fillText(formatDuration(h.duration), width - 68, cy + 27);
    ctx.textAlign = "left";
  });

  // 7. Biographer's Literary Quote
  const quoteY = 525;
  const quote = data.biographerQuote || "A dedicated day of craftsmanship and quiet persistence. Meaningful artifacts left along the river of time.";
  ctx.fillStyle = "rgba(245, 158, 11, 0.1)";
  ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(50, quoteY, width - 100, 68, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fef08a";
  ctx.font = "italic 14px Georgia, serif";
  let displayQuote = `"${quote}"`;
  if (displayQuote.length > 120) displayQuote = displayQuote.substring(0, 117) + '..."';
  ctx.fillText(displayQuote, 72, quoteY + 39);

  // 8. Footer Brand Watermark
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("LifeMirror Desktop · The Cognitive River", 50, height - 32);

  ctx.textAlign = "right";
  ctx.font = "11px monospace";
  ctx.fillText("lifemirror.app", width - 50, height - 32);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob failed"));
    }, "image/png");
  });
}
