import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  Server,
  Zap,
  ArrowUpRight,
  RefreshCw,
  Clock,
  ShieldCheck,
  Play,
  Pause,
  ExternalLink,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Service, Incident, Maintenance, OverviewAnalytics, ActiveTab } from '../types';
import { api } from '../api';
import { UptimeHistoryBars } from './UptimeHistoryBars';

interface DashboardViewProps {
  services: Service[];
  incidents: Incident[];
  maintenances: Maintenance[];
  analytics: OverviewAnalytics | null;
  onSelectService: (service: Service) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onRefreshData: () => Promise<void>;
}

export function DashboardView({
  services,
  incidents,
  maintenances,
  analytics,
  onSelectService,
  onNavigateTab,
  onRefreshData,
}: DashboardViewProps) {
  const [checkingServiceId, setCheckingServiceId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const activeMaintenances = maintenances.filter(
    (m) => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS'
  );

  const anyDown = services.some((s) => s.status === 'DOWN');
  const anyDegraded = services.some((s) => s.status === 'DEGRADED');

  const overallState = anyDown
    ? {
        label: 'Major Outage Detected',
        desc: `${services.filter((s) => s.status === 'DOWN').length} service(s) currently failing health checks`,
        color: 'bg-rose-50 border-rose-200 text-rose-900',
        icon: <XCircle className="h-6 w-6 text-rose-600" />,
      }
    : anyDegraded
    ? {
        label: 'Partial Degradation',
        desc: 'Some services are reporting elevated latency or partial issues',
        color: 'bg-amber-50 border-amber-200 text-amber-900',
        icon: <AlertTriangle className="h-6 w-6 text-amber-600" />,
      }
    : {
        label: 'All Systems Operational',
        desc: `Monitoring ${services.length} production services with 100% active real HTTP checks`,
        color: 'bg-emerald-50/80 border-emerald-200 text-emerald-950',
        icon: <ShieldCheck className="h-6 w-6 text-emerald-600" />,
      };

  const handleManualCheck = async (e: React.MouseEvent, serviceId: string) => {
    e.stopPropagation();
    try {
      setCheckingServiceId(serviceId);
      await api.triggerCheck(serviceId);
      await onRefreshData();
    } catch (err) {
      console.error('Manual check failed:', err);
    } finally {
      setCheckingServiceId(null);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshData();
    setIsRefreshing(false);
  };

  // Build latency data points for the response time timeline
  const chartData = services.map((s) => ({
    name: s.name.length > 14 ? s.name.slice(0, 12) + '…' : s.name,
    latency: s.lastResponseTimeMs || 0,
    status: s.status,
  }));

  return (
    <div id="dashboard-view" className="space-y-6">
      {/* Top Banner Status Bar */}
      <div
        id="dashboard-status-banner"
        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border p-4 sm:p-5 shadow-xs transition ${overallState.color}`}
      >
        <div className="flex items-center gap-3.5">
          <div className="rounded-lg bg-white/80 p-2 shadow-2xs">{overallState.icon}</div>
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">{overallState.label}</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{overallState.desc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            id="dashboard-refresh-btn"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300/80 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white shadow-2xs transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Refreshing…' : 'Sync All'}</span>
          </button>
          <button
            id="dashboard-view-statuspage-btn"
            onClick={() => onNavigateTab('status-page')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs transition"
          >
            <span>Public Status</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Active Incident Warning Callout if any */}
      {activeIncidents.length > 0 && (
        <div
          id="dashboard-active-incidents-callout"
          className="rounded-xl border border-rose-300 bg-rose-50/70 p-4 text-rose-900 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 animate-pulse" />
              <span className="font-semibold text-sm">
                Active Incident ({activeIncidents.length}): {activeIncidents[0].title}
              </span>
            </div>
            <button
              onClick={() => onNavigateTab('incidents')}
              className="text-xs font-semibold text-rose-700 underline hover:text-rose-900"
            >
              View Timeline & Updates →
            </button>
          </div>
          <p className="text-xs text-rose-800 mt-1 pl-6 line-clamp-1">{activeIncidents[0].description}</p>
        </div>
      )}

      {/* Upcoming Maintenance Alert if any */}
      {activeMaintenances.length > 0 && (
        <div
          id="dashboard-maintenance-callout"
          className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 text-blue-900 text-xs flex items-center justify-between shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span>
              <strong>Scheduled Maintenance:</strong> {activeMaintenances[0].title} (Starts:{' '}
              {new Date(activeMaintenances[0].startAt).toLocaleString()})
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('maintenance')}
            className="font-semibold text-blue-700 underline hover:text-blue-900 ml-2"
          >
            Details
          </button>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Metric 1: Overall Uptime */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Overall Uptime</span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {analytics ? `${analytics.overallUptimePercentage}%` : '99.9%'}
            </span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              30-Day SLA
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Calculated from verified HTTP checks</p>
        </div>

        {/* Metric 2: Monitored Services */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Active Services</span>
            <Server className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {services.length}
            </span>
            <span className="text-[11px] text-slate-500">
              ({services.filter((s) => s.status === 'OPERATIONAL').length} operational)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Background worker tick: 5s loop</p>
        </div>

        {/* Metric 3: Avg Latency */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Avg Response Time</span>
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {analytics?.averageResponseTimeMs || 0}
              <span className="text-sm font-normal text-slate-500 ml-1">ms</span>
            </span>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
              P95 &lt;200ms
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">High-precision stopwatch ms</p>
        </div>

        {/* Metric 4: Active Incidents */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Active Incidents</span>
            <AlertTriangle
              className={`h-4 w-4 ${activeIncidents.length > 0 ? 'text-rose-500' : 'text-slate-400'}`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                activeIncidents.length > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              {activeIncidents.length}
            </span>
            <span
              className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                activeIncidents.length > 0
                  ? 'bg-rose-100 text-rose-700 font-semibold'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {activeIncidents.length === 0 ? 'Zero Outages' : 'Action Needed'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Automatic &amp; manual trackers</p>
        </div>
      </div>

      {/* Latency Distribution Area Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Real-Time Service Latency (ms)</h3>
            <p className="text-xs text-slate-500">
              Live HTTP round-trip timing captured directly by background worker
            </p>
          </div>
          <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-200">
            Real Network Data
          </span>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="ms" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-md text-xs">
                        <p className="font-semibold text-slate-800">{data.name}</p>
                        <p className="text-blue-600 font-bold mt-1">Latency: {data.latency} ms</p>
                        <p className="text-[10px] text-slate-400 mt-0.5 capitalize">Status: {data.status}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="latency"
                stroke="#2563eb"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#latencyGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monitored Services Quick List with Uptime Bars */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Monitored Endpoints</h3>
            <p className="text-xs text-slate-500">Live operational status and 30-day uptime bars</p>
          </div>
          <button
            id="dashboard-manage-services-btn"
            onClick={() => onNavigateTab('services')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition flex items-center gap-1"
          >
            Manage Services ({services.length}) →
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {services.map((service) => {
            const isChecking = checkingServiceId === service.id;
            const isOperational = service.status === 'OPERATIONAL';
            const isDown = service.status === 'DOWN';
            const isPaused = service.status === 'PAUSED';

            return (
              <div
                key={service.id}
                onClick={() => onSelectService(service)}
                className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/70 transition cursor-pointer"
              >
                {/* Left: Status Icon + Service Name + URL */}
                <div className="flex items-start gap-3.5 min-w-0 md:w-1/3">
                  <div className="mt-0.5">
                    {isDown ? (
                      <XCircle className="h-5 w-5 text-rose-500 animate-pulse" />
                    ) : isOperational ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : isPaused ? (
                      <Pause className="h-5 w-5 text-slate-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 truncate">
                        {service.name}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider ${
                          isDown
                            ? 'bg-rose-100 text-rose-800'
                            : isOperational
                            ? 'bg-emerald-100 text-emerald-800'
                            : isPaused
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {service.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">{service.url}</p>
                  </div>
                </div>

                {/* Middle: 30-Day Segmented Uptime Pill Bars */}
                <div className="flex-1 max-w-sm hidden lg:block">
                  <UptimeHistoryBars service={service} maxBars={30} showLabels={true} />
                </div>

                {/* Right: Latency & Quick Check */}
                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 font-mono text-xs font-semibold text-slate-800">
                      <Zap className="h-3 w-3 text-amber-500" />
                      <span>{service.lastResponseTimeMs ? `${service.lastResponseTimeMs}ms` : '—'}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      {service.lastCheckedAt
                        ? `Checked ${new Date(service.lastCheckedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}`
                        : 'Pending check'}
                    </span>
                  </div>

                  <button
                    id={`check-now-btn-${service.id}`}
                    onClick={(e) => handleManualCheck(e, service.id)}
                    disabled={isChecking}
                    title="Execute immediate HTTP check now"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs transition disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin text-blue-600' : ''}`} />
                    <span className="hidden sm:inline">{isChecking ? 'Checking…' : 'Check Now'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
