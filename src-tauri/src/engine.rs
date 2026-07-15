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
