#!/usr/bin/env node
/**
 * Seeds a small set of technicians into the operations-service database.
 * Idempotent (upserts by employeeCode), safe to run on every start.
 *
 *   MONGODB_URI=<uri> node scripts/seed-technicians.js
 *
 * Without MONGODB_URI it falls back to operations-service/.env (used for Atlas).
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { Technician } from '../models/technician.model.js';

const technicians = [
  { employeeCode: 'TECH-001', name: 'Ravi Kumar',   email: 'ravi.kumar@acme.io',   phone: '+91 90000 10001', skills: ['electrical', 'mechanical'], team: 'Field',   status: 'available' },
  { employeeCode: 'TECH-002', name: 'Priya Sharma', email: 'priya.sharma@acme.io', phone: '+91 90000 10002', skills: ['networking'],              team: 'Infra',  status: 'available' },
  { employeeCode: 'TECH-003', name: 'John Doe',     email: 'john.doe@acme.io',     phone: '+91 90000 10003', skills: ['software', 'printer'],     team: 'Desk',   status: 'available' },
  { employeeCode: 'TECH-004', name: 'Meera Iyer',   email: 'meera.iyer@acme.io',   phone: '+91 90000 10004', skills: ['hvac', 'calibration'],     team: 'Facilities', status: 'busy' },
];

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('[seed-tech] MONGODB_URI is required');
  process.exit(1);
}

async function main() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  for (const t of technicians) {
    await Technician.findOneAndUpdate(
      { employeeCode: t.employeeCode },
      { ...t, skills: t.skills, status: t.status },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`[seed-tech] upserted ${t.employeeCode} ${t.name} (${t.email})`);
  }
  await mongoose.disconnect();
  console.log('[seed-tech] done');
}

main().catch(async (err) => {
  console.error('[seed-tech] failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});