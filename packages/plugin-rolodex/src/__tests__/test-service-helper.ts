/**
 * Test service helper
 * Creates mock services for testing
 */

/**
 * Helper to create service instances for testing
 * Works around the readonly property issue in Service base class
 */
export function createRolodexService(runtime: any, config: any = {}) {
  const { RolodexService } = require('../services/RolodexService');

  // Create the service instance directly
  const service = new RolodexService();

  // Set up runtime and mock the necessary properties
  (service as any).runtime = runtime;
  (service as any).databaseReady = true; // Mock database ready state

  // Set the serviceName property if needed
  Object.defineProperty(service, 'serviceName', {
    value: 'rolodex',
    writable: true,
    configurable: true,
  });

  return service;
}
