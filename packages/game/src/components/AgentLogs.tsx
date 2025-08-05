import React, { useState, useEffect, useRef } from 'react';
import TauriService from '../services/TauriService';
import { LogEntry } from '../types/shared';

export const AgentLogs: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'agent' | 'system'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const maxLogsRef = useRef<number>(1000); // Keep last 1000 logs

  // Fetch initial logs
  const fetchInitialLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const fetchedLogs = await TauriService.fetchLogs(filter === 'all' ? undefined : filter, 100);
      setLogs(fetchedLogs);
    } catch (err) {
      console.error('Failed to fetch initial logs:', err);
      setError('Failed to fetch logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Fetch initial logs
    fetchInitialLogs();

    // Subscribe to real-time log stream
    const unsubscribe = TauriService.onAgentLog((log: LogEntry) => {
      setLogs((prevLogs) => {
        const newLogs = [...prevLogs, log];
        // Keep only the last maxLogsRef logs
        if (newLogs.length > maxLogsRef.current) {
          return newLogs.slice(-maxLogsRef.current);
        }
        return newLogs;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogClass = (log: LogEntry): string => {
    if (log.level === 'error') return 'text-terminal-red border-l-terminal-red/50 bg-terminal-red/10';
    if (log.level === 'warn') return 'text-terminal-yellow border-l-terminal-yellow/50';
    if (log.level === 'debug') return 'text-gray-500 border-l-gray-500/30';
    const logType = getLogType(log.source);
    if (logType === 'system') return 'text-terminal-magenta border-l-terminal-magenta/30';
    if (logType === 'agent') return 'text-terminal-cyan border-l-terminal-cyan/30';
    return 'text-gray-300 border-l-gray-300/30';
  };

  const getLogType = (source?: string): 'agent' | 'system' | 'error' => {
    if (!source) return 'system';
    if (source.toLowerCase().includes('agent')) return 'agent';
    if (source.toLowerCase().includes('error')) return 'error';
    return 'system';
  };

  const formatTimestamp = (timestamp: string | Date): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLogIcon = (log: LogEntry): string => {
    const logType = getLogType(log.source);
    if (logType === 'agent') return '🤖';
    if (logType === 'system') return '⚙️';
    if (log.level === 'error') return '❌';
    if (log.level === 'warn') return '⚠️';
    return '📝';
  };

  const clearLogs = () => {
    setLogs([]);
  };

  // Filter logs based on selected filter
  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    const logType = getLogType(log.source);
    return logType === filter;
  });

  return (
    <div className="flex flex-col h-full bg-black text-terminal-green font-mono">
      <div className="px-4 py-3 border-b border-terminal-green/30 bg-black/80 flex items-center justify-between">
        <h3 className="text-sm font-bold text-terminal-green uppercase tracking-wider">Eliza Agent & System Logs (Live)</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-terminal-green/70">Type:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'agent' | 'system')}
              className="py-1 px-2 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none cursor-pointer transition-none appearance-none pr-6 bg-no-repeat bg-[right_4px_center] bg-[length:10px] hover:border-terminal-green/50 hover:bg-black/70 focus:border-terminal-green focus:bg-black/80"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='5' viewBox='0 0 10 5'%3E%3Cpath d='M0 0 L5 5 L10 0' fill='none' stroke='%2300ff00' stroke-width='1.5'/%3E%3C/svg%3E\")",
              }}
            >
              <option value="all">All</option>
              <option value="agent">Agent Only</option>
              <option value="system">System Only</option>
            </select>
          </div>
          <button 
            onClick={clearLogs} 
            className="py-1 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs uppercase transition-none hover:bg-terminal-green/10 hover:border-terminal-green"
          >
            Clear Logs
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-terminal-red/10 border-b border-terminal-red/30 text-terminal-red text-xs">
          {error}
        </div>
      )}

      <div className="flex-1 px-4 py-2 overflow-y-auto" ref={logContainerRef}>
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-400 italic py-8">
            {isLoading ? 'Loading logs...' : 'No logs to display'}
            {logs.length > 0 && filteredLogs.length === 0 && (
              <p className="text-[10px] mt-2 text-gray-600">
                {logs.length} logs hidden by filter
              </p>
            )}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div 
              key={index} 
              className={`flex items-start gap-2 py-1.5 mb-1 border-l-2 pl-2 font-mono text-xs ${getLogClass(log)}`}
            >
              <span className="text-gray-500 text-[10px] shrink-0">{formatTimestamp(log.timestamp)}</span>
              <span className="text-base leading-none">{getLogIcon(log)}</span>
              <span className="font-bold shrink-0">[{getLogType(log.source).toUpperCase()}]</span>
              <span className="break-words">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AgentLogs;