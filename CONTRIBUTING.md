# Contributing Guide

Thanks for your interest in contributing!

This repository contains the backend API for the Academic Project Management & Collaboration Platform, built with NestJS and Prisma.

## Ways to Contribute

- Report bugs and propose improvements via issues
- Improve documentation
- Submit pull requests for fixes and features

## Development Setup

### Prerequisites

- Node.js **>= 18**
- pnpm (recommended) or npm
- PostgreSQL and Redis available locally or via Docker

### Install

```bash
pnpm install
```

### Environment variables

- Copy `.env.example` to `.env`
- Update database, Redis, and auth settings

### Database

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm db:seed
```

### Run

```bash
pnpm start:dev
```

## Code Style  Quality

Before opening a PR, please run:

```bash
pnpm lint
pnpm type-check
pnpm test
```

If your changes affect the database schema, include:

```bash
pnpm prisma:migrate
```

## Branching and PRs

- Create a branch from `main`: `feature/<name>` or `fix/<name>`
- Keep PRs focused and small where possible
- Include a clear description, screenshots/logs when relevant
- Add tests for behavior changes

## Commit Messages

Use descriptive commit messages (imperative mood):

- `feat: add tenant usage metrics`
- `fix: handle expired refresh tokens`
- `docs: improve setup instructions`

## Security

If you find a security issue, do **not** open a public GitHub issue. Please see `SECURITY.md`.
