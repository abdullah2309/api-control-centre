import React, { useState, useEffect } from 'react';
import { FileText, RefreshCw, Filter, Search, Clock, User, Shield } from 'lucide-react';
import { ActivityLog } from '../types';
import { api } from '../api';

export function ActivityLogsView() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getActivityLogs();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const eventTypes = Array.from(new Set(logs.map((l) => l.eventType)));

  const filtered = logs.filter((l) => {
    const matchesFilter = filterType === 'ALL' || l.eventType === filterType;
    const matchesSearch =
      l.message.toLowerCase().includes(search.toLowerCase()) ||
      l.eventType.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div id="activity-logs-view" className="space-y-6 text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Activity &amp; Audit Logs</h2>
          <p className="text-slate-500">
            Immutable audit record of all configuration changes, health check alerts, and incidents
          </p>
        </div>

        <button
          id="refresh-logs-btn"
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Logs</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="logs-search-input"
            type="text"
            placeholder="Search audit trail entries…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            id="logs-filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 bg-white text-slate-700 font-medium focus:outline-hidden"
          >
            <option value="ALL">All Event Types</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading audit trail…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No log entries matched your filter.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((log) => (
              <div key={log.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50/60 transition">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-lg bg-slate-100 p-1.5 text-slate-600">
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                        {log.eventType}
                      </span>
                      <span className="text-[10px] text-slate-400">Entity: {log.entityType}</span>
                    </div>
                    <p className="text-slate-800 font-medium mt-1">{log.message}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[11px] text-slate-400 block">
                    {new Date(log.createdAt).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
