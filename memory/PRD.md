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
- [x] Profile: avatar upload, name edit, unique_id regeneration
- [x] Friends: search by unique_id, request/accept/reject/cancel/remove, list
- [x] Rooms: create, join (password hashed), get, messages, leave
- [x] WebSocket hub: presence, sync (host only), chat (persisted), WebRTC signaling, platform-change
- [x] Frontend: Landing, Login, Register, Dashboard, Profile, Friends, Lobby, Watch Room
- [x] Admin seeding + MongoDB indexes on startup
- [x] Native fullscreen + WebRTC screen-share (host → peers, STUN)
- [x] Infographic dashboard, Pastel Purple-Neon theme, Allerta Stencil font
- [x] Admin panel at /admin for manasijmandal1999@gmail.com
- [x] OTT popup launching (bypass iframe X-Frame-Options)
- [x] **[2026-04-18] Real OTT logos** — Netflix, Prime Video, JioHotstar, Hoichoi, Addatimes, ZEE5 integrated via shared `PlatformLogo` component across Dashboard picker, LiveRoomCard thumbnails, Lobby hero tile, WatchRoom header & Intermission.
- [x] **[2026-04-18] 10MB Profile Pictures via Emergent Object Storage** — replaced base64/Mongo storage. New endpoints: `POST /api/profile/picture` (multipart, 10MB cap, JPG/PNG/WEBP/GIF), `GET /api/files/{path}` (authenticated serve). Upload progress UI in Profile page. 14/14 tests pass.
- [x] **[2026-04-18] Dashboard stacked layout + refined platform picker** — Create Room card on top, Join Room below full-width; 7-column platform tiles with 72px logos, brand-accurate white backgrounds so every logo is clearly visible.
- [x] **[2026-04-18] Responsive unique-ID badge** — collapses to circular avatar (profile picture or smart initials) below `md` breakpoint so the long `CinemaSync_Name_DDMMYYYY` pill never overlaps the greeting.
- [x] **[2026-04-18] AI Share-Party Poster (Gemini Nano Banana)** — `POST /api/rooms/{room_id}/poster` generates a 1024x1024 JPG via `gemini-3.1-flash-image-preview`, stores in Object Storage, returns authenticated URL. Lobby `PosterCard` component: Generate / Share (Web Share API with file fallback) / Download / Regenerate. Verified end-to-end.
- [x] **[2026-04-18] Password reset / email verification** — full Resend-powered flow; `/forgot-password`, `/reset-password?token=`, `/verify-email?token=` pages; 30-min reset TTL, 48-hr verify TTL, single-use tokens; rate-limited (3/hr per email). Sender currently `onboarding@resend.dev` (sandbox limits to account owner until `cinemasync.com` domain is DNS-verified at resend.com/domains).
- [x] **[2026-04-18] Multi-host (co-hosts)** — host promotes/demotes from Lobby participants list; co-hosts can play/pause/seek like host.
- [x] **[2026-04-18] Persistent room history** — `/api/rooms/history` tracks every create/join with visit count + last_joined_at; Dashboard shows "Recent rooms" grid with live indicator + re-enter.
- [x] **[2026-04-18] Rate limiting** — login (8/10min email, 30/10min IP), chat (10/5s per user, emits `rate-limited` WS event), sync (8/sec host), forgot-password (3/hr per email).
- [x] **[2026-04-18] TURN server + Voice/Video chat** — `/api/rtc/ice` returns Metered TURN creds (server-side fetched via API key, 5-min cached). WatchRoom consumes it for all PeerConnections. Added voice + video mesh on dedicated "voice" WS channel with floating tile grid overlay (self + remote peers, mic/cam toggles in sync bar). Graceful fallback to STUN-only if Metered is down.
- [x] **[2026-04-19] QR code + Friend broadcast on room creation** — new `POST /api/rooms/{id}/broadcast` endpoint sends `room-invite` notifications to ALL friends at once. New `QRCodeCard` component (uses `qrcode` npm). `RoomCreatedModal` shows QR + room code + password post-creation; Lobby gets a `QRCard` panel so host can regenerate QR any time. 12/12 tests pass.
- [x] **[2026-04-19] Onboarding checklist** — `OnboardingChecklist` component on Dashboard with 5 steps (profile photo, email verify, add friend, host room, send invite), progress bar, auto-completing detection, localStorage dismiss.
- [x] **[2026-04-19] Voice commands** — `useVoiceCommands` Web Speech API hook in WatchRoom. Radio button in sync bar starts listening (host/co-host only). Commands: play / pause / reset / forward N / back N / mute / unmute. Live "Listening…" banner with transcript at top of stage.

## Verified (2026-04-18)
- Backend: 14/14 tests pass (upload happy path + 400 invalid type + 413 oversize + 401 unauth + regression auth/rooms/friends/admin)
- Frontend: all 6 platform logo tiles render with naturalWidth>0; Profile upload end-to-end works.

## Prioritized Backlog
- **P1**: TURN server for WebRTC NAT traversal (currently STUN-only)
- **P1**: Password reset flow (forgot-password), email verification
- **P2**: Voice/Video chat in watch rooms
- **P2**: Multi-host control (co-hosts), persistent room history, AI movie recommendations
- **P2**: Browser extension to drive `sync` events from host's <video> element
- **P2**: Rate limiting on chat/sync, brute-force lockout on login

## Known Limitations
- Playback sync uses a server-side virtual timer; host manually controls it. Real OTT `<video>` element hookup requires a browser extension (future).
- WebRTC screen-share requires user gesture + HTTPS; not testable in headless browsers.
- CORS currently wildcard — tighten for production.
