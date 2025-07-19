import { useEffect, useRef } from 'react';
import { Message } from '../hooks/useWebSocket';
import MessageComponent from './Message';
import MessageInput from './MessageInput';

interface ChatPanelProps {
    messages: Message[];
    onSendMessage: (text: string) => void;
    isLoading: boolean;
    isConnected: boolean;
}

// Add welcome message
const welcomeMessage: Message = {
    id: 'welcome',
    text: 'Terminal AI initialized. Type your message and press Enter.',
    senderId: 'system',
    senderName: 'System',
    timestamp: new Date(),
    isAgent: false
};

export default function ChatPanel({ messages, onSendMessage, isLoading, isConnected }: ChatPanelProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Combine welcome message with actual messages
    const displayMessages = [welcomeMessage, ...messages];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="panel-header panel-title glow">
                Terminal Chat
            </div>
            <div className="panel-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Messages area */}
                <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
                    {displayMessages.map((message) => (
                        <MessageComponent key={message.id} message={message} />
                    ))}
                    
                    {/* Loading indicator */}
                    {isLoading && (
                        <div className="glow loading" style={{ marginTop: '8px' }}>
                            Terminal is processing...
                        </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <MessageInput 
                    onSendMessage={onSendMessage} 
                    disabled={!isConnected}
                />
            </div>
        </div>
    );
} 