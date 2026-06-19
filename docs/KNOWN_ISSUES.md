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
