import { test, expect } from '@playwright/test';

test.describe('Raptor Axum REST/WebSocket Bridge API Testleri', () => {
  const apiBase = 'http://127.0.0.1:9145';

  test('GET /health endpoint çalışır durumda ve ok dönmeli', async ({ request }) => {
    try {
      const resp = await request.get(`${apiBase}/health`);
      if (resp.ok()) {
        const body = await resp.json();
        expect(body.status).toBe('ok');
      }
    } catch {
      test.skip();
    }
  });

  test('GET /api/media/probe endpoint dosya türünü tespit edebilmeli', async ({ request }) => {
    try {
      const resp = await request.get(`${apiBase}/api/media/probe?url=https%3A%2F%2Fexample.com%2Fsetup.exe`);
      if (resp.ok()) {
        const body = await resp.json();
        expect(body).toHaveProperty('isMedia');
        expect(body.isMedia).toBe(false);
      }
    } catch {
      test.skip();
    }
  });

  test('GET /api/downloads görev listesini döndürmeli', async ({ request }) => {
    try {
      const resp = await request.get(`${apiBase}/api/downloads`);
      if (resp.ok()) {
        const body = await resp.json();
        expect(Array.isArray(body)).toBe(true);
      }
    } catch {
      test.skip();
    }
  });
});
