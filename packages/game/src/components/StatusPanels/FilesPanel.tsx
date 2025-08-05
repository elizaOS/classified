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
    <div className="flex flex-col h-full bg-black text-terminal-green font-mono">
      <div className="p-4 border-b border-terminal-green bg-black/90">
        <span className="font-bold text-terminal-green">
          ◎ KNOWLEDGE BASE [{knowledgeFiles.length}]
        </span>
      </div>

      <div className="flex-1 p-4 overflow-y-auto min-h-0">
        {knowledgeFiles.length === 0 ? (
          <div className="text-center text-gray-400 italic py-10 px-5">
            No knowledge files loaded
          </div>
        ) : (
          knowledgeFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-start gap-3 p-3 mb-2 border border-terminal-green-border bg-terminal-green-subtle transition-all duration-200 hover:bg-terminal-green/10 hover:border-terminal-green/50"
            >
              <span className="text-base leading-none mt-0.5">📄</span>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-terminal-green text-sm block mb-1">
                  {file.title}
                </span>
                <span className="text-gray-400 text-xs">
                  {file.type} • {new Date(file.createdAt).toLocaleDateString()}
                </span>
              </div>
              <button
                className="text-terminal-red hover:text-terminal-red/80 transition-colors duration-200 text-sm px-2 py-1 border border-terminal-red/30 hover:border-terminal-red hover:bg-terminal-red/10"
                onClick={() => onDeleteFile(file.id)}
                title="Delete file"
              >
                ✕
              </button>
            </div>
          ))
        )}

        <div className="mt-4">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={onFileUpload}
            accept=".txt,.md,.pdf,.doc,.docx,.html,.json,.csv"
          />
          <label
            htmlFor="file-upload"
            className="block text-center py-3 px-4 border border-dashed border-terminal-green-border text-terminal-green hover:border-terminal-green hover:bg-terminal-green/10 transition-all duration-200 cursor-pointer uppercase text-xs font-bold tracking-wider"
          >
            + Upload File
          </label>
        </div>
      </div>
    </div>
  );
};

export default FilesPanel;
