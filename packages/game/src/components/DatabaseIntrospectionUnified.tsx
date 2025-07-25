import { useState, useEffect, useCallback, FC } from 'react';
import { apiFetch } from '../config/api';
import {
  Database,
  Terminal,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Zap,
  Activity,
  AlertTriangle,
  Wifi,
  WifiOff,
  Settings,
} from 'lucide-react';

interface TableInfo {
  name: string;
  schema: string;
  rowCount: number;
  createSql?: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  primaryKey?: boolean;
}

interface TableData {
  table: string;
  columns: ColumnInfo[];
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  filters: {
    search: string;
    orderBy: string;
    orderDir: string;
  };
}

interface DatabaseIntrospectionProps {
  onViewSwitch?: (view: 'terminal' | 'database' | 'settings') => void;
}

type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// Get auth token from localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

export const DatabaseIntrospection: FC<DatabaseIntrospectionProps> = ({ onViewSwitch }) => {
  // State management
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTableData, setIsLoadingTableData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);

  // Add terminal output helper
  const addTerminalOutput = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalOutput((prev) => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  // Fetch database tables list - uses real API endpoints only
  const fetchDatabaseInfo = async () => {
    try {
      addTerminalOutput('INIT: Connecting to database server...');
      setError(null);
      setConnectionStatus('connecting');
      setIsLoading(true);
      const token = getAuthToken();

      const response = await apiFetch('/api/database/tables', {
        method: 'GET',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(
          `Server responded with ${response.status}: ${errorData.error?.message || 'Unknown error'}`
        );
      }

      const data = await response.json();

      if (data.success && data.data && Array.isArray(data.data.tables)) {
        setTables(data.data.tables);
        setConnectionStatus('connected');
        addTerminalOutput(`SUCCESS: Found ${data.data.tables.length} database tables`);
        addTerminalOutput(`DATABASE: ${data.data.databaseType || 'Unknown'} detected`);

        // Log table summary
        data.data.tables.forEach((table: TableInfo) => {
          addTerminalOutput(`TABLE: ${table.name} (${table.rowCount} rows)`);
        });
      } else {
        throw new Error('Invalid response format from server');
      }
    } catch (error: any) {
      console.error('[DATABASE] Error fetching database info:', error);
      setError(`Database connection failed: ${error.message}`);
      setConnectionStatus('error');
      addTerminalOutput(`ERROR: ${error.message}`);
      setTables([]); // Clear any existing data
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data for a specific table
  const fetchTableData = async (tableName: string, page = 1, search = '') => {
    try {
      setIsLoadingTableData(true);
      addTerminalOutput(`QUERY: Loading data from table "${tableName}"`);

      const token = getAuthToken();
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(search && { search }),
      });

      const response = await apiFetch(`/api/database/tables/${tableName}?${params}`, {
        method: 'GET',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(
          `Failed to fetch table data: ${errorData.error?.message || 'Unknown error'}`
        );
      }

      const data = await response.json();

      if (data.success && data.data) {
        setTableData(data.data);
        addTerminalOutput(`SUCCESS: Loaded ${data.data.data.length} rows from "${tableName}"`);
      } else {
        throw new Error('Invalid table data response');
      }
    } catch (error: any) {
      console.error('[DATABASE] Error fetching table data:', error);
      setError(`Failed to load table data: ${error.message}`);
      addTerminalOutput(`ERROR: ${error.message}`);
    } finally {
      setIsLoadingTableData(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchDatabaseInfo();
  }, []);

  // Handle table selection
  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setCurrentPage(1);
    setSearchTerm('');
    fetchTableData(tableName, 1, '');
  };

  // Handle search
  const handleSearch = (search: string) => {
    if (selectedTable) {
      setSearchTerm(search);
      setCurrentPage(1);
      fetchTableData(selectedTable, 1, search);
    }
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    if (selectedTable && tableData) {
      setCurrentPage(newPage);
      fetchTableData(selectedTable, newPage, searchTerm);
    }
  };

  return (
    <div className="terminal-container" data-testid="database-interface">
      {/* Main Layout */}
      <div className="terminal-layout">
        {/* Left Panel - Navigation */}
        <div
          className="panel panel-left"
          style={{
            width: '300px',
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            border: '1px solid var(--text-primary)',
          }}
        >
          <div
            className="panel-header"
            style={{
              background: 'var(--accent-color)',
              color: 'var(--bg-primary)',
              border: 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              <Database className="w-4 h-4" />
              <span>DATABASE</span>
            </div>
            <div
              className="connection-status"
              data-status={connectionStatus}
              style={{
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {connectionStatus === 'connected' ? (
                <>
                  <Wifi className="w-3 h-3" />
                  <span>ONLINE</span>
                </>
              ) : connectionStatus === 'connecting' ? (
                <>
                  <Activity className="w-3 h-3 animate-spin" />
                  <span>CONNECTING</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" />
                  <span>OFFLINE</span>
                </>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--text-secondary)' }}>
            {onViewSwitch && (
              <div
                className="view-switcher"
                style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                <button
                  onClick={() => onViewSwitch('terminal')}
                  className="view-switch-btn"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--bg-primary)',
                    color: 'var(--bg-primary)',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-primary)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--bg-primary)';
                  }}
                  title="Switch to Admin Terminal"
                >
                  <Terminal className="w-3 h-3 inline mr-2" />
                  ADMIN TERMINAL
                </button>
                <button
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--bg-primary)',
                    color: 'var(--text-primary)',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    width: '100%',
                    textAlign: 'left',
                  }}
                  disabled
                >
                  <Database className="w-3 h-3 inline mr-2" />
                  DATABASE
                </button>
                <button
                  onClick={() => onViewSwitch('settings')}
                  className="view-switch-btn"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--bg-primary)',
                    color: 'var(--bg-primary)',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-primary)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--bg-primary)';
                  }}
                  title="Switch to Settings"
                >
                  <Settings className="w-3 h-3 inline mr-2" />
                  SETTINGS
                </button>
              </div>
            )}
          </div>

          {/* Tables List */}
          <div className="panel-content" style={{ flex: 1, color: 'var(--bg-primary)' }}>
            {/* Refresh button */}
            <div style={{ padding: '12px', borderBottom: '1px solid var(--text-secondary)' }}>
              <button
                onClick={fetchDatabaseInfo}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  cursor: isLoading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  textTransform: 'uppercase',
                }}
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* Tables list */}
            <div className="log-content" style={{ padding: '12px' }}>
              {error ? (
                <div
                  style={{
                    color: 'var(--error-color)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle className="w-4 h-4" />
                    <strong>System Error</strong>
                  </div>
                  <div style={{ marginTop: '8px' }}>{error}</div>
                </div>
              ) : tables.length === 0 && !isLoading ? (
                <div style={{ color: 'var(--text-dim)', textAlign: 'center', fontSize: '12px' }}>
                  No tables found
                </div>
              ) : (
                <div>
                  {tables.map((table) => (
                    <div
                      key={table.name}
                      onClick={() => handleTableSelect(table.name)}
                      style={{
                        padding: '8px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--text-secondary)',
                        backgroundColor:
                          selectedTable === table.name ? 'var(--text-secondary)' : 'transparent',
                        marginBottom: '4px',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        color:
                          selectedTable === table.name ? 'var(--bg-primary)' : 'var(--bg-primary)',
                      }}
                    >
                      <div style={{ fontWeight: 'bold' }}>{table.name}</div>
                      <div style={{ fontSize: '10px', opacity: 0.8 }}>
                        {table.schema} • {table.rowCount} rows
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Middle Panel - Main Database View */}
        <div className="panel" style={{ flex: 1 }}>
          <div className="panel-header">
            <div className="panel-title">
              <Database className="w-4 h-4" />
              {selectedTable ? `Table: ${selectedTable}` : 'Select Table'}
            </div>
            {tableData && (
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                <span>
                  Page {tableData.pagination.page} of {tableData.pagination.totalPages}
                </span>
                <span>{tableData.pagination.total} total rows</span>
              </div>
            )}
          </div>

          <div className="panel-content" style={{ display: 'flex', flexDirection: 'column' }}>
            {selectedTable ? (
              <>
                {/* Search bar */}
                <div
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <Search className="w-4 h-4 text-dim" style={{ color: 'var(--text-dim)' }} />
                  <input
                    type="text"
                    placeholder="Search table data..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchTerm)}
                    style={{
                      flex: 1,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      padding: '6px 8px',
                    }}
                  />
                  <button
                    onClick={() => handleSearch(searchTerm)}
                    disabled={isLoadingTableData}
                    style={{
                      padding: '6px 12px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      fontSize: '11px',
                      cursor: 'pointer',
                    }}
                  >
                    Search
                  </button>
                </div>

                {/* Table data */}
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {isLoadingTableData ? (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '200px',
                        color: 'var(--text-dim)',
                      }}
                    >
                      <Activity className="w-5 h-5 animate-spin mr-2" />
                      Loading table data...
                    </div>
                  ) : tableData ? (
                    <div style={{ padding: '12px' }}>
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontFamily: 'monospace',
                          fontSize: '12px',
                        }}
                      >
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                            {tableData.columns.map((column) => (
                              <th
                                key={column.name}
                                style={{
                                  textAlign: 'left',
                                  padding: '8px 12px',
                                  color: 'var(--text-primary)',
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  fontSize: '11px',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {column.primaryKey && <Zap className="w-3 h-3" />}
                                  {column.name}
                                  <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
                                    ({column.type})
                                  </span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableData.data.map((row, index) => (
                            <tr
                              key={index}
                              style={{ borderBottom: '1px solid rgba(0, 170, 0, 0.1)' }}
                            >
                              {tableData.columns.map((column) => (
                                <td
                                  key={`${index}-${column.name}`}
                                  style={{
                                    padding: '8px 12px',
                                    color: 'var(--text-secondary)',
                                    maxWidth: '200px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={String(row[column.name] || '')}
                                >
                                  {row[column.name] !== null ? (
                                    String(row[column.name])
                                  ) : (
                                    <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                      null
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      {tableData.pagination.totalPages > 1 && (
                        <div
                          style={{
                            marginTop: '16px',
                            padding: '12px',
                            borderTop: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'center',
                            gap: '8px',
                            alignItems: 'center',
                          }}
                        >
                          <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={!tableData.pagination.hasPrev}
                            style={{
                              padding: '4px 8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              cursor: tableData.pagination.hasPrev ? 'pointer' : 'not-allowed',
                              opacity: tableData.pagination.hasPrev ? 1 : 0.5,
                            }}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>

                          <span
                            style={{
                              color: 'var(--text-secondary)',
                              fontSize: '12px',
                              minWidth: '100px',
                              textAlign: 'center',
                            }}
                          >
                            {currentPage} / {tableData.pagination.totalPages}
                          </span>

                          <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={!tableData.pagination.hasNext}
                            style={{
                              padding: '4px 8px',
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              cursor: tableData.pagination.hasNext ? 'pointer' : 'not-allowed',
                              opacity: tableData.pagination.hasNext ? 1 : 0.5,
                            }}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                  color: 'var(--text-dim)',
                  gap: '12px',
                }}
              >
                <Database className="w-12 h-12 opacity-50" />
                <p style={{ fontSize: '14px', textAlign: 'center' }}>
                  Select a table from the navigation panel to view its data
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Status/Reset */}
        <div className="panel panel-right" style={{ width: '300px' }}>
          <div className="panel-header">
            <span>◆ STATUS</span>
          </div>

          <div className="panel-content">
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Connection Status
                </h4>
                <div
                  style={{
                    color: connectionStatus === 'connected' ? '#00ff00' : '#ff4444',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                >
                  {connectionStatus === 'connected' ? '● ONLINE' : '○ OFFLINE'}
                </div>
              </div>

              {tables.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Tables Found
                  </h4>
                  <div
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {tables.length} total tables
                  </div>
                </div>
              )}

              {selectedTable && tableData && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Selected Table
                  </h4>
                  <div
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {selectedTable}
                    <br />
                    {tableData.pagination.total} rows
                    <br />
                    {tableData.columns.length} columns
                  </div>
                </div>
              )}
            </div>

            {/* System Log */}
            {terminalOutput.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', padding: '16px' }}>
                <h4 style={{ color: 'var(--text-primary)', marginBottom: '8px' }}>System Log</h4>
                <div
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    color: 'var(--text-dim)',
                  }}
                >
                  {terminalOutput.slice(-10).map((line, index) => (
                    <div key={index} style={{ marginBottom: '4px' }}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
