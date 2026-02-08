# Dashboard Deploy (Static Export)

This repo contains a Next.js dashboard at `packages/dashboard/`.

Current config is set to `output: "export"` (static export), so production deploy is a static site served by Nginx (no Next.js server process required).

## Build

From repo root:

```bash
bun install
cd packages/dashboard
bun run build
```

Expected output directory: `packages/dashboard/out/`

## Deploy (Nginx Static Root)

Copy the export output to the server web root directory (example path used in production):

```bash
rsync -a --delete packages/dashboard/out/ /opt/dashboard-web/
```

## Nginx Notes

For static export with `trailingSlash: true`, a minimal location is:

```nginx
root /opt/dashboard-web;
index index.html;

location / {
  try_files $uri $uri/ =404;
}
```

API is expected to be same-origin:

- `/api/*` proxied to the Bun Hono API
- `/api/coord/*` proxied to the Coordinator API

The dashboard client defaults to same-origin in production, and to localhost in development:

- API: `/Users/mister/Documents/New project/packages/dashboard/src/lib/api.ts`
- Coordinator: `/Users/mister/Documents/New project/packages/dashboard/src/lib/coord.ts`

