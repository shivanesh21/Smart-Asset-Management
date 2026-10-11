export const ASSET_STATUSES = [
  'draft',
  'in_stock',
  'assigned',
  'in_maintenance',
  'returned',
  'lost',
  'retired',
  'disposed',
];

export const ASSET_CATEGORIES = [
  'laptop',
  'desktop',
  'monitor',
  'mobile',
  'printer',
  'network',
  'peripheral',
  'vehicle',
  'tool',
  'other',
];

export const ASSET_CONDITIONS = ['new', 'good', 'fair', 'poor', 'damaged'];

export const LOCATION_TYPES = ['office', 'warehouse', 'remote', 'field', 'vehicle'];

export const ASSET_TRANSITIONS = {
  draft: ['in_stock', 'retired'],
  in_stock: ['assigned', 'in_maintenance', 'retired', 'disposed'],
  assigned: ['in_stock', 'in_maintenance', 'returned', 'lost', 'retired'],
  in_maintenance: ['in_stock', 'retired', 'disposed'],
  returned: ['in_stock', 'in_maintenance', 'retired'],
  lost: ['retired', 'disposed'],
  retired: ['disposed'],
  disposed: [],
};

export function canTransition(from, to) {
  return ASSET_TRANSITIONS[from]?.includes(to) ?? false;
}
