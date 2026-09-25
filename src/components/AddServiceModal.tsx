import React, { useState } from 'react';
import { X, Plus, Server, Globe, Clock, ShieldAlert, Check } from 'lucide-react';
import { api } from '../api';
import { Service } from '../types';

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (service: Service) => void;
}

export function AddServiceModal({ isOpen, onClose, onCreated }: AddServiceModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [httpMethod, setHttpMethod] = useState<'GET' | 'POST' | 'HEAD'>('GET');
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [timeoutSeconds, setTimeoutSeconds] = useState(10);
  const [expectedCodes, setExpectedCodes] = useState('200');
  const [failureThreshold, setFailureThreshold] = useState(3);
  const [retryCount, setRetryCount] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a service name');
      return;
    }

    let parsedUrl = url.trim();
    if (!parsedUrl.startsWith('http://') && !parsedUrl.startsWith('https://')) {
      parsedUrl = `https://${parsedUrl}`;
    }

    try {
      new URL(parsedUrl);
    } catch {
      setError('Invalid URL format. Please enter a valid address.');
      return;
    }

    const expectedStatusCodes = expectedCodes
      .split(',')
      .map((c) => parseInt(c.trim(), 10))
      .filter((c) => !isNaN(c));

    if (expectedStatusCodes.length === 0) {
      setError('Please provide at least one expected status code (e.g. 200)');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await api.createService({
        name: name.trim(),
        description: description.trim(),
        url: parsedUrl,
        httpMethod,
        intervalSeconds,
        timeoutSeconds,
        expectedStatusCodes,
        failureThreshold,
        retryCount,
        monitoringEnabled: true,
      });

      onCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create service');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="add-service-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition animate-in fade-in zoom-in-95 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Add Monitored Service</h2>
              <p className="text-xs text-slate-500">Configure real HTTP uptime and health checks</p>
            </div>
          </div>
          <button
            id="close-add-service-modal-btn"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Service Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="service-name-input"
              type="text"
              required
              placeholder="e.g. Production Payment Gateway"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <input
              id="service-desc-input"
              type="text"
              placeholder="e.g. Critical customer checkout API endpoint"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-1">
              <label className="block font-semibold text-slate-700 mb-1">Method</label>
              <select
                id="service-method-select"
                value={httpMethod}
                onChange={(e) => setHttpMethod(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-slate-800 bg-white focus:border-blue-500 focus:outline-hidden"
              >
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
                <option value="POST">POST</option>
              </select>
            </div>
            <div className="col-span-3">
              <label className="block font-semibold text-slate-700 mb-1">
                Endpoint URL <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="service-url-input"
                  type="text"
                  required
                  placeholder="https://api.yourcompany.com/health"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-2 text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden"
                />
                <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Check Frequency</label>
              <select
                id="service-interval-select"
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 bg-white focus:border-blue-500 focus:outline-hidden"
              >
                <option value={10}>Every 10 seconds (High frequency)</option>
                <option value={30}>Every 30 seconds</option>
                <option value={60}>Every 1 minute (Recommended)</option>
                <option value={120}>Every 2 minutes</option>
                <option value={300}>Every 5 minutes</option>
                <option value={600}>Every 10 minutes</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">HTTP Timeout</label>
              <select
                id="service-timeout-select"
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 bg-white focus:border-blue-500 focus:outline-hidden"
              >
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds (Standard)</option>
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Expected Codes</label>
              <input
                id="service-expected-codes-input"
                type="text"
                placeholder="200, 201"
                value={expectedCodes}
                onChange={(e) => setExpectedCodes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-slate-800 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Failure Threshold</label>
              <input
                id="service-threshold-input"
                type="number"
                min={1}
                max={10}
                value={failureThreshold}
                onChange={(e) => setFailureThreshold(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-slate-800 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Retries</label>
              <input
                id="service-retries-input"
                type="number"
                min={0}
                max={5}
                value={retryCount}
                onChange={(e) => setRetryCount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-slate-800 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500 space-y-1 border border-slate-100">
            <p>
              • <strong>Threshold ({failureThreshold}x)</strong>: Confirmed outage after {failureThreshold} consecutive failed checks.
            </p>
            <p>
              • <strong>Immediate Check</strong>: The worker executes a real network request immediately upon save.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              id="cancel-add-service-btn"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="submit-add-service-btn"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white shadow-xs hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{isSubmitting ? 'Creating & Checking…' : 'Start Monitoring'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
