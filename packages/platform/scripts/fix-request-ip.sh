#!/bin/bash

echo "Fixing request.ip occurrences..."

# Fix security/config/route.ts
sed -i '' "s/ipAddress: request.ip,/ipAddress: request.headers.get('x-forwarded-for') || \n                  request.headers.get('x-real-ip') || \n                  'unknown',/g" app/api/security/config/route.ts

echo "Done fixing request.ip occurrences" 