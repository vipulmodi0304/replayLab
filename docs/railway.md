# Deploy ReplayLab on Railway

Deploy from a GitHub repository containing this source at its root. Use the same branch and revision for the web/API service and worker. Railway detects the root `Dockerfile`; keep the service root directory at `/`.

## Services

| Service  | Source                               | Start command                                  | Public access                                |
| -------- | ------------------------------------ | ---------------------------------------------- | -------------------------------------------- |
| web      | GitHub repository, root Dockerfile   | `node services-dist/apps/api/src/server.js`    | Generated HTTPS domain or your custom domain |
| worker   | Same repository and Dockerfile       | `node services-dist/apps/worker/src/worker.js` | None                                         |
| Postgres | Railway PostgreSQL database template | Template default                               | Private only                                 |
| Redis    | Railway Redis database template      | Template default                               | Private only                                 |

Create PostgreSQL and Redis using the database templates so they include persistent volumes. Use persistence and a no-eviction memory policy for Redis. Railway database templates require you to manage maintenance and backups.

## Variables

Add these to both `web` and `worker`. Reference names must match your database service names exactly.

| Name                            | Value                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `NODE_ENV`                      | `production`                                                                  |
| `DATABASE_URL`                  | `${{Postgres.DATABASE_URL}}`                                                  |
| `REDIS_URL`                     | `${{Redis.REDIS_URL}}`                                                        |
| `ENCRYPTION_KEY`                | One generated base64-encoded 32-byte secret, shared by both services          |
| `WEB_URL`                       | Exact generated HTTPS origin or custom HTTPS domain, without a trailing slash |
| `ALLOW_PRIVATE_NETWORK_TARGETS` | `false`                                                                       |
| `AI_ENABLED`                    | `false`                                                                       |

On `web`, also set `SERVE_WEB=true`, `PORT=4000`, and `TRUST_PROXY_HOPS=1` for Railway's public ingress. Expose target port 4000. Do not expose the worker or databases publicly. Keep both application services running rather than sleeping between requests, so queued jobs continue.

Generate an encryption key locally with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Store the result only in Railway variables and your secret backup, never in GitHub or the frontend. Reuse it for subsequent deployments. Optional AI explanation credentials are server-side variables and are unnecessary for the comparison engine.

## Deploy order

1. Connect the GitHub repository and configure both application services before their first successful deployment.
2. Set the web pre-deploy command to `node node_modules/prisma/build/index.js migrate deploy` and its healthcheck path to `/ready` with a 120-second timeout. Configure no HTTP healthcheck for the worker.
3. Generate the web domain, set the exact `WEB_URL` on both services, and deploy the web service. Wait for migrations and the readiness check to pass.
4. Deploy the worker from the same revision. Use an on-failure restart policy for both processes.
5. Open `/register` and create your account. Run the built-in comparison, close the browser, then return to confirm it finished. Expect one pass, one warning, and one breaking case.
6. Verify login/logout, refresh a direct `/app/...` link, check `/docs`, and confirm `/ready` returns HTTP 200. Review deployment and worker logs.

Do not run `db:seed` in production. Accounts create their own isolated demo workspace on first use. Existing data from a different host is not automatically migrated.

Service settings are configured through Railway rather than deprecated `railway.json` or `railway.toml` files. The Dockerfile and lockfile define the application build. Check the account's plan and usage before enabling four running services; no plan upgrade is required by the source itself.

References: [Dockerfile deployment](https://docs.railway.com/builds/dockerfiles), [healthchecks](https://docs.railway.com/deployments/healthchecks), [pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command), [reference variables](https://docs.railway.com/variables/reference).
