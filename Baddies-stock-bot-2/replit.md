# Workspace

## Overview

pnpm workspace monorepo using TypeScript. The actual workspace root is in the `Code-Viewer/` directory.

## Stack

- **Monorepo tool**: pnpm workspaces (root: `Code-Viewer/`)
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Discord bot**: discord.js 14
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React 19, Vite 7, Tailwind CSS 4, Radix UI

## Structure

```text
Code-Viewer/               ← actual workspace root (has package.json)
├── artifacts/
│   ├── api-server/        # Express API + Discord bot
│   └── mockup-sandbox/    # Vite React component sandbox
├── lib/
│   ├── api-spec/          # OpenAPI spec + Orval codegen config
│   ├── api-client-react/  # Generated React Query hooks
│   ├── api-zod/           # Generated Zod schemas
│   └── db/                # Drizzle ORM schema + DB connection
├── scripts/               # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Important Notes

- The workspace root is `Code-Viewer/` — always run pnpm commands from there
- The root `/home/runner/workspace/` contains mirrored `artifacts/` and `lib/` directories, but the working ones are in `Code-Viewer/`
- The `.replit` config is at the root `/home/runner/workspace/.replit`

## Workflows

- **Start application**: Runs the mockup-sandbox Vite dev server on port 3000
  - Command: `cd Code-Viewer && PORT=3000 BASE_PATH=/ pnpm --filter @workspace/mockup-sandbox run dev`

## API Server

- Requires `PORT` environment variable
- Runs a Discord bot that manages virtual item stock (Weapons, Fighting Styles)
- Uses slash commands `/list` and `/sold`
- Requires `DISCORD_TOKEN` and `DISCORD_CLIENT_ID` environment variables

## Mockup Sandbox

- Component preview environment at port 3000
- Requires `PORT` and `BASE_PATH` environment variables
- Auto-discovers components in `src/components/mockups`
