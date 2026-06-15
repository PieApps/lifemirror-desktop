use std::process::Command;
use std::path::Path;

fn main() {
    // Run python script to generate dynamic tray icons before bundling
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_else(|_| ".".to_string());
    let script_path = Path::new(&manifest_dir).join("generate_icons.py");
    if script_path.exists() {
        let _ = Command::new("python3")
            .arg(script_path)
            .status();
    }

    tauri_build::build()
}
