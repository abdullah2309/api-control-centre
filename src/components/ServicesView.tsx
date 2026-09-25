import React, { useState, useEffect } from 'react';
import {
  Server,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Edit2,
  ExternalLink,
  Zap,
  Globe,
  Clock,
  ChevronRight,
  X,
  History,
  Check,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Service, MonitorCheck, ServiceStatus } from '../types';
import { api } from '../api';
import { UptimeHistoryBars, getResponseCheckColor } from './UptimeHistoryBars';

interface ServicesViewProps {
  services: Service[];
  onAddService: () => void;
  onRefreshData: () => Promise<void>;
  selectedServiceId?: string | null;
  onClearSelectedService?: () => void;
}

export function ServicesView({
  services,
  onAddService,
  onRefreshData,
  selectedServiceId,
  onClearSelectedService,
}: ServicesViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'latency' | 'uptime' | 'lastChecked'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Detail Modal State
  const [inspectingService, setInspectingService] = useState<Service | null>(null);
  const [checks, setChecks] = useState<MonitorCheck[]>([]);
  const [loadingChecks, setLoadingChecks] = useState(false);
  const [checkingServiceId, setCheckingServiceId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Service>>({});
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // If a selectedServiceId was passed from dashboard, inspect it
  useEffect(() => {
    if (selectedServiceId) {
      const found = services.find((s) => s.id === selectedServiceId);
      if (found) {
        openInspection(found);
      }
    }
  }, [selectedServiceId, services]);

  const openInspection = async (service: Service) => {
    setInspectingService(service);
    setIsEditing(false);
    setEditFormData({
      name: service.name,
      description: service.description,
      url: service.url,
      intervalSeconds: service.intervalSeconds,
      timeoutSeconds: service.timeoutSeconds,
      expectedStatusCodes: service.expectedStatusCodes,
      failureThreshold: service.failureThreshold,
      retryCount: service.retryCount,
    });
    setLoadingChecks(true);
    try {
      const checkHistory = await api.getServiceChecks(service.id, 50);
      setChecks(checkHistory);
    } catch (err) {
      console.error('Failed to load checks:', err);
    } finally {
      setLoadingChecks(false);
    }
  };

  const closeInspection = () => {
    setInspectingService(null);
    onClearSelectedService?.();
  };

  const handleManualCheck = async (serviceId: string) => {
    try {
      setCheckingServiceId(serviceId);
      await api.triggerCheck(serviceId);
      await onRefreshData();
      if (inspectingService && inspectingService.id === serviceId) {
        const freshChecks = await api.getServiceChecks(serviceId, 50);
        setChecks(freshChecks);
        const updated = await api.getService(serviceId);
        setInspectingService(updated);
      }
    } catch (err) {
      console.error('Check failed:', err);
    } finally {
      setCheckingServiceId(null);
    }
  };

  const handleToggleMonitoring = async (service: Service) => {
    try {
      if (service.monitoringEnabled) {
        await api.disableMonitoring(service.id);
      } else {
        await api.enableMonitoring(service.id);
      }
      await onRefreshData();
      if (inspectingService && inspectingService.id === service.id) {
        const updated = await api.getService(service.id);
        setInspectingService(updated);
      }
    } catch (err) {
      console.error('Toggle monitoring failed:', err);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!window.confirm('Are you sure you want to delete this monitored service?')) return;
    try {
      await api.deleteService(serviceId);
      closeInspection();
      await onRefreshData();
    } catch (err) {
      console.error('Delete service failed:', err);
    }
  };

  const handleSaveEdit = async () => {
    if (!inspectingService) return;
    setIsSavingEdit(true);
    try {
      const updated = await api.updateService(inspectingService.id, editFormData);
      setInspectingService(updated);
      setIsEditing(false);
      await onRefreshData();
    } catch (err) {
      console.error('Save edit failed:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Filter & Sort
  let filtered = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.url.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'name') {
      return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    }
    if (sortBy === 'latency') {
      const latA = a.lastResponseTimeMs || 0;
      const latB = b.lastResponseTimeMs || 0;
      return sortOrder === 'asc' ? latA - latB : latB - latA;
    }
    if (sortBy === 'uptime') {
      return sortOrder === 'asc'
        ? a.uptimePercentage - b.uptimePercentage
        : b.uptimePercentage - a.uptimePercentage;
    }
    if (sortBy === 'lastChecked') {
      const tA = a.lastCheckedAt ? new Date(a.lastCheckedAt).getTime() : 0;
      const tB = b.lastCheckedAt ? new Date(b.lastCheckedAt).getTime() : 0;
      return sortOrder === 'asc' ? tA - tB : tB - tA;
    }
    return 0;
  });

  return (
    <div id="services-view" className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Monitored Services</h2>
          <p className="text-xs text-slate-500">
            Real HTTP/HTTPS uptime monitoring with automated failure detection and recovery
          </p>
        </div>

        <button
          id="services-add-btn"
          onClick={onAddService}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Service</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="services-search-input"
            type="text"
            placeholder="Search by service name or URL…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {['ALL', 'OPERATIONAL', 'DEGRADED', 'DOWN', 'PAUSED'].map((status) => {
            const isSelected = statusFilter === status;
            return (
              <button
                key={status}
                id={`filter-${status.toLowerCase()}`}
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition ${
                  isSelected
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                {status === 'ALL' ? 'All Services' : status}
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-slate-400">Sort:</span>
          <select
            id="services-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-lg border border-slate-300 px-2.5 py-1 bg-white text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="name">Name</option>
            <option value="latency">Response Time</option>
            <option value="uptime">Uptime %</option>
            <option value="lastChecked">Last Checked</option>
          </select>
        </div>
      </div>

      {/* Services List Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Server className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No matching services found</p>
            <p className="mt-1">Try adjusting your search filter or add a new service.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((service) => {
              const isChecking = checkingServiceId === service.id;
              const isDown = service.status === 'DOWN';
              const isOperational = service.status === 'OPERATIONAL';
              const isPaused = service.status === 'PAUSED';

              return (
                <div
                  key={service.id}
                  id={`service-row-${service.id}`}
                  onClick={() => openInspection(service)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition cursor-pointer"
                >
                  {/* Service Basic Info */}
                  <div className="flex items-start gap-3.5 min-w-0 md:w-2/5">
                    <div className="mt-0.5 shrink-0">
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
                      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                        <span>Method: {service.httpMethod}</span>
                        <span>Interval: {service.intervalSeconds}s</span>
                        <span>Timeout: {service.timeoutSeconds}s</span>
                      </div>
                    </div>
                  </div>

                  {/* 30-day Response History Bars */}
                  <div className="hidden lg:block w-72 shrink-0">
                    <UptimeHistoryBars service={service} maxBars={30} showLabels={true} />
                  </div>

                  {/* Metrics: Latency & Uptime */}
                  <div className="grid grid-cols-2 gap-4 md:gap-6 shrink-0 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                        Uptime
                      </span>
                      <span className="font-bold text-slate-800 text-sm">
                        {service.uptimePercentage}%
                      </span>
                      <span className="text-[10px] text-slate-400 block">30-day verified</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                        Response
                      </span>
                      <div className="flex items-center gap-1 font-mono font-semibold text-slate-800 text-sm">
                        <Zap className="h-3 w-3 text-amber-500" />
                        <span>{service.lastResponseTimeMs ? `${service.lastResponseTimeMs}ms` : '—'}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        HTTP {service.lastHttpStatusCode || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center justify-end gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Manual Check */}
                    <button
                      id={`check-service-${service.id}`}
                      onClick={() => handleManualCheck(service.id)}
                      disabled={isChecking}
                      title="Run immediate HTTP health check"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-2xs transition disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin text-blue-600' : ''}`}
                      />
                      <span>{isChecking ? 'Checking…' : 'Check'}</span>
                    </button>

                    {/* Pause / Resume */}
                    <button
                      id={`toggle-monitor-${service.id}`}
                      onClick={() => handleToggleMonitoring(service)}
                      title={service.monitoringEnabled ? 'Pause monitoring' : 'Resume monitoring'}
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                    >
                      {service.monitoringEnabled ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 text-emerald-600" />
                      )}
                    </button>

                    {/* Open Details */}
                    <button
                      id={`inspect-service-${service.id}`}
                      onClick={() => openInspection(service)}
                      title="Inspect health check history"
                      className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Service Inspection & Check History Drawer/Modal */}
      {inspectingService && (
        <div
          id="service-inspection-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
        >
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition animate-in fade-in zoom-in-95 my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{inspectingService.name}</h3>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase ${
                        inspectingService.status === 'OPERATIONAL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : inspectingService.status === 'DOWN'
                          ? 'bg-rose-100 text-rose-800'
                          : inspectingService.status === 'PAUSED'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {inspectingService.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{inspectingService.url}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="inspect-check-now-btn"
                  onClick={() => handleManualCheck(inspectingService.id)}
                  disabled={checkingServiceId === inspectingService.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      checkingServiceId === inspectingService.id ? 'animate-spin text-blue-600' : ''
                    }`}
                  />
                  <span>Check Now</span>
                </button>
                <button
                  id="inspect-close-btn"
                  onClick={closeInspection}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto py-4 space-y-5 text-xs flex-1">
              {/* Stat Pills */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Uptime</span>
                  <span className="text-base font-bold text-slate-800">
                    {inspectingService.uptimePercentage}%
                  </span>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Latency</span>
                  <span className="text-base font-bold text-slate-800 font-mono">
                    {inspectingService.lastResponseTimeMs ? `${inspectingService.lastResponseTimeMs}ms` : '—'}
                  </span>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Interval</span>
                  <span className="text-base font-bold text-slate-800">
                    Every {inspectingService.intervalSeconds}s
                  </span>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Threshold</span>
                  <span className="text-base font-bold text-slate-800">
                    {inspectingService.failureThreshold}x Failures
                  </span>
                </div>
              </div>

              {/* Edit Mode Toggle */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-800">
                  {isEditing ? 'Edit Service Configuration' : 'Recent HTTP Health Checks'}
                </span>
                <button
                  id="inspect-toggle-edit-btn"
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Edit2 className="h-3 w-3" />
                  {isEditing ? 'Cancel Editing' : 'Edit Configuration'}
                </button>
              </div>

              {isEditing ? (
                /* Edit Form */
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Service Name</label>
                    <input
                      type="text"
                      value={editFormData.name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-800 bg-white focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Target URL</label>
                    <input
                      type="text"
                      value={editFormData.url || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, url: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-800 bg-white focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Interval (sec)</label>
                      <input
                        type="number"
                        min={10}
                        value={editFormData.intervalSeconds || 60}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, intervalSeconds: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-800 bg-white focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Timeout (sec)</label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={editFormData.timeoutSeconds || 10}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, timeoutSeconds: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-800 bg-white focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Failure Threshold</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={editFormData.failureThreshold || 3}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, failureThreshold: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-slate-800 bg-white focus:outline-hidden focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      id="save-service-config-btn"
                      onClick={handleSaveEdit}
                      disabled={isSavingEdit}
                      className="rounded-lg bg-blue-600 px-3.5 py-1.5 font-semibold text-white hover:bg-blue-700 transition"
                    >
                      {isSavingEdit ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Check History Table */
                <div className="space-y-4">
                  {/* Response List Visualization (0 to 30 Checks with Status Colors) */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">Response History List</span>
                        <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {checks.length === 0 ? 'Empty (0 checks)' : `${checks.length} checks recorded`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-2.5 rounded-2xs bg-emerald-500"></span> Fast (&lt;150ms)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-2.5 rounded-2xs bg-teal-500"></span> Good (&lt;400ms)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-2.5 rounded-2xs bg-amber-400"></span> Slow (&lt;900ms)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-2.5 rounded-2xs bg-rose-500"></span> Down / Err
                        </span>
                      </div>
                    </div>

                    <UptimeHistoryBars
                      service={{
                        ...inspectingService,
                        recentChecks: checks,
                      }}
                      maxBars={30}
                      showLabels={true}
                    />

                    {checks.length === 0 && (
                      <p className="text-center text-xs text-slate-400 mt-2">
                        Response list is empty. When newly added, checks occur every {inspectingService.intervalSeconds}s (or on schedule). You can also click <strong>"Check Now"</strong> below to record the first response.
                      </p>
                    )}
                  </div>

                  {loadingChecks ? (
                    <div className="p-8 text-center text-slate-400">Loading check history…</div>
                  ) : checks.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">
                      No check records yet. Click "Check Now" to execute.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-slate-200 overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 font-semibold">Status</th>
                            <th className="py-2.5 px-3 font-semibold">HTTP Code</th>
                            <th className="py-2.5 px-3 font-semibold">Response Time</th>
                            <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                            <th className="py-2.5 px-3 font-semibold">Error Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {checks.map((check) => {
                            const isUp = check.status === 'UP';
                            return (
                              <tr key={check.id} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                      isUp ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {isUp ? (
                                      <CheckCircle2 className="h-3 w-3" />
                                    ) : (
                                      <XCircle className="h-3 w-3" />
                                    )}
                                    {check.status}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-mono font-semibold">
                                  {check.httpStatusCode || '—'}
                                </td>
                                <td className="py-2 px-3 font-mono">
                                  {check.responseTimeMs ? `${check.responseTimeMs} ms` : '—'}
                                </td>
                                <td className="py-2 px-3 text-slate-500">
                                  {new Date(check.checkedAt).toLocaleString()}
                                </td>
                                <td className="py-2 px-3 text-slate-500 max-w-xs truncate">
                                  {check.errorMessage || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 shrink-0 text-xs">
              <button
                id="inspect-delete-btn"
                onClick={() => handleDeleteService(inspectingService.id)}
                className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Service
              </button>
              <button
                onClick={closeInspection}
                className="rounded-lg border border-slate-300 px-3.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
