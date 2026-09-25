import React, { useState } from 'react';
import {
  Activity,
  Server,
  AlertOctagon,
  Calendar,
  BarChart3,
  Globe,
  FileText,
  Plus,
  Bell,
  Radio,
  LogOut,
  User as UserIcon,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { ActiveTab } from '../types';
import { useAuth } from '../context/AuthContext';
import { NotificationsPopover } from './NotificationsPopover';
import { ConnectionStatus } from '../hooks/useRealtime';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onAddService: () => void;
  unreadNotificationsCount: number;
  activeIncidentsCount: number;
  totalServicesCount: number;
  connectionStatus: ConnectionStatus;
  onOpenAuthModal: () => void;
  onRefreshData?: () => void;
}

export function Header({
  activeTab,
  onTabChange,
  onAddService,
  unreadNotificationsCount,
  activeIncidentsCount,
  totalServicesCount,
  connectionStatus,
  onOpenAuthModal,
  onRefreshData,
}: HeaderProps) {
  const { user, workspace, logout } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; badge?: number | string; badgeColor?: string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity className="h-4 w-4" /> },
    { id: 'services', label: 'Services', icon: <Server className="h-4 w-4" />, badge: totalServicesCount },
    {
      id: 'incidents',
      label: 'Incidents',
      icon: <AlertOctagon className="h-4 w-4" />,
      badge: activeIncidentsCount > 0 ? activeIncidentsCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    { id: 'maintenance', label: 'Maintenance', icon: <Calendar className="h-4 w-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'status-page', label: 'Status Page', icon: <Globe className="h-4 w-4" /> },
    { id: 'activity', label: 'Activity Logs', icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <header id="app-header" className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-xs">
      {/* Top Bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Brand & Workspace */}
          <div className="flex items-center gap-4">
            <button
              id="brand-logo-btn"
              onClick={() => onTabChange('dashboard')}
              className="flex items-center gap-2.5 text-slate-900 focus:outline-hidden"
            >
        
              <div className="text-left">
                <span className="text-lg font-bold tracking-tight text-slate-900 block leading-tight">
                  API Control Centre
                </span>
              </div>
            </button>



            {/* Workspace badge */}
            {workspace && (
              <div className="hidden md:flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                <span className="text-slate-400 font-normal">Workspace:</span>
                <span className="truncate max-w-[140px] font-semibold">{workspace.name}</span>
              </div>
            )}
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2.5">
            {/* Quick Refresh All Services Button */}
            {onRefreshData && (
              <button
                id="header-refresh-data-btn"
                onClick={onRefreshData}
                title="Refresh Services & Live Metrics"
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition focus:outline-hidden"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}

            {/* Add Service Button */}
            <button
              id="header-add-service-btn"
              onClick={onAddService}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>Add Service</span>
            </button>

            {/* Notifications Button */}
            <div className="relative">
              <button
                id="header-notifications-btn"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition focus:outline-hidden"
                title="Alerts & Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              <NotificationsPopover
                isOpen={notificationsOpen}
                onClose={() => setNotificationsOpen(false)}
                onRefresh={onRefreshData}
              />
            </div>

            {/* User Account / Auth Dropdown */}
            <div className="relative">
              {user ? (
                <div>
                  <button
                    id="header-user-menu-btn"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 py-1.5 px-2.5 text-xs text-slate-700 hover:bg-slate-50 transition focus:outline-hidden"
                  >
                    <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[11px]">
                      {user.firstName ? user.firstName[0].toUpperCase() : 'U'}
                    </div>
                    <span className="hidden sm:inline font-medium max-w-[100px] truncate">{user.firstName}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-1 z-50 text-xs">
                      <div className="px-3.5 py-2 border-b border-slate-100">
                        <p className="font-semibold text-slate-800">{user.firstName} {user.lastName}</p>
                        <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenAuthModal();
                        }}
                        className="w-full text-left px-3.5 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <UserIcon className="h-3.5 w-3.5 text-slate-500" /> Switch Account
                      </button>
                      <button
                        id="header-logout-btn"
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="w-full text-left px-3.5 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100"
                      >
                        <LogOut className="h-3.5 w-3.5" /> Log Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  id="header-login-btn"
                  onClick={onOpenAuthModal}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Log In
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav id="header-nav-tabs" className="flex space-x-1 overflow-x-auto pb-0.5 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-2.5 px-3 text-xs font-medium transition ${
                  isActive
                    ? 'border-blue-600 text-blue-600 font-semibold'
                    : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                      tab.badgeColor || (isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
