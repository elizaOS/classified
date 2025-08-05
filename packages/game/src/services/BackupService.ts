/**
 * Backup Service
 * Handles backup creation, restoration, and management
 * Extracted from the monolithic TauriService for better maintainability
 */

import { BaseTauriService } from './BaseTauriService';

export class BackupService extends BaseTauriService {
  // Backup creation and management
  public async createBackup(backupType: string, notes?: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('create_backup', {
        backupType,
        notes,
        agentId: this.agentId,
      });
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw new Error(`Backup creation failed: ${error}`);
    }
  }

  public async restoreBackup(backupId: string, options: Record<string, unknown>): Promise<void> {
    try {
      await this.ensureInitializedAndInvoke('restore_backup', {
        backupId,
        options,
        agentId: this.agentId,
      });
    } catch (error) {
      console.error('Failed to restore backup:', error);
      throw new Error(`Backup restoration failed: ${error}`);
    }
  }

  public async listBackups(): Promise<Record<string, unknown>[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('list_backups', {
        agentId: this.agentId,
      });

      if (Array.isArray(response)) {
        return response as Record<string, unknown>[];
      }

      return [];
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  public async deleteBackup(backupId: string): Promise<void> {
    return this.ensureInitializedAndInvoke('delete_backup', { backupId }) as Promise<void>;
  }

  // Backup configuration
  public async getBackupConfig(): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_backup_config');
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to get backup config:', error);
      return {};
    }
  }

  public async updateBackupConfig(config: Record<string, unknown>): Promise<void> {
    return this.ensureInitializedAndInvoke('update_backup_config', { config }) as Promise<void>;
  }

  // Import/Export operations
  public async exportBackup(backupId: string): Promise<string> {
    try {
      // Try to get dialog API for save location
      const dialog = await import('@tauri-apps/plugin-dialog');

      const savePath = await dialog.save({
        defaultPath: `backup-${backupId}.json`,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!savePath) {
        throw new Error('Export cancelled by user');
      }

      await this.ensureInitializedAndInvoke('export_backup', {
        backupId,
        exportPath: savePath,
      });

      return savePath;
    } catch (error) {
      console.error('Failed to export backup:', error);
      throw new Error(`Backup export failed: ${error}`);
    }
  }

  public async importBackup(importPath: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.ensureInitializedAndInvoke('import_backup', {
        importPath,
        agentId: this.agentId,
      });
      return (response as Record<string, unknown>) || {};
    } catch (error) {
      console.error('Failed to import backup:', error);
      throw new Error(`Backup import failed: ${error}`);
    }
  }

  // Select file for import
  public async selectBackupFile(): Promise<string | null> {
    try {
      const dialog = await import('@tauri-apps/plugin-dialog');

      const result = await dialog.open({
        multiple: false,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      return Array.isArray(result) ? result[0] : result;
    } catch (error) {
      console.error('Failed to select backup file:', error);
      return null;
    }
  }
}

// Export singleton instance
export const backupService = new BackupService();
export default backupService;
