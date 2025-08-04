/**
 * Knowledge Service
 * Handles knowledge base and file management operations
 * Extracted from the monolithic TauriService for better maintainability
 */

import { BaseTauriService } from './BaseTauriService';
import { KnowledgeItem } from '../types/shared';

export type TauriKnowledgeFile = KnowledgeItem;

// Dialog types (avoid runtime imports)
type DialogSaveOptions = {
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
};

type DialogOpenOptions = {
  multiple?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
};

type TauriDialogAPI = {
  save: (options?: DialogSaveOptions) => Promise<string | null>;
  open: (options?: DialogOpenOptions) => Promise<string | string[] | null>;
};

export class KnowledgeService extends BaseTauriService {
  private dialogAPI: TauriDialogAPI | null = null;

  protected async setupEventListeners(): Promise<void> {
    // Initialize dialog API for file operations
    await this.initializeDialogAPI();
  }

  private async initializeDialogAPI(): Promise<void> {
    try {
      const dialog = await import('@tauri-apps/plugin-dialog');
      this.dialogAPI = {
        save: dialog.save,
        open: dialog.open,
      };
    } catch (error) {
      console.warn('Dialog API not available:', error);
      this.dialogAPI = null;
    }
  }

  // Knowledge base management
  public async fetchKnowledgeFiles(): Promise<TauriKnowledgeFile[]> {
    try {
      const response = await this.ensureInitializedAndInvoke('get_knowledge_items', {
        agentId: this.agentId,
      });

      if (Array.isArray(response)) {
        return response as TauriKnowledgeFile[];
      }

      return [];
    } catch (error) {
      console.error('Failed to fetch knowledge files:', error);
      return [];
    }
  }

  public async uploadKnowledgeFile(file: File): Promise<void> {
    try {
      // Read file content
      const fileContent = await file.text();

      await this.ensureInitializedAndInvoke('upload_knowledge_file', {
        agentId: this.agentId,
        fileName: file.name,
        content: fileContent,
        fileType: file.type || 'text/plain',
      });
    } catch (error) {
      console.error('Failed to upload knowledge file:', error);
      throw new Error(`Upload failed: ${error}`);
    }
  }

  public async deleteKnowledgeFile(fileId: string): Promise<void> {
    return this.ensureInitializedAndInvoke('delete_knowledge_file', { fileId }) as Promise<void>;
  }

  // File selection operations
  public async selectFile(options?: {
    multiple?: boolean;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | string[] | null> {
    if (!this.dialogAPI) {
      throw new Error('File dialog is not available in this environment');
    }

    try {
      return await this.dialogAPI.open({
        multiple: options?.multiple || false,
        filters: options?.filters || [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Text Files', extensions: ['txt', 'md'] },
          { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
        ],
      });
    } catch (error) {
      console.error('File selection failed:', error);
      return null;
    }
  }

  public async saveFile(
    content: string,
    defaultPath?: string,
    filters?: Array<{ name: string; extensions: string[] }>
  ): Promise<string | null> {
    if (!this.dialogAPI) {
      throw new Error('File dialog is not available in this environment');
    }

    try {
      const filePath = await this.dialogAPI.save({
        defaultPath,
        filters: filters || [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (filePath) {
        // Use Tauri's core API to write the file
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('plugin:fs|write_text_file', { path: filePath, contents: content });
        return filePath;
      }

      return null;
    } catch (error) {
      console.error('File save failed:', error);
      return null;
    }
  }
}

// Export singleton instance
export const knowledgeService = new KnowledgeService();
export default knowledgeService;
