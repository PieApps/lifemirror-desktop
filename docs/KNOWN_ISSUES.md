# Known Issues

## Wayland Active Window Tracking
Due to Wayland's strict security and isolation model, there is no standardized protocol to get the globally active window title across all desktop environments.

### GNOME Wayland
GNOME completely prevents access to active window information on Wayland. **To track active windows on GNOME Wayland, a GNOME Shell Extension must be installed.**
- **Details:** The tracker requires an extension that exposes the focused window over D-Bus (e.g., `focused-window-dbus` or similar). Without it, the tracker will default to "No active focus".
- **Workaround:** Install a supported GNOME Shell extension that exposes active window details over D-Bus, or switch to an X11 session.

### Other Desktop Environments
- **KDE Plasma:** Supported natively via D-Bus (`org.kde.KWin`).
- **Hyprland & Sway:** Supported natively using `hyprctl` and `swaymsg`.

## AI Chat Context Limits and Hallucinations
Due to context window limits in local AI models (like Llama 3.2 via Ollama) and processing speed constraints, the AI does not receive your entire raw activity log history for every chat message.

**What the AI Actually Sees:**
- **Daily View:** The top 15 applications by duration, and up to the most recent 200 chronological window transitions and browser tab switches (including your journal notes).
- **Weekly View:** The top 15 applications for the week, plus a daily breakdown for the top 5 apps per day.
- **Monthly View:** The top 20 applications by duration and their daily averages.

**What to Expect:**
- **Hallucinations:** If you ask the AI for patterns that fall outside this context (e.g., "What did I do at 9 AM?" when it is 5 PM and 9 AM was more than 200 events ago), the AI will likely "hallucinate" or guess an answer instead of admitting it doesn't know. 
- **Missing Distractions:** Because the AI only sees up to 200 recent events, distractions that occurred earlier in the day may not be analyzable. 
- **Safety Cap:** The 200-event cap ensures the local AI does not crash due to token limits or take excessively long to respond.
