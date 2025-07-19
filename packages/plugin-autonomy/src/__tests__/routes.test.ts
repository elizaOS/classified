import { describe, it, expect } from 'bun:test';
import { autonomyRoutes } from '../routes';

describe('Autonomy Routes', () => {
  it('should export autonomy routes', () => {
    expect(autonomyRoutes).toBeDefined();
    expect(Array.isArray(autonomyRoutes)).toBe(true);
    expect(autonomyRoutes.length).toBeGreaterThan(0);
  });

  it('should have all required routes', () => {
    const routePaths = autonomyRoutes.map((r) => `${r.type} ${r.path}`);

    expect(routePaths).toContain('GET /autonomy/status');
    expect(routePaths).toContain('POST /autonomy/enable');
    expect(routePaths).toContain('POST /autonomy/disable');
    expect(routePaths).toContain('POST /autonomy/toggle');
    expect(routePaths).toContain('POST /autonomy/interval');
  });

  it('should have proper route structure', () => {
    autonomyRoutes.forEach((route) => {
      expect(route).toHaveProperty('path');
      expect(route).toHaveProperty('type');
      expect(route).toHaveProperty('handler');
      expect(route).toHaveProperty('public');
      expect(route).toHaveProperty('name');

      expect(typeof route.path).toBe('string');
      expect(['GET', 'POST', 'PUT', 'DELETE']).toContain(route.type);
      expect(typeof route.handler).toBe('function');
      expect(typeof route.public).toBe('boolean');
      expect(typeof route.name).toBe('string');
    });
  });

  describe('Route Handlers', () => {
    it('status route should be a GET endpoint', () => {
      const statusRoute = autonomyRoutes.find((r) => r.path === '/autonomy/status');
      expect(statusRoute).toBeDefined();
      expect(statusRoute?.type).toBe('GET');
      expect(statusRoute?.public).toBe(true);
    });

    it('enable route should be a POST endpoint', () => {
      const enableRoute = autonomyRoutes.find((r) => r.path === '/autonomy/enable');
      expect(enableRoute).toBeDefined();
      expect(enableRoute?.type).toBe('POST');
      expect(enableRoute?.public).toBe(true);
    });

    it('disable route should be a POST endpoint', () => {
      const disableRoute = autonomyRoutes.find((r) => r.path === '/autonomy/disable');
      expect(disableRoute).toBeDefined();
      expect(disableRoute?.type).toBe('POST');
      expect(disableRoute?.public).toBe(true);
    });

    it('toggle route should be a POST endpoint', () => {
      const toggleRoute = autonomyRoutes.find((r) => r.path === '/autonomy/toggle');
      expect(toggleRoute).toBeDefined();
      expect(toggleRoute?.type).toBe('POST');
      expect(toggleRoute?.public).toBe(true);
    });

    it('interval route should be a POST endpoint', () => {
      const intervalRoute = autonomyRoutes.find((r) => r.path === '/autonomy/interval');
      expect(intervalRoute).toBeDefined();
      expect(intervalRoute?.type).toBe('POST');
      expect(intervalRoute?.public).toBe(true);
    });
  });
});
