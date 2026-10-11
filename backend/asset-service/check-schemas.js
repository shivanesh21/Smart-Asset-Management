import { User } from './models/user.model.js';
import { Asset } from './models/asset.model.js';
import { Allocation } from './models/allocation.model.js';

const checks = [
  ['User', User, ['name', 'email', 'passwordHash']],
  ['Asset', Asset, ['assetId', 'name', 'category']],
  ['Allocation', Allocation, ['asset', 'user', 'allocatedBy', 'conditionOnHandover']],
];

let failed = false;
for (const [name, Model, required] of checks) {
  const err = new Model().validateSync();
  const paths = Object.keys(err?.errors ?? {}).sort();
  const ok = required.every((r) => paths.includes(r));
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: required paths reported = [${paths.join(', ')}]`);
  console.log(`     indexes: ${Object.keys(Model.schema.indexes()).length}`);
  if (!ok) failed = true;
}
process.exit(failed ? 1 : 0);
