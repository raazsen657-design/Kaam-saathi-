# KaamSaathi Backend

A small Express API that stores workers, reviews, and contact messages
in JSON files on disk — real persistence, no external database required.

## Run it locally

```
cd server
npm install
cp .env.example .env
# open .env and set a real ADMIN_KEY
npm start
```

The API will run at `http://localhost:4000`. Test it:

```
curl http://localhost:4000/api/health
curl http://localhost:4000/api/workers
```

## API routes

| Method | Route                        | Auth        | Purpose                          |
|--------|-------------------------------|-------------|-----------------------------------|
| GET    | /api/workers                  | Public      | List workers (supports ?trade=, ?area=, ?search=, ?sort=) |
| GET    | /api/workers/:id               | Public      | One worker with reviews          |
| POST   | /api/workers/:id/reviews       | Public      | Submit a review                  |
| POST   | /api/contact                   | Public      | Submit contact form              |
| POST   | /api/workers                   | Admin key   | Add a worker                     |
| PATCH  | /api/workers/:id               | Admin key   | Edit a worker / toggle badges    |
| DELETE | /api/workers/:id               | Admin key   | Remove a worker                  |
| GET    | /api/messages                  | Admin key   | Read contact form submissions    |

Admin routes need a header: `x-admin-key: <your ADMIN_KEY>`

## Deploying so it's live 24/7

**Important:** this backend saves data to files on disk. Some free hosts wipe
the disk on every redeploy or restart ("ephemeral" storage) — meaning your
saved reviews could vanish after an update. Pick a host that gives you a
**persistent volume/disk**, not just any free tier. Two solid, beginner-friendly
options:

### Option A — Railway (recommended, has free persistent volumes)
1. Push this `server/` folder to a GitHub repo.
2. On railway.app, create a new project → "Deploy from GitHub repo".
3. Add a **Volume**, mounted at `/app/data`, so `data/workers.json` and
   `data/messages.json` persist across deploys.
4. Set environment variable `ADMIN_KEY` to a real secret.
5. Railway gives you a live `https://...up.railway.app` URL — that's your
   `API_BASE` for the frontend (see below).

### Option B — Render (Web Service + paid persistent disk)
1. Push `server/` to GitHub.
2. New → Web Service on render.com, connect the repo.
3. Build command: `npm install`   Start command: `npm start`
4. Add a **Disk**, mounted at `/opt/render/project/src/data`, so data survives.
   (Render's disks require a paid instance — the free tier is ephemeral.)
5. Set `ADMIN_KEY` in the Environment tab.

### Connecting the frontend
Once deployed, open `app/index.html`, find the line near the top of the
`<script>` block:

```js
const API_BASE = "http://localhost:4000";
```

Change it to your live URL, e.g.:

```js
const API_BASE = "https://kaamsaathi-production.up.railway.app";
```

Then redeploy/re-host the frontend files. The app will now read and write
real, permanent data.

## Growing beyond this

This file-based setup comfortably handles a small directory (tens to a few
hundred workers, light traffic). If the app grows a lot, the natural next
step — without rewriting the API shape — is swapping the JSON file reads/writes
for a real database (PostgreSQL is a common, free-tier-friendly choice via
Supabase or Neon).
