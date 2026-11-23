use std::path::PathBuf;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum AppEnvironment {
    Production,
    Development,
    Testing,
}

impl AppEnvironment {
    pub fn detect(app_handle: Option<&tauri::AppHandle>) -> Self {
        // 1. Explicit environment variable override (highest priority)
        if let Ok(val) = std::env::var("LIFEMIRROR_ENV") {
            match val.to_lowercase().as_str() {
                "development" | "dev" => return AppEnvironment::Development,
                "production" | "prod" => return AppEnvironment::Production,
                "testing" | "test" => return AppEnvironment::Testing,
                _ => {}
            }
        }

        // 2. Check Tauri app identifier if available
        if let Some(app) = app_handle {
            let id = app.config().identifier.clone();
            if id.ends_with(".dev") {
                return AppEnvironment::Development;
            } else if id.ends_with(".test") {
                return AppEnvironment::Testing;
            }
        }

        // 3. Fallback based on compile-time / build profile
        if cfg!(test) {
            AppEnvironment::Testing
        } else if cfg!(debug_assertions) {
            AppEnvironment::Development
        } else {
            AppEnvironment::Production
        }
    }

    pub fn data_dir(&self) -> PathBuf {
        #[cfg(target_os = "windows")]
        {
            let base = std::env::var("LOCALAPPDATA")
                .or_else(|_| std::env::var("APPDATA"))
                .or_else(|_| std::env::var("USERPROFILE").map(|p| format!(r"{}\AppData\Local", p)))
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from("."));

            match self {
                AppEnvironment::Production => base.join("lifemirror-desktop"),
                AppEnvironment::Development => base.join("lifemirror-dev"),
                AppEnvironment::Testing => base.join("lifemirror-test"),
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let base = if let Ok(data_home) = std::env::var("XDG_DATA_HOME") {
                PathBuf::from(data_home)
            } else if let Ok(home) = std::env::var("HOME") {
                PathBuf::from(home).join(".local").join("share")
            } else {
                PathBuf::from(".")
            };

            match self {
                AppEnvironment::Production => base.join("lifemirror-desktop"),
                AppEnvironment::Development => base.join("lifemirror-dev"),
                AppEnvironment::Testing => base.join("lifemirror-test"),
            }
        }
    }

    pub fn ensure_data_dir(&self) -> std::io::Result<PathBuf> {
        let dir = self.data_dir();
        std::fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    pub fn db_path(&self) -> PathBuf {
        let dir = self.data_dir();
        match self {
            AppEnvironment::Production => dir.join("lifemirror-desktop.db"),
            AppEnvironment::Development => dir.join("lifemirror-desktop-dev.db"),
            AppEnvironment::Testing => dir.join("lifemirror-test.db"),
        }
    }

    pub fn keyring_service(&self) -> &'static str {
        match self {
            AppEnvironment::Production => "com.lifemirror.desktop",
            AppEnvironment::Development => "com.lifemirror.desktop.dev",
            AppEnvironment::Testing => "com.lifemirror.desktop.test",
        }
    }

    pub fn default_vault_path(&self) -> PathBuf {
        let folder_name = match self {
            AppEnvironment::Production => "LifeMirror Vault",
            AppEnvironment::Development => "LifeMirror Vault (Dev)",
            AppEnvironment::Testing => "LifeMirror Vault (Test)",
        };

        if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
            let docs = PathBuf::from(home).join("Documents");
            if docs.exists() {
                docs.join(folder_name)
            } else {
                PathBuf::from(folder_name)
            }
        } else {
            PathBuf::from(folder_name)
        }
    }

    pub fn should_register_native_host(&self) -> bool {
        matches!(self, AppEnvironment::Production)
    }

    pub fn app_display_name(&self) -> &'static str {
        match self {
            AppEnvironment::Production => "LifeMirror Desktop",
            AppEnvironment::Development => "LifeMirror Desktop (Dev)",
            AppEnvironment::Testing => "LifeMirror Desktop (Test)",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_environment_paths_are_disjoint() {
        let prod = AppEnvironment::Production;
        let dev = AppEnvironment::Development;
        let test = AppEnvironment::Testing;

        assert_ne!(prod.data_dir(), dev.data_dir());
        assert_ne!(prod.data_dir(), test.data_dir());
        assert_ne!(dev.data_dir(), test.data_dir());

        assert_ne!(prod.db_path(), dev.db_path());
        assert_ne!(prod.db_path(), test.db_path());
        assert_ne!(dev.db_path(), test.db_path());

        assert_ne!(prod.keyring_service(), dev.keyring_service());
        assert_ne!(prod.keyring_service(), test.keyring_service());
        assert_ne!(dev.keyring_service(), test.keyring_service());

        assert_ne!(prod.default_vault_path(), dev.default_vault_path());
    }

    #[test]
    fn test_native_host_registration_only_in_production() {
        assert!(AppEnvironment::Production.should_register_native_host());
        assert!(!AppEnvironment::Development.should_register_native_host());
        assert!(!AppEnvironment::Testing.should_register_native_host());
    }

    #[test]
    fn test_env_var_override() {
        std::env::set_var("LIFEMIRROR_ENV", "dev");
        assert_eq!(AppEnvironment::detect(None), AppEnvironment::Development);

        std::env::set_var("LIFEMIRROR_ENV", "production");
        assert_eq!(AppEnvironment::detect(None), AppEnvironment::Production);

        std::env::set_var("LIFEMIRROR_ENV", "testing");
        assert_eq!(AppEnvironment::detect(None), AppEnvironment::Testing);

        std::env::remove_var("LIFEMIRROR_ENV");
    }
}
