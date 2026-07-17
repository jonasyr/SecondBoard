# Tech stack

- **Frontend**: SvelteKit 5 (runes: `$state`, `$derived`, `$props`), TypeScript, Vite 8, `@sveltejs/adapter-static` (static build for Tauri to embed).
- **Desktop shell**: Tauri v2 (`@tauri-apps/api` in JS, `tauri` crate in Rust). `@tauri-apps/cli` for the `tauri` CLI.
- **Chess engine**: Stockfish invoked from Rust (`src-tauri/src/engine.rs`) via the `analyze_fen` Tauri command; JS calls it through `src/lib/api/engine.ts`.
- **PGN parsing**: Rust `pgn-reader` + `shakmaty` crates (`src-tauri/src/pgn.rs`), exposed as the `parse_pgn` command. This replaced an earlier JS mock SAN engine (`mock-engine.ts`, deleted — LOGIC.md explicitly says it must not ship).
- **Fonts**: `@fontsource/geist-sans`, `@fontsource/geist-mono` (see `--sbmono`/`.sbmono` class usage in components for numeric/mono text).
- **Testing**: Vitest 4 + `@testing-library/svelte` + `jsdom`. Every component has a co-located `*.test.ts`.
- **Lint/format**: ESLint 10 (flat config, `eslint.config.js`) with `svelte-eslint-parser`/`typescript-eslint`; Prettier 3 with `prettier-plugin-svelte`.
- **Package manager**: pnpm (`pnpm-lock.yaml` present; `.npmrc` configures it).
