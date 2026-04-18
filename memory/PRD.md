# CinemaSync Watch Party — PRD

## Original Problem Statement
Build a real-time watch-party web app (like Discord + Teleparty) that syncs OTT playback (play/pause/seek) + chat between friends — legally (each user signs into their own OTT; we sync, not stream). Originally proposed with Firebase; implemented on our FastAPI + MongoDB + WebSocket stack.

## Architecture
- **Frontend**: React 19 (CRA + craco), React Router v7, Tailwind, shadcn/ui primitives, lucide-react icons, sonner toasts, Google Fonts (Anton / Manrope / IBM Plex Mono).
- **Backend**: FastAPI, Motor (MongoDB), JWT (httpOnly cookie + Bearer fallback), bcrypt password hashing, WebSockets for room hub (sync + chat + WebRTC signaling).
- **Realtime**: `/api/ws/room/{room_id}?token=...` — message types: `hello`, `presence`, `sync`, `chat`, `webrtc-signal`, `screenshare-start/stop`, `platform-change`.
- **Auth**: JWT-based email/password. Admin seeded on startup. test_credentials at `/app/memory/test_credentials.md`.

## User Personas
1. **Host** — creates rooms, invites friends, controls playback, can start screen-share.
2. **Guest** — joins with Room ID + password, watches synced, chats.
3. **Friend** — regular you add via `CinemaSync_Name_DDMMYYYY` unique ID.

## Core Requirements (static)
- Email/password auth (no OTT credentials shared)
- Unique ID per user: `CinemaSync_{Name}_{DDMMYYYY}`
- Friend system: search/request/accept/reject/cancel/remove
- Rooms: 8-char Room ID + password, platform selection (Netflix/Prime/Hotstar/Hoichoi/Adda Times/ZEE5/Custom)
- Realtime: host-authoritative play/pause/seek; chat w/ emojis; presence
- WebRTC screen-share (host → peers via WS signaling, STUN only)
- Dark cinematic UI (vintage marquee + modern overlay aesthetic)

## Implemented (2026-02 / today)
- [x] Auth: register / login / logout / me (JWT + cookie + bearer fallback)
- [x] Profile: avatar upload (base64, <800KB), name edit, unique_id regeneration
- [x] Friends: search by unique_id, request/accept/reject/cancel/remove, list
- [x] Rooms: create, join (password hashed), get, messages, leave
- [x] WebSocket hub: presence, sync (host only), chat (persisted), WebRTC signaling, platform-change
- [x] Frontend: Landing (hero marquee), Login, Register, Dashboard, Profile, Friends (tabs), Lobby, Watch Room (sync bar + chat + emoji + screenshare button)
- [x] Admin seeding + MongoDB indexes on startup
- [x] Data-testids everywhere for e2e

## Verified (2026-02)
- Backend: 17/17 pytest pass (auth, profile, friends, rooms, ws endpoint)
- Frontend: all UI flows pass (register → dashboard → create room → lobby → watch room → chat → profile → friends)

## Prioritized Backlog
- **P0**: Provide user-supplied logo/branding assets; swap placeholder typography wordmark.
- **P1**: Multi-host control (co-hosts), persistent room history on dashboard ("Recent rooms"), room invites via friend DM.
- **P1**: Password reset flow (forgot-password), email verification.
- **P2**: Voice chat (WebRTC audio-only room), AI movie recommendation, watch history, reactions overlay on player.
- **P2**: Browser extension so host's Netflix video element can drive `sync` events automatically (instead of manual timer).
- **P2**: Rate limiting on chat/sync broadcasts, brute-force lockout on login.

## Known Limitations
- Playback sync uses a server-side virtual timer; host manually controls it. Real OTT `<video>` element hookup requires a browser extension (future).
- WebRTC screen-share requires user gesture + HTTPS; not testable in headless browsers.
- CORS currently wildcard — tighten for production.
