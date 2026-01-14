# replit.md

## Overview

This is a **TeleLoad Bot** application - a Telegram bot with an admin dashboard for managing video downloads. The system consists of a Node.js/Express backend that runs a Telegram bot (using grammY) and serves a React admin dashboard. Users interact with the bot to download videos, with free users getting watermarked content and PRO subscribers getting clean downloads.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for smooth transitions
- **Charts**: Recharts for dashboard analytics
- **Build Tool**: Vite with custom plugins for Replit integration

The frontend follows a component-based architecture with:
- Pages in `client/src/pages/` (Home landing page, AdminDashboard, 404)
- Reusable UI components in `client/src/components/ui/` (shadcn/ui)
- Custom hooks in `client/src/hooks/` for data fetching and utilities
- Path aliases: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **Bot Framework**: grammY for Telegram bot functionality
- **API Pattern**: RESTful endpoints defined in `shared/routes.ts`
- **Database ORM**: Drizzle ORM with PostgreSQL

The backend serves dual purposes:
1. Runs the Telegram bot for user interactions (video downloads, subscriptions)
2. Provides REST API endpoints for the admin dashboard

Key server files:
- `server/index.ts` - Express app setup and HTTP server
- `server/bot.ts` - Telegram bot logic with grammY
- `server/routes.ts` - API route handlers
- `server/storage.ts` - Database operations via Drizzle
- `server/db.ts` - Database connection pool

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Tables**:
  - `users` - Telegram user data (ID, username, PRO status, trial info)
  - `downloads` - Download history (file IDs, URLs, watermark status)
- **Migrations**: Managed via `drizzle-kit push` command

### Shared Code Pattern
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts` - Drizzle table definitions and Zod validation schemas
- `routes.ts` - API route definitions with type-safe request/response schemas

## External Dependencies

### Third-Party Services
- **Telegram Bot API**: Via grammY library for bot functionality
- **PostgreSQL**: Primary database (requires `DATABASE_URL` environment variable)

### Key NPM Packages
- `grammy` - Telegram bot framework
- `drizzle-orm` + `drizzle-kit` - Database ORM and migrations
- `express` - HTTP server framework
- `@tanstack/react-query` - Data fetching and caching
- `recharts` - Dashboard charts
- `framer-motion` - Animations
- `fluent-ffmpeg` - Video processing (referenced in bot.ts)
- `zod` - Schema validation

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- Telegram bot token (used in bot.ts, exact variable name to be determined)

### Build Configuration
- Development: `npm run dev` uses tsx for TypeScript execution
- Production: `npm run build` bundles with esbuild (server) and Vite (client)
- Database: `npm run db:push` syncs schema to database