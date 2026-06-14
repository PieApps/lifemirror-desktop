---
name: frontend_ui_web
description: "Expert skill for crafting React + Vite dashboards, drawing responsive serpentine SVG S-Curve timeline vectors, and triggering local Ollama reflection requests."
---

# Frontend UI Web Developer Skill

Use this skill when developing the React dashboard and timeline interfaces of LifeMirror.

> [!IMPORTANT]
> Always adhere to the project workflow guidelines specified in [docs/WORKFLOW.md](file:///var/www/pieapps/lifemirror-desktop/docs/WORKFLOW.md). Run pre-change builds, keep edits surgical, and run verification loops before concluding.

## Core Capabilities & Instructions

1. **SVG Serpentine Path Calculus**:
   - Draw an S-shaped curving path winding down the page.
   - For row `index`, sweep control points to the right or left margins dynamically.
   - Position activity node icons at the parametric midpoint `t = 0.5` of each cubic Bezier curve segment.
   - Midwest nodes sit at `x = width * 0.875` (even) and `x = width * 0.125` (odd), at `y = (index + 0.5) * rowHeight`.

2. **Aesthetics & Layout**:
   - Dark mode styling using `#0d0d11` backgrounds, violet paths, and glassmorphism cards.
   - High-contrast visual lockouts when Incognito Mode is toggled to indicate that logging has paused.

3. **Ollama Integration**:
   - Treat Ollama as an optional plugin. Query the local HTTP endpoint (`http://localhost:11434/api/generate`) with system prompts and handle errors gracefully.

4. **Build & Test Delegation**:
   - Run `npm run build` to verify React/Vite assets compile cleanly.
   - Skip Rust compilation checks (`cargo check`) to avoid duplicate compilation and file locks.
