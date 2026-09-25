import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useRealtime } from './hooks/useRealtime';
import { api } from './api';
import {
  Service,
  Incident,
  Maintenance,
  NotificationItem,
  OverviewAnalytics,
  ActiveTab,
} from './types';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ServicesView } from './components/ServicesView';
import { IncidentsView } from './components/IncidentsView';
import { MaintenanceView } from './components/MaintenanceView';
import { AnalyticsView } from './components/AnalyticsView';
import { StatusPageView } from './components/StatusPageView';
import { ActivityLogsView } from './components/ActivityLogsView';
import { SettingsView } from './components/SettingsView';
import { AddServiceModal } from './components/AddServiceModal';
import { AuthModal } from './components/AuthModal';

function MainApp() {
  const { user, workspace } = useAuth();

  // Primary Data State (with instant cached restore for zero-latency initial render)
  const [services, setServices] = useState<Service[]>(() => {
    try {
      const cached = localStorage.getItem('statusmith_cached_services');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [incidents, setIncidents] = useState<Incident[]>(() => {
    try {
      const cached = localStorage.getItem('statusmith_cached_incidents');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [overview, setOverview] = useState<OverviewAnalytics | null>(() => {
    try {
      const cached = localStorage.getItem('statusmith_cached_overview');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('statusmith_cached_services');
      return !(cached && JSON.parse(cached).length > 0);
    } catch {
      return true;
    }
  });

  // Navigation & Modals
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Data Fetcher
  const loadAllData = useCallback(async () => {
    try {
      const [fetchedServices, fetchedIncidents, fetchedMaintenances, fetchedNotifs, fetchedOverview] =
        await Promise.all([
          api.getServices().catch(() => []),
          api.getIncidents().catch(() => []),
          api.getMaintenances().catch(() => []),
          api.getNotifications().catch(() => []),
          api.getOverviewAnalytics().catch(() => null),
        ]);

      if (fetchedServices && fetchedServices.length > 0) {
        setServices(fetchedServices);
        try {
          localStorage.setItem('statusmith_cached_services', JSON.stringify(fetchedServices));
        } catch {}
      }
      if (fetchedIncidents) {
        setIncidents(fetchedIncidents);
        try {
          localStorage.setItem('statusmith_cached_incidents', JSON.stringify(fetchedIncidents));
        } catch {}
      }
      if (fetchedOverview) {
        setOverview(fetchedOverview);
        try {
          localStorage.setItem('statusmith_cached_overview', JSON.stringify(fetchedOverview));
        } catch {}
      }
      setMaintenances(fetchedMaintenances || []);
      setNotifications(fetchedNotifs || []);
    } catch (err) {
      console.error('Failed to load platform data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial Load & Auth/Workspace Sync
  useEffect(() => {
    loadAllData();
  }, [loadAllData, workspace?.id, user?.id]);

  // Continuous Auto-Refresh (every 6 seconds): services auto-load & auto-update without manual interaction
  useEffect(() => {
    const autoSyncTimer = setInterval(() => {
      api
        .getServices()
        .then((svcs) => {
          if (svcs && svcs.length > 0) {
            setServices(svcs);
            try {
              localStorage.setItem('statusmith_cached_services', JSON.stringify(svcs));
            } catch {}
          }
        })
        .catch(() => {});

      api
        .getOverviewAnalytics()
        .then((ov) => {
          if (ov) {
            setOverview(ov);
            try {
              localStorage.setItem('statusmith_cached_overview', JSON.stringify(ov));
            } catch {}
          }
        })
        .catch(() => {});
    }, 6000);

    return () => clearInterval(autoSyncTimer);
  }, []);

  // Real-time SSE listener with instant in-place patch
  const handleRealtimeEvent = useCallback(
    (event: { type: string; data: any }) => {
      const type = (event.type || '').toUpperCase();

      // Instant in-place update for service health checks
      if (type === 'CHECK_COMPLETED' && event.data?.serviceId && event.data?.check) {
        const { serviceId, check } = event.data;
        setServices((prev) =>
          prev.map((s) => {
            if (s.id !== serviceId) return s;
            const updatedRecentChecks = [check, ...(s.recentChecks || [])].slice(0, 30);
            return {
              ...s,
              status: check.status === 'UP' ? 'OPERATIONAL' : 'DOWN',
              lastHttpStatusCode: check.httpStatusCode,
              lastResponseTimeMs: check.responseTimeMs,
              lastCheckedAt: check.checkedAt,
              recentChecks: updatedRecentChecks,
            };
          })
        );
        api.getOverviewAnalytics().then(setOverview).catch(() => {});
        return;
      }

      if (
        type === 'SERVICE_STATUS_CHANGED' ||
        type === 'INCIDENT_CREATED' ||
        type === 'INCIDENT_RESOLVED' ||
        type === 'NOTIFICATION' ||
        type === 'SERVICE_CREATED' ||
        type === 'SERVICE_UPDATED' ||
        type === 'SERVICE_DELETED'
      ) {
        api.getServices().then((svcs) => {
          setServices(svcs);
          try {
            localStorage.setItem('statusmith_cached_services', JSON.stringify(svcs));
          } catch {}
        }).catch(console.error);
        api.getIncidents().then(setIncidents).catch(console.error);
        api.getOverviewAnalytics().then(setOverview).catch(console.error);
        api.getNotifications().then(setNotifications).catch(console.error);
      }
    },
    []
  );

  const { status: connectionStatus } = useRealtime(handleRealtimeEvent);

  // Action Handlers
  const handleServiceCreated = (newService: Service) => {
    setServices((prev) => [newService, ...prev]);
    loadAllData();
  };

  const handleInspectService = (service: Service) => {
    setSelectedServiceId(service.id);
    setActiveTab('services');
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const activeIncidentsCount = incidents.filter((i) => i.status !== 'RESOLVED').length;

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* Platform Header */}
      <Header
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'services') {
            setSelectedServiceId(null);
          }
        }}
        onAddService={() => setIsAddServiceOpen(true)}
        unreadNotificationsCount={unreadCount}
        activeIncidentsCount={activeIncidentsCount}
        totalServicesCount={services.length}
        connectionStatus={connectionStatus}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onRefreshData={loadAllData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="text-xs font-semibold text-slate-600">Connecting to Statusmith Engine…</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                services={services}
                incidents={incidents}
                maintenances={maintenances}
                analytics={overview}
                onSelectService={handleInspectService}
                onNavigateTab={setActiveTab}
                onRefreshData={loadAllData}
              />
            )}

            {activeTab === 'services' && (
              <ServicesView
                services={services}
                onAddService={() => setIsAddServiceOpen(true)}
                onRefreshData={loadAllData}
                selectedServiceId={selectedServiceId}
                onClearSelectedService={() => setSelectedServiceId(null)}
              />
            )}

            {activeTab === 'incidents' && (
              <IncidentsView
                incidents={incidents}
                services={services}
                onRefreshData={loadAllData}
              />
            )}

            {activeTab === 'maintenance' && (
              <MaintenanceView
                maintenances={maintenances}
                services={services}
                onRefreshData={loadAllData}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView services={services} overview={overview} />
            )}

            {activeTab === 'status-page' && (
              <StatusPageView
                services={services}
                incidents={incidents}
                maintenances={maintenances}
                workspaceSlug={workspace?.slug || 'acme-prod'}
                onRefreshData={loadAllData}
              />
            )}

            {activeTab === 'activity' && <ActivityLogsView />}

            {activeTab === 'settings' && (
              <SettingsView
                workspace={workspace}
                onRefreshData={loadAllData}
              />
            )}
          </>
        )}
      </main>

      {/* Add Service Modal */}
      <AddServiceModal
        isOpen={isAddServiceOpen}
        onClose={() => setIsAddServiceOpen(false)}
        onCreated={handleServiceCreated}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
