# Desk Companion — Architecture

## High-level architecture

Desk Companion is split into two processes:

- **Frontend (Vite + React)**: renders the kiosk UI, starts the webcam, detects presence, and calls the backend API.
- **Backend (FastAPI)**: performs face recognition, stores users + analytics in SQLite, and exposes API endpoints for the UI.

In development, the frontend uses a Vite proxy so the UI can call `/api/...` and have it forwarded to `http://127.0.0.1:8000/...` (`vite.config.ts`).

## Runtime flow (main user journey)

### 1) Presence → recognition (frontend)

- `src/hooks/useMotionDetector.ts`
  - starts the webcam (`getUserMedia`)
  - performs simple motion-based presence detection by comparing frames
- `src/hooks/useAppState.ts`
  - when state is `idle` and presence becomes true, it triggers recognition **once**
  - captures a frame from the hidden canvas and calls `recognizeFace(...)`
  - transitions UI to `authenticated` or `locked`

### 2) Recognition (backend)

- `main.py`
  - loads known face encodings from `known_faces/<username>/*.jpg` on startup
  - `POST /recognize` compares the incoming encoding against known encodings
  - saves unknown attempts to `logs/unknown/*.jpg` (best-effort)

### 3) UI states (frontend)

`src/pages/Index.tsx` is the state router:

- `idle` → `src/components/IdleScreen.tsx`
- `locked` → `src/components/LockedScreen.tsx`
- `login` → `src/components/LoginScreen.tsx`
- `authenticated` → `src/components/DashboardScreen.tsx`
- `admin` → `src/components/AdminScreen.tsx`

## Repository layout

### Root

- `main.py`: FastAPI app (recognition, users, analytics, commands, notifications)
- `requirements.txt`: Python dependencies for the API
- `package.json`: frontend dependencies + scripts
- `vite.config.ts`: Vite config (dev server, `/api` proxy, PWA)
- `index.html`: Vite entry HTML
- `tailwind.config.ts`, `postcss.config.js`: styling pipeline
- `vitest.config.ts`, `src/test/*`: frontend tests
- `public/`: static assets served as-is
  - `config.js`: runtime config injected as global `CONFIG` (no rebuild required)
  - `manifest.json`, `robots.txt`: PWA/static metadata

### `src/` (frontend)

- `src/main.tsx`: React bootstrap
- `src/App.tsx`: router setup (React Query, UI providers, routes)
- `src/pages/`
  - `Index.tsx`: app state → screen selection (the “kiosk shell”)
  - `NotFound.tsx`: catch-all route
- `src/hooks/`
  - `useMotionDetector.ts`: webcam + motion-based presence
  - `useAppState.ts`: finite state machine for idle/locked/login/auth/admin
  - `use-toast.ts`, `use-mobile.tsx`: UI utilities
- `src/lib/`
  - `config.ts`: reads `CONFIG`, decides API base (`/api` in dev, LAN URL in prod)
  - `api.ts`: typed API calls (recognize, login, register user, users list, delete, log events)
  - `utils.ts`: shared frontend utilities (Tailwind helper, etc.)
- `src/components/`
  - Screens:
    - `IdleScreen.tsx`, `LockedScreen.tsx`, `LoginScreen.tsx`, `DashboardScreen.tsx`, `AdminScreen.tsx`
  - Widgets:
    - `CommandsWidget.tsx`: macropad-like actions calling `POST /command`
    - `AnalyticsWidget.tsx`: session summary + overlay charts (UI only; uses session state)
    - `NotificationsWidget.tsx`: polls notifications endpoint and shows overlay
    - `ClockDisplay.tsx`: clock UI
  - `components/ui/`: shadcn-ui component library building blocks
- `src/index.css`, `src/App.css`: global styles and theme (“metal/macropad” look)
- `src/vite-env.d.ts`: Vite types

### Backend runtime data (created at runtime)

These are created/used by `main.py` and are **not** part of the source tree by default:

- `analytics.db`: SQLite database
  - `users` table: `username`, `password_hash`, `role`, `created_at`
  - `events` table: `event`, `user_id`, `timestamp`
- `known_faces/`: per-user face images (used to compute encodings)
- `logs/unknown/`: unknown recognition attempt images

## Backend API surface (as implemented)

All routes are defined in `main.py`.

- `GET /`: health-ish root message
- `GET /health`: returns counts (known users, encodings loaded, unknown attempts)
- `POST /recognize`: face recognition from base64 image payload
- `POST /reload-faces`: reload known face images from disk
- `POST /register-face`: add a face image for an existing/new username (disk + reload)
- `POST /register-user`: add user (SQLite) + face image (disk) + reload
- `GET /users`: list users from SQLite
- `DELETE /users/{username}`: delete user from SQLite + best-effort delete their `known_faces` dir
- `POST /login`: username/password check against SQLite hash
- `POST /log`: write an analytics event row
- `GET /analytics`: fetch latest events (currently last 100)
- `GET /notifications`: best-effort KDE Connect notifications feed (otherwise empty)
- `POST /command`: run a predefined action; includes `capture_inspiration` screenshot flow

## Key design decisions (to avoid confusion)

- **Runtime config is in `public/config.js`**, not `.env`. It’s loaded as a global `CONFIG` so you can change IP/ports without rebuilding.
- **Dev API base is `/api`** (proxy). **Prod API base is LAN URL** from config.
- **Presence detection is intentionally lightweight** (pixel diffs) to trigger recognition once and avoid constant face recognition calls.
- **Analytics widget charts are UI-only**; persistent analytics are recorded by the backend via event logging.
- **Commands are server-controlled**: the UI only sends `{ action }`; the server maps actions to OS commands. This keeps the UI simple but requires caution on the server host.

