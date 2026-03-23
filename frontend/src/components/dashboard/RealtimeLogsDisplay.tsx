import React, { useState, useEffect } from 'react';
import { useWebSocketLogs } from '../hooks/useWebSocketLogs';
import { useAuth } from '../context/AuthContext';

interface RealtimeLogsDisplayProps {
  maxMessagesPerSecond?: number;
}

export const RealtimeLogsDisplay: React.FC<RealtimeLogsDisplayProps> = ({
  maxMessagesPerSecond = 60
}) => {
  const { user, token } = useAuth();
  const [severityFilter, setSeverityFilter] = useState<string | undefined>(undefined);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showStats, setShowStats] = useState(true);

  const {
    isConnected,
    logs,
    error,
    clearLogs,
    logCount,
    queuedMessages
  } = useWebSocketLogs(token, {
    severityFilter,
    maxMessagesPerSecond
  });

  const logsEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  if (!user) {
    return <div className="p-4 text-center">Please log in to view real-time logs</div>;
  }

  const getSeverityColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'critical':
      case 'error':
        return 'bg-red-50 border-l-4 border-red-400';
      case 'warning':
        return 'bg-yellow-50 border-l-4 border-yellow-400';
      case 'information':
      case 'info':
        return 'bg-blue-50 border-l-4 border-blue-400';
      default:
        return 'bg-gray-50 border-l-4 border-gray-400';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Real-time Event Logs</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowStats(!showStats)}
              className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
            >
              {showStats ? 'Hide' : 'Show'} Stats
            </button>
            <button
              onClick={clearLogs}
              className="px-3 py-1 text-sm bg-red-400 hover:bg-red-500 text-white rounded"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Status & Controls */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-sm">
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          <div className="text-sm">Total Logs: <strong>{logCount}</strong></div>
          <div className="text-sm">Queued: <strong>{queuedMessages}</strong></div>
          <div className="text-sm">Rate: <strong>{maxMessagesPerSecond}/sec</strong></div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <label className="text-sm font-semibold">Severity Filter:</label>
          <select
            value={severityFilter || ''}
            onChange={(e) => setSeverityFilter(e.target.value || undefined)}
            className="px-3 py-1 text-sm border rounded"
          >
            <option value="">All</option>
            <option value="Information">Information</option>
            <option value="Warning">Warning</option>
            <option value="Error">Error</option>
            <option value="Critical">Critical</option>
          </select>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Statistics Panel */}
      {showStats && (
        <div className="bg-gray-100 border-b p-3 grid grid-cols-5 gap-4 text-sm">
          <div>
            <span className="font-semibold">Info:</span> {logs.filter(l => l.level?.toLowerCase() === 'information').length}
          </div>
          <div>
            <span className="font-semibold">Warning:</span> {logs.filter(l => l.level?.toLowerCase() === 'warning').length}
          </div>
          <div>
            <span className="font-semibold">Error:</span> {logs.filter(l => l.level?.toLowerCase() === 'error').length}
          </div>
          <div>
            <span className="font-semibold">Critical:</span> {logs.filter(l => l.level?.toLowerCase() === 'critical').length}
          </div>
          <div>
            <span className="font-semibold">Rate:</span> {queuedMessages > 50 ? '🔴 HIGH' : queuedMessages > 20 ? '🟡 MED' : '🟢 LOW'}
          </div>
        </div>
      )}

      {/* Logs Container */}
      <div className="flex-1 overflow-y-auto bg-white">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {isConnected ? 'Waiting for logs...' : 'Not connected'}
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log, index) => (
              <div key={index} className={`p-3 ${getSeverityColor(log.level)}`}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex gap-2 items-center mb-1">
                      <span className="text-xs font-bold bg-gray-200 px-2 py-0.5 rounded">
                        {log.level || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-600">
                        {log.computer}
                      </span>
                      {log.provider && (
                        <span className="text-xs text-gray-500">
                          [{log.provider}]
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-mono text-gray-800 mb-1">
                      {log.message}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()} 
                      {log.event_id && ` • Event: ${log.event_id}`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};

export default RealtimeLogsDisplay;
