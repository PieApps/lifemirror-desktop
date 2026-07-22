use std::path::PathBuf;
use crate::window_provider::{WindowInfo, WindowProvider};

pub struct KdeProvider;
impl WindowProvider for KdeProvider {
    fn get_active_window(&self) -> Option<WindowInfo> {
        // First try active-win-pos-rs which encapsulates kdotool and other backends gracefully
        if let Ok(win) = active_win_pos_rs::get_active_window() {
            return Some(WindowInfo {
                app_name: win.app_name,
                title: win.title,
                process_path: Some(PathBuf::from(win.process_path)),
            });
        }
        
        // Fallback: KWin DBus script injection
        // Requires tokio runtime since zbus uses async under the hood, but blocking APIs are available
        use zbus::blocking::Connection;
        if let Ok(_conn) = Connection::session() {
            // In a real KWin script implementation, we'd load a script and run it.
            // For now, if active_win_pos_rs (kdotool) fails, we likely don't have permission.
            // As a basic DBus fallback we can try to query if there's any simple property,
            // though KWin generally requires a script injection.
        }

        None
    }
}

pub struct GnomeExtensionProvider;
impl WindowProvider for GnomeExtensionProvider {
    fn get_active_window(&self) -> Option<WindowInfo> {
        use zbus::blocking::Connection;
        
        if let Ok(conn) = Connection::session() {
            // Attempt to query the `focused-window-dbus` GNOME extension or similar
            // This is a common community extension D-Bus endpoint
            let msg = conn.call_method(
                Some("org.gnome.Shell.Extensions.FocusedWindow"),
                "/org/gnome/Shell/Extensions/FocusedWindow",
                Some("org.gnome.Shell.Extensions.FocusedWindow"),
                "Get",
                &(),
            );
            
            if let Ok(reply) = msg {
                if let Ok(body) = reply.body().deserialize::<(String, String)>() {
                    return Some(WindowInfo {
                        app_name: body.0,
                        title: body.1,
                        process_path: None,
                    });
                }
            }
        }
        
        // Fallback to active-win-pos-rs in case it works (e.g. X11 fallback or unconfined wayland)
        if let Ok(win) = active_win_pos_rs::get_active_window() {
            return Some(WindowInfo {
                app_name: win.app_name,
                title: win.title,
                process_path: Some(PathBuf::from(win.process_path)),
            });
        }

        None
    }
}
