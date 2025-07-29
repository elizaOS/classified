/**
 * Database adapters module exports
 */

export { BaseDatabaseAdapter } from './base';
export { PGliteAdapter } from './pglite';
export { PostgreSQLAdapter } from './postgresql';
export {
  createDatabaseAdapter,
  getDatabaseAdapter,
  resetDatabaseAdapter,
  detectDatabaseEngine,
} from './factory';

export type {
  DatabaseAdapter,
  DatabaseConfig,
  DatabaseEngine,
  AdapterFactoryConfig,
} from './factory';
