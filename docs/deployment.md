# Deployment

Use the root Dockerfile for both the web/API service and the replay worker. The frontend is compiled into `apps/web/dist` and served by Express, so login cookies and API requests remain on one origin.

For Railway, follow [the service setup](railway.md).

## Production configuration

Set `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, `WEB_URL`, `NODE_ENV=production`, and `ALLOW_PRIVATE_NETWORK_TARGETS=false` on both processes. Use the same encryption key on the API and worker, and retain it across deployments. Losing it makes saved target tokens unreadable.

Set `SERVE_WEB=true` on the web service. The server listens on `PORT`, falling back to `API_PORT` or 4000. Terminate TLS at the hosting proxy, and set `WEB_URL` to the exact HTTPS origin. Production cookies are Secure, HttpOnly, and SameSite=Strict. Configure `TRUST_PROXY_HOPS` only for the trusted ingress in front of the app.

The image already contains generated Prisma clients and compiled code. Run `node node_modules/prisma/build/index.js migrate deploy` once as the API pre-deploy step. Start the API using `node services-dist/apps/api/src/server.js`, and the worker with `node services-dist/apps/worker/src/worker.js`. Deploy the same revision to both. The worker must stay running independently of the HTTP process.

`/health` checks process liveness; `/ready` checks PostgreSQL and Redis. Keep the database and Redis private, attach persistent volumes, and configure backups. Redis should use persistence and a no-eviction policy for queue data.

Create your own account through `/register`. Registration seeds each new account with isolated demo data. Do not run the local demo seed against an existing production account. Authentication has no password recovery or email verification yet.

The included Compose file uses development credentials, HTTP, and localhost-bound ports for local use. It is not a production configuration.
