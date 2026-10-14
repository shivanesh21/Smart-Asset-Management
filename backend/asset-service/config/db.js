import mongoose from 'mongoose';
import { env } from './env.js';

const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function connectDB({ retries = MAX_RETRIES } = {}) {
  mongoose.set('strictQuery', true);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const conn = await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
      });
      console.log(`[db] connected to ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (err) {
      const last = attempt === retries;
      console.error(
        `[db] connection attempt ${attempt}/${retries} failed: ${err.message}`
      );
      if (last) {
        mongoose.connection.close();
        return null;
      }
      await sleep(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  return null;
}

export async function disconnectDB() {
  await mongoose.connection.close();
}

export function dbState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] ?? 'unknown';
}

// Lifecycle notices go to stdout (console.log), not stderr: PowerShell renders any
// native-command stderr as a red NativeCommandError, which looks like a crash.
mongoose.connection.on('disconnected', () => console.log('[db] disconnected'));
mongoose.connection.on('reconnected', () => console.log('[db] reconnected'));
mongoose.connection.on('error', (err) => console.error('[db] error:', err.message));
