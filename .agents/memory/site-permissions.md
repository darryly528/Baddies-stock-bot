---
name: Site Permission System
description: How the role-based permission system works — replaces Discord role checks with owner-managed JSON store
---

## Role Hierarchy
owner(4) > co-owner(3) > admin(2) > mod(1) > verified_reseller(0)

Owner is always `disgust_tf` by username — no file entry needed, checked in `getRole()`.

## Data files (relative to api-server CWD = `artifacts/api-server`)
- `../../permissions.json` — `Record<userId, StaffEntry>` (role, username, addedAt, addedBy)
- `../../ban-requests.json` — `BanRequest[]` with status: pending|approved|rejected
- `../../warnings.json` — `Record<userId, Warning[]>`

## Key modules
- `src/permissions.ts` — single source of truth; exports `getRole`, `hasMinRole`, `setStaffMember`, ban request + warning CRUD
- `src/routes/staff.ts` — REST endpoints for staff CRUD, ban requests, warnings
- `src/routes/admin.ts` — uses `requireMinRole` helper; `/admin/me` returns role

## Permission gates per endpoint
- `admin+`: most admin panel actions (ban, timeout, suspend, delete listings, manage staff)
- `co-owner+`: kick, view DMs/messages monitor
- `mod+`: warn users, submit ban requests for admin approval
- Staff CRUD: only assign roles strictly below own rank

## Frontend
- `use-staff.ts` — hooks: useStaff, useAddStaff, useChangeRole, useRemoveStaff, useBanRequests, useApproveBanRequest, useRejectBanRequest, useWarnUser, useSubmitBanRequest
- Admin page tab "Staff" — add by Discord User ID + username + role, remove, change role
- Admin page tab "Requests" — pending ban requests from mods, approve/reject
- MemberRow — actions gated by caller rank vs target rank
- `isVerifiedReseller` field on Listing type — enriched at GET /listings from permissions.json, shows green ✓VERIFIED badge next to seller name

**Why:** Owner wanted site-managed roles independent of Discord server roles so fine-grained permissions can be assigned without Discord role management.
