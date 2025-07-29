#!/bin/bash

# Fix searchParams.get() with 2 arguments

echo "Fixing searchParams.get() with 2 arguments..."

# Fix patterns like searchParams.get('param', 10) to searchParams.get('param') || '10', 10)
find app -name "*.ts" -type f -exec sed -i '' -E "s/searchParams\.get\((['\"][^'\"]+['\"])\s*,\s*([0-9]+)\)/searchParams.get(\1)/g" {} \;

# Fix patterns like parseInt(searchParams.get('limit') || '50') to parseInt(searchParams.get('limit') || '50', 10)
find app -name "*.ts" -type f -exec sed -i '' -E "s/parseInt\(([^)]+searchParams\.get\([^)]+\)[^)]*)\)\s*([,;])/parseInt(\1, 10)\2/g" {} \;

echo "Done fixing searchParams.get() calls" 