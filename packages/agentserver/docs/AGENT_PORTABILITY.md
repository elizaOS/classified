# Agent Export/Import Documentation

## Overview

The Agent Export/Import feature allows you to export all data associated with an agent (database records and uploaded files) to a ZIP archive, and then import that data to create a new agent or replace an existing one. This feature is useful for:

- Backing up agent data
- Moving agents between environments
- Cloning agents
- Sharing agent configurations

⚠️ **Warning**: Importing an agent with the `overwrite` flag will completely replace any existing agent data with the same ID.

## Export Format

Exported agents are packaged as ZIP files with the following structure:

```
agent-export-{agentId}-{timestamp}.zip
├── manifest.json         # Export metadata and version info
├── database/
│   ├── agent.json       # Agent configuration
│   ├── memories.json    # Agent memories with embeddings
│   ├── entities.json    # Known entities
│   ├── relationships.json # Entity relationships
│   ├── worlds.json      # Worlds the agent has joined
│   ├── rooms.json       # Rooms/channels
│   ├── participants.json # Room participants
│   ├── tasks.json       # Agent tasks
│   └── server_agents.json # Server associations
└── uploads/             # Agent uploaded files
    └── {original file structure}
```

## API Endpoints

### Export Agent

**Endpoint**: `POST /api/agents/:agentId/export`

**Response**: ZIP file download

**Example using curl**:

```bash
curl -X POST http://localhost:3000/api/agents/{agentId}/export \
  -o agent-backup.zip
```

**Example using JavaScript**:

```javascript
const response = await fetch(`/api/agents/${agentId}/export`, {
  method: 'POST',
});

if (response.ok) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-${agentId}-backup.zip`;
  a.click();
}
```

### Import Agent

**Endpoint**: `POST /api/agents/:agentId/import`

**Body**: `multipart/form-data`

- `archive`: ZIP file (required)
- `overwrite`: boolean (default: false)
- `skipValidation`: boolean (default: false)

**Example using curl**:

```bash
# Import to new agent (will fail if agent exists)
curl -X POST http://localhost:3000/api/agents/{newAgentId}/import \
  -F "archive=@agent-backup.zip"

# Import with overwrite (replaces existing agent)
curl -X POST http://localhost:3000/api/agents/{agentId}/import \
  -F "archive=@agent-backup.zip" \
  -F "overwrite=true"
```

**Example using JavaScript**:

```javascript
const formData = new FormData();
formData.append('archive', zipFile);
formData.append('overwrite', 'true');

const response = await fetch(`/api/agents/${agentId}/import`, {
  method: 'POST',
  body: formData,
});

const result = await response.json();
if (result.status === 'success') {
  console.log('Import successful:', result.data);
}
```

### Validate Import

**Endpoint**: `POST /api/agents/:agentId/import/validate`

**Body**: `multipart/form-data`

- `archive`: ZIP file (required)

This endpoint validates a ZIP file without actually importing it.

**Example**:

```bash
curl -X POST http://localhost:3000/api/agents/{agentId}/import/validate \
  -F "archive=@agent-backup.zip"
```

## Usage Examples

### Backing Up an Agent

```javascript
async function backupAgent(agentId) {
  const response = await fetch(`/api/agents/${agentId}/export`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Export failed');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-${agentId}-${new Date().toISOString()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### Cloning an Agent

```javascript
async function cloneAgent(sourceAgentId, targetAgentId) {
  // Step 1: Export source agent
  const exportResponse = await fetch(`/api/agents/${sourceAgentId}/export`, {
    method: 'POST',
  });

  if (!exportResponse.ok) {
    throw new Error('Export failed');
  }

  const zipBlob = await exportResponse.blob();

  // Step 2: Import to new agent ID
  const formData = new FormData();
  formData.append('archive', zipBlob, 'agent-export.zip');

  const importResponse = await fetch(`/api/agents/${targetAgentId}/import`, {
    method: 'POST',
    body: formData,
  });

  const result = await importResponse.json();
  if (result.status !== 'success') {
    throw new Error('Import failed: ' + result.error.message);
  }

  return result.data;
}
```

### Migrating Between Environments

```javascript
async function migrateAgent(agentId, sourceUrl, targetUrl) {
  // Export from source
  const exportResponse = await fetch(`${sourceUrl}/api/agents/${agentId}/export`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + sourceToken,
    },
  });

  const zipBlob = await exportResponse.blob();

  // Import to target
  const formData = new FormData();
  formData.append('archive', zipBlob);
  formData.append('overwrite', 'true');

  const importResponse = await fetch(`${targetUrl}/api/agents/${agentId}/import`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + targetToken,
    },
    body: formData,
  });

  return await importResponse.json();
}
```

## Error Handling

### Common Export Errors

| Error Code         | Description            | Solution                          |
| ------------------ | ---------------------- | --------------------------------- |
| `INVALID_AGENT_ID` | Invalid UUID format    | Ensure agent ID is a valid UUID   |
| `AGENT_NOT_FOUND`  | Agent doesn't exist    | Verify agent exists before export |
| `EXPORT_FAILED`    | General export failure | Check server logs for details     |

### Common Import Errors

| Error Code         | Description                 | Solution                               |
| ------------------ | --------------------------- | -------------------------------------- |
| `NO_FILE`          | No ZIP file provided        | Ensure file is attached to request     |
| `FILE_TOO_LARGE`   | ZIP exceeds 500MB limit     | Reduce file size or contact admin      |
| `INVALID_ARCHIVE`  | Invalid ZIP structure       | Ensure ZIP was created by export       |
| `VERSION_MISMATCH` | Incompatible export version | Update system or use compatible export |
| `AGENT_EXISTS`     | Agent already exists        | Use `overwrite=true` to replace        |
| `IMPORT_FAILED`    | General import failure      | Check server logs for details          |

## Security Considerations

1. **Authentication**: Ensure proper authentication is implemented before using these endpoints
2. **File Size Limits**: Default limit is 500MB to prevent DoS attacks
3. **Path Sanitization**: File paths are sanitized to prevent directory traversal
4. **Data Validation**: All imported data is validated against schemas

## Limitations

1. **Single Agent**: Each export contains only one agent
2. **File Size**: Maximum ZIP size is 500MB
3. **Version Compatibility**: Currently only supports version 1.0.0 exports
4. **Atomic Operations**: Import is atomic - either all data is imported or none

## Best Practices

1. **Regular Backups**: Export agents regularly for backup purposes
2. **Test Imports**: Always test imports in a development environment first
3. **Version Control**: Keep track of export versions for compatibility
4. **Validate First**: Use the validation endpoint before importing
5. **Monitor Storage**: Exported files can be large; monitor disk usage

## Programmatic Usage

### TypeScript Types

```typescript
interface ExportOptions {
  includeFiles?: boolean;
  compress?: boolean;
}

interface ImportOptions {
  overwrite?: boolean;
  validateManifest?: boolean;
  maxFileSize?: number;
}

interface ImportResult {
  success: boolean;
  agentId: string;
  agentName: string;
  tablesImported: string[];
  filesImported: number;
  errors?: string[];
}

interface ExportManifest {
  version: string;
  exportedAt: string;
  agentId: string;
  agentName: string;
  tables: string[];
  fileCount: number;
  elizaVersion: string;
}
```

### Service Classes

The implementation provides two service classes:

```typescript
// For exporting
const exportService = new AgentExportService(agentId, runtime, serverInstance);
const zipStream = await exportService.exportToZip(options);

// For importing
const importService = new AgentImportService(targetAgentId, serverInstance);
const result = await importService.importFromZip(zipBuffer, options);
```

## Troubleshooting

### Export Issues

**Problem**: Export fails with "Agent not found"

- **Solution**: Verify the agent ID exists in the system

**Problem**: Export takes too long

- **Solution**: Check if agent has many files or memories; consider excluding files

### Import Issues

**Problem**: Import fails with "Invalid manifest"

- **Solution**: Ensure ZIP file was created by the export function

**Problem**: Import succeeds but agent doesn't work

- **Solution**: Check if all required plugins are installed in target system

**Problem**: Vector embeddings not working after import

- **Solution**: Ensure pgvector extension is installed in target database

## Future Enhancements

1. **Incremental Backups**: Only export changes since last backup
2. **Compression Options**: Support different compression levels
3. **Selective Export**: Choose which data types to include
4. **Batch Operations**: Export/import multiple agents at once
5. **Cloud Storage**: Direct export to S3/GCS/Azure
6. **Encryption**: Option to encrypt exports for security
