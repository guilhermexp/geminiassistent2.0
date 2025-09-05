# Repository Guidelines

## Project Structure & Module Organization
- `src/components/`: UI built with Lit custom elements (kebab-case files, e.g., `assistant-shell.ts`, `analysis-form.ts`).
- `src/services/`: App logic and integrations (e.g., `analysis`, `audio`, `api`).
- `src/shaders/`: Three.js shader modules.
- `src/utils/`, `src/config/`, `src/types/`: Shared helpers, config, and TypeScript types.
- `public/`: Static assets served as-is (e.g., `public/avatars/`).
- `docs/`: Project docs (e.g., `docs/components/user-profile.md`).
- Entry points: `index.html`, `index.css`, `src/components/main/index.tsx`.

## Build, Test, and Development Commands
- `npm run dev`: Start Vite dev server with HMR.
- `npm run build`: Production build via Vite.
- `npm run preview`: Preview the production build locally.
- Tests: No test runner is configured yet; see Testing Guidelines.

## Coding Style & Naming Conventions
- Language: TypeScript (`module` ESNext, `target` ES2022).
- Components: Lit `@customElement` names must include a dash (e.g., `gdm-live-audio`). Class names in PascalCase; files in kebab-case.
- Indentation: 2 spaces; prefer explicit types for public APIs.
- Imports: Use ESM and local aliases as configured (see `tsconfig.json` paths).
- Formatting/Linting: Not enforced in repo; prefer Prettier defaults and consistent semicolons.

## Testing Guidelines
- Framework: Not set. Recommended next step: add Vitest for unit tests and Playwright for E2E.
- Conventions (proposed):
  - Place unit tests alongside sources as `*.spec.ts`.
  - Name test suites by component/service (e.g., `analysis-service.spec.ts`).
- Run: After adding Vitest, expose `npm test` and document coverage thresholds.

## Commit & Pull Request Guidelines
- History shows mixed styles; some Conventional Commits present (e.g., `feat: ...`, `fix: ...`). Prefer Conventional Commits (`feat`, `fix`, `refactor`, `chore`, `docs`).
- PRs should include: concise description, linked issue (if any), screenshots or clips for UI, and steps to verify.
- Keep changes scoped; update docs in `docs/` when relevant.

## Security & Configuration Tips
- Secrets: Store in uncommitted `.env.local`. Examples:
  - `API_KEY=...` (GenAI) and `FIRECRAWL_API_KEY=...` used by `src/components/main/index.tsx` and `src/config/config.ts`.
- Do not commit keys or tokens. Verify env loading before `npm run dev` or `build`.
