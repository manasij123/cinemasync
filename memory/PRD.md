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
- [x] **[2026-04-19] Email-verify fallback link** — Resend sandbox can't send to non-owner addresses until domain DNS-verified, so `/api/auth/send-verify-email` now returns `{delivered, fallback_link, message}`. Profile page shows "Open verification link" button when delivery fails so user can still verify instantly. 13/13 tests pass.
- [x] **[2026-04-19] Permanent account delete** — `DELETE /api/account` requires password + `confirm="DELETE MY ACCOUNT"`; admin is protected. Purges rooms they host, messages, notifications (incoming & sent), email tokens, room history, soft-deletes files, strips friendships. Profile "Danger Zone" has a two-field confirmation form.
- [x] **[2026-04-19] 30-day inactivity auto-delete** — tracked via `last_active_at` (stamped on login + `/auth/me`). Daily background sweep (`_inactivity_sweeper_loop`) purges non-admin users whose last activity is older than `INACTIVE_THRESHOLD_DAYS` (env, default 30). Falls back to `created_at` for accounts that never hit `/auth/me`.
- [x] **[2026-04-19] Admin bulk-delete users** — `POST /api/admin/users/bulk-delete` accepts `{user_ids: [...]}` (up to 500), filters out self + other admins, runs the same full `_purge_user` cascade per target. Admin panel Users tab now has per-row checkboxes + header "select all visible" checkbox. Selections persist across search (previously selected users stay selected even when filtered out). Confirmation modal shows preview of selected users and requires typing "DELETE" to proceed.
- [x] **[2026-04-19] Role-split Dashboard** — KPI row + LineChart/Doughnut/BarChart are gated behind `user.is_admin`. Regular users get a clean **`UserSummary`** hero card with personalized greeting + 4 icon-driven info tiles (New invitations · Live rooms · Friends · Past rooms) and a standalone Invitations inbox. All functional data is preserved, just no analytics visuals for non-admins.
- [x] **[2026-04-19] `cinemasync.co.in` verified on Resend** — DNS records (DKIM, SPF, MX, DMARC) added to GoDaddy, Resend Tokyo region (ap-northeast-1). `SENDER_EMAIL` flipped from sandbox `onboarding@resend.dev` to production `no-reply@cinemasync.co.in`. Verified: test email to brand-new example.com address returns `delivered:true, fallback_link:null`.
- [x] **[2026-04-19] End Room (Terminate Session)** — new `DELETE /api/rooms/{id}` endpoint (host-only, 403 for non-host). Broadcasts `{type:'room-ended', by_name, room_id, ended_at}` over WS then closes all sockets for that room. Purges `db.rooms`, `db.messages`, `db.notifications(type=room-invite)`; keeps `room_history` (flagged inactive via `/rooms/history`). WatchRoom header now shows a themed `watch-end-room-button` for host only, with confirm dialog. Non-host clients auto-redirect to `/dashboard` with toast "Host ended the watch party". 9/9 pytest (REST + WS E2E) pass.
- [x] **[2026-04-19] Room Name = Platform · Custom Title** — `CreateRoomIn` schema accepts optional `custom_title` (max 80). Dashboard `CreateRoomForm` replaces the free-text Room Name field with a "What are you watching?" input (`create-room-custom-title-input`), live-previews the final room name `PLATFORM · TITLE` (or `PLATFORM WATCH PARTY` when empty) at `create-room-final-name`. Backend echoes `custom_title` on create + GET. Backward-compat: field is optional.
- [x] **[2026-04-19] Recent-rooms bulk kill + admin alerts** — Dashboard "Recent rooms" gets a `history-manage-button` that toggles manage mode with per-card checkboxes (`history-select-{id}`), a live selection count, and `history-bulk-delete-button`. Backend `DELETE /api/rooms/history/{id}` + `POST /api/rooms/history/bulk-delete`: **cascade** when the caller was the host (nukes room + messages + invite notifications + every user's room_history + closes live WS sockets) and fires a `type:'admin-alert', subtype:'room-killed'` notification for every OTHER admin. Guests can just remove their own Recent-row without cascade. Admin panel gets a new **Alerts** tab (`admin-tab-alerts`) listing alerts with per-row `OK` dismiss and a "Dismiss all" action. 10/10 pytest + full frontend automation pass.
- [x] **[2026-04-19] Live + Recent as side-by-side Folder tiles** — Dashboard no longer stacks the Live-now grid and Recent grid vertically. A single compact `dashboard-folders-section` shows two clickable folder tiles (`folder-tile-live` pink + `folder-tile-recent` purple) with count, preview platform logos, and a folder-tab accent. Clicking one toggles an inline drawer below revealing the full grid (LiveRoomCards or HistoryCards with manage-mode intact). Empty sides render disabled. Manage mode auto-resets when drawer closes. All existing data-testids preserved.
- [x] **[2026-04-19] In-stage Custom player + Share-tab guide** — Two complementary upgrades to the WatchRoom share flow: (1) **Custom platform** rooms now render a URL input + "Launch here" button on the intermission stage (`watch-custom-url-input`, `watch-custom-launch-button`). Pasted YouTube/Vimeo/`.mp4`/Twitch links are normalized via `toEmbedUrl()` and played in an in-stage iframe (`watch-custom-iframe`, sandboxed + `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`) with a "Change URL" button for the host. When the host then hits Share, `getDisplayMedia` is called with `displaySurface: "browser"` so Chrome pre-selects tab mode → browser's "Stop sharing" bar appears only on the shared tab (not over CinemaSync). (2) For OTT platforms (Netflix / Prime / JioHotstar / Hoichoi / Addatimes / ZEE5), clicking Share now shows a themed 3-step `share-guide-modal` explaining "Share only the OTT tab (not whole screen)" before the browser picker opens, so guests always get clean video and the ribbon never covers either party.
- [x] **[2026-04-19] Brand logo in header** — New SVG mark at `/cinemasync-logo.svg` (user-uploaded). Displayed in sidebar (`w-14 h-14`) + top navbar (`w-12 h-12`) with clean rounded tile, 92% inner fit. Also wired as browser favicon + apple-touch-icon.
- [x] **[2026-04-19] Real-time Custom URL sync** — Host sets/changes/clears the in-stage iframe URL → WS `{type:"custom-url", url, embed}` event broadcast to all peers → guests automatically load the same embed, toast "{Host} loaded a new video". Persisted on `rooms.custom_url` + `rooms.custom_embed` so late-joiners hydrate via `/rooms/{id}` on load. Rate-limited 6/5s per user; host/co-host only.
- [x] **[2026-04-19] Themed ConfirmDialog** — New `/app/frontend/src/components/ConfirmDialog.jsx` wraps shadcn `AlertDialog` with brand palette (pastel purple primary, neon pink danger tone). Replaces native `window.confirm` on two critical flows: **End Room** (`end-room-confirm` in WatchRoom) and **Bulk-Kill Recent** (`bulk-kill-confirm` in Dashboard). Allerta Stencil title + contextual description + Cancel / Confirm actions with loading state.
- [x] **[2026-04-19] server.py refactor (Phase 1)** — Extracted Pydantic request models to `/app/backend/models.py` (84 lines) and auth utilities — password hashing, JWT, cookie, `public_user`, `generate_unique_id`, and a `make_auth_deps(db)` factory for `get_current_user` / `require_admin` / `get_user_from_token_str` — to `/app/backend/auth_utils.py` (126 lines). `server.py` trimmed from 1672 → 1514 lines with zero regressions; all 8 key endpoints (auth/me, rooms/active, rooms/history, friends, notifications, admin/stats, rtc/ice, room CRUD) return 200.
- [x] **[2026-04-21] Splash Intro — cinema entry edition** — `SplashIntro.jsx` rebuilt around pure-CSS `@keyframes` drawing of two SVG masks (no rAF jitter). Beat 1: C film-reel reveals anti-clockwise (1.7s handwriting); Beat 2: S arrows reveal behind C as one continuous curve (1.6s); Beat 3: composition flies into the empty Navbar logo slot via a GSAP `power3.inOut` tween and the real header logo cross-fades in so the drawn mark becomes the header mark. Uses user-provided 100×100 PNG assets (`/cinemasync-c-logo.png`, `/cinemasync-s-arrows.png`). Tiny 50×50 viewBox + `shapeRendering="optimizeSpeed"` + `willChange` + `force3D` for smoothness. Ambience: film-strip sprockets scrolling on both edges, letter-box bars sliding in, corner marquee bulbs, rotating projector ray, soft neon glow pulse, film-grain flicker — all pure CSS, started AFTER the reveal completes so GPU budget during drawing is dedicated 100% to the stroke. Stage 260px (documented knob `STAGE_PX`).
- [x] **[2026-04-21] WebRTC screen-share smoothness pass** — `WatchRoom.jsx` `doStartShare` now caps capture at 1080p/30fps + `contentHint="motion"`. `createOfferTo` sets `encodings[0].maxBitrate=2_500_000` + `maxFramerate=30` + `degradationPreference="maintain-framerate"`. Receiver sets `playoutDelayHint=0.4` + `jitterBufferTarget=400` so TURN jitter is absorbed without visible stutter on guest side.
- [x] **[2026-04-21] App-wide responsive fix** — `index.css` `html, body, #root { overflow-x:hidden; max-width:100% }`. `AppShell` main is now `min-w-0 max-w-full overflow-x-hidden`. Landing hero: blurred background (`filter:blur(6px) scale(1.06)`), `px-4 sm:px-6 md:px-10`, h1 sized `text-[2.25rem] sm:text-6xl lg:text-7xl`, CTAs stack vertically below `sm`. Feature/Context/Footer sections mobile padding `px-4`. Admin users table wrapped with mobile-edge-bleed `-mx-4 px-4 sm:mx-0 sm:px-0` + `min-w-[640px]` so the table scrolls inside its container while the page itself does not. Lobby main + WatchRoom main responsive padding. Testing agent (`/app/test_reports/iteration_8.json`): 9 pages × 3 viewports (375 / 768 / 1280) all pass `documentElement.scrollWidth === innerWidth`.


## Verified (2026-04-18)
- Backend: 14/14 tests pass (upload happy path + 400 invalid type + 413 oversize + 401 unauth + regression auth/rooms/friends/admin)
- Frontend: all 6 platform logo tiles render with naturalWidth>0; Profile upload end-to-end works.

## Prioritized Backlog
- **P2**: Refactor `/app/backend/server.py` (>1640 lines) into `routes/{auth,rooms,friends,admin,notifications}.py` modules
- **P2**: Migrate WebRTC Mesh → Metered SFU for >8-person watch parties
- **P2**: AI live subtitles / translation (OpenAI Whisper STT + Gemini translate)
- **P2**: Replace `window.confirm` End Room + Bulk-Kill dialogs with themed shadcn `AlertDialog`
- **P2**: Pause AlertsTab polling when `document.hidden` for background savings
- **P2**: Tighten CORS `allow_origins` from `*` to production domain list
- **P3**: Browser extension to drive real-OTT `<video>` sync events

## Known Limitations
- Playback sync uses a server-side virtual timer; host manually controls it. Real OTT `<video>` element hookup requires a browser extension (future).
- WebRTC screen-share requires user gesture + HTTPS; not testable in headless browsers.
- CORS currently wildcard — tighten for production.
