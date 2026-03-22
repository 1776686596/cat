mod commands;
mod ipc;
mod settings;
mod window;

use commands::ShellCommandSet;
use settings::{UiRuntimeConfig, ENV_AGENT_SOCKET_PATH, ENV_AGENT_SOCKET_PATH_LEGACY};

fn main() {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if !args.is_empty() {
        run_cli_shell(&args);
        return;
    }

    run_gui();
}

fn run_cli_shell(args: &[String]) {
    let command_set = ShellCommandSet::default();
    match commands::run_cli(&command_set, args) {
        Ok(output) => println!("{output}"),
        Err(err) => {
            eprintln!("socket {} -> {err}", command_set.socket_path().display());
            std::process::exit(1);
        }
    }
}

fn run_gui() {
    let runtime_config = UiRuntimeConfig::from_env();
    let command_set = ShellCommandSet::from_runtime_config(runtime_config.clone());

    if let Err(err) = tauri::Builder::default()
        .manage(runtime_config.clone())
        .manage(command_set)
        .setup(move |app| {
            window::create_widget_window(app, &runtime_config)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::bridge_load_dashboard_payload,
            commands::bridge_load_processes_payload,
            commands::bridge_load_history_payload,
            commands::bridge_load_process_detail_payload,
            commands::bridge_show_main_window,
            commands::bridge_start_widget_dragging,
        ])
        .run(tauri::generate_context!())
    {
        eprintln!(
            "desktop-ui GUI 启动失败，可通过 {} 或 {} 覆盖 UDS：{err}",
            ENV_AGENT_SOCKET_PATH, ENV_AGENT_SOCKET_PATH_LEGACY
        );
        std::process::exit(1);
    }
}
