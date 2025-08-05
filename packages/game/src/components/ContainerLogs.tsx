import React, { useState, useEffect, useRef } from 'react';
import TauriService, { ContainerLog } from '../services/TauriService';

export const ContainerLogs: React.FC = () => {
  const [logs, setLogs] = useState<ContainerLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'agentserver' | 'postgres'>('all');
  const [showOnlyErrors, setShowOnlyErrors] = useState<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const maxLogsRef = useRef<number>(1000); // Keep last 1000 logs

  useEffect(() => {
    // Subscribe to container logs
    const unsubscribe = TauriService.onContainerLog((log: ContainerLog) => {
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

  const isErrorLog = (message: string): boolean => {
    const errorPatterns = [
      /ERROR/i,
      /FATAL/i,
      /CRITICAL/i,
      /Exception/i,
      /Failed/i,
      /Error:/i,
      /panic:/i,
    ];
    return errorPatterns.some((pattern) => pattern.test(message));
  };

  const isPostgresError = (log: ContainerLog): boolean => {
    return log.service.toLowerCase().includes('postgres') && isErrorLog(log.message);
  };

  const filteredLogs = logs.filter((log) => {
    // Filter by container
    if (filter === 'agentserver' && !log.service.toLowerCase().includes('agentserver')) {
      return false;
    }
    if (filter === 'postgres' && !log.service.toLowerCase().includes('postgres')) {
      return false;
    }

    // For postgres, only show errors
    if (log.service.toLowerCase().includes('postgres') && !isPostgresError(log)) {
      return false;
    }

    // For other containers, show all logs unless showOnlyErrors is true
    if (
      showOnlyErrors &&
      !log.service.toLowerCase().includes('postgres') &&
      !isErrorLog(log.message)
    ) {
      return false;
    }

    return true;
  });

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogClass = (log: ContainerLog): string => {
    if (isErrorLog(log.message)) return 'text-terminal-red border-l-terminal-red/50 bg-terminal-red/10';
    if (log.level === 'error') return 'text-terminal-red border-l-terminal-red/30';
    if (log.message.includes('WARN')) return 'text-terminal-yellow border-l-terminal-yellow/30';
    if (log.message.includes('INFO')) return 'text-terminal-cyan border-l-terminal-cyan/30';
    if (log.message.includes('DEBUG')) return 'text-gray-500 border-l-gray-500/30';
    return 'text-gray-300 border-l-gray-300/30';
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-black text-terminal-green font-mono">
      <div className="px-4 py-3 border-b border-terminal-green/30 bg-black/80 flex items-center justify-between">
        <h3 className="text-sm font-bold text-terminal-green uppercase tracking-wider">Container Logs</h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-terminal-green/70">Container:</label>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as any)}
              className="py-1 px-2 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs outline-none cursor-pointer transition-none appearance-none pr-6 bg-no-repeat bg-[right_4px_center] bg-[length:10px] hover:border-terminal-green/50 hover:bg-black/70 focus:border-terminal-green focus:bg-black/80"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='5' viewBox='0 0 10 5'%3E%3Cpath d='M0 0 L5 5 L10 0' fill='none' stroke='%2300ff00' stroke-width='1.5'/%3E%3C/svg%3E\")",
              }}
            >
              <option value="all">All</option>
              <option value="agentserver">AgentServer</option>
              <option value="postgres">PostgreSQL (Errors Only)</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="checkbox"
              id="errors-only"
              checked={showOnlyErrors}
              onChange={(e) => setShowOnlyErrors(e.target.checked)}
              disabled={filter === 'postgres'} // Postgres always shows only errors
              className="w-3 h-3 accent-terminal-green cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
            <label 
              htmlFor="errors-only" 
              className={`text-xs text-terminal-green/70 cursor-pointer ${filter === 'postgres' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Errors Only
            </label>
          </div>
          <button 
            onClick={clearLogs} 
            className="py-1 px-3 bg-black/60 border border-terminal-green/30 text-terminal-green font-mono text-xs uppercase transition-none hover:bg-terminal-green/10 hover:border-terminal-green"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="flex-1 px-4 py-2 overflow-y-auto" ref={logContainerRef}>
        {filteredLogs.length === 0 ? (
          <div className="text-center text-gray-400 italic py-8">
            <p>No logs to display</p>
            <p className="text-[10px] mt-2 text-gray-600">
              Container logs will appear here when services are running
            </p>
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div 
              key={index} 
              className={`flex items-start gap-2 py-1.5 mb-1 border-l-2 pl-2 font-mono text-xs ${getLogClass(log)}`}
            >
              <span className="text-gray-500 text-[10px] shrink-0">{formatTimestamp(log.timestamp)}</span>
              <span className="font-bold text-terminal-magenta shrink-0">[{log.service}]</span>
              <span className="break-words">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ContainerLogs;