# Smart Asset Management — Data Model

This document captures the five core entities and relationships for the MVP. All ObjectIds reference documents within the same database (cross-database references are noted).

## Overview of databases

| Database | Service | Models |
| --- | --- | --- |
| `asset_db` | `asset-service` | User, Asset, Allocation |
| `operations_db` | `operations-service` | Technician, Maintenance |

## 1. User (`asset_db.Users`)

**Purpose**: AuthN/AuthZ and ownership/assignment.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | String | Y | 2-120, trimmed |
| `email` | String | Y | unique, lowercase, valid email regex |
| `passwordHash` | String | Y | not returned by `toJSON` |
| `role` | Enum | N (staff) | `admin`, `staff`, `technician` (index) |
| `department` | String | N | 80 max |
| `phone` | String | N | 20 max |
| `employeeCode` | String | N | unique, sparse |
| `jobTitle` | String | N | 80 max |
| `manager` | ObjectId (User) | N | ref to User |
| `site` | String | N | 80 max |
| `isActive` | Boolean | N (true) | index |
| `lastLoginAt` | Date | N | null |
| `mustChangePassword` | Boolean | N (false) | |
| `failedLoginAttempts` | Number | N (0) | |
| `lockedUntil` | Date | N | lockout expiry |
| `timestamps` | createdAt, updatedAt | auto | |

**Indexes**: `{email:1} unique`, `{employeeCode:1} sparse unique`, `{role:1,isActive:1}`, `{name:'text',email:'text',employeeCode:'text'}`.

## 2. Asset (`asset_db.Assets`)

**Purpose**: Track IT assets throughout lifecycle.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `assetId` | String | Y | unique, `AST-1001` format, **auto-generated**, never client-supplied |
| `name` | String | Y | 2-160 |
| `description` | String | N | 2000 |
| `category` | Enum | Y | `laptop,desktop,monitor,mobile,printer,network,peripheral,vehicle,tool,other` |
| `status` | Enum | N (draft) | `draft,in_stock,assigned,in_maintenance,returned,lost,retired,disposed` (index) |
| `condition` | Enum | N (new) | `new,good,fair,poor,damaged` |
| `serialNumber` | String | N | 64, uppercase, **unique + sparse** so many assets may omit it |
| `department` | String | N | 80, index |
| `manufacturer` | String | N | 80 |
| `model` | String | N | 80 |
| `vendor` | String | N | 120 |
| `purchaseDate` | Date | N | |
| `purchaseCost` | Number | N | min 0 |
| `currency` | String | N (INR) | 3 letters |
| `warrantyEndDate` | Date | N | index |
| `warrantyDetails` | String | N | 500 |
| `location` | Subdoc | N | `label,type,site,building,floor,room,coordinates{lat,lon}` |
| `tags` | [String] | N | deduped, trimmed |
| `assignedTo` | ObjectId (User) | N | current assignee |
| `currentAllocation` | ObjectId (Allocation) | N | active allocation ref |
| `imageUrl` | String | N | 500 |
| `notes` | String | N | 2000 |
| `createdBy` | ObjectId (User) | N | set from the token once auth lands |
| `updatedBy` | ObjectId (User) | N | |
| `deletedAt` | Date | N (null) | soft-delete marker; excluded from all reads by default |
| `timestamps` | createdAt, updatedAt | auto | `optimisticConcurrency: true` |

**Indexes**: `{assetId:1} unique`, `{serialNumber:1} unique sparse`, `{status:1,category:1,department:1}`, `{deletedAt:1}`, `{assetId:1,deletedAt:1}`, `{purchaseDate:1}`, `{name:'text',assetId:'text',serialNumber:'text',notes:'text'}`.

### Status transitions

Enforced in `constants/asset.js` (`ASSET_TRANSITIONS`, `canTransition`). Changing status happens only through `PATCH /api/assets/:id/status`; a `PUT`/`PATCH` on the asset body ignores `status`. Violations return `409 INVALID_TRANSITION` with the allowed next states.

| From | Allowed next |
| --- | --- |
| `draft` | `in_stock`, `retired` |
| `in_stock` | `assigned`, `in_maintenance`, `retired`, `disposed` |
| `assigned` | `in_stock`, `in_maintenance`, `returned`, `lost`, `retired` |
| `in_maintenance` | `in_stock`, `retired`, `disposed` |
| `returned` | `in_stock`, `in_maintenance`, `retired` |
| `lost` | `retired`, `disposed` |
| `retired` | `disposed` |
| `disposed` | *(none — terminal)* |

## 3. Allocation (`asset_db.Allocations`)

**Purpose**: History and enforcement of one active allocation per asset.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `asset` | ObjectId (Asset) | Y | index |
| `user` | ObjectId (User) | Y | index |
| `allocatedBy` | ObjectId (User) | Y | |
| `status` | Enum | N (active) | `active,returned,overdue,cancelled` index |
| `allocatedAt` | Date | Y (default now) | |
| `expectedReturnDate` | Date | N | |
| `returnedAt` | Date | N | |
| `conditionOnHandover` | Enum | Y | `new,good,fair,poor,damaged` |
| `conditionOnReturn` | Enum | N | `new,good,fair,poor,damaged` |
| `purpose` | String | N | 500 |
| `notes` | String | N | 2000 |
| `handoverNotes` | String | N | 2000 |
| `handoverSignatureUrl` | String | N | 500 |
| `returnConditionNotes` | String | N | 2000 |
| `timestamps` | createdAt, updatedAt | auto | optimisticConcurrency true |

**Constraints/Indexes**: Partial unique `{asset:1}` where `status=='active'` (enforces max 1 active allocation per asset). Also `{user:1,status:1}`, `{status:1,expectedReturnDate:1}`, `{asset:1,allocatedAt:-1}`.

## 4. Technician (`operations_db.Technicians`)

**Purpose**: People who perform maintenance.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `employeeCode` | String | Y | unique, uppercase |
| `name` | String | Y | 2-120 |
| `email` | String | Y | unique, lowercase |
| `phone` | String | N | 20 |
| `status` | Enum | N (available) | `available,busy,off_duty,inactive` index |
| `skills` | [Enum] | N | `electrical,mechanical,networking,software,printer,hvac,plumbing,calibration,general` |
| `certifications[]` | Array | N | `{name,issuedBy,issuedOn,expiresOn,certificateUrl}` |
| `team` | String | N | 80, index |
| `site` | String | N | 80 |
| `shift` | Enum | N (flexible) | `morning,evening,night,flexible` |
| `maxConcurrentJobs` | Number | N (5) | 1-50 |
| `activeJobCount` | Number | N (0) | 0+ |
| `hourlyRate` | Number | N | min 0 |
| `currency` | String | N (INR) | 3 |
| `linkedUser` | ObjectId | N | links to User in `asset_db` (no DB ref constraint) |
| `notes` | String | N | 2000 |
| `timestamps` | createdAt, updatedAt | auto | |

**Indexes**: `{employeeCode:1} unique`, `{email:1} unique`, `{status:1,skills:1}`, `{team:1,status:1}`, `{name:'text',employeeCode:'text',email:'text'}`.

## 5. Maintenance (`operations_db.Maintenances`)

**Purpose**: Work orders for assets.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `maintenanceId` | String | Y | unique, `MNT-YYYY-XXXX`, uppercase |
| `assetId` | ObjectId | Y | references Asset in `asset_db` (no DB ref) — index |
| `assetTag` | String | Y | denormalized for search/reporting — index |
| `title` | String | Y | 3-160 |
| `description` | String | N | 4000 |
| `type` | Enum | Y | `preventive,corrective,inspection,calibration,upgrade,damage` index |
| `priority` | Enum | N (medium) | `low,medium,high,critical` index |
| `status` | Enum | N (requested) | `requested,scheduled,in_progress,on_hold,completed,cancelled` index |
| `reportedBy` | ObjectId | Y | references User in `asset_db` |
| `assignedTechnician` | ObjectId (Technician) | N | ref within operations_db — index |
| `scheduledFor` | Date | N | index |
| `startedAt` | Date | N | |
| `completedAt` | Date | N | |
| `onHoldReason` | String | N | 500 |
| `cancelledReason` | String | N | 500 |
| `resolutionNotes` | String | N | 4000 |
| `partsUsed[]` | Array | N | `{name,partNumber,quantity,unitCost,supplier}` |
| `laborHours` | Number | N | min 0 |
| `cost` | Subdoc | N | `{laborCost,partsCost,totalCost,currency}` defaults 0, INR |
| `downtimeHours` | Number | N | min 0, default 0 |
| `recurring` | Subdoc | N | `{enabled,intervalDays,min1,nextDueDate}` |
| `attachments[]` | Array | N | `{name,url,mimeType,sizeBytes,uploadedBy,uploadedAt}` |
| `auditTrail[]` | Array | N | append-only: `{action,fromStatus,toStatus,actorId,actorRole,note,at}` |
| `timestamps` | createdAt, updatedAt | auto | optimisticConcurrency true |

**Indexes**: `{maintenanceId:1} unique`, `{status:1,priority:1,scheduledFor:1}`, `{assetId:1,status:1}`, `{assignedTechnician:1,status:1}`, `{recurring.enabled:1,recurring.nextDueDate:1}`, `{title:'text',description:'text',assetTag:'text'}`.

## Relationships

- **Asset → User**: `assignedTo` and `createdBy/updatedBy` are User ObjectIds (asset_db). 
- **Allocation → Asset/User**: links the two. Active allocation is mutually exclusive.
- **Technician** may link to a **User** via `linkedUser` (cross-database, advisory only).
- **Maintenance** references **Asset** by `assetId` (asset_db) and stores `assetTag` for denormalization. It references **User** via `reportedBy`. It references **Technician** via `assignedTechnician` (operations_db).
- **Auth boundary**: Users live in asset-service (asset_db). Both services verify JWTs using the same `JWT_SECRET` (see Auth Design).

## Notes

- Cross-database ObjectId references are not enforced by MongoDB (no foreign keys). Enforce referential integrity in service layer (check existence before writes, soft deletes, cleanup on delete).
- `optimisticConcurrency: true` is enabled on Asset, Allocation, Maintenance to prevent lost updates on concurrent edits.
- Text indexes cover common search fields.
- Dates are UTC. Store as Date, not strings.
- Monetary values: use Number (cents preferred later, but MVP can store amount with currency).
