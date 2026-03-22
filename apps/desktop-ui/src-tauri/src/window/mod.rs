use tauri::{Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::settings::UiRuntimeConfig;

pub const WIDGET_WINDOW_LABEL: &str = "widget";
pub const DASHBOARD_WINDOW_LABEL: &str = "dashboard";

const DEFAULT_DASHBOARD_VIEW: &str = "realtime";
const WIDGET_TITLE: &str = "Traffic Cat Widget";
const DASHBOARD_TITLE: &str = "Traffic Cat";

pub fn create_widget_window<R: Runtime, M: Manager<R>>(
    app: &M,
    config: &UiRuntimeConfig,
) -> tauri::Result<WebviewWindow<R>> {
    if let Some(window) = app.get_webview_window(WIDGET_WINDOW_LABEL) {
        return Ok(window);
    }

    let widget = WebviewWindowBuilder::new(
        app,
        WIDGET_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title(WIDGET_TITLE)
    .inner_size(
        f64::from(config.ui_settings.widget.compact_width),
        f64::from(config.ui_settings.widget.compact_height),
    )
    .min_inner_size(
        f64::from(config.ui_settings.widget.compact_width),
        f64::from(config.ui_settings.widget.compact_height),
    )
    .max_inner_size(
        f64::from(config.ui_settings.widget.compact_width),
        f64::from(config.ui_settings.widget.compact_height),
    )
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .visible_on_all_workspaces(true)
    .skip_taskbar(true)
    .center()
    .focused(false)
    .initialization_script(&build_launch_context_script(
        "widget",
        DEFAULT_DASHBOARD_VIEW,
    ))
    .build()?;

    widget.set_always_on_top(true)?;
    widget.set_visible_on_all_workspaces(true)?;

    Ok(widget)
}

pub fn show_or_create_dashboard<R: Runtime, M: Manager<R>>(
    app: &M,
    config: &UiRuntimeConfig,
    target_view: Option<&str>,
) -> tauri::Result<()> {
    let dashboard_view = normalize_dashboard_view(target_view);

    if let Some(window) = app.get_webview_window(DASHBOARD_WINDOW_LABEL) {
        apply_launch_context(&window, "dashboard", dashboard_view)?;
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
        return Ok(());
    }

    let dashboard = WebviewWindowBuilder::new(
        app,
        DASHBOARD_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title(DASHBOARD_TITLE)
    .inner_size(
        f64::from(config.ui_settings.window.main_window.width),
        f64::from(config.ui_settings.window.main_window.height),
    )
    .visible(true)
    .maximized(config.ui_settings.window.main_window.maximized)
    .initialization_script(&build_launch_context_script("dashboard", dashboard_view))
    .build()?;

    dashboard.show()?;
    dashboard.set_focus()?;
    Ok(())
}

fn normalize_dashboard_view(target_view: Option<&str>) -> &'static str {
    match target_view {
        Some("processes") => "processes",
        Some("history") => "history",
        Some("diagnostics") => "diagnostics",
        _ => DEFAULT_DASHBOARD_VIEW,
    }
}

fn apply_launch_context<R: Runtime>(
    window: &WebviewWindow<R>,
    window_mode: &str,
    initial_view: &str,
) -> tauri::Result<()> {
    window.eval(&build_launch_context_script(window_mode, initial_view))
}

fn build_launch_context_script(window_mode: &str, initial_view: &str) -> String {
    format!(
        concat!(
            "window.__TRAFFIC_CAT_LAUNCH_CONTEXT__ = {{ ",
            "windowMode: {0:?}, ",
            "initialView: {1:?}",
            " }};",
            "if (typeof window.__TRAFFIC_CAT_SET_LAUNCH_CONTEXT__ === 'function') {{",
            " window.__TRAFFIC_CAT_SET_LAUNCH_CONTEXT__(",
            "window.__TRAFFIC_CAT_LAUNCH_CONTEXT__",
            ");",
            "}}"
        ),
        window_mode,
        initial_view,
    )
}
