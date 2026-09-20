# Contributing

Use the Node/pnpm versions in package.json and preserve the committed lockfile. Follow README setup, run the checks, and keep changes focused. Add tests when changing comparison, security, authorization, or replay behavior. Use synthetic fixtures and never commit environment secrets or real customer payloads.

Update the Prisma schema and the SQLite test fixture together for persistence changes. Generate and inspect migrations before publishing. Never rewrite an applied migration. Run the optional PostgreSQL/Redis integration test when changing the PostgreSQL database or queue adapters.

Explain the user-facing problem, behavioral change, and verification in each pull request. Do not add dependencies or architecture merely to increase complexity.
