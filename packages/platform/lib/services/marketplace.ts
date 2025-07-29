/**
 * Marketplace Service
 * Provides functionality for marketplace asset management, search, and installation
 */

import { getDatabase } from '@/lib/database';
import {
  marketplaceAssets,
  assetInstallations,
  userFavorites,
  assetReviews,
  type MarketplaceAsset,
  type NewMarketplaceAsset,
} from '@/lib/database/marketplace-schema';
import { eq, and, or, like, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface SearchParams {
  assetType?: 'mcp' | 'agent' | 'workflow' | 'plugin';
  category?: string;
  tags?: string[];
  searchQuery?: string;
  sortBy?: 'created' | 'updated' | 'downloads' | 'rating' | 'price';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  rating?: number;
  priceRange?: { min: number; max: number };
}

export interface CreateAssetRequest {
  name: string;
  description: string;
  assetType: 'mcp' | 'agent' | 'workflow' | 'plugin';
  category: string;
  tags?: string[];
  content: any;
  basePrice?: string;
  subscriptionPrice?: string;
  isPublic?: boolean;
  metadata?: any;
}

export interface UpdateAssetRequest {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  content?: any;
  basePrice?: string;
  subscriptionPrice?: string;
  isPublic?: boolean;
  metadata?: any;
}

export interface ReviewRequest {
  rating: number;
  comment?: string;
}

export class MarketplaceService {
  /**
   * Search marketplace assets
   */
  async searchAssets(params: SearchParams, userId?: string) {
    const db = await getDatabase();

    const conditions = [];

    // Filter by asset type
    if (params.assetType) {
      conditions.push(eq(marketplaceAssets.assetType, params.assetType));
    }

    // Filter by category
    if (params.category) {
      conditions.push(eq(marketplaceAssets.category, params.category));
    }

    // Filter by search query
    if (params.searchQuery) {
      conditions.push(
        or(
          like(marketplaceAssets.name, `%${params.searchQuery}%`),
          like(marketplaceAssets.description, `%${params.searchQuery}%`),
        ),
      );
    }

    // Filter by rating
    if (params.rating) {
      conditions.push(gte(marketplaceAssets.averageRating, params.rating));
    }

    // Filter by price range
    if (params.priceRange) {
      if (params.priceRange.min > 0) {
        conditions.push(
          gte(
            sql`CAST(${marketplaceAssets.basePrice} AS DECIMAL)`,
            params.priceRange.min,
          ),
        );
      }
      if (params.priceRange.max < Number.MAX_VALUE) {
        conditions.push(
          lte(
            sql`CAST(${marketplaceAssets.basePrice} AS DECIMAL)`,
            params.priceRange.max,
          ),
        );
      }
    }

    // Only show public assets or user's own assets
    if (userId) {
      conditions.push(
        or(
          eq(marketplaceAssets.isPublic, true),
          eq(marketplaceAssets.creatorId, userId),
        ),
      );
    } else {
      conditions.push(eq(marketplaceAssets.isPublic, true));
    }

    // Build query
    let query = db
      .select()
      .from(marketplaceAssets)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Apply sorting
    const sortColumn = {
      created: marketplaceAssets.createdAt,
      updated: marketplaceAssets.updatedAt,
      downloads: marketplaceAssets.downloadCount,
      rating: marketplaceAssets.averageRating,
      price: sql`CAST(${marketplaceAssets.basePrice} AS DECIMAL)`,
    }[params.sortBy || 'created'];

    if (params.sortOrder === 'asc') {
      query = query.orderBy(asc(sortColumn));
    } else {
      query = query.orderBy(desc(sortColumn));
    }

    // Apply pagination
    if (params.limit) {
      query = query.limit(params.limit);
    }
    if (params.offset) {
      query = query.offset(params.offset);
    }

    const assets = await query;

    // Filter by tags if specified (tags are stored as JSON array)
    if (params.tags && params.tags.length > 0) {
      return assets.filter((asset) => {
        const assetTags = asset.tags || [];
        return params.tags!.some((tag) => assetTags.includes(tag));
      });
    }

    return assets;
  }

  /**
   * Get a single asset by ID
   */
  async getAsset(assetId: string, userId?: string) {
    const db = await getDatabase();

    const conditions = [eq(marketplaceAssets.id, assetId)];

    // Only show public assets or user's own assets
    if (userId) {
      conditions.push(
        or(
          eq(marketplaceAssets.isPublic, true),
          eq(marketplaceAssets.creatorId, userId),
        ),
      );
    } else {
      conditions.push(eq(marketplaceAssets.isPublic, true));
    }

    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(and(...conditions))
      .limit(1);

    return asset || null;
  }

  /**
   * Create a new marketplace asset
   */
  async createAsset(request: CreateAssetRequest, creatorId: string) {
    const db = await getDatabase();

    const newAsset: NewMarketplaceAsset = {
      name: request.name,
      description: request.description,
      assetType: request.assetType,
      category: request.category,
      tags: request.tags || [],
      content: request.content,
      basePrice: request.basePrice || '0',
      subscriptionPrice: request.subscriptionPrice,
      isPublic: request.isPublic ?? true,
      metadata: request.metadata || {},
      creatorId,
      downloadCount: 0,
      averageRating: 0,
      totalReviews: 0,
    };

    const [asset] = await db
      .insert(marketplaceAssets)
      .values(newAsset)
      .returning();

    logger.info('Created marketplace asset', {
      assetId: asset.id,
      assetType: asset.assetType,
      creatorId,
    });

    return asset;
  }

  /**
   * Update an existing marketplace asset
   */
  async updateAsset(
    assetId: string,
    request: UpdateAssetRequest,
    userId: string,
  ) {
    const db = await getDatabase();

    // Verify ownership
    const [existing] = await db
      .select()
      .from(marketplaceAssets)
      .where(
        and(
          eq(marketplaceAssets.id, assetId),
          eq(marketplaceAssets.creatorId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new Error('Asset not found or unauthorized');
    }

    const updates: any = {
      updatedAt: new Date(),
    };

    if (request.name !== undefined) updates.name = request.name;
    if (request.description !== undefined)
      updates.description = request.description;
    if (request.category !== undefined) updates.category = request.category;
    if (request.tags !== undefined) updates.tags = request.tags;
    if (request.content !== undefined) updates.content = request.content;
    if (request.basePrice !== undefined) updates.basePrice = request.basePrice;
    if (request.subscriptionPrice !== undefined)
      updates.subscriptionPrice = request.subscriptionPrice;
    if (request.isPublic !== undefined) updates.isPublic = request.isPublic;
    if (request.metadata !== undefined) updates.metadata = request.metadata;

    const [updated] = await db
      .update(marketplaceAssets)
      .set(updates)
      .where(eq(marketplaceAssets.id, assetId))
      .returning();

    logger.info('Updated marketplace asset', {
      assetId,
      updates: Object.keys(updates),
    });

    return updated;
  }

  /**
   * Install an asset for a user
   */
  async installAsset(assetId: string, userId: string, organizationId: string) {
    const db = await getDatabase();

    // Check if already installed
    const [existing] = await db
      .select()
      .from(assetInstallations)
      .where(
        and(
          eq(assetInstallations.assetId, assetId),
          eq(assetInstallations.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      return existing;
    }

    // Get asset info for version
    const [asset] = await db
      .select()
      .from(marketplaceAssets)
      .where(eq(marketplaceAssets.id, assetId))
      .limit(1);

    if (!asset) {
      throw new Error('Asset not found');
    }

    // Create installation record
    const [installation] = await db
      .insert(assetInstallations)
      .values({
        organizationId,
        assetId,
        userId,
        versionId: asset.latestVersionId || assetId, // Use asset ID as fallback if no version
        purchaseType: 'free',
        isActive: true,
      })
      .returning();

    // Increment download count
    await db
      .update(marketplaceAssets)
      .set({
        installCount: sql`${marketplaceAssets.installCount} + 1`,
      })
      .where(eq(marketplaceAssets.id, assetId));

    logger.info('Installed marketplace asset', {
      assetId,
      userId,
      installationId: installation.id,
    });

    return installation;
  }

  /**
   * Favorite/unfavorite an asset
   */
  async favoriteAsset(assetId: string, userId: string, favorite: boolean) {
    const db = await getDatabase();

    if (favorite) {
      // Get organization ID from user's first asset or use a default
      const [userAsset] = await db
        .select({ organizationId: marketplaceAssets.organizationId })
        .from(marketplaceAssets)
        .where(eq(marketplaceAssets.creatorId, userId))
        .limit(1);

      const organizationId = userAsset?.organizationId || userId; // Fallback to userId

      // Add favorite
      await db
        .insert(userFavorites)
        .values({
          organizationId,
          assetId,
          userId,
        })
        .onConflictDoNothing();
    } else {
      // Remove favorite
      await db
        .delete(userFavorites)
        .where(
          and(
            eq(userFavorites.assetId, assetId),
            eq(userFavorites.userId, userId),
          ),
        );
    }

    logger.info('Updated asset favorite status', {
      assetId,
      userId,
      favorite,
    });
  }

  /**
   * Add a review for an asset
   */
  async reviewAsset(assetId: string, userId: string, review: ReviewRequest) {
    const db = await getDatabase();

    // Check if user has already reviewed
    const [existing] = await db
      .select()
      .from(assetReviews)
      .where(
        and(eq(assetReviews.assetId, assetId), eq(assetReviews.userId, userId)),
      )
      .limit(1);

    if (existing) {
      // Update existing review
      const [updated] = await db
        .update(assetReviews)
        .set({
          rating: review.rating,
          review: review.comment,
          updatedAt: new Date(),
        })
        .where(eq(assetReviews.id, existing.id))
        .returning();

      await this.updateAssetRating(assetId);
      return updated;
    } else {
      // Get organization ID from asset
      const [asset] = await db
        .select({ organizationId: marketplaceAssets.organizationId })
        .from(marketplaceAssets)
        .where(eq(marketplaceAssets.id, assetId))
        .limit(1);

      if (!asset) {
        throw new Error('Asset not found');
      }

      // Create new review
      const [created] = await db
        .insert(assetReviews)
        .values({
          organizationId: asset.organizationId,
          assetId,
          userId,
          rating: review.rating,
          review: review.comment,
        })
        .returning();

      await this.updateAssetRating(assetId);
      return created;
    }
  }

  /**
   * Get user's installations
   */
  async getInstallations(userId: string) {
    const db = await getDatabase();

    const installations = await db
      .select({
        installation: assetInstallations,
        asset: marketplaceAssets,
      })
      .from(assetInstallations)
      .innerJoin(
        marketplaceAssets,
        eq(assetInstallations.assetId, marketplaceAssets.id),
      )
      .where(eq(assetInstallations.userId, userId))
      .orderBy(desc(assetInstallations.installedAt));

    return installations;
  }

  /**
   * Get user's favorites
   */
  async getFavorites(userId: string) {
    const db = await getDatabase();

    const favorites = await db
      .select({
        favorite: userFavorites,
        asset: marketplaceAssets,
      })
      .from(userFavorites)
      .innerJoin(
        marketplaceAssets,
        eq(userFavorites.assetId, marketplaceAssets.id),
      )
      .where(eq(userFavorites.userId, userId))
      .orderBy(desc(userFavorites.createdAt));

    return favorites;
  }

  /**
   * Update asset rating based on reviews
   */
  private async updateAssetRating(assetId: string) {
    const db = await getDatabase();

    const [stats] = await db
      .select({
        avgRating: sql<number>`AVG(${assetReviews.rating})`,
        totalReviews: sql<number>`COUNT(*)`,
      })
      .from(assetReviews)
      .where(eq(assetReviews.assetId, assetId));

    await db
      .update(marketplaceAssets)
      .set({
        rating: stats.avgRating || 0,
        ratingCount: stats.totalReviews || 0,
      })
      .where(eq(marketplaceAssets.id, assetId));
  }
}
