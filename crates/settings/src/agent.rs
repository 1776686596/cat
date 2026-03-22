use std::env;
use std::path::PathBuf;

pub const DEFAULT_RUNTIME_DIR: &str = "/run/traffic-cat";
pub const DEFAULT_SOCKET_PATH: &str = "/run/traffic-cat/agentd.sock";
pub const DEFAULT_DATABASE_PATH: &str = "/var/lib/traffic-cat/traffic.db";
pub const DEFAULT_DATABASE_SOFT_LIMIT_BYTES: u64 = 512 * 1024 * 1024;
pub const DEFAULT_RETENTION_DAYS: u16 = 30;
pub const ENV_AGENT_RUNTIME_DIR: &str = "TRAFFIC_CAT_AGENT_RUNTIME_DIR";
pub const ENV_AGENT_SOCKET_PATH: &str = "TRAFFIC_CAT_AGENT_SOCKET";
pub const ENV_AGENT_SOCKET_PATH_LEGACY: &str = "TRAFFIC_CAT_AGENT_SOCKET_PATH";
pub const ENV_AGENT_DATABASE_PATH: &str = "TRAFFIC_CAT_AGENT_DATABASE_PATH";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentPaths {
    pub runtime_dir: PathBuf,
    pub socket_path: PathBuf,
    pub database_path: PathBuf,
}

impl Default for AgentPaths {
    fn default() -> Self {
        Self {
            runtime_dir: PathBuf::from(DEFAULT_RUNTIME_DIR),
            socket_path: PathBuf::from(DEFAULT_SOCKET_PATH),
            database_path: PathBuf::from(DEFAULT_DATABASE_PATH),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum CaptureModePreference {
    #[default]
    PreferEbpf,
    FallbackOnly,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CaptureSettings {
    pub preferred_mode: CaptureModePreference,
    pub poll_interval_millis: u64,
    pub active_window_secs: u64,
}

impl Default for CaptureSettings {
    fn default() -> Self {
        Self {
            preferred_mode: CaptureModePreference::PreferEbpf,
            poll_interval_millis: 1_000,
            active_window_secs: 8,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StorageSettings {
    pub retention_days: u16,
    pub soft_limit_bytes: u64,
    pub flush_interval_millis: u64,
}

impl Default for StorageSettings {
    fn default() -> Self {
        Self {
            retention_days: DEFAULT_RETENTION_DAYS,
            soft_limit_bytes: DEFAULT_DATABASE_SOFT_LIMIT_BYTES,
            flush_interval_millis: 1_000,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AlertSettings {
    pub pause_minutes: u16,
    pub dedupe_window_minutes: u16,
    pub notify_first_seen: bool,
    pub notify_burst: bool,
    pub notify_persistent: bool,
}

impl Default for AlertSettings {
    fn default() -> Self {
        Self {
            pause_minutes: 30,
            dedupe_window_minutes: 30,
            notify_first_seen: true,
            notify_burst: true,
            notify_persistent: true,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct AgentSettings {
    pub paths: AgentPaths,
    pub capture: CaptureSettings,
    pub storage: StorageSettings,
    pub alerts: AlertSettings,
}

impl AgentSettings {
    pub fn from_env() -> Self {
        Self::from_env_with(|name| env::var(name).ok())
    }

    fn from_env_with(read_env: impl Fn(&str) -> Option<String>) -> Self {
        let mut settings = Self::default();
        let mut runtime_dir_overridden = false;

        if let Some(runtime_dir) = read_path_env(&read_env, ENV_AGENT_RUNTIME_DIR) {
            runtime_dir_overridden = true;
            settings.paths.runtime_dir = PathBuf::from(&runtime_dir);
            settings.paths.socket_path = PathBuf::from(runtime_dir).join("agentd.sock");
        }

        if let Some(socket_path) = first_env_value(
            &read_env,
            &[ENV_AGENT_SOCKET_PATH, ENV_AGENT_SOCKET_PATH_LEGACY],
        ) {
            let socket_path = PathBuf::from(socket_path);
            if !runtime_dir_overridden {
                if let Some(parent) = socket_path.parent() {
                    settings.paths.runtime_dir = parent.to_path_buf();
                }
            }
            settings.paths.socket_path = socket_path;
        }

        if let Some(database_path) = read_path_env(&read_env, ENV_AGENT_DATABASE_PATH) {
            settings.paths.database_path = PathBuf::from(database_path);
        }

        settings
    }
}

fn first_env_value(read_env: &impl Fn(&str) -> Option<String>, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| read_path_env(read_env, key))
}

fn read_path_env(read_env: &impl Fn(&str) -> Option<String>, key: &str) -> Option<String> {
    read_env(key).and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    #[test]
    fn agent_settings_uses_runtime_dir_override_for_socket_path() {
        let values = HashMap::from([
            (
                ENV_AGENT_RUNTIME_DIR.to_string(),
                "/tmp/traffic-cat/run".to_string(),
            ),
            (
                ENV_AGENT_DATABASE_PATH.to_string(),
                "/tmp/traffic-cat/data/traffic.db".to_string(),
            ),
        ]);
        let settings = AgentSettings::from_env_with(|key| values.get(key).cloned());

        assert_eq!(
            settings.paths.runtime_dir,
            PathBuf::from("/tmp/traffic-cat/run")
        );
        assert_eq!(
            settings.paths.socket_path,
            PathBuf::from("/tmp/traffic-cat/run/agentd.sock")
        );
        assert_eq!(
            settings.paths.database_path,
            PathBuf::from("/tmp/traffic-cat/data/traffic.db")
        );
    }

    #[test]
    fn agent_settings_prefers_explicit_socket_path_and_updates_runtime_dir() {
        let values = HashMap::from([(
            ENV_AGENT_SOCKET_PATH.to_string(),
            "/tmp/traffic-cat/custom.sock".to_string(),
        )]);
        let settings = AgentSettings::from_env_with(|key| values.get(key).cloned());

        assert_eq!(
            settings.paths.runtime_dir,
            PathBuf::from("/tmp/traffic-cat")
        );
        assert_eq!(
            settings.paths.socket_path,
            PathBuf::from("/tmp/traffic-cat/custom.sock")
        );
        assert_eq!(
            settings.paths.database_path,
            PathBuf::from(DEFAULT_DATABASE_PATH)
        );
    }

    #[test]
    fn agent_settings_reads_legacy_socket_key() {
        let values = HashMap::from([(
            ENV_AGENT_SOCKET_PATH_LEGACY.to_string(),
            "/tmp/traffic-cat/legacy.sock".to_string(),
        )]);
        let settings = AgentSettings::from_env_with(|key| values.get(key).cloned());

        assert_eq!(
            settings.paths.runtime_dir,
            PathBuf::from("/tmp/traffic-cat")
        );
        assert_eq!(
            settings.paths.socket_path,
            PathBuf::from("/tmp/traffic-cat/legacy.sock")
        );
    }
}
