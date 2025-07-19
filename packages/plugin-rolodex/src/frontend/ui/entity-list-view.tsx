import React, { useState } from 'react';
import type { UUID, Entity, Relationship } from '@elizaos/core';
import {
  ChevronDown,
  ChevronRight,
  Users as _Users,
  Link,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { Badge } from './badge';
import { Button } from './button';
import { Input } from './input';

interface EntityListViewProps {
  entities: Entity[];
  relationships: Relationship[];
  onEntityClick?: (entity: Entity) => void;
}

// Calculate entity metrics
const calculateEntityMetrics = (entity: Entity, relationships: Relationship[]) => {
  const directRelationships = relationships.filter(
    (r) => r.sourceEntityId === entity.id || r.targetEntityId === entity.id
  );

  const incomingCount = relationships.filter((r) => r.targetEntityId === entity.id).length;
  const outgoingCount = relationships.filter((r) => r.sourceEntityId === entity.id).length;

  const avgStrength =
    directRelationships.length > 0
      ? directRelationships.reduce((sum, r) => sum + (r.strength || 0.5), 0) /
        directRelationships.length
      : 0;

  return {
    totalConnections: directRelationships.length,
    incomingConnections: incomingCount,
    outgoingConnections: outgoingCount,
    averageStrength: avgStrength,
  };
};

// Get relationship details between entities
const getRelationshipDetails = (
  entityId: UUID,
  relationships: Relationship[],
  entities: Entity[]
) => {
  const directRelationships = relationships.filter(
    (r) => r.sourceEntityId === entityId || r.targetEntityId === entityId
  );

  // Group by other entity
  const grouped = new Map<UUID, Relationship[]>();

  directRelationships.forEach((rel) => {
    const otherEntityId = rel.sourceEntityId === entityId ? rel.targetEntityId : rel.sourceEntityId;
    if (!grouped.has(otherEntityId)) {
      grouped.set(otherEntityId, []);
    }
    grouped.get(otherEntityId)!.push(rel);
  });

  // Convert to detailed view
  const details = Array.from(grouped.entries()).map(([otherEntityId, rels]) => {
    const otherEntity = entities.find((e) => e.id === otherEntityId);
    const bidirectional =
      rels.some((r) => r.sourceEntityId === entityId) &&
      rels.some((r) => r.targetEntityId === entityId);

    const types = new Set<string>();
    let maxStrength = 0;
    let totalStrength = 0;

    rels.forEach((rel) => {
      const relType = rel.metadata?.relationshipType || rel.metadata?.type || 'unknown';
      if (relType) {
        types.add(String(relType));
      }
      const strength = rel.strength || 0.5;
      maxStrength = Math.max(maxStrength, strength);
      totalStrength += strength;
    });

    return {
      otherEntityId,
      otherEntity,
      relationships: rels,
      types: Array.from(types),
      bidirectional,
      maxStrength,
      avgStrength: totalStrength / rels.length,
      connectionCount: rels.length,
    };
  });

  // Sort by strength descending
  return details.sort((a, b) => b.maxStrength - a.maxStrength);
};

export function EntityListView({ entities, relationships, onEntityClick }: EntityListViewProps) {
  const [expandedEntities, setExpandedEntities] = useState<Set<UUID>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [strengthFilter, setStrengthFilter] = useState(0);

  const toggleExpanded = (entityId: UUID) => {
    const newExpanded = new Set(expandedEntities);
    if (newExpanded.has(entityId)) {
      newExpanded.delete(entityId);
    } else {
      newExpanded.add(entityId);
    }
    setExpandedEntities(newExpanded);
  };

  // Filter entities based on search
  const filteredEntities = entities.filter((entity) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesName = entity.names.some((name) => name.toLowerCase().includes(searchLower));
      const matchesPlatform = ((entity.metadata?.platformIdentities as any[]) || []).some(
        (p: any) =>
          p.platform?.toLowerCase().includes(searchLower) ||
          p.handle?.toLowerCase().includes(searchLower)
      );
      if (!matchesName && !matchesPlatform) {
        return false;
      }
    }

    // Filter by connection strength
    if (strengthFilter > 0) {
      const metrics = calculateEntityMetrics(entity, relationships);
      if (metrics.averageStrength < strengthFilter) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="p-4 border-b space-y-3">
        <div className="flex gap-3">
          <Input
            placeholder="Search entities..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Min Strength:</span>
            <Input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={strengthFilter.toString()}
              onChange={(e) => setStrengthFilter(Number(e.target.value))}
              className="w-20"
            />
          </div>
        </div>
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>
            Showing {filteredEntities.length} of {entities.length} entities
          </span>
          <span>{relationships.length} total relationships</span>
        </div>
      </div>

      {/* Entity List */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Trust Level</TableHead>
              <TableHead>Connections</TableHead>
              <TableHead>Avg Strength</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntities.map((entity) => {
              const isExpanded = expandedEntities.has(entity.id!);
              const metrics = calculateEntityMetrics(entity, relationships);
              const trust = entity.metadata?.trustMetrics as any;
              const trustLevel =
                trust && 'helpfulness' in trust && 'suspicionLevel' in trust
                  ? trust.helpfulness - trust.suspicionLevel
                  : 0;
              const entityType = (entity.metadata?.type || 'person') as string;

              return (
                <React.Fragment key={entity.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => toggleExpanded(entity.id!)}
                  >
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          if (e) {
                            e.stopPropagation();
                          }
                          toggleExpanded(entity.id!);
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div
                        className="font-medium cursor-pointer hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEntityClick?.(entity);
                        }}
                      >
                        {entity.names[0]}
                        {entity.names.length > 1 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (+{entity.names.length - 1})
                          </span>
                        )}
                      </div>
                      {/* Platform identities */}
                      {(() => {
                        const platformIds = (entity.metadata?.platformIdentities as any[]) || [];
                        return platformIds.length > 0 ? (
                          <div className="flex gap-1 mt-1">
                            {platformIds.slice(0, 2).map((p, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                                {p.platform}
                              </Badge>
                            ))}
                            {platformIds.length > 2 && (
                              <span className="text-xs text-muted-foreground">
                                +{platformIds.length - 2}
                              </span>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {trustLevel > 0.5 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : trustLevel < -0.5 ? (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        ) : null}
                        <span
                          className={
                            trustLevel > 0.5
                              ? 'text-green-600 dark:text-green-400'
                              : trustLevel < -0.5
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-yellow-600 dark:text-yellow-400'
                          }
                        >
                          {trustLevel.toFixed(2)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{metrics.totalConnections} total</div>
                        <div className="text-xs text-muted-foreground">
                          ↓{metrics.incomingConnections} ↑{metrics.outgoingConnections}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-mono">{metrics.averageStrength.toFixed(2)}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {entityType}
                      </Badge>
                    </TableCell>
                  </TableRow>

                  {/* Expanded connections */}
                  {isExpanded && (
                    <TableRow>
                      <td colSpan={6} className="bg-muted/30 p-0">
                        <div className="p-4">
                          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <Link className="h-4 w-4" />
                            Connections ({metrics.totalConnections})
                          </h4>

                          {metrics.totalConnections === 0 ? (
                            <p className="text-sm text-muted-foreground">No connections found</p>
                          ) : (
                            <div className="space-y-2">
                              {getRelationshipDetails(entity.id!, relationships, entities).map(
                                (detail) => (
                                  <div
                                    key={detail.otherEntityId}
                                    className="border rounded-md p-3 bg-background hover:bg-accent/20 transition-colors"
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className="font-medium cursor-pointer hover:underline"
                                            onClick={() => onEntityClick?.(detail.otherEntity!)}
                                          >
                                            {detail.otherEntity?.names[0] || 'Unknown Entity'}
                                          </span>
                                          {detail.bidirectional && (
                                            <Badge variant="outline" className="text-xs">
                                              ↔ Bidirectional
                                            </Badge>
                                          )}
                                        </div>

                                        <div className="flex gap-2 mt-1">
                                          {detail.types.map((type) => (
                                            <Badge
                                              key={type}
                                              variant="secondary"
                                              className="text-xs"
                                            >
                                              {type}
                                            </Badge>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="text-right">
                                        <div className="text-sm font-mono">
                                          {detail.maxStrength.toFixed(2)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          strength
                                        </div>
                                        {detail.connectionCount > 1 && (
                                          <div className="text-xs text-muted-foreground mt-1">
                                            {detail.connectionCount} connections
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Connection metadata */}
                                    {detail.relationships.some(
                                      (r) => r.metadata && Object.keys(r.metadata).length > 0
                                    ) && (
                                      <details className="mt-2">
                                        <summary className="text-xs cursor-pointer text-muted-foreground">
                                          View metadata
                                        </summary>
                                        <div className="mt-1 text-xs font-mono bg-muted/30 p-2 rounded">
                                          {detail.relationships.map((rel, idx) => (
                                            <div key={idx} className="mb-1">
                                              <div className="text-muted-foreground">
                                                {rel.sourceEntityId === entity.id ? '→' : '←'}{' '}
                                                Connection {idx + 1}:
                                              </div>
                                              <pre className="whitespace-pre-wrap text-[10px]">
                                                {JSON.stringify(rel.metadata, null, 2)}
                                              </pre>
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    )}
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
