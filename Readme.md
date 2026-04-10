# Academia Backend API

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/Built%20With-NestJS-red)](https://nestjs.com/)
[![CI](https://github.com/kubsamelkamu/academia-backend-api/actions/workflows/ci.yml/badge.svg)](https://github.com/kubsamelkamu/academia-backend-api/actions/workflows/ci.yml)

A multi-tenant backend API for managing academic projects, collaboration, and administrative workflows across universities. This service powers the Academia platform and is deployed on **Heroku** (Herukom) with **Redis** used for caching and background queues.

## Overview

Academia provides role-based workspaces for department heads, coordinators, advisors, evaluators, committee members, and students—covering the full project lifecycle from intake to defense and reporting.

## Table of contents

- [Key features](#key-features)
- [Technology stack](#technology-stack)
- [Architecture highlights](#architecture-highlights)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [API documentation](#api-documentation)
- [Deployment](#deployment)
- [Related repositories](#related-repositories)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)
- [Acknowledgments](#acknowledgments)

## Key features

- Multi-tenant isolation with tenant-aware middleware and request scoping.
- JWT authentication with fine-grained RBAC for platform admins, coordinators, advisors, and students.
- End-to-end project lifecycle: proposals, milestones, evaluations, and defense workflows.
- Real-time notifications, messaging, and Socket.IO events.
- Background jobs and scheduling with Bull + Redis.
- File upload support with Cloudinary integration.
- Analytics-ready structure for reporting and administrative insights.

## Technology stack

| Category | Technology |
| --- | --- |
| Framework | [NestJS](https://nestjs.com/) |
| Language | [TypeScript](https://www.typescriptlang.org/) |
| Database | [PostgreSQL](https://www.postgresql.org/) + [Prisma ORM](https://www.prisma.io/) |
| Caching & Queues | [Redis](https://redis.io/) + [Bull](https://github.com/OptimalBits/bull) |
| Auth | Passport + JWT |
| Real-time | Socket.IO |
| Testing | Jest |

## Architecture highlights

- Feature-based modules under `src/modules/` for domain separation.
- Centralized shared utilities under `src/common/` (guards, decorators, filters, pipes).
- Prisma-powered repositories for database access.
- Queue-backed workloads for notifications and scheduled workflows.

## Project structure

```bash
src/
├── common/             # Shared utilities (guards, pipes, decorators)
├── config/             # App, auth, database, and integrations config
├── core/               # Cache, queues, logging, health checks
├── modules/            # Feature modules (auth, project, notification, etc.)
├── prisma/             # Prisma schema and migrations
├── app.module.ts       # Root module
└── main.ts             # Application entry point
```

## Getting started

### Prerequisites

- Node.js 22.x
- npm 10.x
- PostgreSQL 14+
- Redis

### Install

```bash
git clone https://github.com/kubsamelkamu/academia-backend-api.git
cd academia-backend-api
npm install
```

### Database setup

```bash
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```

### Run locally

```bash
npm run start:dev
```

The API will be available at `http://localhost:3001/api/v1` (depending on config).

## Environment variables

Copy the example environment file and update values as needed:

```bash
cp .env.example .env.development
```

Required values include:

- `DATABASE_URL`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `REDIS_HOST`, `REDIS_PORT`
- `CLOUDINARY_*`
- Email provider credentials (Brevo)

## Scripts

| Command | Description |
| --- | --- |
| `npm run build` | Compile the application |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Apply migrations |
| `npm run db:seed` | Seed database |

## API documentation

- Base URL: `http://localhost:3001/api/v1`
- Swagger UI: `http://localhost:3001/api/docs`

## Deployment

- **Hosting**: Heroku (Herukom)
- **Caching & queues**: Redis
- **Database**: PostgreSQL

## Related repositories

- Frontend: https://github.com/kubsamelkamu/Academia

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Security

If you discover a security issue, please follow [SECURITY.md](SECURITY.md).

## License

MIT - see [LICENSE](LICENSE).

## Acknowledgments

This project is part of the Academic Excellence initiative at Haramaya University, College of Computing and Informatics, Department of Software Engineering.
