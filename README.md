# Render Pulse

Self-triggering keep-alive platform. Users submit backend URLs, an admin
approves them, and the backend pings every approved URL (plus itself) every
13 minutes so free-tier hosts like Render don't spin down from inactivity.

```
render-pulse/
  backend/    -> Node/Express + MongoDB, deploy to Render
  frontend/   -> React (Vite), deploy to Vercel
```

## How the "keeps working even after sleeping" part works

Render's free tier spins the service down after inactivity. A `setInterval`
inside the process is useless once Render has actually stopped the dyno —
nothing is running to fire it. Two things fix that:

1. **Self-ping**: every cycle, the backend makes a real outbound HTTP
   request to its own public URL (`SELF_URL` + `/api/health`). That's a
   genuine inbound request from Render's point of view, so it resets
   Render's inactivity timer and keeps the service from sleeping again
   before the next cycle.
2. **Resume-on-boot**: every completed cycle timestamp is saved to MongoDB
   (`Meta.lastPulseAt`), not just kept in memory. Whenever the process
   starts — first deploy, a manual restart, or Render waking back up after
   you paused/stopped it — `server.js` checks that timestamp. If it's
   missing or older than one interval, it immediately runs a full ping
   cycle (self + all approved URLs) before falling back to the normal
   `*/13 * * * *` cron schedule. So even if you stop the Render service for
   a while and start it again later, the first thing it does is catch up
   and ping everything, then resumes the regular schedule.

Keep in mind: if Render fully stops the service, *nothing* pings it back to
life — something external has to hit it once (you visiting it, a user
loading the frontend, a Render health check, etc.) to wake it up initially.
After that first wake-up, the self-ping loop takes over and keeps it awake.

## Backend setup (local)

```bash
cd backend
cp .env.example .env    # fill in MONGO_URI, JWT_SECRET, etc.
npm install
npm run dev
```

Key env vars (see `.env.example` for the full list):

- `MONGO_URI` — your MongoDB connection string (Atlas works fine)
- `JWT_SECRET` — any long random string
- `FRONTEND_URL` — comma-separated list of allowed origins for CORS
  (e.g. `http://localhost:5173,https://your-app.vercel.app`)
- `SELF_URL` — the backend's own public URL. Locally this doesn't matter
  much; **on Render, set it to your Render service's public URL**
  (e.g. `https://render-pulse-backend.onrender.com`)
- `PING_INTERVAL_MINUTES` — defaults to `13`
- `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` — optional. If set,
  that account is auto-created/promoted to admin on boot. Otherwise, just
  register a normal account and flip `isAdmin: true` on that user's
  document directly in MongoDB.

## Frontend setup (local)

```bash
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev
```

## Deploying

**Backend -> Render**
1. Push `backend/` to a repo (or point Render at the repo root with
   `backend` as the root directory).
2. New Web Service, build command `npm install`, start command `npm start`.
3. Set the same env vars as `.env.example` in Render's dashboard —
   critically `SELF_URL` must be the Render URL Render gives you, and
   `FRONTEND_URL` must include your Vercel domain.

**Frontend -> Vercel**
1. Push `frontend/` to a repo (or point Vercel at the repo root with
   `frontend` as the root directory).
2. Framework preset: Vite.
3. Set `VITE_API_URL` in Vercel's env vars to
   `https://your-backend.onrender.com/api`.

**Database -> MongoDB Atlas**
1. Create a free cluster, get the connection string, put it in `MONGO_URI`
   on the backend.
2. Whitelist `0.0.0.0/0` in Atlas network access (or Render's specific IPs)
   so Render can connect.

## Becoming an admin

Register a normal account through the UI, then in MongoDB (Atlas UI,
Compass, or `mongosh`) find that user in the `users` collection and set:

```json
{ "isAdmin": true }
```

Log out and back in (or just reload — `/auth/me` is checked on load) and
the Admin link/dashboard becomes available.

## API summary

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/urls`, `POST /api/urls`, `DELETE /api/urls/:id` — user's own
  submissions, capped at 2 on the free tier
- `GET /api/admin/urls`, `PATCH /api/admin/urls/:id/approve`,
  `PATCH /api/admin/urls/:id/reject`, `POST /api/admin/urls` (admin add,
  auto-approved, no cap), `DELETE /api/admin/urls/:id`
- `GET /api/admin/users`
- `GET /api/admin/status` — last pulse time, counts
- `POST /api/admin/trigger-now` — force a ping cycle immediately
- `GET /api/health` — also the self-ping target
