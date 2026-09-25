import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
  Check,
  Settings,
  X,
} from 'lucide-react';
import { api } from '../api';
import { NotificationItem, NotificationPrefs } from '../types';

interface NotificationsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export function NotificationsPopover({ isOpen, onClose, onRefresh }: NotificationsPopoverProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await api.getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrefs = async () => {
    try {
      const p = await api.getNotificationPrefs();
      setPrefs(p);
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
      fetchPrefs();
    }
  }, [isOpen]);

  const handleMarkRead = async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    onRefresh?.();
  };

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    onRefresh?.();
  };

  const handleTogglePref = async (key: keyof NotificationPrefs) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await api.updateNotificationPrefs({ [key]: updated[key] });
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div
      id="notifications-popover"
      className="absolute right-0 mt-2 w-96 rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden text-slate-800"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-600" />
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            id="notifications-prefs-btn"
            onClick={() => setShowPrefs(!showPrefs)}
            title="Notification Preferences"
            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            id="notifications-close-btn"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showPrefs ? (
        <div className="p-4 space-y-3 bg-white text-sm">
          <div className="flex items-center justify-between font-medium text-slate-700 pb-2 border-b border-slate-100">
            <span>Alert Preferences</span>
            <button
              onClick={() => setShowPrefs(false)}
              className="text-xs text-blue-600 hover:underline"
            >
              Done
            </button>
          </div>
          {prefs && (
            <div className="space-y-2.5 text-xs">
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-slate-600">Service Downtime Alerts</span>
                <input
                  type="checkbox"
                  checked={prefs.serviceDown}
                  onChange={() => handleTogglePref('serviceDown')}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-slate-600">Service Recovery Alerts</span>
                <input
                  type="checkbox"
                  checked={prefs.serviceRecovered}
                  onChange={() => handleTogglePref('serviceRecovered')}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-slate-600">New Incident Updates</span>
                <input
                  type="checkbox"
                  checked={prefs.incidentCreated}
                  onChange={() => handleTogglePref('incidentCreated')}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer py-1">
                <span className="text-slate-600">Maintenance Window Notices</span>
                <input
                  type="checkbox"
                  checked={prefs.maintenanceStarted}
                  onChange={() => handleTogglePref('maintenanceStarted')}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </label>
              <label className="flex items-center justify-between cursor-pointer py-1 pt-2 border-t border-slate-100">
                <span className="text-slate-800 font-medium">Email Notifications</span>
                <input
                  type="checkbox"
                  checked={prefs.emailAlerts}
                  onChange={() => handleTogglePref('emailAlerts')}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </label>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading alerts...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-2" />
                No alerts. All systems healthy.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 transition flex items-start gap-3 hover:bg-slate-50 ${
                    !n.isRead ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {n.type === 'SERVICE_DOWN' ? (
                      <XCircle className="h-4 w-4 text-rose-500" />
                    ) : n.type === 'SERVICE_RECOVERED' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : n.type.includes('INCIDENT') ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-800 truncate">{n.title}</p>
                      <span className="text-[10px] text-slate-400 ml-2 whitespace-nowrap">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">{n.message}</p>
                    {!n.isRead && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="mt-1 text-[11px] font-medium text-blue-600 hover:text-blue-800"
                      >
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 flex items-center justify-between text-xs">
              <button
                id="notifications-mark-all-read-btn"
                onClick={handleMarkAllRead}
                className="text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1"
              >
                <Check className="h-3.5 w-3.5" /> Mark all read
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
