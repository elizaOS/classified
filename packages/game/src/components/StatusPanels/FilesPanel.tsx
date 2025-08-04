/**
 * Files Panel Component
 * Extracted from GameInterface.tsx for better maintainability
 * Displays knowledge base files with upload and delete functionality
 */

import React from 'react';

export interface KnowledgeFile {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

interface FilesPanelProps {
  knowledgeFiles: KnowledgeFile[];
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteFile: (fileId: string) => void;
}

export const FilesPanel: React.FC<FilesPanelProps> = ({
  knowledgeFiles,
  onFileUpload,
  onDeleteFile,
}) => {
  return (
    <div className="status-content">
      <div className="status-header">
        <span>◎ KNOWLEDGE BASE [{knowledgeFiles.length}]</span>
      </div>

      <div className="scrollable-content">
        {knowledgeFiles.length === 0 ? (
          <div className="empty-state">No knowledge files loaded</div>
        ) : (
          knowledgeFiles.map((file) => (
            <div key={file.id} className="file-item">
              <span className="file-icon">📄</span>
              <div className="file-info">
                <span className="file-name">{file.title}</span>
                <span className="file-meta">
                  {file.type} • {new Date(file.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                className="file-action"
                onClick={() => onDeleteFile(file.id)}
                title="Delete file"
              >
                ✕
              </button>
            </div>
          ))
        )}

        <div className="file-upload">
          <input
            type="file"
            id="file-upload"
            style={{ display: 'none' }}
            onChange={onFileUpload}
            accept=".txt,.md,.pdf,.doc,.docx,.html,.json,.csv"
          />
          <label htmlFor="file-upload" className="upload-btn">
            + Upload File
          </label>
        </div>
      </div>
    </div>
  );
};

export default FilesPanel;
