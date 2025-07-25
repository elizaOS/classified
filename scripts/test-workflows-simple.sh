#!/bin/bash

# Simple workflow testing with act
# Tests syntax and basic workflow structure

set -e

echo "🧪 Testing GitHub Actions Workflows with act"
echo "=============================================="

# Check if act and docker are available
command -v act >/dev/null 2>&1 || { echo "❌ act is required but not installed. Install with: brew install act"; exit 1; }
docker info >/dev/null 2>&1 || { echo "❌ Docker is required but not running. Please start Docker."; exit 1; }

echo "✅ Prerequisites check passed"
echo ""

# Test each workflow with dry-run to check syntax
workflows=(
    "test-build.yml:pull_request"
    "lander-deploy.yml:workflow_dispatch"
    "tauri-release.yml:workflow_dispatch"
    "manual-release.yml:workflow_dispatch" 
    "verify-deployment.yml:workflow_dispatch"
)

for workflow_info in "${workflows[@]}"; do
    IFS=':' read -r workflow event <<< "$workflow_info"
    
    echo "📋 Testing: $workflow (event: $event)"
    
    if [ ! -f ".github/workflows/$workflow" ]; then
        echo "   ❌ Workflow file not found: $workflow"
        continue
    fi
    
    # Test syntax with dry-run
    echo "   🔍 Checking syntax..."
    if act "$event" --dryrun -W ".github/workflows/$workflow" --env-file .env.act > /tmp/act_test.log 2>&1; then
        echo "   ✅ Syntax check passed"
    else
        echo "   ❌ Syntax check failed. Check /tmp/act_test.log for details"
        echo "   Last few lines from log:"
        tail -5 /tmp/act_test.log | sed 's/^/      /'
    fi
    
    echo ""
done

echo "🎯 Workflow Syntax Testing Complete!"
echo ""
echo "Next steps:"
echo "1. Fix any syntax errors shown above"
echo "2. Run full workflow tests: node scripts/test-workflows.js"
echo "3. Test on GitHub with manual triggers"