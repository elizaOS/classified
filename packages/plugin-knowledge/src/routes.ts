import type {
  IAgentRuntime,
  Route,
  UUID,
  Memory,
  KnowledgeItem as _KnowledgeItem,
} from '@elizaos/core';
import { MemoryType as _MemoryType, createUniqueUuid, logger, ModelType } from '@elizaos/core';
import { getTempPath } from './utils/temp';
import { KnowledgeService } from './service';
import fs from 'node:fs'; // For file operations in upload
import path from 'node:path'; // For path operations
import multer from 'multer'; // For handling multipart uploads
import { fetchUrlContent, normalizeS3Url } from './utils.ts'; // Import utils functions

// Create multer configuration function that uses runtime settings
const createUploadMiddleware = (runtime: IAgentRuntime) => {
  const uploadDir = runtime.getSetting('KNOWLEDGE_UPLOAD_DIR') || getTempPath('uploads');
  const maxFileSize = parseInt(runtime.getSetting('KNOWLEDGE_MAX_FILE_SIZE') || '52428800', 10); // 50MB default
  const maxFiles = parseInt(runtime.getSetting('KNOWLEDGE_MAX_FILES') || '10', 10);
  const allowedMimeTypes = runtime.getSetting('KNOWLEDGE_ALLOWED_MIME_TYPES')?.split(',') || [
    'text/plain',
    'text/markdown',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/html',
    'application/json',
    'application/xml',
    'text/csv',
  ];

  return multer({
    dest: uploadDir,
    limits: {
      fileSize: maxFileSize,
      files: maxFiles,
    },
    fileFilter: (req, file, cb) => {
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(
          new Error(
            `File type ${file.mimetype} not allowed. Allowed types: ${allowedMimeTypes.join(', ')}`
          )
        );
      }
    },
  });
};

// Add this type declaration to fix Express.Multer.File error
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

// Helper to send success response
function sendSuccess(res: any, data: any, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, data }));
}

// Helper to send error response
function sendError(res: any, status: number, code: string, message: string, details?: string) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: { code, message, details } }));
}

// Helper to clean up a single file
const cleanupFile = (filePath: string) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      logger.error(`Error cleaning up file ${filePath}:`, error);
    }
  }
};

// Helper to clean up multiple files
const cleanupFiles = (files: MulterFile[]) => {
  if (files) {
    files.forEach((file) => cleanupFile(file.path));
  }
};

// Main upload handler (without multer, multer is applied by wrapper)
async function uploadKnowledgeHandler(req: any, res: any, runtime: IAgentRuntime) {
  const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
  if (!service) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'KnowledgeService not found');
  }

  // Check if the request has uploaded files or URLs
  const hasUploadedFiles = req.files && req.files.length > 0;
  const isJsonRequest = !hasUploadedFiles && req.body && (req.body.fileUrl || req.body.fileUrls);

  if (!hasUploadedFiles && !isJsonRequest) {
    return sendError(res, 400, 'INVALID_REQUEST', 'Request must contain either files or URLs');
  }

  try {
    // Process multipart requests (file uploads)
    if (hasUploadedFiles) {
      const files = req.files as MulterFile[];
      if (!files || files.length === 0) {
        return sendError(res, 400, 'NO_FILES', 'No files uploaded');
      }

      // Get agentId from request body or query parameter BEFORE processing files
      // IMPORTANT: We require explicit agent ID to prevent cross-agent contamination
      const agentId = (req.body.agentId as UUID) || (req.query.agentId as UUID);

      if (!agentId) {
        logger.error('[KNOWLEDGE UPLOAD HANDLER] No agent ID provided in request');
        return sendError(
          res,
          400,
          'MISSING_AGENT_ID',
          'Agent ID is required for uploading knowledge'
        );
      }

      const worldId = (req.body.worldId as UUID) || agentId;
      logger.info(`[KNOWLEDGE UPLOAD HANDLER] Processing upload for agent: ${agentId}`);

      const processingPromises = files.map(async (file, index) => {
        const originalFilename = file.originalname;
        const filePath = file.path;

        const knowledgeId: UUID =
          (req.body?.documentIds && req.body.documentIds[index]) ||
          req.body?.documentId ||
          (createUniqueUuid(runtime, `knowledge-${originalFilename}-${Date.now()}`) as UUID);

        logger.debug(
          `[KNOWLEDGE UPLOAD HANDLER] File: ${originalFilename}, Agent ID: ${agentId}, World ID: ${worldId}, Knowledge ID: ${knowledgeId}`
        );

        try {
          const fileBuffer = await fs.promises.readFile(filePath);
          const base64Content = fileBuffer.toString('base64');

          // Construct AddKnowledgeOptions directly using available variables
          const addKnowledgeOpts: import('./types.ts').AddKnowledgeOptions = {
            agentId, // Pass the agent ID from frontend
            clientDocumentId: knowledgeId, // This is knowledgeItem.id
            contentType: file.mimetype, // Directly from multer file object
            originalFilename, // Directly from multer file object
            content: base64Content, // The base64 string of the file
            worldId,
            roomId: agentId, // Use the correct agent ID
            entityId: agentId, // Use the correct agent ID
          };

          await service.addKnowledge(addKnowledgeOpts);

          cleanupFile(filePath);
          return {
            id: knowledgeId,
            filename: originalFilename,
            type: file.mimetype,
            size: file.size,
            uploadedAt: Date.now(),
            status: 'success',
          };
        } catch (fileError: any) {
          logger.error(
            `[KNOWLEDGE UPLOAD HANDLER] Error processing file ${file.originalname}: ${fileError}`
          );
          cleanupFile(filePath);
          return {
            id: knowledgeId,
            filename: originalFilename,
            status: 'error_processing',
            error: fileError.message,
          };
        }
      });

      const results = await Promise.all(processingPromises);
      sendSuccess(res, results);
    }
    // Process JSON requests (URL uploads)
    else if (isJsonRequest) {
      // Accept either an array of URLs or a single URL
      const fileUrls = Array.isArray(req.body.fileUrls)
        ? req.body.fileUrls
        : req.body.fileUrl
          ? [req.body.fileUrl]
          : [];

      if (fileUrls.length === 0) {
        return sendError(res, 400, 'MISSING_URL', 'File URL is required');
      }

      // Get agentId from request body or query parameter
      // IMPORTANT: We require explicit agent ID to prevent cross-agent contamination
      const agentId = (req.body.agentId as UUID) || (req.query.agentId as UUID);

      if (!agentId) {
        logger.error('[KNOWLEDGE URL HANDLER] No agent ID provided in request');
        return sendError(
          res,
          400,
          'MISSING_AGENT_ID',
          'Agent ID is required for uploading knowledge from URLs'
        );
      }

      logger.info(`[KNOWLEDGE URL HANDLER] Processing URL upload for agent: ${agentId}`);

      // Process each URL as a distinct file
      const processingPromises = fileUrls.map(async (fileUrl: string) => {
        try {
          // Normalize the URL for storage (remove query parameters)
          const normalizedUrl = normalizeS3Url(fileUrl);

          // Create a unique ID based on the normalized URL
          const knowledgeId = createUniqueUuid(runtime, normalizedUrl) as UUID;

          // Extract filename from URL for better display
          const urlObject = new URL(fileUrl);
          const pathSegments = urlObject.pathname.split('/');
          // Decode URL-encoded characters and handle empty filename
          const encodedFilename = pathSegments[pathSegments.length - 1] || 'document.pdf';
          const originalFilename = decodeURIComponent(encodedFilename);

          logger.info(`[KNOWLEDGE URL HANDLER] Fetching content from URL: ${fileUrl}`);

          // Fetch the content from the URL
          const { content, contentType: fetchedContentType } = await fetchUrlContent(fileUrl);

          // Determine content type, using the one from the server response or inferring from extension
          let contentType = fetchedContentType;

          // If content type is generic, try to infer from file extension
          if (contentType === 'application/octet-stream') {
            const fileExtension = originalFilename.split('.').pop()?.toLowerCase();
            if (fileExtension) {
              if (['pdf'].includes(fileExtension)) {
                contentType = 'application/pdf';
              } else if (['txt', 'text'].includes(fileExtension)) {
                contentType = 'text/plain';
              } else if (['md', 'markdown'].includes(fileExtension)) {
                contentType = 'text/markdown';
              } else if (['doc', 'docx'].includes(fileExtension)) {
                contentType = 'application/msword';
              } else if (['html', 'htm'].includes(fileExtension)) {
                contentType = 'text/html';
              } else if (['json'].includes(fileExtension)) {
                contentType = 'application/json';
              } else if (['xml'].includes(fileExtension)) {
                contentType = 'application/xml';
              }
            }
          }

          // Construct AddKnowledgeOptions with the fetched content
          const addKnowledgeOpts: import('./types.ts').AddKnowledgeOptions = {
            agentId, // Pass the agent ID from frontend
            clientDocumentId: knowledgeId,
            contentType,
            originalFilename,
            content, // Use the base64 encoded content from the URL
            worldId: agentId,
            roomId: agentId,
            entityId: agentId,
            // Store the normalized URL in metadata
            metadata: {
              url: normalizedUrl,
            },
          };

          logger.debug(
            `[KNOWLEDGE URL HANDLER] Processing knowledge from URL: ${fileUrl} (type: ${contentType})`
          );
          const result = await service.addKnowledge(addKnowledgeOpts);

          return {
            id: result.clientDocumentId,
            fileUrl,
            filename: originalFilename,
            message: 'Knowledge created successfully',
            createdAt: Date.now(),
            fragmentCount: result.fragmentCount,
            status: 'success',
          };
        } catch (urlError: any) {
          logger.error(`[KNOWLEDGE URL HANDLER] Error processing URL ${fileUrl}: ${urlError}`);
          return {
            fileUrl,
            status: 'error_processing',
            error: urlError.message,
          };
        }
      });

      const results = await Promise.all(processingPromises);
      sendSuccess(res, results);
    }
  } catch (error: any) {
    logger.error('[KNOWLEDGE HANDLER] Error processing knowledge:', error);
    if (hasUploadedFiles) {
      cleanupFiles(req.files as MulterFile[]);
    }
    sendError(res, 500, 'PROCESSING_ERROR', 'Failed to process knowledge', error.message);
  }
}

// Update knowledge handler
async function updateKnowledgeHandler(req: any, res: any, runtime: IAgentRuntime) {
  const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
  if (!service) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'KnowledgeService not found');
  }

  const knowledgeId = req.params.knowledgeId;
  if (!knowledgeId || knowledgeId.length < 36) {
    return sendError(res, 400, 'INVALID_ID', 'Invalid Knowledge ID format');
  }

  try {
    const agentId = (req.body.agentId as UUID) || (req.query.agentId as UUID);
    if (!agentId) {
      return sendError(res, 400, 'MISSING_AGENT_ID', 'Agent ID is required');
    }

    // Get the existing document
    const existingDoc = await runtime.getMemoryById(knowledgeId as UUID);
    if (!existingDoc) {
      return sendError(res, 404, 'NOT_FOUND', 'Knowledge document not found');
    }

    // Check if this is a file upload or metadata update
    const isFileUpdate = req.files && req.files.length > 0;
    const isMetadataUpdate = req.body.metadata || req.body.title;

    if (isFileUpdate) {
      // Delete the old document and its fragments
      await service.deleteMemory(knowledgeId as UUID);

      // Process the new file as a replacement
      const file = req.files[0] as MulterFile;
      const fileBuffer = await fs.promises.readFile(file.path);
      const base64Content = fileBuffer.toString('base64');

      const addKnowledgeOpts: import('./types.ts').AddKnowledgeOptions = {
        agentId,
        clientDocumentId: knowledgeId as UUID, // Keep the same ID
        contentType: file.mimetype,
        originalFilename: file.originalname,
        content: base64Content,
        worldId: existingDoc.worldId || agentId,
        roomId: existingDoc.roomId || agentId,
        entityId: existingDoc.entityId || agentId,
        metadata: {
          ...(existingDoc.metadata || {}),
          ...(req.body.metadata || {}),
          updatedAt: new Date().toISOString(),
          version: ((existingDoc.metadata as any)?.version || 0) + 1,
        },
      };

      const result = await service.addKnowledge(addKnowledgeOpts);
      cleanupFile(file.path);

      sendSuccess(res, {
        id: result.clientDocumentId,
        message: 'Knowledge document updated successfully',
        fragmentCount: result.fragmentCount,
        version: ((existingDoc.metadata as any)?.version || 0) + 1,
      });
    } else if (isMetadataUpdate) {
      // Update only metadata
      const updatedMetadata = {
        ...(existingDoc.metadata || {}),
        ...(req.body.metadata || {}),
        updatedAt: new Date().toISOString(),
      };

      if (req.body.title) {
        updatedMetadata.title = req.body.title;
      }

      await runtime.updateMemory({
        id: knowledgeId as UUID,
        metadata: updatedMetadata,
      });

      sendSuccess(res, {
        id: knowledgeId,
        message: 'Knowledge metadata updated successfully',
      });
    } else {
      return sendError(res, 400, 'INVALID_REQUEST', 'No update data provided');
    }
  } catch (error: any) {
    logger.error('[KNOWLEDGE UPDATE HANDLER] Error updating knowledge:', error);
    if (req.files) {
      cleanupFiles(req.files as MulterFile[]);
    }
    sendError(res, 500, 'UPDATE_ERROR', 'Failed to update knowledge', error.message);
  }
}

async function getKnowledgeDocumentsHandler(req: any, res: any, runtime: IAgentRuntime) {
  const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
  if (!service) {
    return sendError(
      res,
      500,
      'SERVICE_NOT_FOUND',
      'KnowledgeService not found for getKnowledgeDocumentsHandler'
    );
  }

  try {
    const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 20;
    const before = req.query.before ? Number.parseInt(req.query.before as string, 10) : Date.now();
    const includeEmbedding = req.query.includeEmbedding === 'true';
    const _agentId = req.query.agentId as UUID | undefined;

    // Retrieve fileUrls if they are provided in the request
    const fileUrls = req.query.fileUrls
      ? typeof req.query.fileUrls === 'string' && req.query.fileUrls.includes(',')
        ? req.query.fileUrls.split(',')
        : [req.query.fileUrls]
      : null;

    const memories = await service.getMemories({
      tableName: 'documents',
      count: limit,
      end: before,
    });

    // Filter documents by URL if fileUrls is provided
    let filteredMemories = memories;
    if (fileUrls && fileUrls.length > 0) {
      // Normalize the URLs for comparison
      const normalizedRequestUrls = fileUrls.map((url: string) => normalizeS3Url(url));

      // Create IDs based on normalized URLs for comparison
      const urlBasedIds = normalizedRequestUrls.map((url: string) =>
        createUniqueUuid(runtime, url)
      );

      filteredMemories = memories.filter(
        (memory) =>
          urlBasedIds.includes(memory.id) || // If the ID corresponds directly
          // Or if the URL is stored in the metadata (check if it exists)
          (memory.metadata &&
            'url' in memory.metadata &&
            typeof memory.metadata.url === 'string' &&
            normalizedRequestUrls.includes(normalizeS3Url(memory.metadata.url)))
      );

      logger.debug(
        `[KNOWLEDGE GET HANDLER] Filtered documents by URLs: ${fileUrls.length} URLs, found ${filteredMemories.length} matching documents`
      );
    }

    const cleanMemories = includeEmbedding
      ? filteredMemories
      : filteredMemories.map((memory: Memory) => ({
          ...memory,
          embedding: undefined,
        }));
    sendSuccess(res, {
      memories: cleanMemories,
      urlFiltered: fileUrls ? true : false,
      totalFound: cleanMemories.length,
      totalRequested: fileUrls ? fileUrls.length : 0,
    });
  } catch (error: any) {
    logger.error('[KNOWLEDGE GET HANDLER] Error retrieving documents:', error);
    sendError(res, 500, 'RETRIEVAL_ERROR', 'Failed to retrieve documents', error.message);
  }
}

async function deleteKnowledgeDocumentHandler(req: any, res: any, runtime: IAgentRuntime) {
  logger.debug(`[KNOWLEDGE DELETE HANDLER] Received DELETE request:
    - path: ${req.path}
    - params: ${JSON.stringify(req.params)}
  `);

  const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
  if (!service) {
    return sendError(
      res,
      500,
      'SERVICE_NOT_FOUND',
      'KnowledgeService not found for deleteKnowledgeDocumentHandler'
    );
  }

  // Get the ID directly from the route parameters
  const knowledgeId = req.params.knowledgeId;

  if (!knowledgeId || knowledgeId.length < 36) {
    logger.error(`[KNOWLEDGE DELETE HANDLER] Invalid knowledge ID format: ${knowledgeId}`);
    return sendError(res, 400, 'INVALID_ID', 'Invalid Knowledge ID format');
  }

  try {
    // Use type conversion with template string to ensure the typing is correct
    const typedKnowledgeId = knowledgeId as `${string}-${string}-${string}-${string}-${string}`;
    logger.debug(
      `[KNOWLEDGE DELETE HANDLER] Attempting to delete document with ID: ${typedKnowledgeId}`
    );

    await service.deleteMemory(typedKnowledgeId);
    logger.info(
      `[KNOWLEDGE DELETE HANDLER] Successfully deleted document with ID: ${typedKnowledgeId}`
    );
    sendSuccess(res, null, 204);
  } catch (error: any) {
    logger.error(`[KNOWLEDGE DELETE HANDLER] Error deleting document ${knowledgeId}:`, error);
    sendError(res, 500, 'DELETE_ERROR', 'Failed to delete document', error.message);
  }
}

async function getKnowledgeByIdHandler(req: any, res: any, runtime: IAgentRuntime) {
  logger.debug(`[KNOWLEDGE GET BY ID HANDLER] Received GET request:
    - path: ${req.path}
    - params: ${JSON.stringify(req.params)}
  `);

  const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
  if (!service) {
    return sendError(
      res,
      500,
      'SERVICE_NOT_FOUND',
      'KnowledgeService not found for getKnowledgeByIdHandler'
    );
  }

  // Get the ID directly from the route parameters
  const knowledgeId = req.params.knowledgeId;

  if (!knowledgeId || knowledgeId.length < 36) {
    logger.error(`[KNOWLEDGE GET BY ID HANDLER] Invalid knowledge ID format: ${knowledgeId}`);
    return sendError(res, 400, 'INVALID_ID', 'Invalid Knowledge ID format');
  }

  try {
    logger.debug(`[KNOWLEDGE GET BY ID HANDLER] Retrieving document with ID: ${knowledgeId}`);
    const _agentId = req.query.agentId as UUID | undefined;

    // Use the service methods instead of calling runtime directly
    // We can't use getMemoryById directly because it's not exposed by the service
    // So we'll use getMemories with a filter
    const memories = await service.getMemories({
      tableName: 'documents',
      count: 1000,
    });

    // Use type conversion with template string to ensure the typing is correct
    const typedKnowledgeId = knowledgeId as `${string}-${string}-${string}-${string}-${string}`;

    // Find the document with the corresponding ID
    const document = memories.find((memory) => memory.id === typedKnowledgeId);

    if (!document) {
      return sendError(res, 404, 'NOT_FOUND', `Knowledge with ID ${typedKnowledgeId} not found`);
    }

    // Filter the embedding if necessary
    const cleanDocument = {
      ...document,
      embedding: undefined,
    };

    sendSuccess(res, { document: cleanDocument });
  } catch (error: any) {
    logger.error(`[KNOWLEDGE GET BY ID HANDLER] Error retrieving document ${knowledgeId}:`, error);
    sendError(res, 500, 'RETRIEVAL_ERROR', 'Failed to retrieve document', error.message);
  }
}

// Handler for the panel itself - serves the actual HTML frontend
async function knowledgePanelHandler(req: any, res: any, runtime: IAgentRuntime) {
  const agentId = runtime.agentId; // Get from runtime context

  logger.debug(`[KNOWLEDGE PANEL] Serving panel for agent ${agentId}, request path: ${req.path}`);

  try {
    const currentDir = path.dirname(new URL(import.meta.url).pathname);
    // Serve the main index.html from Vite's build output
    const frontendPath = path.join(currentDir, '../dist/index.html');

    logger.debug(`[KNOWLEDGE PANEL] Looking for frontend at: ${frontendPath}`);

    if (fs.existsSync(frontendPath)) {
      const html = await fs.promises.readFile(frontendPath, 'utf8');
      // Inject config into existing HTML
      const injectedHtml = html.replace(
        '<head>',
        `<head>
          <script>
            window.ELIZA_CONFIG = {
              agentId: '${agentId}',
              apiBase: '/api'
            };
          </script>`
      );
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(injectedHtml);
    } else {
      // Fallback: serve a basic HTML page that loads the JS bundle from the assets folder
      // Use manifest.json to get the correct asset filenames if it exists
      let cssFile = 'index.css';
      let jsFile = 'index.ts';

      const manifestPath = path.join(currentDir, '../dist/manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const manifestContent = await fs.promises.readFile(manifestPath, 'utf8');
          const manifest = JSON.parse(manifestContent);

          // Look for the entry points in the manifest
          // Different Vite versions might structure the manifest differently
          for (const [key, value] of Object.entries(manifest)) {
            if (typeof value === 'object' && value !== null) {
              if (key.endsWith('.css') || (value as any).file?.endsWith('.css')) {
                cssFile = (value as any).file || key;
              }
              if (key.endsWith('.ts') || (value as any).file?.endsWith('.ts')) {
                jsFile = (value as any).file || key;
              }
            }
          }
        } catch (manifestError) {
          logger.error('[KNOWLEDGE PANEL] Error reading manifest:', manifestError);
          // Continue with default filenames if manifest can't be read
        }
      }

      logger.debug(`[KNOWLEDGE PANEL] Using fallback with CSS: ${cssFile}, JS: ${jsFile}`);

      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Knowledge</title>
    <script>
      window.ELIZA_CONFIG = {
        agentId: '${agentId}',
        apiBase: '/api'
      };
    </script>
    <link rel="stylesheet" href="./assets/${cssFile}">
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .loading { text-align: center; padding: 40px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div id="root">
            <div class="loading">Loading Knowledge Library...</div>
        </div>
    </div>
    <script type="module" src="./assets/${jsFile}"></script>
</body>
</html>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    }
  } catch (error: any) {
    logger.error('[KNOWLEDGE PANEL] Error serving frontend:', error);
    sendError(res, 500, 'FRONTEND_ERROR', 'Failed to load knowledge panel', error.message);
  }
}

// Generic handler to serve static assets from the dist/assets directory
async function frontendAssetHandler(req: any, res: any, _runtime: IAgentRuntime) {
  try {
    logger.debug(
      `[KNOWLEDGE ASSET HANDLER] Called with req.path: ${req.path}, req.originalUrl: ${req.originalUrl}, req.params: ${JSON.stringify(req.params)}`
    );
    const currentDir = path.dirname(new URL(import.meta.url).pathname);

    const assetRequestPath = req.path; // This is the full path, e.g., /api/agents/X/plugins/knowledge/assets/file.js
    const assetsMarker = '/assets/';
    const assetsStartIndex = assetRequestPath.indexOf(assetsMarker);

    let assetName = null;
    if (assetsStartIndex !== -1) {
      assetName = assetRequestPath.substring(assetsStartIndex + assetsMarker.length);
    }

    if (!assetName || assetName.includes('..')) {
      // Basic sanitization
      return sendError(
        res,
        400,
        'BAD_REQUEST',
        `Invalid asset name: '${assetName}' from path ${assetRequestPath}`
      );
    }

    const assetPath = path.join(currentDir, '../dist/assets', assetName);
    logger.debug(`[KNOWLEDGE ASSET HANDLER] Attempting to serve asset: ${assetPath}`);

    if (fs.existsSync(assetPath)) {
      const fileStream = fs.createReadStream(assetPath);
      let contentType = 'application/octet-stream'; // Default
      if (assetPath.endsWith('.ts')) {
        contentType = 'application/javascript';
      } else if (assetPath.endsWith('.css')) {
        contentType = 'text/css';
      }
      res.writeHead(200, { 'Content-Type': contentType });
      fileStream.pipe(res);
    } else {
      sendError(res, 404, 'NOT_FOUND', `Asset not found: ${req.url}`);
    }
  } catch (error: any) {
    logger.error(`[KNOWLEDGE ASSET HANDLER] Error serving asset ${req.url}:`, error);
    sendError(res, 500, 'ASSET_ERROR', `Failed to load asset ${req.url}`, error.message);
  }
}

async function getKnowledgeChunksHandler(req: any, res: any, runtime: IAgentRuntime) {
  const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
  if (!service) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'KnowledgeService not found');
  }

  try {
    const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 100;
    const before = req.query.before ? Number.parseInt(req.query.before as string, 10) : Date.now();
    const documentId = req.query.documentId as string | undefined;
    const _agentId = req.query.agentId as UUID | undefined;

    // Get knowledge chunks/fragments for graph view
    const chunks = await service.getMemories({
      tableName: 'knowledge',
      count: limit,
      end: before,
    });

    // Filter chunks by documentId if provided
    const filteredChunks = documentId
      ? chunks.filter(
          (chunk) =>
            chunk.metadata &&
            typeof chunk.metadata === 'object' &&
            'documentId' in chunk.metadata &&
            chunk.metadata.documentId === documentId
        )
      : chunks;

    sendSuccess(res, { chunks: filteredChunks });
  } catch (error: any) {
    logger.error('[KNOWLEDGE CHUNKS GET HANDLER] Error retrieving chunks:', error);
    sendError(res, 500, 'RETRIEVAL_ERROR', 'Failed to retrieve knowledge chunks', error.message);
  }
}

async function searchKnowledgeHandler(req: any, res: any, runtime: IAgentRuntime) {
  const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
  if (!service) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'KnowledgeService not found');
  }

  try {
    const searchText = req.query.q as string;

    // Parse threshold with NaN check
    const parsedThreshold = req.query.threshold
      ? Number.parseFloat(req.query.threshold as string)
      : NaN;
    let matchThreshold = Number.isNaN(parsedThreshold) ? 0.5 : parsedThreshold;

    // Clamp threshold between 0 and 1
    matchThreshold = Math.max(0, Math.min(1, matchThreshold));

    // Parse limit with NaN check
    const parsedLimit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : NaN;
    let limit = Number.isNaN(parsedLimit) ? 20 : parsedLimit;

    // Clamp limit between 1 and 100
    limit = Math.max(1, Math.min(100, limit));

    const agentId = (req.query.agentId as UUID) || runtime.agentId;

    if (!searchText || searchText.trim().length === 0) {
      return sendError(res, 400, 'INVALID_QUERY', 'Search query cannot be empty');
    }

    // Log if values were clamped
    if (req.query.threshold && (parsedThreshold < 0 || parsedThreshold > 1)) {
      logger.debug(
        `[KNOWLEDGE SEARCH] Threshold value ${parsedThreshold} was clamped to ${matchThreshold}`
      );
    }
    if (req.query.limit && (parsedLimit < 1 || parsedLimit > 100)) {
      logger.debug(`[KNOWLEDGE SEARCH] Limit value ${parsedLimit} was clamped to ${limit}`);
    }

    logger.debug(
      `[KNOWLEDGE SEARCH] Searching for: "${searchText}" with threshold: ${matchThreshold}, limit: ${limit}`
    );

    // First get the embedding for the search text
    const embedding = await runtime.useModel(ModelType.TEXT_EMBEDDING, {
      text: searchText,
    });

    // Use searchMemories directly for more control over the search
    const results = await runtime.searchMemories({
      tableName: 'knowledge',
      embedding,
      query: searchText,
      count: limit,
      match_threshold: matchThreshold,
      roomId: agentId,
    });

    // Enhance results with document information
    const enhancedResults = await Promise.all(
      results.map(async (fragment) => {
        let documentTitle = 'Unknown Document';
        let documentFilename = 'unknown';

        // Try to get the parent document information
        if (
          fragment.metadata &&
          typeof fragment.metadata === 'object' &&
          'documentId' in fragment.metadata
        ) {
          const documentId = fragment.metadata.documentId as UUID;
          try {
            const document = await runtime.getMemoryById(documentId);
            if (document && document.metadata) {
              documentTitle =
                (document.metadata as any).title ||
                (document.metadata as any).filename ||
                documentTitle;
              documentFilename = (document.metadata as any).filename || documentFilename;
            }
          } catch (_e) {
            logger.debug(`Could not fetch document ${documentId} for fragment`);
          }
        }

        return {
          id: fragment.id,
          content: fragment.content,
          similarity: fragment.similarity || 0,
          metadata: {
            ...(fragment.metadata || {}),
            documentTitle,
            documentFilename,
          },
        };
      })
    );

    logger.info(
      `[KNOWLEDGE SEARCH] Found ${enhancedResults.length} results for query: "${searchText}"`
    );

    sendSuccess(res, {
      query: searchText,
      threshold: matchThreshold,
      results: enhancedResults,
      count: enhancedResults.length,
    });
  } catch (error: any) {
    logger.error('[KNOWLEDGE SEARCH] Error searching knowledge:', error);
    sendError(res, 500, 'SEARCH_ERROR', 'Failed to search knowledge', error.message);
  }
}

// Wrapper handler that applies multer middleware before calling the upload handler
async function uploadKnowledgeWithMulter(req: any, res: any, runtime: IAgentRuntime) {
  const upload = createUploadMiddleware(runtime);
  const uploadArray = upload.array(
    'files',
    parseInt(runtime.getSetting('KNOWLEDGE_MAX_FILES') || '10', 10)
  );

  // Apply multer middleware manually
  uploadArray(req, res, (err: any) => {
    if (err) {
      logger.error('[KNOWLEDGE UPLOAD] Multer error:', err);
      return sendError(res, 400, 'UPLOAD_ERROR', err.message);
    }
    // If multer succeeded, call the actual handler
    uploadKnowledgeHandler(req, res, runtime);
  });
}

// Wrapper for update with multer
async function updateKnowledgeWithMulter(req: any, res: any, runtime: IAgentRuntime) {
  const upload = createUploadMiddleware(runtime);
  const uploadSingle = upload.single('file');

  // Apply multer middleware manually
  uploadSingle(req, res, (err: any) => {
    if (err) {
      logger.error('[KNOWLEDGE UPDATE] Multer error:', err);
      return sendError(res, 400, 'UPDATE_ERROR', err.message);
    }
    // If multer succeeded or no file, call the actual handler
    updateKnowledgeHandler(req, res, runtime);
  });
}

// Bulk delete handler
async function bulkDeleteKnowledgeHandler(req: any, res: any, runtime: IAgentRuntime) {
  const service = runtime.getService<KnowledgeService>(KnowledgeService.serviceType);
  if (!service) {
    return sendError(res, 500, 'SERVICE_NOT_FOUND', 'KnowledgeService not found');
  }

  try {
    const { knowledgeIds } = req.body;
    const agentId = (req.body.agentId as UUID) || (req.query.agentId as UUID);

    if (!agentId) {
      return sendError(res, 400, 'MISSING_AGENT_ID', 'Agent ID is required');
    }

    if (!Array.isArray(knowledgeIds) || knowledgeIds.length === 0) {
      return sendError(res, 400, 'INVALID_REQUEST', 'knowledgeIds must be a non-empty array');
    }

    const results = await Promise.all(
      knowledgeIds.map(async (knowledgeId: string) => {
        try {
          const typedKnowledgeId = knowledgeId as UUID;
          await service.deleteMemory(typedKnowledgeId);
          return { id: knowledgeId, success: true };
        } catch (error: any) {
          logger.error(`Failed to delete knowledge ${knowledgeId}:`, error);
          return { id: knowledgeId, success: false, error: error.message };
        }
      })
    );

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    sendSuccess(res, {
      results,
      summary: {
        requested: knowledgeIds.length,
        successful: successCount,
        failed: failCount,
      },
    });
  } catch (error: any) {
    logger.error('[KNOWLEDGE BULK DELETE] Error:', error);
    sendError(res, 500, 'BULK_DELETE_ERROR', 'Failed to delete knowledge documents', error.message);
  }
}

// Add advanced search route
async function advancedSearchHandler(req: any, res: any, runtime: IAgentRuntime) {
  try {
    const { agentId } = req.params;
    if (!runtime || runtime.agentId !== agentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const service = runtime.getService<KnowledgeService>('knowledge');
    if (!service) {
      return res.status(404).json({ error: 'Knowledge service not available' });
    }

    const searchOptions = req.body;
    const results = await service.advancedSearch(searchOptions);

    res.json(results);
  } catch (error: any) {
    logger.error('Error in advanced search:', error);
    res.status(500).json({ error: error.message || 'Failed to perform advanced search' });
  }
}

// Add analytics route
async function getAnalyticsHandler(req: any, res: any, runtime: IAgentRuntime) {
  try {
    const { agentId } = req.params;
    if (!runtime || runtime.agentId !== agentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const service = runtime.getService<KnowledgeService>('knowledge');
    if (!service) {
      return res.status(404).json({ error: 'Knowledge service not available' });
    }

    const analytics = await service.getAnalytics();
    res.json(analytics);
  } catch (error: any) {
    logger.error('Error getting analytics:', error);
    res.status(500).json({ error: error.message || 'Failed to get analytics' });
  }
}

// Add batch operations route
async function batchOperationHandler(req: any, res: any, runtime: IAgentRuntime) {
  try {
    const { agentId } = req.params;
    if (!runtime || runtime.agentId !== agentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const service = runtime.getService<KnowledgeService>('knowledge');
    if (!service) {
      return res.status(404).json({ error: 'Knowledge service not available' });
    }

    const batchOperation = req.body;
    const result = await service.batchOperation(batchOperation);

    res.json(result);
  } catch (error: any) {
    logger.error('Error in batch operation:', error);
    res.status(500).json({ error: error.message || 'Batch operation failed' });
  }
}

// Add export route
async function exportKnowledgeHandler(req: any, res: any, runtime: IAgentRuntime) {
  try {
    const { agentId } = req.params;
    if (!runtime || runtime.agentId !== agentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const service = runtime.getService<KnowledgeService>('knowledge');
    if (!service) {
      return res.status(404).json({ error: 'Knowledge service not available' });
    }

    const exportOptions = req.body;
    const exportData = await service.exportKnowledge(exportOptions);

    // Set appropriate content type based on format
    const format = exportOptions.format || 'json';
    const contentTypes: Record<string, string> = {
      json: 'application/json',
      csv: 'text/csv',
      markdown: 'text/markdown',
    };

    res.setHeader('Content-Type', contentTypes[format] || 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="knowledge-export.${format}"`);
    res.send(exportData);
  } catch (error: any) {
    logger.error('Error exporting knowledge:', error);
    res.status(500).json({ error: error.message || 'Export failed' });
  }
}

// Add import route
async function importKnowledgeHandler(req: any, res: any, runtime: IAgentRuntime) {
  try {
    const { agentId } = req.params;
    if (!runtime || runtime.agentId !== agentId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const service = runtime.getService<KnowledgeService>('knowledge');
    if (!service) {
      return res.status(404).json({ error: 'Knowledge service not available' });
    }

    const { data, options } = req.body;
    if (!data || !options || !options.format) {
      return res.status(400).json({ error: 'Missing data or import options' });
    }

    const result = await service.importKnowledge(data, options);
    res.json(result);
  } catch (error: any) {
    logger.error('Error importing knowledge:', error);
    res.status(500).json({ error: error.message || 'Import failed' });
  }
}

export const knowledgeRoutes: Route[] = [
  {
    type: 'GET',
    name: 'Knowledge',
    path: '/display',
    handler: knowledgePanelHandler,
    public: true,
  },
  {
    type: 'GET',
    path: '/assets/*',
    handler: frontendAssetHandler,
  },
  {
    type: 'POST',
    path: '/documents',
    handler: uploadKnowledgeWithMulter,
  },
  {
    type: 'PUT',
    path: '/documents/:knowledgeId',
    handler: updateKnowledgeWithMulter,
  },
  {
    type: 'POST',
    path: '/documents/bulk-delete',
    handler: bulkDeleteKnowledgeHandler,
  },
  {
    type: 'GET',
    path: '/documents',
    handler: getKnowledgeDocumentsHandler,
  },
  {
    type: 'GET',
    path: '/documents/:knowledgeId',
    handler: getKnowledgeByIdHandler,
  },
  {
    type: 'DELETE',
    path: '/documents/:knowledgeId',
    handler: deleteKnowledgeDocumentHandler,
  },
  {
    type: 'GET',
    path: '/knowledges',
    handler: getKnowledgeChunksHandler,
  },
  {
    type: 'GET',
    path: '/search',
    handler: searchKnowledgeHandler,
  },
  {
    type: 'GET',
    path: '/test-components',
    handler: async (req: any, res: any, _runtime: IAgentRuntime) => {
      const currentDir = path.dirname(new URL(import.meta.url).pathname);
      // Try multiple locations for the test-components.html file
      const possiblePaths = [
        path.join(currentDir, 'frontend', 'test-components.html'),
        path.join(currentDir, '..', 'src', 'frontend', 'test-components.html'),
        path.join(currentDir, '..', '..', 'src', 'frontend', 'test-components.html'),
      ];

      for (const testPagePath of possiblePaths) {
        try {
          const htmlContent = await fs.promises.readFile(testPagePath, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(htmlContent);
          return;
        } catch (_error) {
          // Try next path
        }
      }

      sendError(res, 404, 'NOT_FOUND', 'Test components page not found');
    },
  },
  {
    type: 'POST',
    path: '/search/advanced',
    handler: advancedSearchHandler,
  },
  {
    type: 'GET',
    path: '/analytics',
    handler: getAnalyticsHandler,
  },
  {
    type: 'POST',
    path: '/batch',
    handler: batchOperationHandler,
  },
  {
    type: 'POST',
    path: '/export',
    handler: exportKnowledgeHandler,
  },
  {
    type: 'POST',
    path: '/import',
    handler: importKnowledgeHandler,
  },
];
