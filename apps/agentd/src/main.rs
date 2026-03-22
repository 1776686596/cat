mod api;
mod app;
mod bootstrap;
mod runtime;
mod services;

fn main() {
    if let Err(err) = app::run() {
        eprintln!("agentd 启动失败: {err}");
        std::process::exit(1);
    }
}
