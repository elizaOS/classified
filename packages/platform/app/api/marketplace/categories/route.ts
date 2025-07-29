import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { getDatabase } from '@/lib/database';
import { marketplaceAssets } from '@/lib/database/marketplace-schema';
import { eq, and, sql, desc } from 'drizzle-orm';

async function handleGET(request: NextRequest) {
  try {
    const db = await getDatabase();

    // Get categories with asset counts
    const categories = await db
      .select({
        category: marketplaceAssets.category,
        assetType: marketplaceAssets.assetType,
        count: sql<number>`count(*)::int`,
        avgRating: sql<number>`avg(${marketplaceAssets.rating})::float`,
        totalInstalls: sql<number>`sum(${marketplaceAssets.installCount})::int`,
      })
      .from(marketplaceAssets)
      .where(
        and(
          eq(marketplaceAssets.status, 'published'),
          eq(marketplaceAssets.visibility, 'public'),
        ),
      )
      .groupBy(marketplaceAssets.category, marketplaceAssets.assetType)
      .orderBy(desc(sql`count(*)`));

    // Group by category
    const categoryMap = new Map();

    categories.forEach((row: any) => {
      if (!categoryMap.has(row.category)) {
        categoryMap.set(row.category, {
          name: row.category,
          totalAssets: 0,
          totalInstalls: 0,
          avgRating: 0,
          assetTypes: {},
        });
      }

      const category = categoryMap.get(row.category);
      category.totalAssets += row.count;
      category.totalInstalls += row.totalInstalls || 0;
      category.assetTypes[row.assetType] = {
        count: row.count,
        avgRating: row.avgRating || 0,
        totalInstalls: row.totalInstalls || 0,
      };
    });

    // Calculate average ratings for categories
    categoryMap.forEach((category, name) => {
      const assetTypes = Object.values(category.assetTypes) as any[];
      if (assetTypes.length > 0) {
        const totalRating = assetTypes.reduce(
          (sum, type) => sum + type.avgRating * type.count,
          0,
        );
        category.avgRating = totalRating / category.totalAssets;
      }
    });

    // Convert to array and sort by total assets
    const categoryList = Array.from(categoryMap.values()).sort(
      (a, b) => b.totalAssets - a.totalAssets,
    );

    // Get popular tags
    const tags = await db
      .select({
        tag: sql<string>`unnest(${marketplaceAssets.tags})`,
        count: sql<number>`count(*)::int`,
      })
      .from(marketplaceAssets)
      .where(
        and(
          eq(marketplaceAssets.status, 'published'),
          eq(marketplaceAssets.visibility, 'public'),
        ),
      )
      .groupBy(sql`unnest(${marketplaceAssets.tags})`)
      .orderBy(desc(sql`count(*)`))
      .limit(50);

    // Get overall statistics
    const stats = await db
      .select({
        totalAssets: sql<number>`count(*)::int`,
        totalInstalls: sql<number>`sum(${marketplaceAssets.installCount})::int`,
        avgRating: sql<number>`avg(${marketplaceAssets.rating})::float`,
        totalCreators: sql<number>`count(distinct ${marketplaceAssets.creatorId})::int`,
      })
      .from(marketplaceAssets)
      .where(
        and(
          eq(marketplaceAssets.status, 'published'),
          eq(marketplaceAssets.visibility, 'public'),
        ),
      );

    return NextResponse.json({
      success: true,
      data: {
        categories: categoryList,
        popularTags: tags.map((t: any) => ({
          name: t.tag,
          count: t.count,
        })),
        statistics: stats[0] || {
          totalAssets: 0,
          totalInstalls: 0,
          avgRating: 0,
          totalCreators: 0,
        },
      },
    });
  } catch (error) {
    console.error('Failed to get marketplace categories:', error);
    return NextResponse.json(
      { error: 'Failed to get marketplace categories' },
      { status: 500 },
    );
  }
}

export const { GET } = wrapHandlers({ handleGET });
