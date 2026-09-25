import React, { useState, useEffect } from 'react';
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  Palette,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Settings,
  Eye,
} from 'lucide-react';
import { StatusPageConfig, Service, Incident, Maintenance } from '../types';
import { api } from '../api';
import { UptimeHistoryBars } from './UptimeHistoryBars';

interface StatusPageViewProps {
  services: Service[];
  incidents: Incident[];
  maintenances: Maintenance[];
  workspaceSlug?: string;
  onRefreshData?: () => Promise<void>;
}

export function StatusPageView({
  services,
  incidents,
  maintenances,
  workspaceSlug = 'acme-prod',
  onRefreshData,
}: StatusPageViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'PREVIEW' | 'SETTINGS'>('PREVIEW');
  const [config, setConfig] = useState<StatusPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const data = await api.getStatusPageConfig();
        setConfig(data);
      } catch (err) {
        console.error('Failed to load status page settings:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const updated = await api.updateStatusPageConfig(config);
      setConfig(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onRefreshData?.();
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const copyPublicUrl = () => {
    const url = `${window.location.origin}/status/${config?.slug || workspaceSlug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const anyDown = services.some((s) => s.status === 'DOWN');
  const anyDegraded = services.some((s) => s.status === 'DEGRADED');
  const overallStatus = anyDown
    ? 'MAJOR_OUTAGE'
    : anyDegraded
    ? 'PARTIAL_OUTAGE'
    : 'OPERATIONAL';

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-xs">Loading Status Page…</div>;
  }

  return (
    <div id="status-page-view" className="space-y-6 text-xs">
      {/* Top Header & Subtabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Public Status Page</h2>
          <p className="text-slate-500">
            Share transparent uptime metrics, live incidents, and maintenance with customers
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Subtab Toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-2xs">
            <button
              id="statuspage-tab-preview"
              onClick={() => setActiveSubTab('PREVIEW')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition ${
                activeSubTab === 'PREVIEW'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Live Preview</span>
            </button>
            <button
              id="statuspage-tab-settings"
              onClick={() => setActiveSubTab('SETTINGS')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold transition ${
                activeSubTab === 'SETTINGS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Branding &amp; Settings</span>
            </button>
          </div>

          <button
            id="copy-statuspage-url-btn"
            onClick={copyPublicUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? 'Copied Link' : 'Copy URL'}</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'SETTINGS' ? (
        /* Settings / Branding Customizer */
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs max-w-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">Custom Branding &amp; Display</h3>
            {saveSuccess && (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Settings saved successfully
              </span>
            )}
          </div>

          {config && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company / Brand Name</label>
                <input
                  type="text"
                  required
                  value={config.companyName}
                  onChange={(e) => setConfig({ ...config, companyName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Public URL Slug</label>
                <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden bg-slate-50">
                  <span className="px-3 text-slate-500 font-mono">statusmith.com/status/</span>
                  <input
                    type="text"
                    required
                    value={config.slug}
                    onChange={(e) => setConfig({ ...config, slug: e.target.value })}
                    className="w-full bg-white p-2 text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tagline</label>
                <input
                  type="text"
                  value={config.tagline}
                  onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Brand Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.accentColor}
                      onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                      className="h-8 w-12 rounded border border-slate-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={config.accentColor}
                      onChange={(e) => setConfig({ ...config, accentColor: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Theme</label>
                  <select
                    value={config.theme}
                    onChange={(e) => setConfig({ ...config, theme: e.target.value as any })}
                    className="w-full rounded-lg border border-slate-300 p-2 bg-white text-slate-800"
                  >
                    <option value="light">Light Theme (Default)</option>
                    <option value="dark">Dark Theme</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="font-semibold text-slate-700 block">Public Page Modules</span>

                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span className="text-slate-600">Show 30-Day Historical Uptime Bars</span>
                  <input
                    type="checkbox"
                    checked={config.showUptime}
                    onChange={(e) => setConfig({ ...config, showUptime: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span className="text-slate-600">Show Incidents &amp; Resolution Timelines</span>
                  <input
                    type="checkbox"
                    checked={config.showIncidents}
                    onChange={(e) => setConfig({ ...config, showIncidents: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span className="text-slate-600">Show Scheduled Maintenance Windows</span>
                  <input
                    type="checkbox"
                    checked={config.showMaintenance}
                    onChange={(e) => setConfig({ ...config, showMaintenance: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer py-1">
                  <span className="text-slate-600">Show Response Time Metrics</span>
                  <input
                    type="checkbox"
                    checked={config.showResponseTime}
                    onChange={(e) => setConfig({ ...config, showResponseTime: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                  />
                </label>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
                >
                  {isSaving ? 'Saving…' : 'Save Status Page'}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        /* Public Status Page Live Preview Frame */
        <div className="rounded-2xl border border-slate-300 bg-slate-100 p-2 sm:p-6 shadow-xs">
          {/* Browser-like window frame */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden max-w-4xl mx-auto">
            {/* Top Fake Browser Chrome */}
            <div className="flex items-center justify-between bg-slate-100 border-b border-slate-200 px-4 py-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </div>
              <div className="rounded bg-white px-4 py-0.5 text-slate-600 font-mono text-[10px] border border-slate-200 shadow-2xs">
                https://statusmith.com/status/{config?.slug || workspaceSlug}
              </div>
              <span className="text-[10px] text-slate-400">Public View</span>
            </div>

            {/* Public Page Body */}
            <div className="p-6 sm:p-8 space-y-8 bg-slate-50/30">
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                    {config?.companyName || 'Statusmith'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {config?.tagline || 'Real-time status and incident communication'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-semibold text-slate-700 text-xs">Live Status</span>
                </div>
              </div>

              {/* Overall Status Banner */}
              <div
                className={`rounded-xl p-5 border text-center shadow-xs ${
                  overallStatus === 'OPERATIONAL'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : overallStatus === 'PARTIAL_OUTAGE'
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-rose-50 border-rose-200 text-rose-950'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {overallStatus === 'OPERATIONAL' ? (
                    <ShieldCheck className="h-6 w-6 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-rose-600" />
                  )}
                  <h2 className="text-lg font-bold">
                    {overallStatus === 'OPERATIONAL'
                      ? 'All Systems Operational'
                      : overallStatus === 'PARTIAL_OUTAGE'
                      ? 'Partial Service Degradation'
                      : 'Major Service Outage Detected'}
                  </h2>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {overallStatus === 'OPERATIONAL'
                    ? 'All monitored web services and endpoints are operating normally.'
                    : 'Our engineering team is actively investigating reports.'}
                </p>
              </div>

              {/* Active Incidents section if any */}
              {activeIncidents.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600">
                    Active Incidents
                  </h3>
                  {activeIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="rounded-xl border border-rose-200 bg-white p-4 shadow-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm">{inc.title}</span>
                        <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-700 text-[10px] uppercase">
                          {inc.status}
                        </span>
                      </div>
                      <p className="text-slate-600">{inc.description}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Monitored Services List with Uptime Bars */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Services Status
                  </h3>
                  <span className="text-[11px] text-slate-400">90-Day Verified Uptime</span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-2xs overflow-hidden">
                  {services.map((s) => {
                    const isDown = s.status === 'DOWN';
                    const isOperational = s.status === 'OPERATIONAL';

                    return (
                      <div key={s.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="min-w-0 sm:w-1/3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{s.name}</span>
                            <span
                              className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase ${
                                isOperational
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isDown
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {s.status}
                            </span>
                          </div>
                          <p className="text-slate-500 text-[11px] mt-0.5">{s.description}</p>
                        </div>

                        {/* Uptime bar blocks */}
                        <div className="sm:w-1/2">
                          <UptimeHistoryBars service={s} maxBars={30} showLabels={true} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Past Incidents (Resolved) */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Past Incidents
                </h3>

                {resolvedIncidents.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
                    <span>No incidents reported in the past 90 days.</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-2xs">
                    {resolvedIncidents.slice(0, 5).map((inc) => (
                      <div key={inc.id} className="p-4 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">{inc.title}</span>
                          <span className="text-[10px] text-slate-400">
                            Resolved on {new Date(inc.resolvedAt || inc.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-600 text-[11px]">{inc.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-slate-400 text-[11px]">
                <span>Powered by Statusmith Uptime Engine</span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Auto-refreshes every 30s
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
