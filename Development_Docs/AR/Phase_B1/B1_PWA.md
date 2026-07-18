# Phase B-1 PWA

The shared application advertises `/manifest.webmanifest`, standalone display, theme colors, scalable icons, and Player/Captain/Studio shortcuts. `PwaRegistration` registers `/sw.js` and truthfully distinguishes online, offline, and waiting-update states.

## Cache policy

The service worker precaches only the offline truth page, manifest, and icons. Hashed `/_next/static/` assets may be cache-first. Navigation remains network-first and falls back only to `/offline`.

The following are always fetched with `cache: no-store` and never placed in the application cache:

- every `/api/` response;
- Studio and Captain pages;
- Player identity and live story pages;
- `/play/` sessions;
- Quartermaster/authentication and invitation routes.

The offline page explicitly states that mutable story state, authentication, Studio data, Captain controls, and Vision verification are unavailable. It never presents cached mutable content as current. The update banner applies a waiting service worker only after user action.

## Development verification

Run `npm run build`, serve the production build, open browser application tools, confirm the manifest is installable, and inspect Cache Storage. `npm test -- pwa-policy` statically verifies sensitive route exclusions. Browser tests verify manifest/service-worker headers and offline truth behavior.

The service worker version is `forever-treasure-b1-v1`. Change it only when the cached application-shell contract changes.
