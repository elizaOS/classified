import { Message } from '../hooks/useWebSocket';

interface MessageProps {
    message: Message;
}

export default function MessageComponent({ message }: MessageProps) {
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
        });
    };

    const isSystem = message.senderId === 'system';
    const messageClass = isSystem ? 'system' : (message.isAgent ? 'agent-message' : 'user-message');

    return (
        <div className={`message glow ${messageClass}`} style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '4px' }}>
                <span style={{ 
                    color: isSystem ? 'var(--terminal-green)' : (message.isAgent ? 'var(--terminal-green)' : 'var(--terminal-amber)'),
                    marginRight: '8px',
                    fontWeight: 'bold'
                }}>
                    {isSystem ? 'SYSTEM' : (message.isAgent ? 'TERMINAL' : 'USER')}
                </span>
                <span style={{ 
                    fontSize: '0.8em', 
                    opacity: 0.6 
                }}>
                    [{formatTime(message.timestamp)}]
                </span>
            </div>
            <div style={{ 
                marginLeft: '16px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
            }}>
                &gt; {message.text}
            </div>
        </div>
    );
} 