# Deployment

Target: Debian, Node 24, MySQL 8, NGINX, HTTPS, and systemd. Do not deploy from development seed credentials.

1. Create MySQL database/user and set `DATABASE_URL=mysql://...`.
2. For a new database run `npm ci`, `npm run db:generate:mysql`, `npm run db:migrate:mysql:init`, `npm run db:migrate:mysql:companion`, and `npm run db:migrate:mysql:studio`, then `npm run build`. Record future MySQL migrations under `prisma/mysql-migrations` before production use.
3. Install `deploy/forever-treasure.service`, place secrets in `/etc/forever-treasure.env`, and proxy with `deploy/nginx.conf`.
4. Send application logs to journald; retain NGINX access/error logs under `/var/log/nginx`.

Back up with daily encrypted `mysqldump --single-transaction`, retain seven daily/four weekly copies off-host, and test quarterly restore into a separate database. Restore by stopping the service, importing a verified dump, applying pending migrations, and starting/reconciling. Generate secrets with `openssl rand -base64 48`.

Set `TALL_TALE_ASSET_ROOT` to durable storage outside the release directory and back it up with the database. Published snapshots retain asset variant identities, so a database-only restore is incomplete. Phase 1 uses local filesystem storage; horizontally scaled production needs shared object storage before enabling multiple application nodes.
