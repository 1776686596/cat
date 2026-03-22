#![allow(dead_code)]

use std::env;
use std::path::{Path, PathBuf};
use std::time::Duration;

use traffic_cat_ipc::DEFAULT_SOCKET_PATH;
use traffic_cat_settings::UiSettings;

pub const ENV_AGENT_SOCKET_PATH: &str = "TRAFFIC_CAT_AGENT_SOCKET";
pub const ENV_AGENT_SOCKET_PATH_LEGACY: &str = "TRAFFIC_CAT_AGENT_SOCKET_PATH";
pub const ENV_REQUEST_TIMEOUT_MILLIS: &str = "TRAFFIC_CAT_AGENT_TIMEOUT_MILLIS";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UiRuntimeConfig {
    pub socket_path: PathBuf,
    pub request_timeout_millis: u64,
    pub ui_settings: UiSettings,
}

impl UiRuntimeConfig {
    pub fn request_timeout(&self) -> Duration {
        Duration::from_millis(self.request_timeout_millis)
    }

    pub fn socket_path(&self) -> &Path {
        &self.socket_path
    }

    pub fn from_env() -> Self {
        Self::from_env_with(|name| env::var(name).ok())
    }

    fn from_env_with(read_env: impl Fn(&str) -> Option<String>) -> Self {
        let mut config = Self::default();

        if let Some(socket_path) = first_env_value(
            &read_env,
            &[ENV_AGENT_SOCKET_PATH, ENV_AGENT_SOCKET_PATH_LEGACY],
        ) {
            config.socket_path = PathBuf::from(socket_path);
        }

        if let Some(request_timeout_millis) = parse_u64_env(&read_env, ENV_REQUEST_TIMEOUT_MILLIS) {
            config.request_timeout_millis = request_timeout_millis;
        }

        config
    }
}

impl Default for UiRuntimeConfig {
    fn default() -> Self {
        Self {
            socket_path: PathBuf::from(DEFAULT_SOCKET_PATH),
            request_timeout_millis: 2_000,
            ui_settings: UiSettings::default(),
        }
    }
}

fn first_env_value(read_env: &impl Fn(&str) -> Option<String>, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        read_env(key).and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
    })
}

fn parse_u64_env(read_env: &impl Fn(&str) -> Option<String>, key: &str) -> Option<u64> {
    read_env(key).and_then(|value| value.trim().parse::<u64>().ok())
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::path::PathBuf;

    use super::*;

    #[test]
    fn runtime_config_reads_socket_path_from_env() {
        let values = HashMap::from([(
            ENV_AGENT_SOCKET_PATH.to_string(),
            "/tmp/agent.sock".to_string(),
        )]);
        let config = UiRuntimeConfig::from_env_with(|key| values.get(key).cloned());

        assert_eq!(config.socket_path, PathBuf::from("/tmp/agent.sock"));
        assert_eq!(config.request_timeout_millis, 2_000);
    }

    #[test]
    fn runtime_config_uses_legacy_socket_key_and_timeout_override() {
        let values = HashMap::from([
            (
                ENV_AGENT_SOCKET_PATH_LEGACY.to_string(),
                "/tmp/legacy.sock".to_string(),
            ),
            (ENV_REQUEST_TIMEOUT_MILLIS.to_string(), "4500".to_string()),
        ]);
        let config = UiRuntimeConfig::from_env_with(|key| values.get(key).cloned());

        assert_eq!(config.socket_path, PathBuf::from("/tmp/legacy.sock"));
        assert_eq!(config.request_timeout_millis, 4_500);
    }
}
