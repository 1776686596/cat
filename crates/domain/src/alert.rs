use crate::enums::{AlertKind, AlertSeverity};
use crate::process::ProcessRef;
use crate::UnixMillis;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub enum AlertStatus {
    #[default]
    Active,
    Muted,
    Resolved,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct AlertRecord {
    pub id: String,
    pub dedupe_key: String,
    pub kind: AlertKind,
    pub severity: AlertSeverity,
    pub process: ProcessRef,
    pub target_label: Option<String>,
    pub summary: String,
    pub created_at: UnixMillis,
    pub last_triggered_at: UnixMillis,
    pub status: AlertStatus,
}

impl AlertRecord {
    pub fn touch(&mut self, triggered_at: UnixMillis) {
        self.last_triggered_at = triggered_at;
    }
}
