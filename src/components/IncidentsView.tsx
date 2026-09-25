import React, { useState } from 'react';
import {
  AlertOctagon,
  Plus,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  AlertTriangle,
  XCircle,
  X,
  ShieldAlert,
} from 'lucide-react';
import { Incident, Service, IncidentStatus, IncidentSeverity } from '../types';
import { api } from '../api';

interface IncidentsViewProps {
  incidents: Incident[];
  services: Service[];
  onRefreshData: () => Promise<void>;
}

export function IncidentsView({ incidents, services, onRefreshData }: IncidentsViewProps) {
  const [filter, setFilter] = useState<'ACTIVE' | 'RESOLVED' | 'ALL'>('ACTIVE');
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateStatus, setUpdateStatus] = useState<IncidentStatus>('INVESTIGATING');
  const [isPostingUpdate, setIsPostingUpdate] = useState(false);

  // New Incident Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newServiceId, setNewServiceId] = useState(services[0]?.id || '');
  const [newSeverity, setNewSeverity] = useState<IncidentSeverity>('HIGH');
  const [isCreating, setIsCreating] = useState(false);

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');

  const displayed =
    filter === 'ACTIVE'
      ? activeIncidents
      : filter === 'RESOLVED'
      ? resolvedIncidents
      : incidents;

  const handleSelectIncident = async (incident: Incident) => {
    try {
      const full = await api.getIncident(incident.id);
      setSelectedIncident(full);
      setUpdateStatus(full.status);
    } catch (err) {
      console.error('Failed to load incident detail:', err);
    }
  };

  const handlePostUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !updateMessage.trim()) return;

    setIsPostingUpdate(true);
    try {
      await api.addIncidentUpdate(selectedIncident.id, updateMessage.trim(), updateStatus);
      setUpdateMessage('');
      const refreshed = await api.getIncident(selectedIncident.id);
      setSelectedIncident(refreshed);
      await onRefreshData();
    } catch (err) {
      console.error('Failed to post update:', err);
    } finally {
      setIsPostingUpdate(false);
    }
  };

  const handleResolveIncident = async () => {
    if (!selectedIncident) return;
    try {
      await api.resolveIncident(
        selectedIncident.id,
        'Incident resolved. Services verified as stable.'
      );
      const refreshed = await api.getIncident(selectedIncident.id);
      setSelectedIncident(refreshed);
      await onRefreshData();
    } catch (err) {
      console.error('Failed to resolve incident:', err);
    }
  };

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newServiceId) return;

    setIsCreating(true);
    try {
      const created = await api.createIncident({
        serviceId: newServiceId,
        title: newTitle.trim(),
        description: newDesc.trim(),
        severity: newSeverity,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      await onRefreshData();
      handleSelectIncident(created);
    } catch (err) {
      console.error('Failed to create incident:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div id="incidents-view" className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Incident Management</h2>
          <p className="text-xs text-slate-500">
            Track real outages, status timeline progression, and post-mortems
          </p>
        </div>

        <button
          id="incidents-create-btn"
          onClick={() => {
            if (services.length > 0) setNewServiceId(services[0].id);
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Declare Incident</span>
        </button>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        <button
          id="incidents-tab-active"
          onClick={() => setFilter('ACTIVE')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
            filter === 'ACTIVE'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Active Incidents ({activeIncidents.length})
        </button>
        <button
          id="incidents-tab-resolved"
          onClick={() => setFilter('RESOLVED')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
            filter === 'RESOLVED'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Resolved ({resolvedIncidents.length})
        </button>
        <button
          id="incidents-tab-all"
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
            filter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All ({incidents.length})
        </button>
      </div>

      {/* Main Grid: List on Left, Detail & Timeline on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Incident Cards Column */}
        <div className="lg:col-span-5 space-y-3">
          {displayed.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-xs">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800">No {filter.toLowerCase()} incidents</p>
              <p className="mt-1 text-slate-400">All systems are currently operating within nominal SLA limits.</p>
            </div>
          ) : (
            displayed.map((inc) => {
              const svc = services.find((s) => s.id === inc.serviceId);
              const isSelected = selectedIncident?.id === inc.id;
              const isResolved = inc.status === 'RESOLVED';

              return (
                <div
                  key={inc.id}
                  id={`incident-card-${inc.id}`}
                  onClick={() => handleSelectIncident(inc)}
                  className={`p-4 rounded-xl border transition cursor-pointer text-xs ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/30 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          inc.severity === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800'
                            : inc.severity === 'HIGH'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {inc.severity}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          isResolved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {inc.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(inc.startedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 mt-2 text-sm">{inc.title}</h3>
                  <p className="text-slate-500 mt-1 line-clamp-2 leading-relaxed">{inc.description}</p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    <span>Target: {svc?.name || 'Service'}</span>
                    <span>{inc.updates?.length || 0} updates</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Incident Detail & Timeline Column */}
        <div className="lg:col-span-7">
          {selectedIncident ? (
            <div
              id="selected-incident-detail"
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-5 text-xs"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        selectedIncident.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : selectedIncident.severity === 'HIGH'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {selectedIncident.severity}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-500 font-medium">
                      Started {new Date(selectedIncident.startedAt).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{selectedIncident.title}</h3>
                  <p className="text-slate-600 mt-1">{selectedIncident.description}</p>
                </div>

                {selectedIncident.status !== 'RESOLVED' && (
                  <button
                    id="incident-resolve-btn"
                    onClick={handleResolveIncident}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Resolve</span>
                  </button>
                )}
              </div>

              {/* Status Progression Bar */}
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Status Workflow
                </span>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {(['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'] as IncidentStatus[]).map(
                    (st) => {
                      const isCurrent = selectedIncident.status === st;
                      return (
                        <div
                          key={st}
                          className={`rounded-lg py-1.5 px-2 font-semibold text-[11px] border transition ${
                            isCurrent
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          {st}
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Timeline Feed */}
              <div className="space-y-3">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Incident Timeline Updates
                </span>

                <div className="border-l-2 border-slate-200 pl-4 space-y-4 ml-2">
                  {selectedIncident.updates && selectedIncident.updates.length > 0 ? (
                    selectedIncident.updates.map((update) => (
                      <div key={update.id} className="relative">
                        <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-600 ring-4 ring-white" />
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">
                            {update.status}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(update.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-slate-700 mt-1 leading-relaxed">{update.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-xs">No updates logged yet.</p>
                  )}
                </div>
              </div>

              {/* Post an Update Form */}
              {selectedIncident.status !== 'RESOLVED' && (
                <form
                  onSubmit={handlePostUpdate}
                  className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Add Timeline Update</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">Update Status:</span>
                      <select
                        id="update-status-select"
                        value={updateStatus}
                        onChange={(e) => setUpdateStatus(e.target.value as IncidentStatus)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        <option value="INVESTIGATING">INVESTIGATING</option>
                        <option value="IDENTIFIED">IDENTIFIED</option>
                        <option value="MONITORING">MONITORING</option>
                        <option value="RESOLVED">RESOLVED</option>
                      </select>
                    </div>
                  </div>

                  <textarea
                    id="incident-update-textarea"
                    rows={2}
                    required
                    placeholder="Provide a clear, customer-safe status update or root cause finding…"
                    value={updateMessage}
                    onChange={(e) => setUpdateMessage(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 bg-white focus:outline-hidden focus:border-blue-500"
                  />

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      id="submit-incident-update-btn"
                      disabled={isPostingUpdate}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 font-semibold text-white hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
                    >
                      <Send className="h-3 w-3" />
                      <span>{isPostingUpdate ? 'Posting…' : 'Post Update'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center text-slate-400 text-xs">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="font-medium text-slate-600">Select an incident to view details &amp; timeline</p>
              <p className="mt-1">You can post timestamped updates or resolve active outages.</p>
            </div>
          )}
        </div>
      </div>

      {/* Declare Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertOctagon className="h-5 w-5" />
                <h3 className="font-bold text-slate-900 text-sm">Declare Incident</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateIncident} className="mt-4 space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Affected Service</label>
                <select
                  id="incident-service-select"
                  value={newServiceId}
                  onChange={(e) => setNewServiceId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 bg-white text-slate-800"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Incident Title</label>
                <input
                  id="incident-title-input"
                  type="text"
                  required
                  placeholder="e.g. Payment Gateway Elevated 503 Errors"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Severity</label>
                <select
                  id="incident-severity-select"
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value as IncidentSeverity)}
                  className="w-full rounded-lg border border-slate-300 p-2 bg-white text-slate-800"
                >
                  <option value="LOW">LOW (Minor degradation)</option>
                  <option value="MEDIUM">MEDIUM (Partial service impact)</option>
                  <option value="HIGH">HIGH (Major outage)</option>
                  <option value="CRITICAL">CRITICAL (Total service failure)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Description</label>
                <textarea
                  id="incident-desc-textarea"
                  rows={3}
                  placeholder="Describe initial symptoms, scope of impact, and investigative steps…"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="submit-create-incident-btn"
                  disabled={isCreating}
                  className="rounded-lg bg-rose-600 px-4 py-1.5 font-semibold text-white hover:bg-rose-700 shadow-xs disabled:opacity-50"
                >
                  {isCreating ? 'Creating…' : 'Declare Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
