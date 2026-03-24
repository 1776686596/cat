use std::path::{Path, PathBuf};

pub const DEFAULT_UI_CONFIG_RELATIVE_PATH: &str = ".config/traffic-cat/ui.json";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct WidgetPosition {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum WidgetLayoutMode {
    #[default]
    CharacterFirst,
    RankingFirst,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WidgetPreferences {
    pub position: WidgetPosition,
    pub show_lan_traffic: bool,
    pub idle_opacity_percent: u8,
    pub active_opacity_percent: u8,
    pub compact_width: u16,
    pub compact_height: u16,
    pub layout_mode: WidgetLayoutMode,
    pub character_enabled: bool,
    pub bubble_enabled: bool,
}

impl Default for WidgetPreferences {
    fn default() -> Self {
        Self {
            position: WidgetPosition { x: 0, y: 0 },
            show_lan_traffic: false,
            idle_opacity_percent: 55,
            active_opacity_percent: 100,
            compact_width: 320,
            compact_height: 340,
            layout_mode: WidgetLayoutMode::CharacterFirst,
            character_enabled: true,
            bubble_enabled: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowFrame {
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

impl Default for WindowFrame {
    fn default() -> Self {
        Self {
            width: 960,
            height: 640,
            maximized: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowPreferences {
    pub main_window: WindowFrame,
    pub diagnostics_window: WindowFrame,
    pub last_route: String,
}

impl Default for WindowPreferences {
    fn default() -> Self {
        Self {
            main_window: WindowFrame::default(),
            diagnostics_window: WindowFrame {
                width: 720,
                height: 540,
                maximized: false,
            },
            last_route: "realtime".to_string(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct NotificationPreferences {
    pub system_notifications_enabled: bool,
    pub mute_until_unix_millis: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UiSettings {
    pub config_path: PathBuf,
    pub autostart_path: Option<PathBuf>,
    pub window: WindowPreferences,
    pub widget: WidgetPreferences,
    pub notifications: NotificationPreferences,
}

impl UiSettings {
    pub fn config_path_from_home(home: &Path) -> PathBuf {
        home.join(DEFAULT_UI_CONFIG_RELATIVE_PATH)
    }

    pub fn autostart_path_from_home(home: &Path) -> PathBuf {
        home.join(".config/autostart/traffic-cat.desktop")
    }
}

impl Default for UiSettings {
    fn default() -> Self {
        Self {
            config_path: PathBuf::from(DEFAULT_UI_CONFIG_RELATIVE_PATH),
            autostart_path: None,
            window: WindowPreferences::default(),
            widget: WidgetPreferences::default(),
            notifications: NotificationPreferences {
                system_notifications_enabled: true,
                mute_until_unix_millis: None,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;

    #[test]
    fn ui_paths_follow_project_conventions() {
        let home = Path::new("/tmp/example-home");

        assert_eq!(
            UiSettings::config_path_from_home(home),
            PathBuf::from("/tmp/example-home/.config/traffic-cat/ui.json")
        );
        assert_eq!(
            UiSettings::autostart_path_from_home(home),
            PathBuf::from("/tmp/example-home/.config/autostart/traffic-cat.desktop")
        );
    }
}
