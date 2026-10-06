# Who's Home — V2 Fixed

This is the complete replacement project with the folder structure already corrected for Next.js/Vercel.

## IMPORTANT: keep this exact folder structure

```text
home-status-app/
├── .gitignore
├── README.md
├── next.config.js
├── package.json
├── tsconfig.json
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── manifest.ts
│   ├── page.tsx
│   └── api/
│       ├── month/
│       │   └── route.ts
│       ├── names/
│       │   └── route.ts
│       └── presence/
│           └── route.ts
└── lib/
    └── redis.ts
```

Do NOT move `page.tsx`, `globals.css`, `layout.tsx`, `manifest.ts`, `route.ts`, or `redis.ts` into the repository root.

## What V2 adds

- Live household dashboard as the main screen
- Each phone can be assigned to one household profile
- One-tap **I'm home** and **I'm leaving** controls
- `/api/presence` endpoint for iPhone Shortcuts automations
- Automatic arrival/leave updates without opening the website
- Automatic refresh of household status
- Manual Home/Away override and expected return time
- Calendar/history retained as a secondary view
- Source labels for automatic, quick, and manual updates
- Home-screen/PWA metadata

## Redis compatibility

`lib/redis.ts` supports either pair of environment variables:

Current Upstash Marketplace names:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Older Vercel KV names:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

This lets you keep the existing Redis database already connected to the Vercel project.

## Safest way to replace the GitHub repo

1. Extract this ZIP on your computer.
2. Open your local GitHub Desktop repository folder for `home-status-app`.
3. Delete the incorrectly placed root-level copies such as `page.tsx`, `route.ts`, `redis.ts`, `globals.css`, `layout.tsx`, and `manifest.ts` if they are sitting beside `app` and `lib`.
4. Copy **all contents inside this extracted folder** into the local repository folder.
5. Confirm the structure matches the tree above.
6. Open GitHub Desktop.
7. Commit all changes with a message such as `Fix project structure and presence app`.
8. Click **Push origin**.
9. Vercel should automatically create a new deployment.

## iPhone automatic presence

After Vercel deploys successfully:

1. Open the deployed site on each person's iPhone.
2. Select that person's profile as **This phone**.
3. Open the app's **Automatic setup** section and copy the Arrival link.
4. In Apple Shortcuts, create a Personal Automation for **Arrive** at home.
5. Add **Get Contents of URL** and paste the Arrival link.
6. Configure it to run automatically/immediately if iOS offers that option.
7. Create a second Personal Automation for **Leave** and use the Leaving link.
8. Repeat once on each household member's phone.

The website receives only the profile's Home/Away update. It does not store a continuous GPS trail.

## Security note

This household version does not include account sign-in. Keep the deployment URL and automation links private.
