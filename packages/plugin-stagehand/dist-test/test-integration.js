import { StagehandProcessManager } from './src/process-manager.js';
import { StagehandWebSocketClient } from './src/websocket-client.js';
async function testIntegration() {
    const manager = new StagehandProcessManager(3456);
    const client = new StagehandWebSocketClient('ws://localhost:3456');
    try {
        console.log('Starting Stagehand server...');
        await manager.start();
        console.log('Connecting WebSocket client...');
        await client.connect();
        console.log('Creating browser session...');
        const sessionResponse = await client.sendMessage('createSession', {
            sessionId: 'test-session-1'
        });
        const sessionId = sessionResponse.sessionId || 'test-session-1';
        console.log('Session created:', sessionId);
        console.log('Testing navigate method...');
        const navResult = await client.navigate(sessionId, 'https://example.com');
        console.log('Navigation result:', navResult);
        console.log('Testing getState method...');
        const stateResult = await client.getState(sessionId);
        console.log('State result:', stateResult);
        console.log('Destroying session...');
        await client.sendMessage('destroySession', { sessionId });
        console.log('Session destroyed');
        console.log('✅ Integration test passed!');
    }
    catch (error) {
        console.error('❌ Integration test failed:', error);
    }
    finally {
        console.log('Disconnecting client...');
        client.disconnect();
        console.log('Stopping server...');
        await manager.stop();
    }
}
// Run the test
testIntegration().catch(console.error);
