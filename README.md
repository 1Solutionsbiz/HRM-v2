# HRM V2 — 1Solutions

A ground-up rebuild of the 1Solutions HR Management System (production: https://hrmpulse.com/).

**This is a brand-new application.** It does not run against, modify, or share a database with
the production HRM. The legacy `1Solutionsbiz/HRM` repository is treated as a reference for
business requirements and historical data only — never edited from this project, and never
connected to from here.

## Non-negotiable rules

These constraints govern every change in this repo. See the project brief for the full list;
the ones most load-bearing for day-to-day work:

- Never modify production HRM or the legacy HRM repository.
- Never connect any environment in this repo to the production database.
- No plaintext passwords, anywhere — not in the DB, sessions, tokens, or logs.
- All authorization/business-rule enforcement happens in the NestJS backend. The frontend
  never talks to MySQL directly and never owns a business rule.
- Modular monolith, not microservices.
- UI is built and validated before the backing API logic is implemented, employee experience
  first.
- No invented business rules — when the legacy system can answer a question, inspect it rather
  than guessing; when it can't, the uncertainty gets written down, not silently resolved.

## Repository layout

```
hrm-v2/
├── apps/
│   ├── web/   Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + PWA
│   └── api/   NestJS + TypeScript + Prisma (MySQL)
├── docker-compose.yml   local-only MySQL + Redis for development
└── .github/workflows/ci.yml
```

`apps/web` and `apps/api` are **independent npm projects**, each with its own `node_modules`
and lockfile — this is not an npm/turborepo workspace. That was a deliberate choice made after
`apps/api`'s dependency graph (Nest 12 + Vitest 4) crashed npm's arborist under workspace-style
resolution; two independent installs are simpler and known to work. The root `package.json`
only holds `npm --prefix` convenience scripts.

## Getting started

```bash
# 1. Start local dev infrastructure (MySQL on :3307, Redis on :6380)
npm run docker:up

# 2. Install both apps
npm run install:all

# 3. Copy env template and adjust if needed
cp apps/api/.env.example apps/api/.env

# 4. Run both apps (separate terminals)
npm run dev:web   # http://localhost:3000
npm run dev:api   # http://localhost:3001
```

## Frontend (`apps/web`)

- Next.js 16 App Router, TypeScript, Tailwind CSS v4, shadcn/ui (Nova preset, Radix-based).
- PWA support via `@ducanh2912/next-pwa`. **Next 16 defaults to Turbopack, but next-pwa is a
  webpack plugin** — `dev`/`build` scripts explicitly pass `--webpack` to keep the service
  worker generation working. Revisit this once next-pwa (or an alternative) supports Turbopack.
- `public/sw.js` and `public/workbox-*.js` are build output, gitignored, regenerated on every
  build — do not hand-edit them.
- `public/icons/*` are flat placeholder icons generated locally. Replace with real branded
  PWA icons before shipping.

## Backend (`apps/api`)

- NestJS 12, Prisma 7.10.0 (pinned — `prisma@latest` currently resolves to an 8.x release
  candidate with a materially different CLI; do not bump past 7.x without deliberately
  evaluating the 8.0 release).
- `apps/api/.npmrc` sets `legacy-peer-deps=true`. Plain `npm install`/`npm ci` in this
  directory crashes with an npm arborist bug (`Cannot read properties of null (reading
  'edgesOut')`) on the Nest/Vitest peer dependency graph — this flag is required, not
  optional. Verified with a clean `npm ci` before relying on it in CI.
- `prisma/schema.prisma` currently has no models — deliberately. Domain modeling is a separate
  task that starts with inspecting the legacy MySQL schema (rule: don't invent business rules
  or data models the legacy system can answer).

## Local infrastructure

`docker-compose.yml` at the repo root starts MySQL and Redis **for local development only**,
on non-default ports (3307 / 6380) to avoid colliding with anything else running locally. It
was not run end-to-end in this environment (Docker CLI isn't installed here) — the compose
file's YAML was validated, but bringing the stack up and connecting Prisma to it is unverified
and should be the first thing to check in a real dev environment.

## CI

`.github/workflows/ci.yml` runs two independent jobs (web, api), each doing
`npm ci` → lint → build (api additionally runs `prisma validate` and the test suite). Verified
locally by running the same commands (including a from-scratch `npm ci`) before committing the
workflow.

## Known limitations / open items

- No domain models yet — next step is inspecting `1Solutionsbiz/HRM`'s schema and business
  logic to derive the employee-facing data model.
- `npm audit` reports several vulnerabilities in both apps' dev-dependency trees (build
  tooling, not runtime code) — not triaged yet.
- PWA icons are placeholders.
- Docker Compose stack unverified end-to-end (see above).
- No auth, no API endpoints, no database migrations yet — this task was scaffolding only.
