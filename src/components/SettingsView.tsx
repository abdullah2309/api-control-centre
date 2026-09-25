import React, { useState } from 'react';
import {
  Settings,
  Key,
  Bell,
  Webhook,
  Mail,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Send,
  Zap,
} from 'lucide-react';
import { Workspace } from '../types';
import { api } from '../api';

interface SettingsViewProps {
  workspace: Workspace | null;
  onRefreshData: () => Promise<void>;
}

export function SettingsView({ workspace, onRefreshData }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'GENERAL' | 'NOTIFICATIONS' | 'API_KEYS' | 'SIMULATION'>('GENERAL');

  // General Settings
  const [workspaceName, setWorkspaceName] = useState(workspace?.name || 'Acme Production');
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Notification Settings
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [alertEmail, setAlertEmail] = useState('ops-team@acme.com');
  const [webhookUrl, setWebhookUrl] = useState('https://hooks.slack.com/services/T0000/B0000/XXXX');
  const [webhookTestSent, setWebhookTestSent] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState<{ id: string; name: string; key: string; createdAt: string }[]>([
    {
      id: 'key-1',
      name: 'CI/CD Pipeline Key',
      key: 'sk_live_98a72b4f8c10e34a91b',
      createdAt: '2025-01-10',
    },
    {
      id: 'key-2',
      name: 'Prometheus Exporter',
      key: 'sk_live_55df9800e234a11c88e',
      createdAt: '2025-02-14',
    },
  ]);
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Simulation state
  const [simulatingAction, setSimulatingAction] = useState<string | null>(null);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  const handleCopyKey = (id: string, key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    const generated = {
      id: `key-${Date.now()}`,
      name: newKeyName.trim(),
      key: `sk_live_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setApiKeys([...apiKeys, generated]);
    setNewKeyName('');
  };

  const handleRevokeKey = (id: string) => {
    setApiKeys(apiKeys.filter((k) => k.id !== id));
  };

  const handleTestWebhook = () => {
    setWebhookTestSent(true);
    setTimeout(() => setWebhookTestSent(false), 3000);
  };

  const handleSimulateOutage = async () => {
    setSimulatingAction('OUTAGE');
    setSimMessage('Simulating external outage on payment service…');
    try {
      // Find or trigger check
      await api.triggerAllChecks();
      await onRefreshData();
      setSimMessage('Outage simulated. Health check loop detected HTTP 503.');
    } catch (err) {
      setSimMessage('Failed to trigger simulation');
    } finally {
      setSimulatingAction(null);
    }
  };

  const handleTriggerAllChecks = async () => {
    setSimulatingAction('CHECK_ALL');
    setSimMessage('Executing live HTTP checks against all endpoints…');
    try {
      await api.triggerAllChecks();
      await onRefreshData();
      setSimMessage('All checks completed successfully. Metrics refreshed.');
    } catch (err) {
      setSimMessage('Failed to trigger checks');
    } finally {
      setSimulatingAction(null);
    }
  };

  return (
    <div id="settings-view" className="space-y-6 text-xs">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Workspace Settings</h2>
        <p className="text-slate-500">
          Manage workspace configuration, webhooks, alerting preferences, and API access
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('GENERAL')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
            activeTab === 'GENERAL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('NOTIFICATIONS')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
            activeTab === 'NOTIFICATIONS'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Alerts &amp; Webhooks
        </button>
        <button
          onClick={() => setActiveTab('API_KEYS')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
            activeTab === 'API_KEYS'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          API Keys
        </button>
        <button
          onClick={() => setActiveTab('SIMULATION')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition ${
            activeTab === 'SIMULATION'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Demo &amp; Testing
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'GENERAL' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs max-w-xl space-y-4">
          <h3 className="font-semibold text-slate-900 text-sm">General Information</h3>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Workspace Name</label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Subscription Plan</label>
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-blue-900">Enterprise High-Frequency SLA</span>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  10-second checks, unlimited services, 90-day retention
                </p>
              </div>
              <span className="rounded bg-blue-600 px-2 py-0.5 font-bold text-white text-[10px] uppercase">
                ACTIVE
              </span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Timezone</label>
            <input
              type="text"
              readOnly
              value={Intl.DateTimeFormat().resolvedOptions().timeZone}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 cursor-not-allowed"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                setIsSavingGeneral(true);
                setTimeout(() => {
                  setIsSavingGeneral(false);
                  setSaveSuccess(true);
                  setTimeout(() => setSaveSuccess(false), 2500);
                }, 400);
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 shadow-xs"
            >
              {isSavingGeneral ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'NOTIFICATIONS' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs max-w-xl space-y-5">
          <h3 className="font-semibold text-slate-900 text-sm">Outage Notification Channels</h3>

          <div className="space-y-4">
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <div>
                    <span className="font-bold text-slate-800">Email Alerts</span>
                    <p className="text-[11px] text-slate-500">
                      Receive instant alerts when a service fails threshold checks
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                />
              </div>
              {emailAlerts && (
                <input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="incident-pager@company.com"
                  className="w-full rounded-lg border border-slate-300 p-2 text-slate-800"
                />
              )}
            </div>

            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Webhook className="h-5 w-5 text-purple-600" />
                  <div>
                    <span className="font-bold text-slate-800">Slack / Webhook Dispatch</span>
                    <p className="text-[11px] text-slate-500">
                      Dispatches JSON payload with event, service status, latency, and error code
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  className="rounded border border-slate-300 px-2.5 py-1 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  {webhookTestSent ? 'Dispatched!' : 'Send Test Ping'}
                </button>
              </div>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 font-mono text-[11px]"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'API_KEYS' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs max-w-2xl space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Programmatic API Keys</h3>
              <p className="text-slate-500">
                Use API keys in your CI/CD pipelines to query service health and automate incidents
              </p>
            </div>
          </div>

          <form onSubmit={handleGenerateKey} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Key description (e.g. Kubernetes Health Probe)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-800"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800 shadow-xs flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              <span>Create Key</span>
            </button>
          </form>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {apiKeys.map((k) => (
              <div key={k.id} className="p-3.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-slate-800 block">{k.name}</span>
                  <span className="font-mono text-slate-400 text-[11px]">{k.key}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyKey(k.id, k.key)}
                    className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                  >
                    {copiedKeyId === k.id ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRevokeKey(k.id)}
                    className="rounded border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'SIMULATION' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs max-w-xl space-y-5">
          <h3 className="font-semibold text-slate-900 text-sm">Testing &amp; Live Demonstration Controls</h3>
          <p className="text-slate-500">
            Trigger real batch network checks or simulate incident lifecycle testing in real time
          </p>

          {simMessage && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-blue-900 font-medium">
              {simMessage}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50/50">
              <div>
                <span className="font-bold text-slate-800 block">Trigger All Health Checks</span>
                <span className="text-slate-500 text-[11px]">
                  Instructs the background engine to query every monitored endpoint immediately
                </span>
              </div>
              <button
                onClick={handleTriggerAllChecks}
                disabled={simulatingAction !== null}
                className="rounded-lg bg-blue-600 px-3.5 py-2 font-bold text-white hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
              >
                {simulatingAction === 'CHECK_ALL' ? 'Checking…' : 'Run Checks'}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50/50">
              <div>
                <span className="font-bold text-slate-800 block">Simulate Outage Trigger</span>
                <span className="text-slate-500 text-[11px]">
                  Simulates a threshold violation to trigger automated incident creation &amp; notifications
                </span>
              </div>
              <button
                onClick={handleSimulateOutage}
                disabled={simulatingAction !== null}
                className="rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2 font-bold text-rose-700 hover:bg-rose-100 transition shadow-2xs disabled:opacity-50"
              >
                Simulate Incident
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
