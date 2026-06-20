---
name: Custom Profiles
description: User profile system — file-backed per-user customization with banner, accent color, bio, and featured catalog items
---

## Data file
`../../profiles.json` (relative to api-server CWD) — `Record<userId, ProfileData>`

## Backend endpoints
- `GET /api/profile` — own profile (authenticated)
- `PATCH /api/profile` — save own profile (authenticated); validates color hex, banner style
- `GET /api/profiles/:userId` — public profile; falls back to listing data if no profile saved

## Customizable fields
- `tagline` (80 chars) — shows in italic under username with accent color
- `bio` (500 chars) — about section
- `tradePreferences` (200 chars) — highlighted card with accent border
- `accentColor` — hex color, validated with `/^#[0-9a-fA-F]{6}$/`
- `bannerStyle` — one of: default, sunset, ocean, forest, midnight, fire, aurora, gold
- `featuredItems` — up to 6 catalog items stored as `{ id, name, imageUrl, rarity, value }`

## Frontend
- `use-profile.ts` — useProfile (retry:false to show errors quickly), useOwnProfile, useUpdateProfile
- `profile.tsx` — profile view + inline editor (tabbed: About / Style / Items)
- Route: `/profile/:userId` in App.tsx
- Navbar avatar is clickable → own profile; mobile bottom nav shows avatar tab when logged in

## UX pattern
Profile page shows view by default. Clicking "Edit Profile" button renders the editor panel as a side column (sticky on desktop, stacked on mobile). Save applies all tabs at once.

**Why:** retry:false on useProfile is important — without it, a 404 would stay in loading skeleton for ~1s due to exponential backoff retry.
