# Postiz Application - Development Guide

## Prerequisites

### Required Software

| Software | Version | Notes |
|----------|---------|-------|
| **Node.js** | v22.x (22.0.0 - 22.x.x) | Required; v23+ not supported |
| **pnpm** | 10.6.1+ | Package manager |
| **Docker** | Latest | For PostgreSQL & Redis |

### Install Node Version Manager (nvm)

```bash
# Install via Homebrew (macOS)
brew install nvm

# Add to your shell profile (~/.zshrc or ~/.bashrc)
export NVM_DIR="$HOME/.nvm"
[ -s "$(brew --prefix nvm)/nvm.sh" ] && \. "$(brew --prefix nvm)/nvm.sh"

# Reload shell and install Node 22
source ~/.zshrc
nvm install 22
nvm use 22
```

---

## Step 1: Start Development Databases

Start PostgreSQL and Redis using Docker Compose:

```bash
pnpm run dev:docker
```

This starts:

| Service | Port | Credentials |
|---------|------|-------------|
| **PostgreSQL** | 5432 | postiz-local / postiz-local-pwd |
| **Redis** | 6379 | — |
| **pgAdmin** | 8081 | admin@admin.com / admin |
| **RedisInsight** | 5540 | — |

---

## Step 2: Configure Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://postiz-local:postiz-local-pwd@localhost:5432/postiz-db-local"
REDIS_URL="redis://localhost:6379"

# URLs
MAIN_URL="http://localhost:4200"
FRONTEND_URL="http://localhost:4200"
NEXT_PUBLIC_BACKEND_URL="http://localhost:3000"
BACKEND_INTERNAL_URL="http://localhost:3000"

# Security
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Storage (options: local, s3, cloudflare)
STORAGE_PROVIDER="local"

# Optional: AI Features
# OPENAI_API_KEY="sk-..."

# Optional: Email Notifications
# RESEND_API_KEY="re_..."

# Optional: Error Tracking (leave empty to disable)
# NEXT_PUBLIC_SENTRY_DSN=""
```

---

## Step 3: Install Dependencies

```bash
pnpm install
```

This automatically runs `prisma-generate` via the postinstall hook.

---

## Step 4: Initialize Database

Push the Prisma schema to create database tables:

```bash
pnpm run prisma-db-push
```

---

## Step 5: Start Development Servers

### Run All Services (Recommended)

```bash
pnpm run dev
```

This starts all services in parallel:

| Service | Port | Description |
|---------|------|-------------|
| **Frontend** | 4200 | Next.js web application |
| **Backend** | 3000 | NestJS API server |
| **Workers** | — | Background job processing (BullMQ) |
| **Cron** | — | Scheduled tasks |
| **Extension** | — | Browser extension (dev build) |

### Run Individual Services

```bash
# Frontend only
pnpm run dev:frontend

# Backend only
pnpm run dev:backend

# Workers only
pnpm run dev:workers

# Cron only
pnpm run dev:cron
```

---

## Access the Application

| URL | Description |
|-----|-------------|
| http://localhost:4200 | Main Application |
| http://localhost:3000 | Backend API |
| http://localhost:3000/api | Swagger API Docs |
| http://localhost:8081 | pgAdmin (DB Management) |
| http://localhost:5540 | RedisInsight |

---

## Common Commands

### Database Operations

```bash
# Push schema changes to database
pnpm run prisma-db-push

# Pull schema from database
pnpm run prisma-db-pull

# Regenerate Prisma client
pnpm run prisma-generate

# Reset database (WARNING: deletes all data)
pnpm run prisma-reset
```

### Build for Production

```bash
# Build all services
pnpm run build

# Build individual services
pnpm run build:frontend
pnpm run build:backend
pnpm run build:workers
pnpm run build:cron
```

### Run Production

```bash
pnpm run start:prod:frontend
pnpm run start:prod:backend
pnpm run start:prod:workers
pnpm run start:prod:cron
```

---

## Troubleshooting

### Prisma Version Mismatch

If you see errors about Prisma 7, the scripts use `pnpm exec prisma` to use the local version (6.x):

```bash
# Correct way to run prisma commands
pnpm exec prisma db push --schema ./libraries/nestjs-libraries/src/database/prisma/schema.prisma
```

### Sentry Profiler Error (Development)

If you see `Cannot find module './sentry_cpu_profiler-darwin-arm64-XXX.node'`, this is safe to ignore in development when `NEXT_PUBLIC_SENTRY_DSN` is not set.

### Clear Next.js Cache

If the frontend shows errors after pulling updates:

```bash
rm -rf apps/frontend/.next
pnpm run dev:frontend
```

### Regenerate Prisma Client After Schema Changes

```bash
pnpm run prisma-db-push
pnpm run prisma-generate
```

### Git Merge Conflicts in package.json

If you see JSON syntax errors after pulling, check for merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) and resolve them.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | NX |
| Frontend | Next.js 14 (React 18) |
| Backend | NestJS 10 |
| Database | PostgreSQL (Prisma ORM) |
| Queue | Redis + BullMQ |
| Email | Resend |
| AI | OpenAI API |
| Monitoring | Sentry (optional) |

---

## Project Structure

```
postiz-app/
├── apps/
│   ├── frontend/          # Next.js web app
│   ├── backend/           # NestJS API server
│   ├── workers/           # Background job workers
│   ├── cron/              # Scheduled tasks
│   ├── extension/         # Browser extension
│   └── commands/          # CLI commands
├── libraries/
│   ├── nestjs-libraries/       # Shared NestJS modules
│   ├── react-shared-libraries/ # Shared React components
│   └── helpers/                # Utility functions
└── .env                   # Environment configuration
```

---

## Additional Resources

- **Official Docs**: https://docs.postiz.com
- **Quick Start**: https://docs.postiz.com/quickstart
- **Developer Guide**: https://docs.postiz.com/developer-guide
- **Discord**: https://discord.postiz.com

