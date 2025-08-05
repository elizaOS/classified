import React, { useState, useEffect } from 'react';
import TauriService, { Backup, BackupConfig, RestoreOptions } from '../services/TauriService';

export const BackupSettings: React.FC = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [config, setConfig] = useState<BackupConfig>({
    auto_backup_enabled: true,
    auto_backup_interval_hours: 4,
    max_backups_to_keep: 5,
    backup_directory: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    restore_database: true,
    restore_agent_state: true,
    restore_knowledge: true,
    restore_logs: false,
    force: false,
  });
  const [backupNotes, setBackupNotes] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    fetchBackups();
    fetchConfig();
  }, []);

  const fetchBackups = async () => {
    try {
      const backupList = await TauriService.listBackups();
      setBackups(backupList);
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    }
  };

  const fetchConfig = async () => {
    try {
      const backupConfig = await TauriService.getBackupConfig();
      setConfig(backupConfig);
    } catch (error) {
      console.error('Failed to fetch backup config:', error);
    }
  };

  const handleCreateBackup = async () => {
    setIsLoading(true);
    try {
      await TauriService.createBackup('manual', backupNotes || undefined);
      await fetchBackups();
      setShowCreateDialog(false);
      setBackupNotes('');
    } catch (error) {
      console.error('Failed to create backup:', error);
      setNotification({ type: 'error', message: `Failed to create backup: ${error}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;

    setConfirmDialog({
      open: true,
      title: '⚠️ Restore Backup Warning',
      message: `This will restore your agent to the state from ${new Date(
        selectedBackup.timestamp
      ).toLocaleString()}. This operation is DESTRUCTIVE and will overwrite current data. Are you sure you want to continue?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsLoading(true);
        try {
          await TauriService.restoreBackup(selectedBackup.id, restoreOptions);
          setNotification({
            type: 'success',
            message: 'Backup restored successfully! The application will restart.',
          });
          await TauriService.restartApplication();
        } catch (error) {
          console.error('Failed to restore backup:', error);
          setNotification({ type: 'error', message: `Failed to restore backup: ${error}` });
        } finally {
          setIsLoading(false);
          setShowRestoreDialog(false);
        }
      },
    });
  };

  const handleDeleteBackup = async (backupId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Backup',
      message: 'Are you sure you want to delete this backup?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await TauriService.deleteBackup(backupId);
          await fetchBackups();
        } catch (error) {
          console.error('Failed to delete backup:', error);
          setNotification({ type: 'error', message: `Failed to delete backup: ${error}` });
        }
      },
    });
  };

  const handleExportBackup = async (backup: Backup) => {
    try {
      const exportPath = await TauriService.exportBackup(backup.id);
      setNotification({
        type: 'success',
        message: `Backup exported successfully to: ${exportPath}`,
      });
    } catch (error) {
      console.error('Failed to export backup:', error);
      setNotification({ type: 'error', message: `Failed to export backup: ${error}` });
    }
  };

  const handleImportBackup = async () => {
    try {
      const importPath = await TauriService.selectFile({
        filters: [{ name: 'Backup Files', extensions: ['zip'] }],
      });

      if (importPath) {
        setIsLoading(true);
        await TauriService.importBackup(importPath);
        await fetchBackups();
        setNotification({ type: 'success', message: 'Backup imported successfully!' });
      }
    } catch (error) {
      console.error('Failed to import backup:', error);
      setNotification({ type: 'error', message: `Failed to import backup: ${error}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigUpdate = async () => {
    try {
      await TauriService.updateBackupConfig(config);
      setNotification({ type: 'success', message: 'Backup configuration updated successfully!' });
    } catch (error) {
      console.error('Failed to update config:', error);
      setNotification({ type: 'error', message: `Failed to update configuration: ${error}` });
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getBackupTypeIcon = (type: string): string => {
    switch (type) {
      case 'manual':
        return '✋';
      case 'automatic':
        return '🔄';
      case 'shutdown':
        return '🔌';
      default:
        return '📦';
    }
  };

  return (
    <div className="p-5 bg-black/60 border border-terminal-green-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-terminal-green uppercase tracking-wider">◎ BACKUP & RESTORE</h3>
        <div className="flex gap-2">
          <button 
            className="py-1.5 px-3 bg-terminal-blue/20 border border-terminal-blue/30 text-terminal-blue font-mono text-xs uppercase transition-none hover:bg-terminal-blue/30 hover:border-terminal-blue disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleImportBackup} 
            disabled={isLoading}
          >
            📥 Import
          </button>
          <button
            className="py-1.5 px-3 bg-terminal-green/20 border border-terminal-green/30 text-terminal-green font-mono text-xs uppercase transition-none hover:bg-terminal-green/30 hover:border-terminal-green disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setShowCreateDialog(true)}
            disabled={isLoading}
          >
            💾 Create Backup
          </button>
        </div>
      </div>

      {/* Auto-backup Configuration */}
      <div className="mb-6 p-4 bg-black/40 border border-terminal-green/20">
        <h4 className="text-xs font-bold text-terminal-green mb-3 uppercase tracking-wider">Automatic Backup Settings</h4>
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.auto_backup_enabled}
              onChange={(e) => setConfig({ ...config, auto_backup_enabled: e.target.checked })}
              className="w-3 h-3 accent-terminal-green cursor-pointer"
            />
            <span className="text-xs text-terminal-green">Enable automatic backups</span>
          </label>
          <div className="flex items-center gap-3">
            <label className="text-xs text-terminal-green/70">Backup interval (hours)</label>
            <input
              type="number"
              min="1"
              max="24"
              value={config.auto_backup_interval_hours}
              onChange={(e) =>
                setConfig({
                  ...config,
                  auto_backup_interval_hours: parseInt(e.target.value, 10) || 4,
                })
              }
              className="w-16 py-1 px-2 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none transition-none focus:border-terminal-green focus:bg-black/80"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-terminal-green/70">Keep last</label>
            <input
              type="number"
              min="1"
              max="20"
              value={config.max_backups_to_keep}
              onChange={(e) =>
                setConfig({ ...config, max_backups_to_keep: parseInt(e.target.value, 10) || 5 })
              }
              className="w-16 py-1 px-2 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none transition-none focus:border-terminal-green focus:bg-black/80"
            />
            <span className="text-xs text-terminal-green/70">backups</span>
          </div>
        </div>
        <button 
          className="mt-4 py-1.5 px-3 bg-terminal-green/20 border border-terminal-green/30 text-terminal-green font-mono text-xs uppercase transition-none hover:bg-terminal-green/30 hover:border-terminal-green"
          onClick={handleConfigUpdate}
        >
          Save Settings
        </button>
      </div>

      {/* Backup List */}
      <div>
        <h4 className="text-xs font-bold text-terminal-green mb-3 uppercase tracking-wider">Available Backups</h4>
        {backups.length === 0 ? (
          <div className="text-center text-gray-400 italic py-8 text-xs">No backups available</div>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div key={backup.id} className="flex items-start gap-3 p-3 bg-black/40 border border-terminal-green/20 hover:bg-black/50 hover:border-terminal-green/30 transition-none">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base leading-none">{getBackupTypeIcon(backup.backup_type)}</span>
                    <span className="text-sm font-bold text-terminal-green">{backup.metadata.agent_name}</span>
                    <span className="px-1.5 py-0.5 bg-terminal-green/20 border border-terminal-green/30 text-terminal-green text-[10px] uppercase">{backup.backup_type}</span>
                  </div>
                  <div className="text-[11px] text-gray-400 space-y-0.5">
                    <div>{new Date(backup.timestamp).toLocaleString()}</div>
                    <div>{formatBytes(backup.size_bytes)}</div>
                    {backup.metadata.notes && (
                      <div className="text-gray-500 italic">{backup.metadata.notes}</div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    className="p-1.5 bg-terminal-green/10 border border-terminal-green/20 text-terminal-green hover:bg-terminal-green/20 hover:border-terminal-green/30 transition-none"
                    onClick={() => {
                      setSelectedBackup(backup);
                      setShowRestoreDialog(true);
                    }}
                    title="Restore"
                  >
                    🔄
                  </button>
                  <button
                    className="p-1.5 bg-terminal-blue/10 border border-terminal-blue/20 text-terminal-blue hover:bg-terminal-blue/20 hover:border-terminal-blue/30 transition-none"
                    onClick={() => handleExportBackup(backup)}
                    title="Export"
                  >
                    📤
                  </button>
                  <button
                    className="p-1.5 bg-terminal-red/10 border border-terminal-red/20 text-terminal-red hover:bg-terminal-red/20 hover:border-terminal-red/30 transition-none"
                    onClick={() => handleDeleteBackup(backup.id)}
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Backup Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-terminal-green-border p-6 max-w-md w-[90%]">
            <h3 className="text-lg font-bold text-terminal-green mb-4 uppercase tracking-wider">Create Manual Backup</h3>
            <div className="mb-4">
              <label className="block mb-2 text-xs text-terminal-green/90 uppercase tracking-wider">Notes (optional)</label>
              <textarea
                value={backupNotes}
                onChange={(e) => setBackupNotes(e.target.value)}
                placeholder="Add notes about this backup..."
                rows={3}
                className="w-full py-2 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none transition-none placeholder:text-gray-500 focus:border-terminal-green focus:bg-black/80"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowCreateDialog(false)} 
                disabled={isLoading}
                className="py-2 px-4 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs uppercase transition-none hover:bg-terminal-green/10 hover:border-terminal-green disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateBackup} 
                disabled={isLoading} 
                className="py-2 px-4 bg-terminal-green/20 border border-terminal-green/30 text-terminal-green font-mono text-xs uppercase transition-none hover:bg-terminal-green/30 hover:border-terminal-green disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Dialog */}
      {showRestoreDialog && selectedBackup && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-terminal-green-border p-6 max-w-lg w-[90%]">
            <h3 className="text-lg font-bold text-terminal-red mb-4 uppercase tracking-wider">⚠️ Restore Backup</h3>
            <div className="mb-4 space-y-3">
              <p className="text-sm text-terminal-yellow">
                This will restore your agent to the state from{' '}
                <strong>{new Date(selectedBackup.timestamp).toLocaleString()}</strong>.
              </p>
              <p className="text-sm text-terminal-red font-bold">
                This operation is DESTRUCTIVE and cannot be undone!
              </p>

              <div className="mt-4 p-3 bg-black/60 border border-terminal-green/20">
                <h4 className="text-xs font-bold text-terminal-green mb-3 uppercase tracking-wider">Select components to restore:</h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restoreOptions.restore_database}
                      onChange={(e) =>
                        setRestoreOptions({ ...restoreOptions, restore_database: e.target.checked })
                      }
                      className="w-3 h-3 accent-terminal-green cursor-pointer"
                    />
                    <span className="text-xs text-terminal-green">Database (conversations, settings)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restoreOptions.restore_agent_state}
                      onChange={(e) =>
                        setRestoreOptions({
                          ...restoreOptions,
                          restore_agent_state: e.target.checked,
                        })
                      }
                      className="w-3 h-3 accent-terminal-green cursor-pointer"
                    />
                    <span className="text-xs text-terminal-green">Agent State (memory, context)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restoreOptions.restore_knowledge}
                      onChange={(e) =>
                        setRestoreOptions({ ...restoreOptions, restore_knowledge: e.target.checked })
                      }
                      className="w-3 h-3 accent-terminal-green cursor-pointer"
                    />
                    <span className="text-xs text-terminal-green">Knowledge Base</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restoreOptions.restore_logs}
                      onChange={(e) =>
                        setRestoreOptions({ ...restoreOptions, restore_logs: e.target.checked })
                      }
                      className="w-3 h-3 accent-terminal-green cursor-pointer"
                    />
                    <span className="text-xs text-terminal-green">Logs (optional)</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowRestoreDialog(false)} 
                disabled={isLoading}
                className="py-2 px-4 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs uppercase transition-none hover:bg-terminal-green/10 hover:border-terminal-green disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button 
                onClick={handleRestore} 
                disabled={isLoading} 
                className="py-2 px-4 bg-terminal-red/30 border border-terminal-red/30 text-terminal-red font-mono text-xs uppercase transition-none hover:bg-terminal-red/40 hover:border-terminal-red disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Restoring...' : 'Restore Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      {notification && (
        <div className={`fixed bottom-4 right-4 p-4 border font-mono text-xs animate-fade-in ${
          notification.type === 'success' 
            ? 'bg-terminal-green/20 border-terminal-green text-terminal-green' 
            : 'bg-terminal-red/20 border-terminal-red text-terminal-red'
        }`}>
          <div className="flex items-start gap-3">
            <span>{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="text-lg leading-none hover:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && confirmDialog.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-gradient-to-br from-gray-900 to-black border border-terminal-green-border p-6 max-w-md w-[90%]">
            <h2 className="text-lg font-bold text-terminal-green mb-4">{confirmDialog.title}</h2>
            <p className="text-sm text-gray-300 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setConfirmDialog(null)}
                className="py-2 px-4 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs uppercase transition-none hover:bg-terminal-green/10 hover:border-terminal-green"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDialog.onConfirm} 
                className="py-2 px-4 bg-terminal-red/30 border border-terminal-red/30 text-terminal-red font-mono text-xs uppercase transition-none hover:bg-terminal-red/40 hover:border-terminal-red"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};