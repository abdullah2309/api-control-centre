import React from 'react';
import { MonitorCheck, Service } from '../types';

interface UptimeHistoryBarsProps {
  service: Service;
  maxBars?: number; // default 30 (30 days ago to today)
  showLabels?: boolean;
}

export function getResponseCheckColor(check?: MonitorCheck | null): {
  bg: string;
  hoverBg: string;
  label: string;
  badge: string;
} {
  if (!check) {
    return {
      bg: 'bg-slate-200',
      hoverBg: 'hover:bg-slate-300',
      label: 'No check recorded yet',
      badge: 'bg-slate-100 text-slate-500',
    };
  }

  // If check failed or status is DOWN
  if (check.status === 'DOWN') {
    return {
      bg: 'bg-rose-500',
      hoverBg: 'hover:bg-rose-600',
      label: `DOWN (${check.httpStatusCode || 'Timeout'}) - ${check.errorMessage || 'Failure'}`,
      badge: 'bg-rose-100 text-rose-800',
    };
  }

  const code = check.httpStatusCode || 200;
  const latency = check.responseTimeMs || 0;

  // 2xx Success: speed-based color mapping
  if (code >= 200 && code < 300) {
    if (latency < 150) {
      return {
        bg: 'bg-emerald-500',
        hoverBg: 'hover:bg-emerald-600',
        label: `HTTP ${code} • ${latency}ms (Fast / Optimal)`,
        badge: 'bg-emerald-100 text-emerald-800',
      };
    } else if (latency < 400) {
      return {
        bg: 'bg-teal-500',
        hoverBg: 'hover:bg-teal-600',
        label: `HTTP ${code} • ${latency}ms (Good Response)`,
        badge: 'bg-teal-100 text-teal-800',
      };
    } else if (latency < 900) {
      return {
        bg: 'bg-amber-400',
        hoverBg: 'hover:bg-amber-500',
        label: `HTTP ${code} • ${latency}ms (Slow / Degraded)`,
        badge: 'bg-amber-100 text-amber-800',
      };
    } else {
      return {
        bg: 'bg-orange-500',
        hoverBg: 'hover:bg-orange-600',
        label: `HTTP ${code} • ${latency}ms (High Latency)`,
        badge: 'bg-orange-100 text-orange-800',
      };
    }
  }

  // 3xx Redirects
  if (code >= 300 && code < 400) {
    return {
      bg: 'bg-blue-500',
      hoverBg: 'hover:bg-blue-600',
      label: `HTTP ${code} Redirect • ${latency}ms`,
      badge: 'bg-blue-100 text-blue-800',
    };
  }

  // 4xx Client Errors
  if (code >= 400 && code < 500) {
    return {
      bg: 'bg-amber-500',
      hoverBg: 'hover:bg-amber-600',
      label: `HTTP ${code} Client Error • ${latency}ms`,
      badge: 'bg-amber-100 text-amber-800',
    };
  }

  // 5xx Server Errors
  return {
    bg: 'bg-rose-500',
    hoverBg: 'hover:bg-rose-600',
    label: `HTTP ${code} Server Error • ${latency}ms`,
    badge: 'bg-rose-100 text-rose-800',
  };
}

export function UptimeHistoryBars({
  service,
  maxBars = 30,
  showLabels = true,
}: UptimeHistoryBarsProps) {
  // Ordered oldest to newest (left to right)
  const checks = service.recentChecks ? [...service.recentChecks].reverse() : [];
  const actualCount = checks.length;

  // Calculate actual uptime % based on recorded checks
  let calculatedUptime = 0;
  if (actualCount > 0) {
    const upCount = checks.filter((c) => c.status === 'UP').length;
    calculatedUptime = Number(((upCount / actualCount) * 100).toFixed(1));
  }

  return (
    <div className="w-full">
      {showLabels && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5 select-none">
          <span className="font-medium text-slate-400">Today</span>
          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
            {actualCount === 0 ? (
              <span className="text-slate-400 font-normal">0% • Waiting for first check</span>
            ) : (
              <span>
                {calculatedUptime}%{' '}
                <span className="text-[10px] text-slate-400 font-normal">
                  ({actualCount} {actualCount === 1 ? 'response' : 'responses'})
                </span>
              </span>
            )}
          </div>
          <span className="font-medium text-slate-400"></span>
        </div>
      )}

      {/* 30 Segments Bar */}
      <div className="flex items-center gap-0.5 h-6 w-full">
        {Array.from({ length: maxBars }).map((_, index) => {
          const check = checks[index]; // Oldest check at index 0, newest check at index actualCount - 1
          const isFilled = index < actualCount;
          const colorInfo = isFilled ? getResponseCheckColor(check) : null;

          return (
            <div
              key={index}
              title={
                isFilled && check
                  ? `Response #${index + 1}: ${colorInfo?.label} (${new Date(
                      check.checkedAt
                    ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
                  : `Slot ${index + 1}/${maxBars}: Empty (Waiting for check)`
              }
              className={`flex-1 h-full rounded-2xs transition-all duration-200 relative group cursor-pointer ${
                isFilled && colorInfo ? colorInfo.bg : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {/* Optional micro-hover tooltip */}
              {isFilled && check && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-30 pointer-events-none whitespace-nowrap">
                  <div className="rounded bg-slate-900 px-2 py-1 text-[10px] font-mono text-white shadow-md">
                    #{index + 1}: {colorInfo?.label}
                  </div>
                  <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
