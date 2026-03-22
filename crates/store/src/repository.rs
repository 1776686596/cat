use std::fmt::{Display, Formatter};
use std::io;

use crate::migrations::Migration;
use crate::models::{FlowSessionRow, HistoryFilter, PersistBatch, ProcessSnapshotRow};
use crate::prune::{PrunePlan, PruneReport};

#[derive(Debug)]
pub enum StoreError {
    Io(io::Error),
    Corrupted(String),
    InvalidInput(String),
    Unsupported(String),
}

impl Display for StoreError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(err) => write!(f, "io 错误: {err}"),
            Self::Corrupted(message) => write!(f, "存储损坏: {message}"),
            Self::InvalidInput(message) => write!(f, "无效输入: {message}"),
            Self::Unsupported(message) => write!(f, "暂不支持: {message}"),
        }
    }
}

impl std::error::Error for StoreError {}

impl From<io::Error> for StoreError {
    fn from(value: io::Error) -> Self {
        Self::Io(value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct PersistStats {
    pub process_snapshots: usize,
    pub flow_sessions: usize,
    pub flow_rollups: usize,
    pub alerts: usize,
    pub settings: usize,
}

pub trait StoreRepository {
    fn migrations(&self) -> &[Migration];

    fn apply_batch(&self, batch: &PersistBatch) -> Result<PersistStats, StoreError>;

    fn list_history(&self, filter: &HistoryFilter) -> Result<Vec<FlowSessionRow>, StoreError>;

    fn list_process_snapshots(&self) -> Result<Vec<ProcessSnapshotRow>, StoreError>;

    fn apply_prune_plan(&self, plan: &PrunePlan) -> Result<PruneReport, StoreError>;
}
