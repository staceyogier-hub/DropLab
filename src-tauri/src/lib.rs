//! DropLab native shell. The analysis engine and UI are the same offline web
//! frontend; this only adds native file open/save dialogs. No network access.

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running DropLab");
}
