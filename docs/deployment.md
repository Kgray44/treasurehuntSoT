# Deployment

Target: Debian, Node 24, MySQL 8, NGINX, HTTPS, and systemd. Do not deploy from development seed credentials.

1. Create MySQL database/user and set `DATABASE_URL=mysql://...`.
2. For a new database run `npm ci`, `npm run db:generate:mysql`, `npm run db:migrate:mysql:init`, `npm run db:migrate:mysql:companion`, `npm run db:migrate:mysql:command-center`, `npm run db:migrate:mysql:studio`, and `npm run db:migrate:mysql:platform`, then `npm run build`. Apply those connector-specific SQL files in order exactly once and record every future MySQL migration under `prisma/mysql-migrations` before production use.
3. Install `deploy/forever-treasure.service`, place secrets in `/etc/forever-treasure.env`, and proxy with `deploy/nginx.conf`.
4. Send application logs to journald; retain NGINX access/error logs under `/var/log/nginx`.

Back up with daily encrypted `mysqldump --single-transaction`, retain seven daily/four weekly copies off-host, and test quarterly restore into a separate database. Restore by stopping the service, importing a verified dump, applying pending migrations, and starting/reconciling. Generate secrets with `openssl rand -base64 48`.

Set `TALL_TALE_ASSET_ROOT` to durable storage outside the release directory and back it up with the database. Published snapshots retain asset variant identities, so a database-only restore is incomplete. Phase 1 uses local filesystem storage; horizontally scaled production needs shared object storage before enabling multiple application nodes.

The platform migration is additive, but it is not reversed destructively. Before applying `0004_tall_tale_platform`, take and verify a database backup. Rollback means stop the application, restore that backup together with the matching asset volume, deploy the previous application release, and validate playthrough/event counts before reopening traffic. Run the normal progress-preserving seed/ensure step after a successful forward migration to backfill existing Tall Tale session memberships; development identities and roles are never a substitute for production provisioning.
