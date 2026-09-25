# API Control Centre (Statusmith)

A high-performance API monitoring, status management, and control center built with Vite, TypeScript, and Bun.

---

## 🚀 Features

- **Real-Time API Monitoring**: Track endpoint statuses, latency, and uptime.
- **Statusmith Core Architecture**: Streamlined state and backend service integrations.
- **Modern Tech Stack**: Built with Vite and Bun for lightning-fast builds and minimal runtime overhead.
- **Environment Management**: Configurable via `.env` variables for seamless local and production deployments.

---

## 🛠️ Tech Stack

- **Runtime & Package Manager**: [Bun](https://bun.sh/)
- **Frontend Framework / Build Tool**: [Vite](https://vitejs.dev/) with TypeScript
- **Backend Server**: TypeScript (`server.ts`)

---

## 📁 Repository Structure

```text
├── data/           # Mock data or local persistent storage files
├── server/         # Server-side modules and utilities
├── src/            # Core frontend client source code
├── .env.example    # Environment variable template
├── bun.lock        # Bun lockfile
├── index.html      # Application entry HTML
├── server.ts       # Backend entry point
├── tsconfig.json   # TypeScript configuration
└── vite.config.ts  # Vite build configuration
