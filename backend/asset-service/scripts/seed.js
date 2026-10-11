import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/user.model.js';
import { USER_ROLES } from '../constants/user.js';

const SEED_USERS = [
  {
    name: 'System Administrator',
    email: 'admin@example.com',
    password: 'Admin@12345',
    role: 'admin',
    employeeCode: 'EMP-001',
    jobTitle: 'IT Administrator',
    department: 'IT',
    site: 'HQ',
  },
  {
    name: 'Staff User',
    email: 'staff@example.com',
    password: 'Staff@12345',
    role: 'staff',
    employeeCode: 'EMP-002',
    jobTitle: 'Asset Coordinator',
    department: 'Operations',
    site: 'HQ',
  },
  {
    name: 'Technician User',
    email: 'technician@example.com',
    password: 'Tech@12345',
    role: 'technician',
    employeeCode: 'TECH-001',
    jobTitle: 'Maintenance Technician',
    department: 'Facilities',
    site: 'HQ',
  },
];

async function seed() {
  const conn = await connectDB();

  if (!conn) {
    console.error('[seed] no database connection, aborting');
    process.exitCode = 1;
    return;
  }

  await mongoose.syncIndexes();

  for (const seedUser of SEED_USERS) {
    if (!USER_ROLES.includes(seedUser.role)) {
      console.error(`[seed] refusing to seed invalid role "${seedUser.role}"`);
      process.exitCode = 1;
      return;
    }

    const existing = await User.findOne({ email: seedUser.email });

    if (existing) {
      console.log(`[seed] skipped ${seedUser.email} (already exists)`);
      continue;
    }

    const { password, ...rest } = seedUser;
    const user = await User.create({
      ...rest,
      passwordHash: await User.hashPassword(password),
    });

    console.log(`[seed] created ${user.role.padEnd(10)} ${user.email}  password: ${password}`);
  }

  console.log('[seed] done');
  await disconnectDB();
}

seed().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  await disconnectDB().catch(() => {});
  process.exitCode = 1;
});