# The Forever Treasure Companion

Production-oriented foundation and first theatrical vertical slice for a private nautical-fantasy date-night Tall Tale. All committed story material is generic development seed content; no final surprise content belongs in this public repository.

## Current phase

Phase one provides a sealed player journal, responsive chart/relic workspace, private quartermaster dashboard, authenticated transactional progression, ordered SSE delivery, replay/skip/reduced-motion ceremony controls, state undo, and development seed data for “The First Seal.”

## Stack

- Next.js 16 App Router, React 19, strict TypeScript
- Prisma 6.19 with SQLite for local/test and an equivalent MySQL production schema
- Framer Motion with pinned compatible motion packages
- bcrypt password/access-code hashing, server-side database sessions, CSRF tokens, and rate limiting
- Vitest and Playwright

## Reproducible setup

Requirements: Node.js 24, npm 11, Git, and (for production parity) MySQL 8.0+.

```bash
git clone https://github.com/Kgray44/treasurehuntSoT.git
cd treasurehuntSoT
npm ci
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Set unique local values in `.env`; the seed’s fallback values are development-only and must never be used outside an isolated development database. Player path: `/tale/development-forever-treasure`. GM path: `/quartermaster`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local server |
| `npm run build` | Production build |
| `npm start` | Start production build |
| `npm test` | Unit tests |
| `npm run test:e2e` | Chromium and WebKit Playwright tests |
| `npm run db:migrate` | Apply local SQLite migrations |
| `npm run db:seed` | Load replaceable development content |
| `npm run db:generate:mysql` | Generate production MySQL client |

## Repository workflow

`main` is canonical. At task start: fetch, inspect status/remotes, and pull with rebase when clean. At task end: validate, review the complete diff, commit intentionally, fetch/rebase if needed, push without force, and verify local `HEAD` equals `origin/main`. See [Codex handoff](docs/codex-handoff.md).

## Important limitations

The full story, final art/audio, multi-player device management, horizontal scale-out for SSE, and production deployment are later work. The current sound is a restrained procedural seal tone; no external copyrighted assets are present. See [known limitations](docs/known-limitations.md).
