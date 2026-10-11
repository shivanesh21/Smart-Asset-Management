#!/usr/bin/env node
/**
 * Starts the whole backend with a single command.
 *
 *   npm run backend            # local in-memory MongoDB + both services
 *   npm run backend -- --atlas # use the MONGODB_URI from each service's .env
 *
 * Zero extra dependencies: services are launched with the current Node binary,
 * and the local database reuses the mongodb-memory-server already installed as
 * a dev dependency (its mongod binary lives in the user cache).
 */

const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = __dirname;
const useAtlas = process.argv.includes('--atlas') || process.env.USE_ATLAS === '1' || process.env.USE_ATLAS === 'true';

const SERVICES = [
  { name: 'asset-service', dir: path.join(ROOT, 'asset-service'), port: 3001, db: 'asset_db', color: '\x1b[36m' },
  { name: 'operations-service', dir: path.join(ROOT, 'operations-service'), port: 3002, db: 'operations_db', color: '\x1b[35m' },
];

const RESET = '\x1b[0m';
const MEMORY_PORT = process.env.MEMORY_DB_PORT ? Number(process.env.MEMORY_DB_PORT) : null;
const SKIP_SEED = process.env.SKIP_SEED === '1' || process.env.SKIP_SEED === 'true';

const children = new Set();
let memoryServer = null;
let shuttingDown = false;

function label(service) {
  return `${service.color}[${service.name}]${RESET} `;
}

// Line-buffered so a service's output is only prefixed once per complete line.
function makePrefixer(service, stream) {
  let buffer = '';
  const prefix = label(service);
  return (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      stream.write(`${prefix}${line}\n`);
    }
  };
}

function loadMemoryServer() {
  const candidates = SERVICES.map((s) =>
    path.join(s.dir, 'node_modules', 'mongodb-memory-server')
  );
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line import/no-dynamic-require
      return require(candidate).MongoMemoryServer;
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') throw err;
    }
  }
  throw new Error(
    'mongodb-memory-server is not installed. Run "npm install" in backend/asset-service.'
  );
}

async function startMemoryDb() {
  const MongoMemoryServer = loadMemoryServer();
  memoryServer = await MongoMemoryServer.create(
    MEMORY_PORT ? { instance: { port: MEMORY_PORT } } : {}
  );

  const uris = Object.fromEntries(
    SERVICES.map((s) => [s.name, memoryServer.getUri(s.db)])
  );
  const host = memoryServer.getUri().replace(/\/[^/]*$/, '');
  console.log(`[backend] local MongoDB ready at ${host} (asset_db + operations_db)`);
  return uris;
}

function runSeed(assetUri) {
  return new Promise((resolve) => {
    console.log('[backend] seeding asset-service users (admin@example.com / Admin@12345)');
    const seed = spawn(process.execPath, ['scripts/seed.js'], {
      cwd: path.join(ROOT, 'asset-service'),
      env: { ...process.env, MONGODB_URI: assetUri, NODE_ENV: 'development' },
      stdio: 'inherit',
    });
    seed.on('exit', (code) => resolve(code ?? 1));
    seed.on('error', () => resolve(1));
  });
}

function runOpsSeed(opsUri) {
  return new Promise((resolve) => {
    console.log('[backend] seeding operations-service technicians...');
    const seed = spawn(process.execPath, ['scripts/seed-technicians.js'], {
      cwd: path.join(ROOT, 'operations-service'),
      env: { ...process.env, ...(opsUri ? { MONGODB_URI: opsUri } : {}) },
      stdio: 'inherit',
    });
    seed.on('exit', (code) => resolve(code ?? 1));
    seed.on('error', () => resolve(1));
  });
}

function start(service, uri) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: service.dir,
    env: { ...process.env, ...(uri ? { MONGODB_URI: uri } : {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  children.add(child);
  const onOut = makePrefixer(service, process.stdout);
  const onErr = makePrefixer(service, process.stderr);
  child.stdout.on('data', onOut);
  child.stderr.on('data', onErr);

  child.on('error', (err) => {
    console.error(`${label(service)}failed to start: ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`${label(service)}exited with ${reason}`);
    shutdown(code ?? 1);
  });

  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  const finish = async () => {
    if (memoryServer) {
      await memoryServer.stop().catch(() => {});
      memoryServer = null;
    }
    process.exit(exitCode);
  };

  if (children.size === 0) {
    finish();
    return;
  }

  console.log(`\n[backend] stopping ${children.size} service(s)...`);
  for (const child of children) child.kill('SIGTERM');

  const forceTimer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 5000);
  forceTimer.unref();

  let remaining = children.size;
  for (const child of children) {
    child.once('exit', () => {
      remaining -= 1;
      if (remaining <= 0) {
        clearTimeout(forceTimer);
        finish();
      }
    });
  }
}

async function main() {
  if (useAtlas) {
    console.log('[backend] database: Atlas (MONGODB_URI from each service .env)');
  } else {
    console.log('[backend] database: local in-memory MongoDB (use --atlas for Atlas)');
  }

  if (!useAtlas) {
    const uris = await startMemoryDb();

    if (!SKIP_SEED) {
      await runSeed(uris['asset-service']);
      await runOpsSeed(uris['operations-service']);
    }

    console.log('[backend] starting asset-service (:3001) and operations-service (:3002)');
    for (const service of SERVICES) start(service, uris[service.name]);
  } else {
    if (!SKIP_SEED) {
      await runOpsSeed();
    }
    console.log('[backend] starting asset-service (:3001) and operations-service (:3002)');
    for (const service of SERVICES) start(service, null);
  }

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));
}

main().catch((err) => {
  console.error(`[backend] failed to start: ${err.message}`);
  shutdown(1);
});
