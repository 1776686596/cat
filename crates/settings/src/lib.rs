pub mod agent;
pub mod ui;

pub use agent::{
    AgentPaths, AgentSettings, AlertSettings, CaptureModePreference, CaptureSettings,
    StorageSettings, DEFAULT_DATABASE_PATH, DEFAULT_DATABASE_SOFT_LIMIT_BYTES,
    DEFAULT_RETENTION_DAYS, DEFAULT_RUNTIME_DIR, DEFAULT_SOCKET_PATH,
};
pub use ui::{
    NotificationPreferences, UiSettings, WidgetPosition, WidgetPreferences, WindowFrame,
    WindowPreferences, DEFAULT_UI_CONFIG_RELATIVE_PATH,
};
