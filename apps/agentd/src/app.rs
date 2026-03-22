use std::fmt::{Display, Formatter};
use std::thread;

use crate::bootstrap::BootstrapContext;

#[derive(Debug)]
pub enum AppError {
    Io(std::io::Error),
}

impl Display for AppError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(err) => write!(f, "io 错误: {err}"),
        }
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

pub fn run() -> Result<(), AppError> {
    let BootstrapContext {
        runtime,
        server,
        refresh_interval_millis,
    } = crate::bootstrap::build()?;

    let refresh_runtime = runtime.clone();
    thread::spawn(move || {
        let interval = std::time::Duration::from_millis(refresh_interval_millis);
        loop {
            if let Err(err) = refresh_runtime.refresh_now() {
                eprintln!("agentd 刷新失败: {err}");
            }
            thread::sleep(interval);
        }
    });

    server.serve()?;
    Ok(())
}
