pub struct Migration {
    pub version: u32,
    pub name: &'static str,
    pub sql: &'static str,
}

pub const CURRENT_SCHEMA_VERSION: u32 = 2;

const INITIAL_SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS process_snapshot (
    id TEXT PRIMARY KEY,
    pid INTEGER NOT NULL,
    parent_pid INTEGER,
    process_name TEXT NOT NULL,
    process_path TEXT,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS flow_session (
    id TEXT PRIMARY KEY,
    process_snapshot_id TEXT NOT NULL,
    protocol TEXT NOT NULL,
    direction TEXT NOT NULL,
    remote_host TEXT,
    host_source TEXT NOT NULL,
    remote_ip TEXT NOT NULL,
    remote_port INTEGER NOT NULL,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    tx_bytes INTEGER NOT NULL,
    rx_bytes INTEGER NOT NULL,
    state TEXT NOT NULL,
    capture_mode TEXT NOT NULL,
    is_lan_traffic INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(process_snapshot_id) REFERENCES process_snapshot(id)
);

CREATE TABLE IF NOT EXISTS flow_event_rollup (
    id TEXT PRIMARY KEY,
    flow_session_id TEXT NOT NULL,
    bucket_start_at INTEGER NOT NULL,
    tx_bytes_delta INTEGER NOT NULL,
    rx_bytes_delta INTEGER NOT NULL,
    FOREIGN KEY(flow_session_id) REFERENCES flow_session(id)
);

CREATE TABLE IF NOT EXISTS alert_record (
    id TEXT PRIMARY KEY,
    process_snapshot_id TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    dedupe_key TEXT NOT NULL,
    status TEXT NOT NULL,
    FOREIGN KEY(process_snapshot_id) REFERENCES process_snapshot(id)
);

CREATE TABLE IF NOT EXISTS app_setting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);
"#;

const INDEXES_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_process_snapshot_pid
    ON process_snapshot(pid);

CREATE INDEX IF NOT EXISTS idx_flow_session_process_snapshot_id
    ON flow_session(process_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_flow_session_last_seen_at
    ON flow_session(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_flow_session_remote_ip_remote_port
    ON flow_session(remote_ip, remote_port);

CREATE INDEX IF NOT EXISTS idx_flow_event_rollup_session_bucket
    ON flow_event_rollup(flow_session_id, bucket_start_at);

CREATE INDEX IF NOT EXISTS idx_alert_record_process_created
    ON alert_record(process_snapshot_id, created_at);
"#;

pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "initial_schema",
        sql: INITIAL_SCHEMA_SQL,
    },
    Migration {
        version: 2,
        name: "secondary_indexes",
        sql: INDEXES_SQL,
    },
];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn schema_version_matches_last_migration() {
        assert_eq!(CURRENT_SCHEMA_VERSION, MIGRATIONS.last().unwrap().version);
    }

    #[test]
    fn initial_schema_covers_core_tables() {
        let sql = MIGRATIONS[0].sql;
        assert!(sql.contains("CREATE TABLE IF NOT EXISTS process_snapshot"));
        assert!(sql.contains("CREATE TABLE IF NOT EXISTS flow_session"));
        assert!(sql.contains("CREATE TABLE IF NOT EXISTS flow_event_rollup"));
        assert!(sql.contains("CREATE TABLE IF NOT EXISTS alert_record"));
        assert!(sql.contains("CREATE TABLE IF NOT EXISTS app_setting"));
    }
}
