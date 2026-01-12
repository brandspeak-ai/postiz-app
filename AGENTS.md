# Repository Guidelines

## Project Structure & Module Organization
- Runtime services live in `apps/`: `backend` (NestJS API), `frontend` (Next.js UI), `workers` (async jobs), `cron` (scheduled tasks), `extension` (browser add-on), plus `sdk` and `commands` for distributables.
- Shared logic resides under `libraries/` (`nestjs-libraries`, `react-shared-libraries`, `helpers`); extract reusable code here rather than repeating it in apps.
- Static assets and translations live in `apps/frontend/public` and `i18n.json`; Docker tooling sits in `var/docker/`.

## Build, Test, and Development Commands
- `pnpm install` — install dependencies (Node 22.x per `package.json` engines).
- `pnpm run dev` — launch backend, frontend, workers, cron, and extension in watch mode.
- `pnpm run dev:<service>` — focus on a single app (e.g., `dev:backend`, `dev:frontend`, `dev:workers`, `dev:cron`).
- `pnpm run build` — produce deployable bundles for API, UI, workers, and cron.
- `pnpm test` — run Jest across all packages with coverage and JUnit output to `reports/junit.xml`.
- `pnpm prisma-generate` / `pnpm prisma-db-push` — regenerate Prisma types or push schema changes after editing `libraries/nestjs-libraries/src/database/prisma/schema.prisma`.

## Coding Style & Naming Conventions
- TypeScript is standard; follow ESLint settings in `eslint.config.mjs` and fix violations with `pnpm dlx eslint apps/** libraries/**`.
- Prettier enforces single quotes (`.prettierrc`) and 2-space indentation; format staged files with `pnpm dlx prettier --write`.
- React components follow PascalCase filenames, hooks remain `use*.ts`, and Nest providers keep module/service/controller suffixes.

## Testing Guidelines
- Place Jest specs alongside source files using `*.spec.ts` or `*.test.ts`; reserve broader scenarios for each app’s `__tests__/` folder.
- Keep coverage meaningful; call out intentional drops in your PR and keep snapshot tests limited to UI packages.
- Use `pnpm test -- --watch` to rerun affected suites during development.

## Commit & Pull Request Guidelines
- Follow conventional commits (`feat:`, `fix:`, `chore:`); squash merges unless coordinating a multi-commit release.
- Name branches by scope (`feature/<topic>`, `fix/<bug-id>`), and keep PRs scoped to a single concern.
- PRs must include context, linked issues, testing evidence, and screenshots or curl examples for UI or API changes; add rollout notes when relevant.

## Environment & Security Tips
- Start from `.env.example`, inject secrets only locally, and never commit `.env*` files.
- For local integrations, use `pnpm run dev:stripe` or bring up dependencies with `docker compose -f docker-compose.dev.yaml up -d`.
- Report security concerns per the process in `SECURITY.md`; avoid sharing keys in issues or PR discussions.
