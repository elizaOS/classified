import { homedir } from 'os';
import { join, resolve } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { randomBytes } from 'crypto';

/**
 * Base directory for all ElizaOS temporary files
 * Defaults to ~/.eliza-temp or can be overridden with ELIZA_TEMP_DIR
 */
export const ELIZA_TEMP_BASE = process.env.ELIZA_TEMP_DIR || join(homedir(), '.eliza-temp');

/**
 * Subdirectories for different types of temporary files
 */
export const TEMP_DIRS = {
  databases: 'databases',
  logs: 'logs',
  uploads: 'uploads',
  generated: 'generated',
  clones: 'clones',
  test: 'test',
  cache: 'cache',
  build: 'build',
} as const;

/**
 * Ensures the base temp directory and all subdirectories exist
 */
export function ensureTempDirs(): void {
  // Create base directory
  if (!existsSync(ELIZA_TEMP_BASE)) {
    mkdirSync(ELIZA_TEMP_BASE, { recursive: true });
  }

  // Create subdirectories
  for (const subdir of Object.values(TEMP_DIRS)) {
    const path = join(ELIZA_TEMP_BASE, subdir);
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }
}

/**
 * Get the path for a specific type of temp file
 * @param type - The type of temp file (databases, logs, etc.)
 * @param filename - Optional filename or subdirectory
 * @returns Full path to the temp file/directory
 */
export function getTempPath(type: keyof typeof TEMP_DIRS, filename?: string): string {
  ensureTempDirs();
  const basePath = join(ELIZA_TEMP_BASE, TEMP_DIRS[type]);
  return filename ? join(basePath, filename) : basePath;
}

/**
 * Create a unique temporary directory
 * @param type - The type of temp directory
 * @param prefix - Optional prefix for the directory name
 * @returns Path to the created directory
 */
export function createTempDir(type: keyof typeof TEMP_DIRS, prefix?: string): string {
  const uniqueId = randomBytes(8).toString('hex');
  const dirname = prefix ? `${prefix}-${uniqueId}` : uniqueId;
  const dirPath = getTempPath(type, dirname);

  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }

  return dirPath;
}

/**
 * Clean up a specific temp directory
 * @param path - Path to clean up
 * @param force - Force removal even if path is outside temp directory
 */
export function cleanupTempPath(path: string, force = false): void {
  const resolvedPath = resolve(path);
  const tempBase = resolve(ELIZA_TEMP_BASE);

  // Safety check: only delete paths within temp directory unless forced
  if (!force && !resolvedPath.startsWith(tempBase)) {
    throw new Error(`Refusing to delete path outside temp directory: ${path}`);
  }

  if (existsSync(resolvedPath)) {
    rmSync(resolvedPath, { recursive: true, force: true });
  }
}

/**
 * Clean up all temp files of a specific type
 * @param type - The type of temp files to clean
 */
export function cleanupTempType(type: keyof typeof TEMP_DIRS): void {
  const dirPath = getTempPath(type);
  if (existsSync(dirPath)) {
    rmSync(dirPath, { recursive: true, force: true });
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Clean up all temp files
 */
export function cleanupAllTemp(): void {
  if (existsSync(ELIZA_TEMP_BASE)) {
    rmSync(ELIZA_TEMP_BASE, { recursive: true, force: true });
  }
  ensureTempDirs();
}

/**
 * Get a temp database path
 * @param name - Database name
 * @returns Path to database directory
 */
export function getTempDbPath(name?: string): string {
  if (!name) {
    name = `db-${Date.now()}-${randomBytes(4).toString('hex')}`;
  }
  return getTempPath('databases', name);
}

/**
 * Get a temp log file path
 * @param name - Log file name
 * @returns Path to log file
 */
export function getTempLogPath(name?: string): string {
  if (!name) {
    name = `log-${Date.now()}.log`;
  }
  return getTempPath('logs', name);
}

/**
 * Check if a path is within the temp directory
 * @param path - Path to check
 * @returns True if path is within temp directory
 */
export function isInTempDir(path: string): boolean {
  const resolvedPath = resolve(path);
  const tempBase = resolve(ELIZA_TEMP_BASE);
  return resolvedPath.startsWith(tempBase);
}

// Initialize temp directories on module load
ensureTempDirs();
