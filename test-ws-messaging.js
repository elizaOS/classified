import WebSocket from 'ws';

console.log('Testing WebSocket messaging interface...\n');

const ws = new WebSocket('ws://localhost:7777/ws');

ws.on('open', () => {
    console.log('✓ Connected to WebSocket');
    
    // Send initial message
    const message = {
        type: 'user_message',
        userId: 'test-user',
        userName: 'Test User',
        message: 'Hello from test script!',
        agentId: 'default',
        timestamp: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(message));
    console.log('✓ Sent test message:', message.message);
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());
        console.log('✓ Received:', msg.type, msg.data || msg);
        
        // Send a media stream message after getting connection ack
        if (msg.type === 'connection_ack') {
            console.log('\nTesting media streaming...');
            
            const mediaMsg = {
                type: 'media_stream',
                agentId: 'default',
                mediaType: 'video',
                source: 'user_camera',
                data: Buffer.from('Test video frame').toString('base64')
            };
            
            ws.send(JSON.stringify(mediaMsg));
            console.log('✓ Sent media stream message');
            
            // Close after a delay
            setTimeout(() => {
                console.log('\n✓ Test completed successfully!');
                ws.close();
                process.exit(0);
            }, 2000);
        }
    } catch (e) {
        console.error('Error parsing message:', e);
    }
});

ws.on('error', (err) => {
    console.error('✗ WebSocket error:', err.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('WebSocket closed');
}); 