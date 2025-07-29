#!/bin/bash

echo "Fixing searchParams.get() with 2 arguments..."

# Fix analytics/detailed
sed -i '' "s/parseInt(searchParams.get('page', 10) || '1')/parseInt(searchParams.get('page') || '1', 10)/g" app/api/analytics/detailed/route.ts
sed -i '' "s/parseInt(searchParams.get('limit', 10) || '50')/parseInt(searchParams.get('limit') || '50', 10)/g" app/api/analytics/detailed/route.ts

# Fix characters route
sed -i '' "s/parseInt(searchParams.get('limit', 10) || '50')/parseInt(searchParams.get('limit') || '50', 10)/g" app/api/characters/route.ts
sed -i '' "s/parseInt(searchParams.get('offset', 10) || '0')/parseInt(searchParams.get('offset') || '0', 10)/g" app/api/characters/route.ts

# Fix characters/[id]/conversations
sed -i '' "s/parseInt(searchParams.get('limit', 10) || '50')/parseInt(searchParams.get('limit') || '50', 10)/g" "app/api/characters/[id]/conversations/route.ts"
sed -i '' "s/parseInt(searchParams.get('offset', 10) || '0')/parseInt(searchParams.get('offset') || '0', 10)/g" "app/api/characters/[id]/conversations/route.ts"

# Fix dashboard/activity
sed -i '' "s/parseInt(url.searchParams.get('limit', 10) || '10')/parseInt(url.searchParams.get('limit') || '10', 10)/g" app/api/dashboard/activity/route.ts

# Fix registry/plugins
sed -i '' "s/parseInt(searchParams.get('limit', 10) || '20')/parseInt(searchParams.get('limit') || '20', 10)/g" app/api/registry/plugins/route.ts
sed -i '' "s/parseInt(searchParams.get('offset', 10) || '0')/parseInt(searchParams.get('offset') || '0', 10)/g" app/api/registry/plugins/route.ts

# Fix security/audit
sed -i '' "s/parseInt(searchParams.get('limit', 10)!)/parseInt(searchParams.get('limit')!, 10)/g" app/api/security/audit/route.ts
sed -i '' "s/parseInt(searchParams.get('offset', 10)!)/parseInt(searchParams.get('offset')!, 10)/g" app/api/security/audit/route.ts

# Fix marketplace routes
sed -i '' "s/parseInt(url.searchParams.get('limit', 10) || '20')/parseInt(url.searchParams.get('limit') || '20', 10)/g" app/api/marketplace/assets/route.ts
sed -i '' "s/parseInt(url.searchParams.get('offset', 10) || '0')/parseInt(url.searchParams.get('offset') || '0', 10)/g" app/api/marketplace/assets/route.ts

sed -i '' "s/parseInt(url.searchParams.get('limit', 10) || '20')/parseInt(url.searchParams.get('limit') || '20', 10)/g" app/api/marketplace/my/installations/route.ts
sed -i '' "s/parseInt(url.searchParams.get('offset', 10) || '0')/parseInt(url.searchParams.get('offset') || '0', 10)/g" app/api/marketplace/my/installations/route.ts

sed -i '' "s/parseInt(url.searchParams.get('limit', 10) || '20')/parseInt(url.searchParams.get('limit') || '20', 10)/g" app/api/marketplace/search/route.ts
sed -i '' "s/parseInt(url.searchParams.get('offset', 10) || '0')/parseInt(url.searchParams.get('offset') || '0', 10)/g" app/api/marketplace/search/route.ts

sed -i '' "s/parseInt(url.searchParams.get('limit', 10) || '20')/parseInt(url.searchParams.get('limit') || '20', 10)/g" app/api/marketplace/my/favorites/route.ts
sed -i '' "s/parseInt(url.searchParams.get('offset', 10) || '0')/parseInt(url.searchParams.get('offset') || '0', 10)/g" app/api/marketplace/my/favorites/route.ts

sed -i '' "s/parseInt(url.searchParams.get('limit', 10) || '10')/parseInt(url.searchParams.get('limit') || '10', 10)/g" "app/api/marketplace/assets/[id]/reviews/route.ts"
sed -i '' "s/parseInt(url.searchParams.get('offset', 10) || '0')/parseInt(url.searchParams.get('offset') || '0', 10)/g" "app/api/marketplace/assets/[id]/reviews/route.ts"

# Fix v1 routes
sed -i '' "s/parseInt(searchParams.get('page', 10) || '1')/parseInt(searchParams.get('page') || '1', 10)/g" app/api/v1/api-keys/route.ts
sed -i '' "s/parseInt(searchParams.get('limit', 10) || '10')/parseInt(searchParams.get('limit') || '10', 10)/g" app/api/v1/api-keys/route.ts

echo "Done fixing searchParams.get() calls" 