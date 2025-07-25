#!/bin/bash
# Quick test summary - runs each test individually and reports results

echo "🧪 ElizaOS Terminal App - Quick Test Summary"
echo "=========================================="

TESTS=(
    "Application binary exists and is executable"
    "Application can be launched successfully" 
    "Server starts and binds to correct port"
    "Health endpoint responds correctly"
    "Agent is properly registered and active"
    "WebSocket endpoint is accessible"
    "API endpoints return valid JSON responses"
    "Server gracefully handles app termination"
    "Application handles multiple launch attempts gracefully"
    "Application startup completes within reasonable time"
)

PASSED=0
FAILED=0

for test in "${TESTS[@]}"; do
    echo -n "Testing: $test ... "
    
    if timeout 90 bats --tap tests/app-integration.bats --filter "$test" >/dev/null 2>&1; then
        echo "✅ PASS"
        PASSED=$((PASSED + 1))
    else
        echo "❌ FAIL"
        FAILED=$((FAILED + 1))
    fi
    
    # Clean up between tests
    pkill -f "ElizaOS Terminal" >/dev/null 2>&1 || true
    pkill -f "node.*server.js" >/dev/null 2>&1 || true
    sleep 2
done

echo
echo "Summary:"
echo "  ✅ Passed: $PASSED"
echo "  ❌ Failed: $FAILED"
echo "  📊 Success Rate: $(( PASSED * 100 / (PASSED + FAILED) ))%"

if [ $FAILED -eq 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "⚠️  Some tests failed"
    exit 1
fi