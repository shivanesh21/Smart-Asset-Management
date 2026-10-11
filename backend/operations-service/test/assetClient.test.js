import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import request from 'supertest';
import {
  getAsset,
  updateAssetStatus,
  createAssetClient,
  AssetClient,
  extractAuthHeader,
} from '../services/assetClient.js';
import { requireAuth, requireRole, signToken, tokenLifetimeSeconds, auth, role } from '../middleware/auth.js';
import { errorHandler } from '../middleware/error.js';
import { env } from '../config/env.js';

describe('Day 9: Inter-service client (assetClient)', () => {
  let mockServer;
  let mockServerPort;
  let originalAssetServiceUrl;
  let originalTimeout;
  let lastReceivedRequest = null;
  let mockHandler = null;

  before(async () => {
    originalAssetServiceUrl = env.assetServiceUrl;
    originalTimeout = env.assetServiceTimeoutMs;

    mockServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        lastReceivedRequest = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: body ? JSON.parse(body) : null,
        };

        if (mockHandler) {
          mockHandler(req, res, lastReceivedRequest);
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: { id: '64f0a1234b567890a1b2c3d5', assetId: 'AST-1001', status: 'in_stock' } }));
        }
      });
    });

    await new Promise((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        mockServerPort = mockServer.address().port;
        env.assetServiceUrl = `http://127.0.0.1:${mockServerPort}`;
        env.assetServiceTimeoutMs = 500;
        resolve();
      });
    });
  });

  after(async () => {
    env.assetServiceUrl = originalAssetServiceUrl;
    env.assetServiceTimeoutMs = originalTimeout;
    await new Promise((resolve) => mockServer.close(resolve));
  });

  describe('extractAuthHeader', () => {
    it('formats a raw JWT token into Bearer header', () => {
      assert.equal(extractAuthHeader('xyz123'), 'Bearer xyz123');
    });

    it('preserves existing Bearer prefix', () => {
      assert.equal(extractAuthHeader('Bearer my-token'), 'Bearer my-token');
      assert.equal(extractAuthHeader('bearer my-token'), 'bearer my-token');
    });

    it('extracts from Express req object', () => {
      const mockReq = {
        get(header) {
          return header.toLowerCase() === 'authorization' ? 'Bearer req-token' : null;
        },
      };
      assert.equal(extractAuthHeader(mockReq), 'Bearer req-token');
    });

    it('extracts from plain options object', () => {
      assert.equal(extractAuthHeader({ authorization: 'Bearer opt-token' }), 'Bearer opt-token');
      assert.equal(extractAuthHeader({ token: 'raw-token' }), 'Bearer raw-token');
      assert.equal(extractAuthHeader({ headers: { authorization: 'Bearer h-token' } }), 'Bearer h-token');
    });
  });

  describe('getAsset(id)', () => {
    it('fetches asset and forwards the Authorization header', async () => {
      mockHandler = (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          data: {
            id: '64f0a1234b567890a1b2c3d5',
            assetId: 'AST-1001',
            name: 'Dell Latitude 5440',
            status: 'in_stock',
          },
        }));
      };

      const token = 'Bearer test-user-jwt-token';
      const asset = await getAsset('AST-1001', token);

      assert.equal(lastReceivedRequest.method, 'GET');
      assert.equal(lastReceivedRequest.url, '/api/assets/AST-1001');
      assert.equal(lastReceivedRequest.headers.authorization, 'Bearer test-user-jwt-token');

      assert.equal(asset.assetId, 'AST-1001');
      assert.equal(asset.name, 'Dell Latitude 5440');
      assert.equal(asset.status, 'in_stock');
    });

    it('forwards Authorization from an Express req object', async () => {
      mockHandler = (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: { id: '64f0a1234b567890a1b2c3d5', assetId: 'AST-1001' } }));
      };

      const reqMock = {
        get(name) {
          return name.toLowerCase() === 'authorization' ? 'Bearer forward-from-req' : null;
        },
      };

      const asset = await getAsset('AST-1001', reqMock);
      assert.equal(lastReceivedRequest.headers.authorization, 'Bearer forward-from-req');
      assert.equal(asset.assetId, 'AST-1001');
    });

    it('handles 404 from asset service with appropriate ApiError', async () => {
      mockHandler = (req, res) => {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            code: 'ASSET_NOT_FOUND',
            message: 'Asset AST-9999 not found',
            details: [],
          },
        }));
      };

      await assert.rejects(
        () => getAsset('AST-9999', 'Bearer token'),
        (err) => {
          assert.equal(err.status, 404);
          assert.equal(err.code, 'ASSET_NOT_FOUND');
          assert.equal(err.message, 'Asset AST-9999 not found');
          return true;
        }
      );
    });
  });

  describe('updateAssetStatus(id, status)', () => {
    it('updates asset status and forwards Authorization header', async () => {
      mockHandler = (req, res, parsed) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          data: {
            id: '64f0a1234b567890a1b2c3d5',
            assetId: 'AST-1001',
            status: parsed.body.status,
            notes: parsed.body.reason ? `[status ${parsed.body.status}] ${parsed.body.reason}` : undefined,
          },
        }));
      };

      const token = 'Bearer admin-token';
      const updated = await updateAssetStatus('AST-1001', 'in_maintenance', token);

      assert.equal(lastReceivedRequest.method, 'PATCH');
      assert.equal(lastReceivedRequest.url, '/api/assets/AST-1001/status');
      assert.equal(lastReceivedRequest.headers.authorization, 'Bearer admin-token');
      assert.deepEqual(lastReceivedRequest.body, { status: 'in_maintenance' });
      assert.equal(updated.status, 'in_maintenance');
    });

    it('supports status transition with reason', async () => {
      mockHandler = (req, res, parsed) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          data: {
            id: '64f0a1234b567890a1b2c3d5',
            assetId: 'AST-1001',
            status: parsed.body.status,
          },
        }));
      };

      await updateAssetStatus(
        'AST-1001',
        { status: 'in_maintenance', reason: 'Scheduled repair' },
        'Bearer token'
      );

      assert.equal(lastReceivedRequest.body.status, 'in_maintenance');
      assert.equal(lastReceivedRequest.body.reason, 'Scheduled repair');
    });

    it('propagates 409 INVALID_TRANSITION from asset service', async () => {
      mockHandler = (req, res) => {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            code: 'INVALID_TRANSITION',
            message: 'Cannot change status from retired to in_stock',
          },
        }));
      };

      await assert.rejects(
        () => updateAssetStatus('AST-1001', 'in_stock', 'Bearer token'),
        (err) => {
          assert.equal(err.status, 409);
          assert.equal(err.code, 'INVALID_TRANSITION');
          return true;
        }
      );
    });
  });

  describe('Handle "Asset Service unavailable" with a 503 response', () => {
    it('returns 503 when asset-service returns a 500 error', async () => {
      mockHandler = (req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
        }));
      };

      await assert.rejects(
        () => getAsset('AST-1001', 'Bearer token'),
        (err) => {
          assert.equal(err.status, 503);
          assert.equal(err.code, 'ASSET_SERVICE_UNAVAILABLE');
          assert.equal(err.message, 'Asset Service unavailable');
          return true;
        }
      );
    });

    it('returns 503 when request times out', async () => {
      mockHandler = (_req, _res) => {
        // Deliberately do not respond, causing client timeout
      };

      const prevTimeout = env.assetServiceTimeoutMs;
      env.assetServiceTimeoutMs = 50;

      try {
        await assert.rejects(
          () => getAsset('AST-1001', 'Bearer token'),
          (err) => {
            assert.equal(err.status, 503);
            assert.equal(err.code, 'ASSET_SERVICE_UNAVAILABLE');
            assert.equal(err.message, 'Asset Service unavailable');
            return true;
          }
        );
      } finally {
        env.assetServiceTimeoutMs = prevTimeout;
      }
    });

    it('returns 503 when asset-service host is unreachable', async () => {
      const prevUrl = env.assetServiceUrl;
      // Port 1 is not listening
      env.assetServiceUrl = 'http://127.0.0.1:1';

      try {
        await assert.rejects(
          () => getAsset('AST-1001', 'Bearer token'),
          (err) => {
            assert.equal(err.status, 503);
            assert.equal(err.code, 'ASSET_SERVICE_UNAVAILABLE');
            assert.equal(err.message, 'Asset Service unavailable');
            return true;
          }
        );
      } finally {
        env.assetServiceUrl = prevUrl;
      }
    });

    it('Express endpoint returns 503 response envelope when asset-service fails', async () => {
      mockHandler = (_req, res) => {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 'DATABASE_DOWN' } }));
      };

      const testApp = express();
      testApp.get('/test-asset/:id', async (req, res, next) => {
        try {
          const asset = await getAsset(req.params.id, req);
          res.json({ data: asset });
        } catch (err) {
          next(err);
        }
      });
      testApp.use(errorHandler);

      const res = await request(testApp)
        .get('/test-asset/AST-1001')
        .set('Authorization', 'Bearer valid-jwt');

      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, 'ASSET_SERVICE_UNAVAILABLE');
      assert.equal(res.body.error.message, 'Asset Service unavailable');
    });
  });

  describe('AssetClient class & createAssetClient factory', () => {
    it('creates an instance bound to default credentials', async () => {
      mockHandler = (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: { id: '64f0a1234b567890a1b2c3d5', assetId: 'AST-1001' } }));
      };

      const client = createAssetClient('Bearer bound-token');
      assert.ok(client instanceof AssetClient);

      const asset = await client.getAsset('AST-1001');
      assert.equal(lastReceivedRequest.headers.authorization, 'Bearer bound-token');
      assert.equal(asset.assetId, 'AST-1001');
    });
  });

  describe('Auth and role middleware', () => {
    const testApp = express();

    testApp.get(
      '/protected/staff',
      requireAuth,
      requireRole('admin', 'staff'),
      (req, res) => {
        res.json({ user: req.user, token: req.token });
      }
    );

    testApp.get(
      '/protected/admin-only',
      auth,
      role('admin'),
      (req, res) => {
        res.json({ success: true, user: req.user });
      }
    );

    testApp.use(errorHandler);

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(testApp).get('/protected/staff');
      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('rejects invalid token signature with 401', async () => {
      const res = await request(testApp)
        .get('/protected/staff')
        .set('Authorization', 'Bearer bad.invalid.token');

      assert.equal(res.status, 401);
      assert.equal(res.body.error.code, 'UNAUTHORIZED');
    });

    it('allows permitted role and attaches req.user and req.token', async () => {
      const token = signToken({ _id: '64f0a1234b567890a1b2c3d4', email: 'staff@example.com', role: 'staff' });
      const res = await request(testApp)
        .get('/protected/staff')
        .set('Authorization', `Bearer ${token}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, 'staff@example.com');
      assert.equal(res.body.user.role, 'staff');
      assert.equal(res.body.token, token);
    });

    it('rejects forbidden role with 403', async () => {
      const technicianToken = signToken({ _id: '64f0a1234b567890a1b2c3d9', role: 'technician' });
      const res = await request(testApp)
        .get('/protected/admin-only')
        .set('Authorization', `Bearer ${technicianToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.error.code, 'FORBIDDEN');
    });

    it('tokenLifetimeSeconds decodes token expiry correctly', () => {
      const token = signToken({ _id: '64f0a1234b567890a1b2c3d4', role: 'admin' });
      const lifetime = tokenLifetimeSeconds(token);
      assert.ok(lifetime > 0);
    });
  });
});
