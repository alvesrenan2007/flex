# FLEX (Flexible Learning Endpoint X-filter)

> A lightweight, cloud-managed endpoint security agent and real-time control plane designed to enforce dynamic, default-deny web whitelisting in classroom environments.

---

## Overview

**FLEX** is an open-source cybersecurity project built to address modern classroom integrity challenges—specifically preventing unintended LLM utilization during exams, blocking unauthorized external downloads, and mitigating perimeter exploration risks. 

Unlike traditional enterprise proxies that require complex network infrastructure, FLEX utilizes a decentralized **endpoint agent paired with a WebSocket-driven control plane**. The instructor manages an active whitelist via a React dashboard, while student clients locally enforce traffic routing and report real-time connection telemetry.

---

## System Architecture

```
┌─────────────────────────┐          WebSocket / HTTP          ┌─────────────────────────┐
│     Student Client      │ ◄──────────────────────────────►   │     ExpressJS Server    │
│  (Tauri / Desktop App)  │         (Heartbeat & Sync)         │    (Backend Control)    │
└───────────┬─────────────┘                                    └───────────┬─────────────┘
            │                                                              │
            ▼                                                              ▼
┌─────────────────────────┐                                    ┌─────────────────────────┤
│  Local Loopback Proxy   │                                    │    MySQL Database       │
│  (Enforces Whitelist)   │                                    │  (Rooms, Whitelists,    │
└─────────────────────────┘                                    │       Logs)             │
                                                               └─────────────────────────┘
```

---

## Technology Stack

* **Client Agent:** Tauri (Rust + Web Frontend) with a local loopback traffic interceptor.
* **Backend Server:** Node.js & ExpressJS (REST API + WebSocket server for live state management).
* **Database:** MySQL (managed via a lightweight ORM or raw SQL for session state, rooms, and audit logs).
* **Instructor Dashboard:** React + Vite web app providing room management, participant monitoring, and real-time whitelist updates.

---

## Repository Structure

```text
flex-project/
├── server/
├── client/
│   ├── src/                # Student desktop app UI (Tauri / React)
│   └── proxy/              # Local loopback proxy interceptor logic
└── dashboard/              # Instructor web dashboard (React / Vite)
```

---

## Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* npm or yarn
* Rust toolchain (if compiling the Tauri student client)

### 1. Setting Up the Backend Server
```bash
cd server
npm install
# Copy .env.example to .env and configure MySQL and JWT_SECRET
npm start
# Or use the development watcher
npm run dev
```

The HTTP and Socket.IO contract for the dashboard and client is documented in
[server/docs/API.md](server/docs/API.md).

### 2. Running the Instructor Dashboard
```bash
cd dashboard
npm install
npm run dev                 # http://localhost:8080
```

Configure `dashboard/.env` with `VITE_API_URL` if the API is not running at
`http://localhost:3000`. See [dashboard/README.md](dashboard/README.md) for
dashboard setup and [server/docs/API.md](server/docs/API.md) for the API
contract.

### 3. Running the Student Client
```bash
cd client
npm install
# Run Tauri development window
npm run tauri dev
```

---

## Core Features

* **Default-Deny Enforcement:** Automatically intercepts traffic and blocks domains absent from the active classroom whitelist.
* **Real-Time Synchronization:** WebSocket architecture instantly pushes whitelist modifications from the teacher panel to all connected student endpoints.
* **Tamper Detection (Heartbeat Monitoring):** Continuously tracks client liveliness; abrupt disconnections (e.g., process termination) are instantly flagged on the teacher's audit panel.
* **Low-Friction Deployment:** Standalone cross-platform executables requiring zero network-level router modifications.

---

## Contributing

This is an academic project, created specifically for the conclusion of a cybersecurity course, thus we are not looking for contributions at the moment. However, feel free to fork the project!

---

## License

Distributed under the **MIT License**. See `LICENSE` for more information.
