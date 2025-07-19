# Knowledge Plugin for ElizaOS

This plugin gives your agent the ability to learn from documents and answer
questions based on that knowledge.

## 🚀 Quick Start (No Configuration Needed!)

If you already have **plugin-openai** configured in your agent, this plugin
works automatically! Just add it to your agent and you're done.

```typescript
import { knowledgePlugin } from '@elizaos/plugin-knowledge';

// Add to your agent's plugins
plugins: [
  '@elizaos/plugin-knowledge',
  // ... other plugins
];
```

That's it! Your agent can now process and learn from documents.

## 📁 Auto-Load Documents on Startup

Want your agent to automatically learn from documents when it starts? Just:

1. **Add this to your `.env` file:**

   ```env
   LOAD_DOCS_ON_STARTUP=true
   ```

2. **Create a `docs` folder in your project root and add your documents:**

   ```
   your-project/
   ├── .env
   ├── docs/           <-- Create this folder
   │   ├── guide.pdf
   │   ├── manual.txt
   │   └── notes.md
   └── ... other files
   ```

3. **Start your agent** - it will automatically load all documents from the
   `docs` folder!

### Supported File Types

- 📄 **Documents:** PDF, TXT, MD, DOC, DOCX
- 💻 **Code:** JS, TS, PY, and many more
- 📊 **Data:** JSON, CSV, XML, YAML

## 💬 How to Use

Once documents are loaded, just ask your agent questions naturally:

- "What does the guide say about setup?"
- "Search your knowledge for information about configuration"
- "What do you know about [topic]?"

Your agent will search through all loaded documents and provide relevant
answers!

## 🎯 Actions Available

The plugin provides these actions that your agent can use:

1. **PROCESS_KNOWLEDGE** - Add new documents or text to the knowledge base

   - "Process the document at /path/to/file.pdf"
   - "Remember this: The sky is blue"
   - Send files as attachments in your message - they'll be automatically
     processed!

2. **SEARCH_KNOWLEDGE** - Search the knowledge base
   - "Search your knowledge for quantum computing"

## 📎 Attachment Processing

The knowledge plugin now intelligently handles attachments:

- **Direct file attachments** - Just attach files to your message
- **URL attachments** - Share links to documents and they'll be downloaded and
  processed
- **Multiple attachments** - Process many files at once
- **Smart detection** - The agent automatically detects when you want to save
  attachments

Examples:

- "Save these documents" + [attach PDFs]
- "Add this to your knowledge" + [attach text file]
- "Learn from this website" + [URL attachment]

## 🌐 Web Interface

The plugin includes a web interface for managing documents! Access it at:

```
http://localhost:3000/api/agents/[your-agent-id]/plugins/knowledge/display
```

Features:

- 📋 List all documents with metadata
- 🔍 Search through your knowledge base
- 📊 Visual graph of document relationships
- ⬆️ Upload new documents
- 🗑️ Delete existing documents
- 🔄 Update document metadata

---

## ⚠️ Advanced Configuration (Developers Only)

**Note: If you're not a developer, don't use the settings below! The plugin
works great with just the quick start setup above.**

<details>
<summary>Click to show advanced configuration options</summary>

### Custom Document Path

Change where documents are loaded from:

```env
KNOWLEDGE_PATH=/path/to/your/documents
```

### Enhanced Contextual Knowledge

For better understanding of complex documents:

```env
CTX_KNOWLEDGE_ENABLED=true
TEXT_PROVIDER=openrouter
TEXT_MODEL=anthropic/claude-3.5-sonnet
OPENROUTER_API_KEY=your-api-key
```

### Custom Embedding Configuration

If not using plugin-openai:

```env
EMBEDDING_PROVIDER=openai
TEXT_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_API_KEY=your-api-key
```

### All Configuration Options

```env
# Document Loading
LOAD_DOCS_ON_STARTUP=true          # Auto-load from docs folder
KNOWLEDGE_PATH=/custom/path        # Custom document path

# Contextual Enhancement (improves understanding)
CTX_KNOWLEDGE_ENABLED=true         # Enable contextual embeddings

# Embedding Provider (if not using plugin-openai)
EMBEDDING_PROVIDER=openai          # or google
TEXT_EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSION=1536

# Text Generation Provider (for contextual mode)
TEXT_PROVIDER=openai               # or anthropic, openrouter, google
TEXT_MODEL=gpt-4o                  # Model name for your provider

# API Keys (based on providers used)
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
OPENROUTER_API_KEY=your-key
GOOGLE_API_KEY=your-key

# Rate Limiting
MAX_CONCURRENT_REQUESTS=30
REQUESTS_PER_MINUTE=60
TOKENS_PER_MINUTE=150000

# Token Limits
MAX_INPUT_TOKENS=4000
MAX_OUTPUT_TOKENS=4096
```

### API Routes Reference

- `POST /api/agents/{agentId}/plugins/knowledge/documents` - Upload documents
- `GET /api/agents/{agentId}/plugins/knowledge/documents` - List documents
- `GET /api/agents/{agentId}/plugins/knowledge/documents/{id}` - Get specific
  document
- `DELETE /api/agents/{agentId}/plugins/knowledge/documents/{id}` - Delete
  document
- `PUT /api/agents/{agentId}/plugins/knowledge/documents/{id}` - Update document
  metadata
- `POST /api/agents/{agentId}/plugins/knowledge/search` - Search knowledge base
- `GET /api/agents/{agentId}/plugins/knowledge/display` - Web interface

### Programmatic Usage

```typescript
import { KnowledgeService } from '@elizaos/plugin-knowledge';

// Add knowledge programmatically
const result = await knowledgeService.addKnowledge({
  clientDocumentId: 'unique-id',
  content: documentContent,
  contentType: 'application/pdf',
  originalFilename: 'document.pdf',
  worldId: 'world-id',
  roomId: 'room-id',
  entityId: 'entity-id',
});

// Update document metadata
await runtime.updateMemory({
  id: documentId,
  metadata: {
    type: MemoryType.DOCUMENT,
    tags: ['updated', 'important'],
    source: 'manual-update',
  },
});

// Delete a document
await knowledgeService.deleteMemory(documentId);
```

</details>

## 📝 License

See the ElizaOS license for details.

### Advanced Features

The knowledge plugin now includes several advanced features for enterprise-grade
knowledge management:

#### 🔍 Advanced Search

Search with filters, sorting, and pagination:

```typescript
const results = await knowledgeService.advancedSearch({
  query: 'machine learning',
  filters: {
    contentType: ['application/pdf', 'text/markdown'],
    tags: ['ai', 'research'],
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-12-31'),
    },
    minSimilarity: 0.7,
  },
  sort: {
    field: 'similarity', // or 'createdAt', 'updatedAt', 'title'
    order: 'desc',
  },
  limit: 20,
  offset: 0,
  includeMetadata: true,
});
```

Natural language search examples:

- "Search for pdf documents about AI from last week"
- "Find recent markdown files sorted by relevant"
- "Look for documents with blockchain tags from today"

#### 📦 Batch Operations

Process multiple documents efficiently:

```typescript
const result = await knowledgeService.batchOperation({
  operation: 'add', // or 'update', 'delete'
  items: [
    { data: { content: 'Doc 1', contentType: 'text/plain', ... } },
    { data: { content: 'Doc 2', contentType: 'text/plain', ... } },
    // ... more items
  ],
});

console.log(`Processed: ${result.successful} successful, ${result.failed} failed`);
```

#### 📊 Analytics & Insights

Get comprehensive analytics about your knowledge base:

```typescript
const analytics = await knowledgeService.getAnalytics();

// Returns:
// {
//   totalDocuments: 150,
//   totalFragments: 450,
//   storageSize: 5242880, // bytes
//   contentTypes: {
//     'application/pdf': 80,
//     'text/plain': 50,
//     'text/markdown': 20,
//   },
//   queryStats: {
//     totalQueries: 1000,
//     averageResponseTime: 250, // ms
//     topQueries: [
//       { query: 'AI research', count: 50 },
//       { query: 'blockchain', count: 30 },
//     ],
//   },
//   usageByDate: [...],
// }
```

#### 📤 Export & Import

Export your knowledge base in multiple formats:

```typescript
// Export to JSON
const jsonExport = await knowledgeService.exportKnowledge({
  format: 'json',
  includeMetadata: true,
  documentIds: ['id1', 'id2'], // optional filter
  dateRange: { start: new Date('2024-01-01') }, // optional filter
});

// Export to CSV
const csvExport = await knowledgeService.exportKnowledge({
  format: 'csv',
});

// Export to Markdown
const markdownExport = await knowledgeService.exportKnowledge({
  format: 'markdown',
  includeMetadata: false,
});
```

Import knowledge from various formats:

```typescript
// Import from JSON
const importResult = await knowledgeService.importKnowledge(jsonData, {
  format: 'json',
  validateBeforeImport: true,
  overwriteExisting: false,
});

// Import from CSV
const csvResult = await knowledgeService.importKnowledge(csvData, {
  format: 'csv',
  batchSize: 100,
});
```

#### 🎯 Action Chaining

The SEARCH_KNOWLEDGE action now returns structured data that can be used by
other actions:

```typescript
// SEARCH_KNOWLEDGE returns:
{
  data: {
    query: 'machine learning',
    results: [...], // KnowledgeItem[]
    count: 5,
  },
  text: 'Found 5 results...',
}

// This data can be consumed by other actions like:
// - ANALYZE_KNOWLEDGE: Analyze search results
// - SUMMARIZE_KNOWLEDGE: Create summaries
// - FILTER_KNOWLEDGE: Further filter results
```

#### ⚙️ Configuration Options

New configuration options for advanced features:

```env
# Search Configuration
SEARCH_MATCH_THRESHOLD=0.7      # Minimum similarity score (0-1)
SEARCH_RESULT_COUNT=20          # Default number of results

# Feature Flags
ENABLE_VERSIONING=true          # Track document versions
ENABLE_ANALYTICS=true           # Enable analytics tracking

# Performance
BATCH_PROCESSING_SIZE=5         # Items processed in parallel
```

### Available Actions

The plugin provides these enhanced actions:

1. **PROCESS_KNOWLEDGE** - Add documents, text, URLs, or attachments
2. **SEARCH_KNOWLEDGE** - Basic knowledge search with action chaining support
3. **ADVANCED_KNOWLEDGE_SEARCH** - Advanced search with filters and sorting
4. **KNOWLEDGE_ANALYTICS** - Get analytics and insights
5. **EXPORT_KNOWLEDGE** - Export knowledge base to various formats

</details>

## 🧪 Testing

The plugin includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run E2E tests (including advanced features)
npm test

# Run Cypress UI tests
npm run test:cypress:open
```

## 🤝 Contributing
