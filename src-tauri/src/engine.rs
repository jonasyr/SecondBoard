//! Drives a real Stockfish process over UCI (OVERVIEW §6.6/§8.3 `engine` module).
//! Locates the binary via `PATH` (`std::process::Command::new("stockfish")`) — this
//! iteration assumes a system-installed Stockfish; a later iteration (settings module)
//! makes the path configurable. No timeout/crash-recovery watchdog yet (Phase-0 spike,
//! see the plan's Global Constraints) — Stockfish's own `movetime` bounds each call.

#[derive(Debug, Default, Clone, PartialEq)]
pub(crate) struct InfoLine {
    pub score_cp: Option<i32>,
    pub score_mate: Option<i32>,
    pub pv: Vec<String>,
}

pub(crate) fn parse_info_line(line: &str) -> Option<InfoLine> {
    if !line.starts_with("info ") {
        return None;
    }
    let tokens: Vec<&str> = line.split_whitespace().collect();
    let mut info = InfoLine::default();
    let mut found_score_or_pv = false;
    let mut i = 0;
    while i < tokens.len() {
        match tokens[i] {
            "cp" if i + 1 < tokens.len() => {
                info.score_cp = tokens[i + 1].parse().ok();
                found_score_or_pv = true;
                i += 2;
            }
            "mate" if i + 1 < tokens.len() => {
                info.score_mate = tokens[i + 1].parse().ok();
                found_score_or_pv = true;
                i += 2;
            }
            "pv" => {
                info.pv = tokens[i + 1..].iter().map(|s| s.to_string()).collect();
                found_score_or_pv = true;
                i = tokens.len();
            }
            _ => i += 1,
        }
    }
    if found_score_or_pv {
        Some(info)
    } else {
        None
    }
}

pub(crate) fn parse_bestmove_line(line: &str) -> Option<String> {
    let tokens: Vec<&str> = line.split_whitespace().collect();
    if tokens.first() != Some(&"bestmove") {
        return None;
    }
    tokens.get(1).map(|s| s.to_string())
}

use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

#[derive(Debug, Clone, PartialEq)]
pub struct EngineAnalysis {
    pub eval_cp: i32,
    pub is_mate: bool,
    pub best_move_uci: String,
    pub pv: Vec<String>,
}

#[derive(Debug, Clone, Copy)]
pub struct EngineOptions {
    pub depth: u32,
    pub movetime_ms: Option<u32>,
}

impl Default for EngineOptions {
    fn default() -> Self {
        // OVERVIEW §10.3/§10.4 "Standard Review" defaults (Global Constraints).
        EngineOptions {
            depth: 16,
            movetime_ms: Some(2000),
        }
    }
}

#[derive(Debug, Clone)]
pub enum EngineError {
    SpawnFailed(String),
    Io(String),
    NoBestMove,
}

impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EngineError::SpawnFailed(msg) => write!(f, "failed to spawn engine: {msg}"),
            EngineError::Io(msg) => write!(f, "engine I/O error: {msg}"),
            EngineError::NoBestMove => write!(f, "engine did not report a best move"),
        }
    }
}

fn write_line(stdin: &mut impl Write, cmd: &str) -> Result<(), EngineError> {
    writeln!(stdin, "{cmd}").map_err(|e| EngineError::Io(e.to_string()))
}

fn wait_for(reader: &mut impl BufRead, token: &str) -> Result<(), EngineError> {
    let mut line = String::new();
    loop {
        line.clear();
        let n = reader
            .read_line(&mut line)
            .map_err(|e| EngineError::Io(e.to_string()))?;
        if n == 0 {
            return Err(EngineError::Io(format!(
                "engine closed stdout waiting for {token}"
            )));
        }
        if line.trim_end() == token {
            return Ok(());
        }
    }
}

pub fn analyze_position(
    engine_path: &str,
    fen: &str,
    opts: &EngineOptions,
) -> Result<EngineAnalysis, EngineError> {
    let mut child = Command::new(engine_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| EngineError::SpawnFailed(e.to_string()))?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| EngineError::Io("engine process has no stdin".into()))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| EngineError::Io("engine process has no stdout".into()))?;
    let mut reader = BufReader::new(stdout);

    write_line(&mut stdin, "uci")?;
    wait_for(&mut reader, "uciok")?;

    // OVERVIEW §10.4 suggested defaults: Threads = max(1, logical_cpu_count - 1), Hash = 256MB.
    let threads = std::thread::available_parallelism()
        .map(|n| n.get().saturating_sub(1).max(1))
        .unwrap_or(1);
    write_line(&mut stdin, &format!("setoption name Threads value {threads}"))?;
    write_line(&mut stdin, "setoption name Hash value 256")?;

    write_line(&mut stdin, "isready")?;
    wait_for(&mut reader, "readyok")?;

    write_line(&mut stdin, &format!("position fen {fen}"))?;

    let go_cmd = match opts.movetime_ms {
        Some(ms) => format!("go depth {} movetime {}", opts.depth, ms),
        None => format!("go depth {}", opts.depth),
    };
    write_line(&mut stdin, &go_cmd)?;

    let mut last_info: Option<InfoLine> = None;
    let mut line = String::new();
    loop {
        line.clear();
        let n = reader
            .read_line(&mut line)
            .map_err(|e| EngineError::Io(e.to_string()))?;
        if n == 0 {
            return Err(EngineError::Io("engine closed stdout mid-analysis".into()));
        }
        let trimmed = line.trim_end();
        if let Some(info) = parse_info_line(trimmed) {
            if info.score_cp.is_some() || info.score_mate.is_some() {
                last_info = Some(info);
            }
        } else if let Some(best) = parse_bestmove_line(trimmed) {
            let _ = write_line(&mut stdin, "quit");
            let _ = child.wait();
            let info = last_info.ok_or(EngineError::NoBestMove)?;
            let (eval_cp, is_mate) = match (info.score_cp, info.score_mate) {
                (_, Some(mate)) => (if mate >= 0 { 100_000 } else { -100_000 }, true),
                (Some(cp), None) => (cp, false),
                (None, None) => return Err(EngineError::NoBestMove),
            };
            return Ok(EngineAnalysis {
                eval_cp,
                is_mate,
                best_move_uci: best,
                pv: info.pv,
            });
        }
    }
}

#[cfg(test)]
mod parse_tests {
    use super::*;

    #[test]
    fn parses_cp_score_and_pv() {
        let line = "info depth 16 seldepth 20 multipv 1 score cp 34 nodes 500000 nps 900000 pv e2e4 e7e5 g1f3";
        let info = parse_info_line(line).unwrap();
        assert_eq!(info.score_cp, Some(34));
        assert_eq!(info.score_mate, None);
        assert_eq!(info.pv, vec!["e2e4", "e7e5", "g1f3"]);
    }

    #[test]
    fn parses_mate_score() {
        let line = "info depth 8 score mate 3 pv f7f5 g2g4";
        let info = parse_info_line(line).unwrap();
        assert_eq!(info.score_mate, Some(3));
        assert_eq!(info.score_cp, None);
    }

    #[test]
    fn ignores_non_info_lines() {
        assert_eq!(parse_info_line("id name Stockfish 18"), None);
        assert_eq!(parse_info_line("uciok"), None);
    }

    #[test]
    fn ignores_info_lines_with_no_score_or_pv() {
        assert_eq!(parse_info_line("info string NNUE evaluation using nn-abc.nnue"), None);
    }

    #[test]
    fn parses_bestmove_with_ponder() {
        assert_eq!(parse_bestmove_line("bestmove e2e4 ponder e7e5"), Some("e2e4".to_string()));
    }

    #[test]
    fn parses_bestmove_without_ponder() {
        assert_eq!(parse_bestmove_line("bestmove g1f3"), Some("g1f3".to_string()));
    }

    #[test]
    fn rejects_non_bestmove_lines() {
        assert_eq!(parse_bestmove_line("info depth 1"), None);
    }
}

#[cfg(test)]
mod analyze_tests {
    use super::*;
    use std::process::{Command, Stdio};

    fn stockfish_available() -> bool {
        Command::new("stockfish")
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map(|mut child| {
                let _ = child.kill();
                let _ = child.wait();
                true
            })
            .unwrap_or(false)
    }

    #[test]
    fn analyzes_the_starting_position_with_a_real_stockfish() {
        if !stockfish_available() {
            eprintln!("skipping analyze_position test: stockfish not found on PATH");
            return;
        }
        let opts = EngineOptions {
            depth: 10,
            movetime_ms: Some(1000),
        };
        let result = analyze_position(
            "stockfish",
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
            &opts,
        )
        .expect("analysis should succeed against a real engine");
        assert!(
            result.eval_cp.abs() < 150,
            "expected a roughly balanced startpos eval, got {}",
            result.eval_cp
        );
        assert_eq!(result.best_move_uci.len(), 4);
        assert!(!result.is_mate);
    }

    #[test]
    fn errors_when_the_engine_binary_does_not_exist() {
        let opts = EngineOptions::default();
        let err = analyze_position(
            "definitely-not-a-real-engine-binary",
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
            &opts,
        )
        .unwrap_err();
        assert!(matches!(err, EngineError::SpawnFailed(_)));
    }
}
