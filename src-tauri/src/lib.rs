use std::fs;
use std::path::Path;
use serde::Serialize;
use walkdir::WalkDir;
use tauri::Manager;
use tauri::Emitter;

// ─── データ構造 ────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub snippet: String,
    pub line: usize,
}

// ─── ユーティリティ ────────────────────────────────────────────────

fn build_tree(path: &Path) -> FileNode {
    let name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let path_str = path.to_string_lossy().to_string();

    if path.is_dir() {
        let children: Vec<FileNode> = fs::read_dir(path)
            .map(|entries| {
                let mut nodes: Vec<FileNode> = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| {
                        // 隠しファイル・ディレクトリはスキップ
                        let fname = e.file_name();
                        !fname.to_string_lossy().starts_with('.')
                    })
                    .filter(|e| {
                        let p = e.path();
                        p.is_dir()
                            || p.extension()
                                .map(|ext| ext.eq_ignore_ascii_case("md"))
                                .unwrap_or(false)
                    })
                    .map(|e| build_tree(&e.path()))
                    .collect();
                // フォルダ優先、アルファベット順
                nodes.sort_by(|a, b| match (a.is_dir, b.is_dir) {
                    (true, false) => std::cmp::Ordering::Less,
                    (false, true) => std::cmp::Ordering::Greater,
                    _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
                });
                nodes
            })
            .unwrap_or_default();

        FileNode {
            name,
            path: path_str,
            is_dir: true,
            children,
        }
    } else {
        FileNode {
            name,
            path: path_str,
            is_dir: false,
            children: vec![],
        }
    }
}

// ─── Tauriコマンド ─────────────────────────────────────────────────

/// フォルダ選択ダイアログを開いてVaultパスを返す
#[tauri::command]
async fn open_vault_dialog(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<tauri_plugin_dialog::FilePath>>();
    app.dialog()
        .file()
        .set_title("Vaultフォルダを選択")
        .pick_folder(move |result| {
            let _ = tx.send(result);
        });
    rx.await
        .ok()
        .flatten()
        .map(|p| p.to_string())
}

/// Vault内のファイルツリーを返す
#[tauri::command]
fn list_vault(vault_path: String) -> Result<FileNode, String> {
    let path = Path::new(&vault_path);
    if !path.exists() || !path.is_dir() {
        return Err(format!("無効なVaultパス: {}", vault_path));
    }
    Ok(build_tree(path))
}

/// ノートの内容を読み込む
#[tauri::command]
fn read_note(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// ノートの内容を保存する
#[tauri::command]
fn write_note(path: String, content: String) -> Result<(), String> {
    // 親ディレクトリが存在しない場合は作成
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// 新規ノートを作成する（空ファイル）
#[tauri::command]
fn create_note(path: String) -> Result<(), String> {
    if Path::new(&path).exists() {
        return Err("同名のファイルが既に存在します".to_string());
    }
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, "").map_err(|e| e.to_string())
}

/// ファイルまたはフォルダを削除する
#[tauri::command]
fn delete_item(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        fs::remove_file(p).map_err(|e| e.to_string())
    }
}

/// ファイルまたはフォルダをリネーム/移動する
#[tauri::command]
fn rename_item(old_path: String, new_path: String) -> Result<(), String> {
    if Path::new(&new_path).exists() {
        return Err("移動先に同名のファイルが存在します".to_string());
    }
    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

/// フォルダを作成する
#[tauri::command]
fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

/// Vault内の全.mdファイルを全文検索する
#[tauri::command]
fn search_vault(vault_path: String, query: String) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let query_lower = query.to_lowercase();
    let mut results: Vec<SearchResult> = Vec::new();

    for entry in WalkDir::new(&vault_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path
            .extension()
            .map(|e| e.eq_ignore_ascii_case("md"))
            .unwrap_or(false)
        {
            continue;
        }

        let name = path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // タイトル一致
        if name.to_lowercase().contains(&query_lower) {
            results.push(SearchResult {
                path: path.to_string_lossy().to_string(),
                name,
                snippet: String::new(),
                line: 0,
            });
            continue;
        }

        // 本文一致（ファイルごとに最初のヒット行のみ）
        if let Ok(content) = fs::read_to_string(path) {
            for (i, line) in content.lines().enumerate() {
                if line.to_lowercase().contains(&query_lower) {
                    let snippet: String = line.trim().chars().take(120).collect();
                    results.push(SearchResult {
                        path: path.to_string_lossy().to_string(),
                        name,
                        snippet,
                        line: i + 1,
                    });
                    break;
                }
            }
        }
    }

    // タイトル一致を上位に
    results.sort_by(|a, b| b.snippet.is_empty().cmp(&a.snippet.is_empty()));
    Ok(results)
}

/// 指定ノートへのバックリンク（[[ノート名]]）を持つファイル一覧を返す
#[tauri::command]
fn get_backlinks(vault_path: String, note_name: String) -> Result<Vec<String>, String> {
    // [[ノート名]] または [[ノート名|表示名]] の両パターンに対応
    let mut backlinks: Vec<String> = Vec::new();

    for entry in WalkDir::new(&vault_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path
            .extension()
            .map(|e| e.eq_ignore_ascii_case("md"))
            .unwrap_or(false)
        {
            continue;
        }
        // 自分自身はスキップ
        if path.file_stem().map(|s| s.to_string_lossy().to_string()).as_deref()
            == Some(note_name.as_str())
        {
            continue;
        }

        if let Ok(content) = fs::read_to_string(path) {
            // [[ノート名]] または [[ノート名|alias]] を検索
            let pattern1 = format!("[[{}]]", note_name);
            let pattern2 = format!("[[{}|", note_name);
            if content.contains(&pattern1) || content.contains(&pattern2) {
                let linker_name = path
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                backlinks.push(linker_name);
            }
        }
    }

    backlinks.sort();
    Ok(backlinks)
}

/// ノート名から絶対パスを解決する（Vault内を検索）
#[tauri::command]
fn resolve_note_path(vault_path: String, note_name: String) -> Option<String> {
    for entry in WalkDir::new(&vault_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path
            .extension()
            .map(|e| e.eq_ignore_ascii_case("md"))
            .unwrap_or(false)
        {
            let stem = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            if stem.eq_ignore_ascii_case(&note_name) {
                return Some(path.to_string_lossy().to_string());
            }
        }
    }
    None
}

// ─── 設定の保存・読み込み ──────────────────────────────────────────

/// 最後に開いたVaultパスをアプリ設定ファイルに保存する
#[tauri::command]
fn save_config(app: tauri::AppHandle, vault_path: String) -> Result<(), String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    let config_file = config_dir.join("config.json");
    let json = serde_json::json!({ "lastVaultPath": vault_path });
    fs::write(config_file, json.to_string()).map_err(|e| e.to_string())
}

/// アプリを即時終了する（JS 側の destroy() は WM_CLOSE を再送するため使わない）
#[tauri::command]
fn force_close(app: tauri::AppHandle) {
    app.exit(0);
}

/// 前回保存したVaultパスを読み込む（なければ None）
#[tauri::command]
fn load_config(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    let config_file = config_dir.join("config.json");
    if !config_file.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(config_file).map_err(|e| e.to_string())?;
    let json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;
    Ok(json["lastVaultPath"].as_str().map(|s| s.to_string()))
}

// ─── エントリーポイント ─────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        // ウィンドウ閉じる操作を Rust 側で確実に捕捉し、
        // フロントエンドにカスタムイベントを送る。
        // JS 側の onCloseRequested は不安定なため使わない。
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close(); // 必ず一旦止める
                window
                    .emit("jade://close-requested", ())
                    .unwrap_or_default(); // フロントエンドへ通知
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_vault_dialog,
            list_vault,
            read_note,
            write_note,
            create_note,
            delete_item,
            rename_item,
            create_folder,
            search_vault,
            get_backlinks,
            resolve_note_path,
            save_config,
            load_config,
            force_close,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
