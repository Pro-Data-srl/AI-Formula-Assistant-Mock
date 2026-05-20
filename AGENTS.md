# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Formelassistent is a Next.js 16 (App Router, Webpack mode) TypeScript application — a formula editor with AI assistant. Single `package.json` at root (not a monorepo).

### Services

| Service | How to start | Port |
|---------|-------------|------|
| PostgreSQL 16 + pgvector | `docker compose up -d` | 5433 |
| Next.js dev server | `npm run dev` | 3000 |

### Key commands

See `README.md` "Scripts" table for full list. Most common:

- **Lint:** `npm run lint`
- **Test:** `npm test` (Vitest, no DB or API keys needed)
- **Dev server:** `npm run dev` (requires DB running)
- **Migrations:** `npm run db:migrate`

### Node version

Project requires Node.js 20 (see `.nvmrc`). Use `source ~/.nvm/nvm.sh && nvm use 20` before running commands.

### Docker

Docker must be running for the PostgreSQL container. Start with `docker compose up -d`. The daemon requires `sudo dockerd` in this environment with `fuse-overlayfs` storage driver and `iptables-legacy`.

After starting the daemon, fix socket permissions: `sudo chmod 666 /var/run/docker.sock`.

### Environment variables

- Copy `.env.example` to `.env` for defaults (DB URL already points to docker compose Postgres on port 5433).
- `FORMULA_SOURCE=direct` mode works without any API keys (formula editor, validation, execution all work). AI chat features require `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`.
- Tests (`npm test`) do not require API keys or a running database.

### Gotchas

- The dev script uses `next dev --webpack` (not Turbopack) despite README mentioning Turbopack.
- First request after `npm run dev` takes ~10s to compile; subsequent requests are fast.
- ESLint has some pre-existing warnings/errors in the codebase (not blocking).
- `npm run db:seed-formula-docs` requires `OPENAI_API_KEY` for embedding generation; only needed for `graph`/`free` agent modes.
