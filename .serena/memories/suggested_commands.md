# Suggested commands (Windows, Git Bash shell)

Run from repo root `C:\Users\JW\Documents\Code\SecondBoard`. Package manager is **pnpm** even though scripts are defined generically in package.json.

- `pnpm install` — install deps.
- `pnpm dev` — Vite dev server (frontend only, no Tauri shell).
- `pnpm exec tauri dev` — full desktop app with Rust backend (needed to exercise real `parse_pgn`/`analyze_fen` Tauri commands; plain `pnpm dev` stubs/fails those `invoke()` calls).
- `pnpm test` — Vitest (frontend unit tests). `pnpm test -- run` for non-watch CI mode; `pnpm exec vitest run <path>` to target one file.
- `pnpm check` — `svelte-kit sync && svelte-check` (TypeScript + Svelte type checking). Run before considering frontend work done.
- `pnpm lint` — ESLint over the whole repo.
- `pnpm format` — Prettier write.
- `pnpm build` — production Vite build (static adapter output, used as Tauri's frontend dist).
- Rust side: `cd src-tauri && cargo test` for `pgn.rs`/`engine.rs` unit tests; `cargo check` for a fast compile check.
- `git` — standard; this machine is Windows but the shell here is Git Bash/POSIX-like, so unix-style git commands work as-is (no PowerShell quoting needed).
