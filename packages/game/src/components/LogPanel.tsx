import { useState, useEffect, useRef } from 'react';

type TabType = 'logs' | 'process' | 'tasks';

interface LogEntry {
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
}

interface LogPanelProps {
    socket: any | null;
    isConnected: boolean;
}

export default function LogPanel({ socket, isConnected }: LogPanelProps) {
    const [activeTab, setActiveTab] = useState<TabType>('logs');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [logFilter, setLogFilter] = useState<string>('all');
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!socket) {
            console.log('[LogPanel] No socket available');
            return;
        }

        try {
            // Subscribe to logs
            socket.emit('subscribe_logs');
            socket.emit('update_log_filters', {
                agentName: 'Terminal',
                level: logFilter === 'all' ? null : logFilter,
            });

            // Handle log stream
            const handleLogStream = (data: any) => {
                try {
                    console.log('[LogPanel] Received log data:', data);
                    if (data.type === 'log_entry' && data.payload) {
                        // Ensure level is a valid string
                        let level: LogEntry['level'] = 'info';
                        if (data.payload.level) {
                            const levelStr = String(data.payload.level).toLowerCase();
                            if (['info', 'warn', 'error', 'debug'].includes(levelStr)) {
                                level = levelStr as LogEntry['level'];
                            }
                        }
                        
                        const newLog: LogEntry = {
                            timestamp: new Date(data.payload.timestamp || Date.now()),
                            level: level,
                            message: data.payload.message || data.payload.text || 'Unknown log entry'
                        };
                        console.log('[LogPanel] Created log entry:', newLog);
                        setLogs(prev => [...prev, newLog]);
                    }
                } catch (error) {
                    console.error('[LogPanel] Error handling log stream:', error);
                }
            };

            socket.on('log_stream', handleLogStream);
            socket.on('log_subscription_confirmed', (data: any) => {
                console.log('[LogPanel] Log subscription confirmed:', data);
            });

            return () => {
                if (socket) {
                    socket.off('log_stream', handleLogStream);
                    socket.emit('unsubscribe_logs');
                }
            };
        } catch (error) {
            console.error('[LogPanel] Error in socket setup:', error);
        }
    }, [socket, logFilter]);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: false 
        });
    };

    const renderLogs = () => {
        const filteredLogs = logFilter === 'all' 
            ? logs 
            : logs.filter(log => (log.level || 'info') === logFilter);

        return (
            <div style={{ height: '100%', overflowY: 'auto' }}>
                {/* Log filter */}
                <div style={{ 
                    marginBottom: '12px', 
                    borderBottom: '1px solid var(--terminal-border)',
                    paddingBottom: '8px'
                }}>
                    <select 
                        value={logFilter}
                        onChange={(e) => setLogFilter(e.target.value)}
                        className="log-filter-select"
                        style={{
                            background: 'var(--terminal-bg)',
                            border: '1px solid var(--terminal-border)',
                            color: 'var(--terminal-green)',
                            padding: '4px 8px',
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            outline: 'none'
                        }}
                    >
                        <option value="all">ALL</option>
                        <option value="debug">DEBUG</option>
                        <option value="info">INFO</option>
                        <option value="warn">WARN</option>
                        <option value="error">ERROR</option>
                    </select>
                </div>

                {/* Log entries */}
                {filteredLogs.length === 0 ? (
                    <div className="glow" style={{ opacity: 0.7 }}>
                        &gt; No logs to display
                    </div>
                ) : (
                    filteredLogs.map((log, index) => (
                        <div 
                            key={index} 
                            className="glow"
                            style={{ 
                                marginBottom: '4px',
                                color: log.level === 'error' ? 'var(--terminal-red)' : 
                                       log.level === 'warn' ? 'var(--terminal-amber)' : 
                                       'var(--terminal-green)',
                                fontSize: '12px'
                            }}
                        >
                            [{formatTime(log.timestamp)}] [{String(log.level || 'info').toUpperCase()}] {log.message}
                        </div>
                    ))
                )}
                <div ref={logsEndRef} />
            </div>
        );
    };

    const renderProcess = () => (
        <div className="process-info glow">
            <div className="process-stat" style={{ marginBottom: '8px' }}>
                &gt; AGENT STATUS: {isConnected ? 'ACTIVE' : 'INACTIVE'}
            </div>
            <div className="process-stat" style={{ marginBottom: '8px' }}>
                &gt; MODEL: Terminal AI v1.0
            </div>
            <div className="process-stat" style={{ marginBottom: '8px' }}>
                &gt; UPTIME: {new Date().toLocaleTimeString()}
            </div>
            <div className="process-stat" style={{ marginBottom: '8px' }}>
                &gt; CPU: -- %
            </div>
            <div className="process-stat" style={{ marginBottom: '8px' }}>
                &gt; MEMORY: -- MB
            </div>
        </div>
    );

    const renderTasks = () => (
        <div className="glow text-dim" style={{ opacity: 0.7 }}>
            <div>Task list coming soon...</div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="panel-header panel-title glow">
                System Monitor
            </div>
            <div className="log-tabs" style={{ 
                display: 'flex', 
                gap: '0',
                borderBottom: '1px solid var(--terminal-border)',
                marginBottom: '12px',
                padding: '0 12px'
            }}>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`log-tab ${activeTab === 'logs' ? 'active' : ''}`}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'logs' ? '2px solid var(--terminal-green)' : 'none',
                        color: 'var(--terminal-green)',
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        textTransform: 'uppercase',
                        opacity: activeTab === 'logs' ? 1 : 0.6
                    }}
                >
                    Logs
                </button>
                <button
                    onClick={() => setActiveTab('process')}
                    className={`log-tab ${activeTab === 'process' ? 'active' : ''}`}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'process' ? '2px solid var(--terminal-green)' : 'none',
                        color: 'var(--terminal-green)',
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        textTransform: 'uppercase',
                        opacity: activeTab === 'process' ? 1 : 0.6
                    }}
                >
                    Process
                </button>
                <button
                    onClick={() => setActiveTab('tasks')}
                    className={`log-tab ${activeTab === 'tasks' ? 'active' : ''}`}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'tasks' ? '2px solid var(--terminal-green)' : 'none',
                        color: 'var(--terminal-green)',
                        padding: '8px 16px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        textTransform: 'uppercase',
                        opacity: activeTab === 'tasks' ? 1 : 0.6
                    }}
                >
                    Tasks
                </button>
            </div>
            <div className="panel-content" style={{ flex: 1, overflow: 'hidden', padding: '12px' }}>
                {activeTab === 'logs' && renderLogs()}
                {activeTab === 'process' && renderProcess()}
                {activeTab === 'tasks' && renderTasks()}
            </div>
        </div>
    );
} 