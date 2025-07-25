#!/usr/bin/env node

const { io } = require('socket.io-client');

async function testSocketIO() {
    console.log('🔗 Testing Socket.IO communication with agent server...');
    
    const socket = io('http://localhost:7779', {
        transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
        console.log('✅ Connected to agent server');
        
        // Join a test room
        const roomId = 'terminal-room-test';
        socket.emit('joinRoom', {
            roomId: roomId,
            userId: 'test-user'
        });
        
        console.log(`📡 Joined room: ${roomId}`);
        
        // Send a test message
        setTimeout(() => {
            const message = {
                roomId: roomId,
                content: { text: 'Hello! Can you tell me your name?' },
                senderId: 'test-user-123',
                senderName: 'Test User',
                timestamp: Date.now(),
                messageId: `msg-${Date.now()}`
            };
            
            console.log(`📤 Sending message: ${message.content.text}`);
            socket.emit('message', message);
        }, 1000);
    });

    socket.on('messageBroadcast', (data) => {
        console.log('📥 Received message broadcast:', data);
        
        if (data.text && data.senderId !== 'test-user-123') {
            console.log('🎉 SUCCESS! Agent responded with:', data.text);
            process.exit(0);
        }
    });

    socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        process.exit(1);
    });

    socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
        console.log('⏰ Timeout - no response received');
        process.exit(1);
    }, 30000);
}

testSocketIO().catch(console.error);