import { randomBytes } from 'node:crypto';
import { existsSync,readFileSync,writeFileSync } from 'node:fs';
if(existsSync('.env')){console.info('.env already exists; preserving it.');process.exit(0)}
const content=readFileSync('.env.example','utf8').replace(/^ENCRYPTION_KEY=$/m,`ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`).replace(/^DEMO_PASSWORD=$/m,`DEMO_PASSWORD=${randomBytes(18).toString('base64url')}`);writeFileSync('.env',content,{mode:0o600});console.info('Created .env. The local demo password is in DEMO_PASSWORD. Do not commit this file.');
