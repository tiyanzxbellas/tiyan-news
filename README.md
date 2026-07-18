# WeNews

Portal berita terkini dengan mode gelap dan kategori.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Deploy to Netlify

This project is set up for Netlify out of the box:

- The frontend builds with `npm run build:netlify` (Vite) into `dist/`, which Netlify serves as a static site.
- The Express-only API routes (`/api/news`, `/api/news/detail`) from `server.ts` have been ported to Netlify Functions in `netlify/functions/` (`news.ts`, `news-detail.ts`), since Netlify doesn't run a persistent Express server.
- The `/file/*` image/HTML proxy runs as a Netlify Edge Function (`netlify/edge-functions/proxy.ts`), already wired up.
- Routing (API redirects + SPA fallback) is configured in `netlify.toml`.

**Steps:**

1. Push this project to a Git repo (GitHub/GitLab/Bitbucket), or drag-and-drop the folder into Netlify's dashboard.
2. In Netlify: "Add new site" → "Import an existing project" and select the repo (build command and publish directory are auto-detected from `netlify.toml`, no manual config needed).
3. Deploy. Netlify will build the static site, bundle the two functions in `netlify/functions/`, and deploy the edge function automatically.

Alternatively, using the Netlify CLI from this folder:

```bash
npm install
npm install -g netlify-cli
netlify deploy --build --prod
```
