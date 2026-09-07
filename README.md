# Who's Home

A small household status app: tap a date, see (or set) whether each of the three of you is home or away that day, with who updated it, when, and — if away — roughly when they'll be back.

Everyone who opens the deployed URL sees the same live data, because it's stored in a shared database (Vercel KV), not on any one phone.

## 1. Get the code running locally (optional but recommended first)

You'll need [Node.js](https://nodejs.org) installed.

```bash
cd home-status-app
npm install
```

## 2. Create the database

Vercel's old built-in "KV" product has been discontinued — databases now come through Vercel's Marketplace instead, typically backed by Upstash Redis. It works the same way for this app, just a different path to set up:

1. Go to [vercel.com](https://vercel.com) and create a free account if you don't have one.
2. Create a new project by importing this folder (see step 3), or first push it to a GitHub repo and import that.
3. In your Vercel project, go to the **Storage** tab → **Create Database** (or **Browse Marketplace**, depending on what you see) → search for **Redis** → choose the **Upstash** integration.
4. Follow the prompts to create a free Redis database and connect it to your project. Vercel will automatically add the required environment variables (`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`) to your project — you don't need to copy these yourself.

## 3. Deploy to Vercel

**Option A — GitHub (recommended):**
1. Push this folder to a new GitHub repo.
2. In Vercel, click **Add New → Project**, import that repo.
3. Attach the KV database from step 2 if it wasn't already connected.
4. Click **Deploy**. You'll get a URL like `home-status-yourname.vercel.app`.

**Option B — Vercel CLI:**
```bash
npm install -g vercel
vercel login
vercel
```
Follow the prompts, then run `vercel --prod` to deploy for real. Make sure to link the KV database in the Vercel dashboard afterward if it doesn't happen automatically.

## 4. Pull environment variables for local testing (optional)

```bash
vercel link
vercel env pull .env.local
npm run dev
```
Then open `http://localhost:3000`.

## 5. Share it

Send the deployed URL (e.g. `https://home-status-yourname.vercel.app`) to your brother and his wife. All three of you can bookmark it or add it to your phone's home screen — it works like a lightweight app from there.

## How it works

- Each month's data is stored as a single record in KV, keyed like `month-data-2026-09`, containing every day that has an entry that month.
- Profile names are stored separately under `profile-names` and apply across all days.
- Tap "rename" on any profile to swap "Person 1/2/3" for your real names — do this once and it's shared for everyone.
