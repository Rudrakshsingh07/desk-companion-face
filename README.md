# Desk Companion

Desk Companion is a local-first “kiosk” web app for a desk/laptop setup:

- **Presence → authenticate**: a lightweight on-device motion detector watches the webcam; when someone appears, the UI captures a frame once and asks the backend to recognize the face.
- **Locked vs authenticated**: unrecognized users see a locked screen with “Retry” or “Manual Login”.
- **Dashboard**: authenticated users get a “macropad-style” control panel (commands), basic session analytics, and a notifications panel.
- **Admin panel**: admins can create/delete users (including capturing/uploading a face image) and view analytics stats.

This repo contains:

- **Frontend**: Vite + React + TypeScript + Tailwind + shadcn-ui
- **Backend**: FastAPI (Python) providing face recognition, user management, analytics logging, and “command” endpoints

## Quick start (dev)

### Prerequisites

- **Node.js + npm** (for the frontend)
- **Python 3.10+** (for the backend)
- **System deps for `face_recognition`**: you may need OS packages for `dlib`/compilers depending on your distro.
- **Optional OS tools**:
  - **KDE Connect** (`kdeconnect-cli`) for notification feed + remote command sharing
  - **Screenshot tool** for “Capture Inspiration”: `grim` (Wayland) / `gnome-screenshot` / `scrot` / ImageMagick `import`

### 1) Run the backend (FastAPI)

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

On first run, the backend creates:

- `known_faces/` (per-user face images)
- `logs/unknown/` (unknown recognition attempts)
- `analytics.db` (SQLite: users + event log)

### 2) Run the frontend (Vite)

In another terminal:

```bash
npm install
npm run dev -- --port 8080
```

The frontend proxies `/api/*` to `http://127.0.0.1:8000/*` in dev (see `vite.config.ts`), so API calls can use `/api/...` without CORS headaches.

### Run both at once

```bash
npm run dev:full
```

## Configuration

### Frontend runtime config (no rebuild needed)

Edit `public/config.js`:

- **`LAPTOP_IP` / `LAPTOP_PORT`**: used for production builds to reach the API server
- **`MOTION_SENSITIVITY`**: controls how sensitive “presence detection” is
- **`SESSION_TIMEOUT_SECONDS`**: auto-logout after inactivity

In dev, the API base is `/api` (Vite proxy). In production, the API base becomes `http://${LAPTOP_IP}:${LAPTOP_PORT}` (see `src/lib/config.ts`).

### Backend device integration

Edit `main.py`:

- **`DEVICE_NAME`**: KDE Connect device name (used for optional sharing/commands)
- **`COMMANDS`**: maps command actions to OS commands (be careful—these run on the server machine)

## Using the app (high level)

- **Idle**: shows a large clock and “Watching for presence”
- **Presence**: motion detected → captures a frame → calls `POST /recognize`
- **Locked**: if not recognized, shows “UNRECOGNIZED” with Retry / Manual Login
- **Login**: manual username/password via `POST /login`
- **Dashboard**:
  - commands via `POST /command`
  - analytics widget (session counts, desk time)
  - notifications widget via `GET /notifications`
- **Admin**:
  - list users `GET /users`
  - register user (username/password/role + face image) `POST /register-user`
  - delete user `DELETE /users/{username}`

## Security notes (important)

- **Default admin**: the backend auto-creates an `admin` user with password `admin` on first run. Change/remove this before any real deployment.
- **Auth model**: this is a **local demo/prototype** auth flow (no sessions/JWTs, no HTTPS termination). Treat it as insecure on untrusted networks.
- **Biometric data**: face images are stored on disk under `known_faces/<username>/...`. Handle and distribute this repository accordingly.

## Testing & linting

```bash
npm run lint
npm test
```

## Build / preview

```bash
npm run build
npm run preview
```

Note: production builds use `public/config.js` for API network settings. Ensure it’s correct wherever you host the frontend.

## Project docs

- `PRD.md`: what the app is / isn’t, requirements, non-goals
- `ARCHITECTURE.md`: folder/file organization, key flows, and how modules interact
