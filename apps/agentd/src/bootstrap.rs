use crate::api::server::AgentHttpServer;
use crate::runtime::AgentRuntime;
use traffic_cat_capture::fallback::ProcfsCollector;
use traffic_cat_settings::AgentSettings;
use traffic_cat_store::{SqliteRepository, SqliteRuntimeConfig};

pub struct BootstrapContext {
    pub runtime: AgentRuntime,
    pub server: AgentHttpServer,
    pub refresh_interval_millis: u64,
}

pub fn build() -> Result<BootstrapContext, std::io::Error> {
    let settings = AgentSettings::from_env();
    let store = SqliteRepository::new(SqliteRuntimeConfig {
        database_path: settings.paths.database_path.clone(),
        flush_interval_millis: settings.storage.flush_interval_millis,
        ..SqliteRuntimeConfig::default()
    });
    let runtime = AgentRuntime::new(
        settings.clone(),
        Box::new(ProcfsCollector::default()),
        store,
    );
    let server = AgentHttpServer::new(runtime.clone(), settings.paths.socket_path.clone())?;

    Ok(BootstrapContext {
        runtime,
        server,
        refresh_interval_millis: settings.capture.poll_interval_millis,
    })
}
