mod engine;
mod pgn;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AnalyzeFenResult {
    eval_cp: i32,
    is_mate: bool,
    best_move_uci: String,
    pv: Vec<String>,
}

impl From<engine::EngineAnalysis> for AnalyzeFenResult {
    fn from(a: engine::EngineAnalysis) -> Self {
        AnalyzeFenResult {
            eval_cp: a.eval_cp,
            is_mate: a.is_mate,
            best_move_uci: a.best_move_uci,
            pv: a.pv,
        }
    }
}

/// Plain function the `#[tauri::command]` below wraps — kept separate so it can be
/// unit-tested directly without spinning up a Tauri `App`/`Window` context.
fn analyze_fen_sync(fen: String) -> Result<AnalyzeFenResult, String> {
    engine::analyze_position("stockfish", &fen, &engine::EngineOptions::default())
        .map(AnalyzeFenResult::from)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn analyze_fen(fen: String) -> Result<AnalyzeFenResult, String> {
    // Blocking process I/O — offload to a blocking-friendly task so it doesn't
    // stall the async runtime (Tauri v2 docs: plain `fn` commands run on the main
    // thread; `async fn` + spawn_blocking is the documented pattern for blocking work).
    tauri::async_runtime::spawn_blocking(move || analyze_fen_sync(fen))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![analyze_fen])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod analyze_fen_tests {
    use super::*;

    #[test]
    fn analyze_fen_command_delegates_to_the_engine_module() {
        // Calls the plain function the #[tauri::command] macro wraps — no Tauri
        // runtime/App context needed to exercise the delegation itself.
        let fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1".to_string();
        match analyze_fen_sync(fen) {
            Ok(result) => {
                assert_eq!(result.best_move_uci.len(), 4);
            }
            Err(msg) => {
                // Only acceptable failure on a machine without stockfish on PATH.
                assert!(msg.contains("failed to spawn engine"), "unexpected error: {msg}");
            }
        }
    }
}
