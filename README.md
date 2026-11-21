# FLEX (Flexible Learning Endpoint X-filter)

> A lightweight, cloud-managed endpoint security agent and real-time control plane designed to enforce dynamic, default-deny web whitelisting in classroom environments.

---

## Overview

**FLEX** is an open-source cybersecurity project built to address modern classroom integrity challenges—specifically preventing unintended LLM utilization during exams, blocking unauthorized external downloads, and mitigating perimeter exploration risks.

Unlike traditional enterprise proxies that require complex network infrastructure, FLEX pairs a **cross-platform Tauri/Rust desktop agent** with a **Socket.IO-driven control plane**. Instructors manage classrooms and domain whitelists in real time via a React dashboard, while student endpoints configure OS-level loopback routing (`127.0.0.1:8080`) and enforce HTTP `CONNECT` filtering locally.

---

## System Architecture

```text
┌────────────────────────────────┐       REST API / Socket.IO       ┌────────────────────────────────┐
│       Instructor Dashboard     │ ◄──────────────────────────────► │        ExpressJS Server        │
│    (React 19 + Vite Web App)   │      (JWT Auth & Room Control)   │    (Node.js + Socket.IO API)   │
└────────────────────────────────┘                                  └───────────────┬────────────────┘
                                                                                    │
┌────────────────────────────────┐           Socket.IO              ┌───────────────▼────────────────┐
│     Student Desktop Client     │ ◄──────────────────────────────► │         MySQL Database         │
│   (Tauri v2 + Rust + React)    │     (Live Whitelist Sync)        │  (Professors & Whitelist       │
└───────────────┬────────────────┘                                  │            Presets)            │
                │                                                   └────────────────────────────────┘
                ▼
┌────────────────────────────────┐
│   Local Loopback HTTP Proxy    │
│ (127.0.0.1:8080 / sysproxy)    │
│  Enforces Default-Deny Rules   │
└────────────────────────────────┘
```

---

## Repository Structure

```text
.
├── client/                     # Student desktop endpoint agent (Tauri v2 + Rust + React)
│   ├── releases/               # Compiled release binaries (e.g., flex-client-0.1.0-linux)
│   ├── src/                    # Student UI (room join & proxy toggle)
│   └── src-tauri/              # Rust backend, OS proxy hooks (sysproxy), & TCP CONNECT filter
│       └── src/
│           ├── lib.rs          # Tauri commands, shared RwLock whitelist state, & cleanup hooks
│           ├── main.rs         # Desktop entry point
│           └── proxy.rs        # Local HTTP proxy listener (127.0.0.1:8080) & Socket.IO client
├── dashboard/                  # Instructor control panel (React 19 + Vite)
│   └── src/
│       ├── api/                # HTTP fetch wrapper & Socket.IO teacher room emitters
│       ├── auth/               # JWT session context (sessionStorage)
│       ├── components/         # Layout, theme switcher (light/dark), & route guards
│       └── pages/              # Login, Register, Room Management, Presets, & Profile
├── server/                     # Backend control plane (Node.js + Express + Socket.IO)
│   ├── docs/API.md             # Full HTTP & Socket.IO API contract
│   ├── src/
│   │   ├── controllers/        # Auth, Professor, & Room controllers
│   │   ├── models/             # Sequelize models (Professor, WhitelistPreset)
│   │   ├── repositories/       # Data access layer
│   │   ├── services/           # Business logic & domain validation
│   │   └── sockets/            # Real-time RoomManager & Socket.IO event handlers
│   └── test/                   # Node native test suites (sockets & whitelist presets)
└── LICENSE                     # MIT License
```

---

## Technology Stack

* **Student Client (`client/`):** Tauri v2, Rust (`tokio`, `sysproxy`, `rust_socketio`), and React 18 + Vite.
* **Backend Server (`server/`):** Node.js, Express 4, Socket.IO 4, Sequelize ORM, MySQL (`mysql2`), JWT (`HS256`), and `bcrypt`.
* **Instructor Dashboard (`dashboard/`):** React 19, React Router 7, Socket.IO Client 4, and Vite 6.

---

## Core Features

* **Default-Deny Local Proxy:** Intercepts outgoing `CONNECT` requests on `127.0.0.1:8080` and blocks any domain (or subdomain) not explicitly present in the active classroom whitelist with `403 Forbidden`.
* **Fail-Safe OS Proxy Cleanup:** Automatically configures OS system proxy settings when enabled and restores normal network routing when toggled off or upon application exit (`RunEvent::Exit`).
* **Real-Time Classroom Sync:** Uses Socket.IO rooms (`room:create`, `room:join`, `room:whitelist:update`, `room:close`) to push whitelist updates instantaneously to all connected student agents.
* **Reusable Whitelist Presets:** Instructors can create, edit, and store reusable domain lists in MySQL and apply them to active rooms on the fly.
* **Live Participant & Audit Tracking:** Monitors active student connections in real time (with 5-character alphanumeric room codes) and logs join/leave events on the instructor dashboard.

---

## Getting Started

### Prerequisites
* **Node.js** (v20.19+ or v22.12+ recommended) and **npm**
* **MySQL** server instance
* **Rust toolchain** (`cargo`, `rustc`) & Tauri system dependencies (required to build/run the student desktop client)

### 1. Backend Server (`server/`)
```bash
cd server
npm install
cp .env.example .env
```

Configure `server/.env` with your MySQL credentials and a strong `JWT_SECRET` (e.g., via `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`):
```env
PORT=3000
NODE_ENV=development
JWT_SECRET=replace-with-a-random-secret
JWT_EXPIRES_IN=1d
DB_HOST=localhost
DB_PORT=3306
DB_NAME=api
DB_USER=root
DB_PASS=
```

Start the server or run the test suite:
```bash
npm run dev     # Starts server with --watch on http://localhost:3000
npm test        # Runs Node.js test suite
```

> For full endpoint and Socket.IO event documentation, see [`server/docs/API.md`](server/docs/API.md).

### 2. Instructor Dashboard (`dashboard/`)
```bash
cd dashboard
npm install
cp .env.example .env
```

Set `VITE_API_URL` in `dashboard/.env` to point to your backend server (defaults to `http://localhost:3000` in `.env.example`):
```env
VITE_API_URL=http://localhost:3000
```

Run the dashboard:
```bash
npm run dev     # Accessible at http://localhost:8080
```

> For dashboard-specific implementation notes, see [`dashboard/README.md`](dashboard/README.md).

### 3. Student Endpoint Client (`client/`)
```bash
cd client
npm install
npm run tauri dev
```

*(Note: Ensure the control plane URL in `client/src-tauri/src/proxy.rs` points to your active backend server endpoint before compiling a release build via `npm run tauri build`.)*

---

## Contributing

This is an academic capstone project developed for the conclusion of a cybersecurity course. While external pull requests are not currently being accepted, feel free to fork and explore the codebase.

---

## License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
