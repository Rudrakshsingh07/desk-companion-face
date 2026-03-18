# Desk Companion — Product Requirements Document (PRD)

## Overview

**Desk Companion** is a local-first desk “kiosk” app that:

- Detects *presence* via lightweight webcam motion detection in the browser
- Performs *face recognition* via a local FastAPI server
- Shows a dashboard with quick actions (“macropad” commands), basic session analytics, and device notifications
- Provides an admin panel for managing users and viewing analytics stats

The app is designed to run on a single machine (or a small trusted LAN) and prioritize responsiveness and a “hardware dashboard” feel.

## Goals

- **Fast unlock experience**: presence detection triggers face recognition automatically once per presence event.
- **Clear states**: the UI should always be in one of: idle, locked, manual login, authenticated dashboard, admin.
- **Local-first**: no mandatory cloud services; backend runs locally and stores data locally.
- **Simple admin workflow**: add/delete users and enroll a face image with minimal steps.

## Non-goals (what this app is not)

- **Not a production security system**:
  - No hardened authentication model (no sessions/JWT refresh, no MFA)
  - No secure device enrollment or tamper resistance
  - No guaranteed liveness detection (motion ≠ liveness)
- **Not a multi-tenant SaaS**:
  - No organizations, billing, roles beyond simple `admin`/`user`
  - No hosted user directory or remote identity provider integration
- **Not a full analytics platform**:
  - Analytics are minimal and local (SQLite event log + UI summaries)
  - No long-term reporting, export pipelines, or dashboards for large datasets
- **Not a smart home hub**:
  - “Commands” are simple OS-level actions defined server-side; no general plugin ecosystem
- **Not a calendar/weather dashboard**:
  - Calendar and weather features are explicitly removed from this project’s frontend API layer.

## Target users

- **Primary**: a single developer/student using a desk/laptop setup who wants a “desk companion” screen with quick actions and a simple lock/unlock flow.
- **Secondary**: demo audiences in a controlled environment.

## User stories

- **As a user**, when I sit down at my desk, the app should attempt to recognize me automatically and show my dashboard quickly.
- **As a user**, if recognition fails, I should see a locked screen and be able to retry once or use manual login.
- **As an admin**, I can add a user by entering username/password/role and capturing/uploading a face image.
- **As an admin**, I can remove a user (except the default admin user) and the system should remove their stored face images best-effort.
- **As a user**, I can run quick commands (e.g., lock, capture inspiration) from the dashboard.
- **As a user**, I can view basic “desk time” and session counts.
- **As a user**, I can view recent notifications (best-effort) if a device integration is configured.

## Functional requirements

### Presence detection

- **FR-P1**: The app starts the webcam on load (best-effort) and keeps it hidden.
- **FR-P2**: Motion detection runs locally in the browser and sets a boolean “presence detected”.
- **FR-P3**: When presence transitions to detected while the app is idle, the app performs **exactly one** automatic recognition attempt.
- **FR-P4**: If recognition fails, the app enters a locked state without spamming repeated recognition attempts.

### Face recognition

- **FR-R1**: The frontend sends a JPEG base64 frame to `POST /recognize`.
- **FR-R2**: Backend returns `{ authenticated: boolean, user_id: string }` (plus optional error/reason).
- **FR-R3**: Unknown recognition attempts are logged on disk in `logs/unknown/` (best-effort).

### Authentication states

- **FR-A1**: States include: `idle`, `locked`, `login`, `authenticated`, `admin`.
- **FR-A2**: Manual login sends username/password to `POST /login` and transitions to authenticated on success.
- **FR-A3**: Session timeout auto-logs-out an authenticated user after `SESSION_TIMEOUT_SECONDS` without activity.

### Dashboard

- **FR-D1**: Shows macropad-style command buttons; each action calls `POST /command`.
- **FR-D2**: Shows analytics widget summarizing total desk time, session count, last seen time.
- **FR-D3**: Shows a notifications widget populated from `GET /notifications` (best-effort).

### Admin panel

- **FR-AD1**: Admin panel is accessible when the authenticated user is `admin`.
- **FR-AD2**: Admin can list users via `GET /users`.
- **FR-AD3**: Admin can register users via `POST /register-user` including face image.
- **FR-AD4**: Admin can delete users via `DELETE /users/{username}` (except `admin`).

### Analytics logging

- **FR-L1**: Frontend logs events `auth_success`, `auth_fail`, `session_end` via `POST /log`.
- **FR-L2**: Backend stores events in SQLite and serves recent events via `GET /analytics`.

## UX requirements

- **UX-1**: State transitions are visually clear (idle → authenticate → dashboard or locked).
- **UX-2**: Errors should be communicated without blocking the UI (best-effort toasts/indicators).
- **UX-3**: Admin flows should provide immediate feedback on success/failure.

## Data requirements

- **Local storage**:
  - `analytics.db` (SQLite): users + events
  - `known_faces/<username>/...`: enrolled face images
  - `logs/unknown/...`: unknown attempt images
- **Retention**: no explicit retention/cleanup policy in-app (manual cleanup acceptable for this scope).

## Operational requirements

- **OR-1**: Dev mode uses Vite proxy for `/api` to `127.0.0.1:8000`.
- **OR-2**: Prod mode uses `public/config.js` for API base URL.
- **OR-3**: Backend must start even if face dirs/db do not exist (it creates them).

## Out of scope (explicit)

- Deployment automation (containers, systemd units, reverse proxies)
- TLS termination / HTTPS certificates
- Database migrations, schema versioning, multi-device sync
- High accuracy biometric tuning, liveness checks, anti-spoofing
- Full “commands” framework (permissions, sandboxing, plugins)

## Acceptance criteria (definition of done)

- App runs locally with `npm run dev:full`.
- When a face is enrolled, automatic recognition transitions idle → authenticated reliably.
- When recognition fails, app shows locked state and does not spam recognition calls.
- Manual login works for users created via admin panel.
- Admin can add/delete users and those changes reflect in the backend immediately.
- Commands endpoint receives requests from the dashboard (backend actions are best-effort).
- Analytics events are recorded in SQLite and reflected in UI summaries.

