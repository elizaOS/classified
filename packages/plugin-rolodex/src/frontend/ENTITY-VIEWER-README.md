# Entity Relationship Viewer

## Overview

The Entity Relationship Viewer is a comprehensive frontend component for
visualizing and managing entities and their relationships within the ElizaOS
rolodex plugin. It provides two main views:

1. **Entity List View** - A table view with collapsible rows showing detailed
   connection information
2. **Entity Graph View** - An interactive force-directed graph visualization

## Features

### Entity List View

- **Collapsible Connections**: Each entity row can be expanded to show all
  connections
- **Connection Details**: Shows relationship types, strengths, and bidirectional
  indicators
- **Filtering**:
  - Search by entity name or platform identity
  - Filter by minimum connection strength
- **Trust Level Indicators**: Visual indicators for trusted (green), neutral
  (yellow), and suspicious (red) entities
- **Platform Identities**: Displays social media handles and verification status

### Entity Graph View

- **Interactive Force Graph**: Powered by react-force-graph-2d
- **Visual Encoding**:
  - Node color represents trust level (green = trusted, blue = neutral, red =
    suspicious)
  - Node size based on engagement metrics
  - Link thickness represents connection strength
  - Link colors indicate relationship types
- **Advanced Filters**:
  - Search entities by name
  - Filter by entity type (person/bot/organization)
  - Adjust trust level range
  - Set minimum connection strength threshold
- **Legend & Stats**: Real-time statistics and color-coded legend
- **Relationship Type Filter**: Click legend items to highlight specific
  relationship types

## Components

### Main Components

- `EntityListView` - Table view with expandable rows
- `EntityGraph` - Force-directed graph visualization
- `RolodexTab` - Main container that switches between views

### API Integration

- Uses React Query for data fetching and caching
- Endpoints:
  - `/api/entities?agentId={id}` - Fetch entities
  - `/api/relationships?agentId={id}` - Fetch relationships

## Testing

### Unit Tests

- `entity-graph.test.tsx` - Tests graph component functionality
- `entity-list-view.test.tsx` - Tests list view functionality
- `entity-api-integration.test.tsx` - Tests API data loading

### E2E Tests

- `entity-graph.cy.ts` - Cypress tests for user interactions

## Usage

```tsx
import { RolodexTab } from './ui/rolodex-tab';

// In your app
<RolodexTab agentId={agentId} />;
```

## Data Types

### Entity

```typescript
interface Entity {
  id: UUID;
  names: string[];
  agentId: UUID;
  metadata?: {
    type?: 'person' | 'bot' | 'organization';
    trustMetrics?: {
      helpfulness: number;
      suspicionLevel: number;
    };
    platformIdentities?: Array<{
      platform: string;
      handle: string;
      verified?: boolean;
    }>;
  };
}
```

### Relationship

```typescript
interface Relationship {
  id: UUID;
  agentId: UUID;
  sourceEntityId: UUID;
  targetEntityId: UUID;
  strength?: number;
  metadata?: {
    relationshipType?: string;
    sentiment?: string;
    [key: string]: any;
  };
  tags: string[];
}
```

## Future Enhancements

- Export graph as image
- Batch entity operations
- Real-time updates via WebSocket
- Advanced graph layouts
- Entity clustering algorithms
