#!/bin/bash

# Complete CI/CD Validation Script
# Tests all components of the ELIZA release system

set -e

echo "🚀 ELIZA CI/CD System Validation"
echo "================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

success_count=0
total_tests=0

check_test() {
    total_tests=$((total_tests + 1))
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        success_count=$((success_count + 1))
    else
        echo -e "${RED}❌ $1${NC}"
    fi
}

echo -e "${BLUE}📋 Phase 1: Prerequisites${NC}"

# Check if required tools are installed
command -v node >/dev/null 2>&1
check_test "Node.js is installed"

command -v npm >/dev/null 2>&1
check_test "npm is installed"

command -v act >/dev/null 2>&1
check_test "act (GitHub Actions local runner) is installed"

command -v docker >/dev/null 2>&1
check_test "Docker is installed"

docker info >/dev/null 2>&1
check_test "Docker is running"

echo ""
echo -e "${BLUE}📋 Phase 2: Repository Structure${NC}"

# Check repository structure
[ -d "packages/lander" ]
check_test "Lander package directory exists"

[ -f "packages/lander/package.json" ]
check_test "Lander package.json exists"

[ -f "packages/lander/vite.config.ts" ]
check_test "Lander Vite config exists"

[ -d "packages/game" ]
check_test "Game package directory exists"

[ -f "packages/game/package.json" ]
check_test "Game package.json exists"

[ -f "packages/game/src-tauri/tauri.conf.json" ]
check_test "Tauri configuration exists"

[ -d ".github/workflows" ]
check_test "GitHub workflows directory exists"

echo ""
echo -e "${BLUE}📋 Phase 3: Configuration Validation${NC}"

# Validate configurations
node scripts/verify-release-setup.js >/dev/null 2>&1
check_test "Release setup configuration is valid"

# Check Tauri config has correct branding
grep -q "ELIZA" packages/game/src-tauri/tauri.conf.json
check_test "Tauri app has correct name"

grep -q "com.classified.eliza" packages/game/src-tauri/tauri.conf.json
check_test "Tauri app has correct identifier"

# Check lander is configured for correct repository
grep -q "lalalune" packages/lander/src/hooks/useGithubReleases.ts
check_test "Lander points to correct repository"

grep -q "thegame" packages/lander/src/hooks/useGithubReleases.ts
check_test "Lander points to correct repository name"

echo ""
echo -e "${BLUE}📋 Phase 4: Build Testing${NC}"

# Test lander build
cd packages/lander

# Clean any existing node_modules and try fresh install
rm -rf node_modules dist 2>/dev/null || true
npm install --no-workspaces >/dev/null 2>&1 || npm install >/dev/null 2>&1
check_test "Lander dependencies install successfully"

npm run build >/dev/null 2>&1
check_test "Lander builds successfully"

[ -d "dist" ] && [ -f "dist/index.html" ]
check_test "Lander build output is correct"
cd ../..

echo ""
echo -e "${BLUE}📋 Phase 5: Workflow Validation${NC}"

# Test workflow syntax
./scripts/test-workflows-simple.sh >/dev/null 2>&1
check_test "All workflow files have valid syntax"

# Check specific workflow requirements
grep -q "workflow_dispatch" .github/workflows/manual-release.yml
check_test "Manual release workflow can be triggered"

grep -q "lalalune/thegame" packages/lander/src/hooks/useGithubReleases.ts
check_test "Release hook points to correct repository"

echo ""
echo -e "${BLUE}📋 Phase 6: Local Testing with act${NC}"

# Test workflow with act (dry run)
act workflow_dispatch --dryrun -W .github/workflows/lander-deploy.yml --env-file .env.act >/dev/null 2>&1
check_test "Lander deployment workflow syntax is valid"

act workflow_dispatch --dryrun -W .github/workflows/tauri-release.yml --env-file .env.act >/dev/null 2>&1
check_test "Tauri release workflow syntax is valid"

act workflow_dispatch --dryrun -W .github/workflows/manual-release.yml --env-file .env.act >/dev/null 2>&1
check_test "Manual release workflow syntax is valid"

echo ""
echo "================================="
echo -e "${BLUE}📊 Test Results Summary${NC}"
echo "================================="

if [ $success_count -eq $total_tests ]; then
    echo -e "${GREEN}🎉 All tests passed! ($success_count/$total_tests)${NC}"
    echo ""
    echo -e "${GREEN}✅ Your CI/CD system is ready for production!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Push these changes to your repository"
    echo "2. Enable GitHub Pages in repository settings" 
    echo "3. Create your first release via GitHub Actions"
    echo "4. Watch the magic happen! 🚀"
    echo ""
    echo "Release creation:"
    echo "• Go to GitHub Actions → Manual Release"
    echo "• Enter version like 'v1.0.0'"
    echo "• Click 'Run workflow'"
    echo ""
    echo "Your mysterious ELIZA will be available at:"
    echo "https://lalalune.github.io/thegame/"
    
    exit 0
else
    failed_tests=$((total_tests - success_count))
    echo -e "${RED}❌ Some tests failed ($failed_tests/$total_tests)${NC}"
    echo ""
    echo -e "${YELLOW}Please fix the issues above before proceeding${NC}"
    
    exit 1
fi