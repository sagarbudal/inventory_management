# Deployment Guide — Vercel (Frontend) + Render (Backend)

## Project stack (detected)

| Layer | Framework | Entry | Package manager |
|-------|-----------|-------|-----------------|
| **Frontend** | React 19 + Vite 6 + TypeScript + Tailwind CSS 4 | `src/main.tsx`, `index.html` | npm (`package.json`) |
| **Backend** | Node.js + Express 4 + TypeScript + Mongoose (MongoDB) | `backend/src/index.ts` → `backend/dist/index.js` | npm (`backend/package.json`) |

### Not FastAPI / Python

The `backend/` folder does **not** contain FastAPI, `main.py`, `app.py`, or `requirements.txt`.  
The API is an **Express (Node.js)** server. Render must use **Node runtime**, not Python.

---

## Prerequisites

1. [MongoDB Atlas](https://cloud.mongodb.com) cluster with connection string
2. [GitHub](https://github.com) repo with this project pushed
3. [Render](https://render.com) account (backend)
4. [Vercel](https://vercel.com) account (frontend)

**MongoDB Atlas:** Network Access → allow `0.0.0.0/0` (or Render outbound IPs) so Render can connect.

---

## Part 1 — Deploy backend on Render

### Option A: Blueprint (`render.yaml`)

1. Push repo to GitHub
2. Render Dashboard → **New** → **Blueprint**
3. Connect repo — Render reads root `render.yaml`

### Option B: Manual Web Service

| Setting | Value |
|---------|--------|
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm run render-build` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/api/health` |

> **Important:** The backend is TypeScript. `npm run render-build` runs `npm install --include=dev && npm run build` so `typescript` and `@types/*` are installed even when `NODE_ENV=production` is set on Render. That produces `dist/index.js` before `npm start` runs.

> **Do not** set Root Directory to the repo root — the build must run inside `backend/` where `backend/package.json` and `tsconfig.json` live.

### Render environment variables

| Variable | Required | Example |
|----------|----------|---------|
| `MONGODB_URI` | Yes | `mongodb://user:pass@host1:27017,.../inventory_management?ssl=true&authSource=admin` |
| `MONGODB_URI_DIRECT` | No | Fallback if primary URI fails |
| `FRONTEND_URL` | Yes | `https://your-app.vercel.app` |
| `NODE_VERSION` | Recommended | `22` |
| `PORT` | Auto | Set by Render — do not override |

**Avoid:** Setting `NODE_ENV=production` on Render *before* the build completes unless you use `npm run render-build` (which installs devDependencies). If the build uses plain `npm install`, TypeScript is skipped and `dist/index.js` is never created.

After deploy, note your URL: `https://YOUR-SERVICE.onrender.com`

Verify: `curl https://YOUR-SERVICE.onrender.com/api/health`

---

## Part 2 — Deploy frontend on Vercel

| Setting | Value |
|---------|--------|
| **Framework Preset** | Vite |
| **Root Directory** | `.` (repo root) |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

### Vercel environment variables

| Variable | Required | Value |
|----------|----------|--------|
| `VITE_API_URL` | Yes | `https://YOUR-SERVICE.onrender.com` (no trailing slash) |

Do **not** set `VITE_API_PROXY_TARGET` on Vercel (local dev only).

`vercel.json` in the repo configures SPA rewrites and output directory.

---

## Part 3 — Connect frontend ↔ backend

1. Deploy **Render backend** first → copy URL
2. Set Vercel `VITE_API_URL` to that URL → redeploy frontend
3. Set Render `FRONTEND_URL` to your Vercel URL → redeploy backend (CORS)

For preview deployments, comma-separate origins:

```env
FRONTEND_URL=https://your-app.vercel.app,https://your-app-git-main-user.vercel.app
```

---

## Local development

**Terminal 1 — Backend**
```bash
cd backend
cp .env.example .env   # fill MONGODB_URI
npm install
npm run dev
```

**Terminal 2 — Frontend**
```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` to `http://localhost:3001`.

---

## Build verification

```bash
# Frontend
npm run build

# Backend
cd backend && npm install && npm run build && npm start
```

---

## API URL in frontend code

All API calls use `src/api.ts`:

```typescript
import.meta.env.VITE_API_URL
```

No hardcoded `fetch('/api/...')` in components. Localhost appears only as **dev defaults** in `vite.config.ts` (proxy) and backend `.env.example`.

---

## Files added for deployment

| File | Purpose |
|------|---------|
| `render.yaml` | Render Blueprint (Node backend) |
| `vercel.json` | Vercel build output + SPA rewrites |
| `.nvmrc` | Node 22 for Vercel/Render |
| `.env.local.example` | Local frontend env template |
| `.env.vercel.example` | Vercel env template |
| `backend/.env.example` | Local + Render backend env template |
| `DEPLOYMENT.md` | This guide |

**Not created:** `requirements.txt` — backend is Node.js, not Python/FastAPI.
