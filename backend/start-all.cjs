#!/usr/bin/env node
/**
 * Starts the whole backend with a single command.
 *
 *   npm run backend               # auto (recommended): if a local MongoDB
 *                                 #   (mongodb://127.0.0.1:27017) is running, use it — data is
 *                                 #   persistent and visible in MongoDB Compass. Otherwise falls
 *                                 #   back to a throwaway in-memory MongoDB.
 *                                 #   (auto-reclaims :3001/:3002 from a previous run)
 *   npm run backend -- --local    # force a local MongoDB (fail if unreachable)
 *   npm run backend -- --memory   # force the throwaway in-memory MongoDB
 *   npm run backend -- --atlas    # use the MONGODB_URI from each service's .env
 *   npm run backend -- --no-reclaim # fail instead of killing a busy :3001/:3002
 *
 * Override the local Mongo host with LOCAL_MONGODB_URI, e.g.
 *   LOCAL_MONGODB_URI=mongodb://127.0.0.1:27018 npm run backend -- --local
 *
 * Zero extra dependencies: services are launched with the current Node binary,
 * and the local database reuses the mongodb-memory-server already installed as
 * a dev dependency (its mongod binary lives in the user cache).
 */

const { spawn, execSync } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

const ROOT = __dirname;
const useAtlas = process.argv.includes('--atlas') || process.env.USE_ATLAS === '1' || process.env.USE_ATLAS === 'true';
// --local persists to a real local MongoDB server (Compass-visible) instead of the
// throwaway in-memory database. --local wins if both flags are passed.
const useLocal = process.argv.includes('--local') || process.env.USE_LOCAL === '1' || process.env.USE_LOCAL === 'true';
// --memory forces the throwaway in-memory database (disables the local-Mongo auto-detect).
const useMemory = process.argv.includes('--memory') || process.env.USE_MEMORY === '1' || process.env.USE_MEMORY === 'true';
const LOCAL_MONGODB_BASE = (process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017').replace(/\/+$/, '');

// Host/port of the local MongoDB, used to decide whether it is reachable.
function localMongoTarget() {
  try {
    const url = new URL(LOCAL_MONGODB_BASE);
    return { host: url.hostname || '127.0.0.1', port: Number(url.port || 27017) };
  } catch {
    return { host: '127.0.0.1', port: 27017 };
  }
}

const SERVICES = [
  { name: 'asset-service', dir: path.join(ROOT, 'asset-service'), port: 3001, db: 'asset_db', color: '\x1b[36m' },
  { name: 'operations-service', dir: path.join(ROOT, 'operations-service'), port: 3002, db: 'operations_db', color: '\x1b[35m' },
];

const RESET = '\x1b[0m';
const MEMORY_PORT = process.env.MEMORY_DB_PORT ? Number(process.env.MEMORY_DB_PORT) : null;
const SKIP_SEED = process.env.SKIP_SEED === '1' || process.env.SKIP_SEED === 'true';
// A previous instance holding :3001/:3002 is reclaimed automatically; --force is kept as an alias.
const NO_RECLAIM = process.argv.includes('--no-reclaim') || process.env.NO_RECLAIM === '1';

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

function portInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (used) => {
      socket.destroy();
      resolve(used);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(800, () => done(false));
  });
}

async function findBusyPorts() {
  const busy = [];
  for (const service of SERVICES) {
    // eslint-disable-next-line no-await-in-loop
    if (await portInUse(service.port)) busy.push(service);
  }
  return busy;
}

// Best-effort: find the PIDs listening on a TCP port (Windows + Unix).
function pidsOnPort(port) {
  const pids = new Set();
  try {
    if (process.platform === 'win32') {
      const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(new RegExp(`[:.]${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`));
        if (m) pids.add(m[1]);
      }
    } else {
      const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' });
      for (const pid of out.split(/\s+/)) if (pid) pids.add(pid);
    }
  } catch {
    /* port might be busy in a way we cannot inspect */
  }
  return [...pids];
}

function killPids(pids) {
  for (const pid of pids) {
    if (!pid || pid === '0') continue;
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      } else {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      }
    } catch {
      /* already gone */
    }
  }
}

async function preflightPorts() {
  const busy = await findBusyPorts();
  if (busy.length === 0) return;

  const details = busy.map((s) => {
    const pids = pidsOnPort(s.port);
    return `  - ${s.name} :${s.port}${pids.length ? ` (pid ${pids.join(', ')})` : ''}`;
  });

  if (NO_RECLAIM) {
    console.error('[backend] cannot start: these ports are already in use:');
    for (const line of details) console.error(line);
    console.error('[backend] another backend is probably still running.');
    console.error('[backend] stop it first (or drop --no-reclaim to reclaim automatically).');
    process.exit(1);
  }

  console.log('[backend] a previous backend is still running on:');
  for (const line of details) console.log(line);
  console.log('[backend] reclaiming those ports...');
  for (const service of SERVICES) {
    const pids = pidsOnPort(service.port);
    if (pids.length) {
      console.log(`[backend] killing pid(s) ${pids.join(', ')} on :${service.port}`);
      killPids(pids);
    }
  }
  // Give the OS a moment to release the sockets.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const stillBusy = await findBusyPorts();
  if (stillBusy.length) {
    console.error(
      `[backend] ports still in use: ${stillBusy.map((s) => `${s.name} :${s.port}`).join(', ')}`
    );
    process.exit(1);
  }
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
  // Decide which database to use.
  let mode;
  if (useAtlas) {
    mode = 'atlas';
  } else if (useLocal) {
    mode = 'local';
  } else if (useMemory) {
    mode = 'memory';
  } else {
    // Auto: prefer a running local MongoDB so data is persistent + Compass-visible.
    const { host, port } = localMongoTarget();
    mode = (await portInUse(port, host)) ? 'local' : 'memory';
  }

  if (mode === 'local') {
    console.log(`[backend] database: local MongoDB at ${LOCAL_MONGODB_BASE} (persistent, Compass-visible)`);
  } else if (mode === 'atlas') {
    console.log('[backend] database: Atlas (MONGODB_URI from each service .env)');
  } else {
    console.log('[backend] database: local in-memory MongoDB (start a local MongoDB or pass --local to persist)');
  }

  await preflightPorts();

  if (mode === 'local') {
    const uris = Object.fromEntries(
      SERVICES.map((s) => [s.name, `${LOCAL_MONGODB_BASE}/${s.db}`])
    );

    if (!SKIP_SEED) {
      await runSeed(uris['asset-service']);
      await runOpsSeed(uris['operations-service']);
    }

    console.log('[backend] starting asset-service (:3001) and operations-service (:3002)');
    for (const service of SERVICES) start(service, uris[service.name]);
  } else if (mode === 'memory') {
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
