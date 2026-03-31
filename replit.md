# Baddies Stock Bot

## Overview

A Discord bot + web store for managing Baddies game item stock listings. Includes a React frontend catalog and an Express API server with Discord bot integration.

## Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, Radix UI, Framer Motion
- **Backend**: Express 5, TypeScript, tsx
- **Discord Bot**: discord.js 14
- **Package manager**: pnpm (standalone installs per artifact)
- **Build**: esbuild (CJS bundle for production)

## Project Structure

```
Baddies-stock-bot-2/
├── artifacts/
│   ├── api-server/        # Express API + Discord bot (port 8080)
│   └── baddies-store/     # React frontend (port 5000)
├── catalog.json           # Item catalog data
└── listings.json          # Current listings data
```

## Services

- **Baddies Store** (frontend): React/Vite app on port 5000, proxies `/api` to port 8080
- **API Server & Discord Bot**: Express API on port 8080, Discord bot started alongside

## Configuration

The Discord bot requires a `DISCORD_BOT_TOKEN` environment variable. Without it, the bot won't start (but the API server still runs).

Optional env vars for the API server:
- `DISCORD_BOT_TOKEN` - Discord bot token
- `TICKET_CATEGORY_ID` - Discord ticket category ID
- `TICKET_MOD_ROLE_ID` - Discord moderator role ID
- `LISTINGS_PATH` - Custom path for listings.json

## Workflows

- **Start application**: Starts the Baddies Store frontend (webview on port 5000)
- **API Server & Discord Bot**: Starts the Express API + Discord bot (port 8080)

## Development

Each artifact has its own `package.json` and `node_modules`. Install dependencies separately:
```
cd Baddies-stock-bot-2/artifacts/baddies-store && pnpm install
cd Baddies-stock-bot-2/artifacts/api-server && pnpm install
```
