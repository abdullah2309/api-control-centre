import React, { useState } from 'react';
import { Calendar, Plus, Clock, CheckCircle2, AlertCircle, X, Trash2, Edit3 } from 'lucide-react';
import { Maintenance, Service, MaintenanceStatus } from '../types';
import { api } from '../api';

interface MaintenanceViewProps {
  maintenances: Maintenance[];
  services: Service[];
  onRefreshData: () => Promise<void>;
}

export function MaintenanceView({ maintenances, services, onRefreshData }: MaintenanceViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set initial default times: starting tomorrow 02:00, ending 04:00
  const handleOpenModal = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(4, 0, 0, 0);

    setStartAt(tomorrow.toISOString().slice(0, 16));
    setEndAt(tomorrowEnd.toISOString().slice(0, 16));
    setSelectedServiceIds(services.map((s) => s.id));
    setTitle('');
    setDescription('');
    setShowModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startAt || !endAt) return;

    setIsSubmitting(true);
    try {
      await api.createMaintenance({
        title: title.trim(),
        description: description.trim(),
        serviceIds: selectedServiceIds,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
      });
      setShowModal(false);
      await onRefreshData();
    } catch (err) {
      console.error('Failed to create maintenance:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: MaintenanceStatus) => {
    try {
      await api.updateMaintenance(id, { status: newStatus });
      await onRefreshData();
    } catch (err) {
      console.error('Failed to update maintenance status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this maintenance entry?')) return;
    try {
      await api.deleteMaintenance(id);
      await onRefreshData();
    } catch (err) {
      console.error('Failed to delete maintenance:', err);
    }
  };

  const toggleServiceId = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((sId) => sId !== id) : [...prev, id]
    );
  };

  return (
    <div id="maintenance-view" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Maintenance Windows</h2>
          <p className="text-xs text-slate-500">
            Schedule planned downtime and communicate maintenance transparently to users
          </p>
        </div>

        <button
          id="schedule-maintenance-btn"
          onClick={handleOpenModal}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" />
          <span>Schedule Window</span>
        </button>
      </div>

      {/* Main List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        {maintenances.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No scheduled maintenance windows</p>
            <p className="mt-1 text-slate-400">
              Create a maintenance window to notify users ahead of routine upgrades.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {maintenances.map((item) => {
              const affected = services.filter((s) => item.serviceIds.includes(s.id));
              const isScheduled = item.status === 'SCHEDULED';
              const isInProgress = item.status === 'IN_PROGRESS';
              const isCompleted = item.status === 'COMPLETED';

              return (
                <div key={item.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                  <div className="min-w-0 md:w-1/2">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isInProgress
                            ? 'bg-amber-100 text-amber-800'
                            : isScheduled
                            ? 'bg-blue-100 text-blue-800'
                            : isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-slate-400 font-medium">
                        {new Date(item.startAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        —{' '}
                        {new Date(item.endAt).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                    <p className="text-slate-600 mt-1 leading-relaxed">{item.description}</p>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <span className="text-[11px] text-slate-400 font-medium">Affected:</span>
                      {affected.map((s) => (
                        <span
                          key={s.id}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 shrink-0">
                    {isScheduled && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'IN_PROGRESS')}
                        className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 font-semibold text-amber-800 hover:bg-amber-100"
                      >
                        Start Maintenance
                      </button>
                    )}
                    {isInProgress && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'COMPLETED')}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-700"
                      >
                        Mark Completed
                      </button>
                    )}
                    {!isCompleted && item.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'CANCELLED')}
                        className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      title="Delete entry"
                      className="rounded-lg border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs text-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Schedule Maintenance</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Database cluster version migration"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description &amp; Expected Impact</label>
                <textarea
                  rows={2}
                  placeholder="Expect 1-2 minutes of brief interruption during replica failover…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Starts At</label>
                  <input
                    type="datetime-local"
                    required
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ends At</label>
                  <input
                    type="datetime-local"
                    required
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Affected Services</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                  {services.map((svc) => (
                    <label
                      key={svc.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedServiceIds.includes(svc.id)}
                        onChange={() => toggleServiceId(svc.id)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span className="font-medium text-slate-800">{svc.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 font-semibold text-white hover:bg-blue-700 shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Scheduling…' : 'Schedule Window'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
