export type ServiceStatus = 'OPERATIONAL' | 'DEGRADED' | 'DOWN' | 'PAUSED';
export type CheckStatus = 'UP' | 'DOWN';
export type IncidentStatus = 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type MaintenanceStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: string;
}

export interface Service {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  url: string;
  httpMethod: 'GET' | 'POST' | 'HEAD';
  intervalSeconds: number;
  timeoutSeconds: number;
  expectedStatusCodes: number[];
  retryCount: number;
  failureThreshold: number;
  monitoringEnabled: boolean;
  status: ServiceStatus;
  lastCheckedAt: string | null;
  lastResponseTimeMs: number | null;
  lastHttpStatusCode: number | null;
  uptimePercentage: number;
  recentChecks?: MonitorCheck[];
  createdAt: string;
  updatedAt: string;
}

export interface MonitorCheck {
  id: string;
  serviceId: string;
  status: CheckStatus;
  httpStatusCode: number | null;
  responseTimeMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

export interface Incident {
  id: string;
  workspaceId: string;
  serviceId: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  startedAt: string;
  resolvedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updates?: IncidentUpdate[];
}

export interface IncidentUpdate {
  id: string;
  incidentId: string;
  message: string;
  status: IncidentStatus;
  createdBy: string;
  createdAt: string;
}

export interface Maintenance {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  serviceIds: string[];
  startAt: string;
  endAt: string;
  status: MaintenanceStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationPrefs {
  userId: string;
  serviceDown: boolean;
  serviceRecovered: boolean;
  incidentCreated: boolean;
  incidentResolved: boolean;
  maintenanceStarted: boolean;
  emailAlerts: boolean;
}

export interface StatusPageConfig {
  id: string;
  workspaceId: string;
  slug: string;
  companyName: string;
  logoUrl: string;
  tagline: string;
  accentColor: string;
  showUptime: boolean;
  showIncidents: boolean;
  showMaintenance: boolean;
  showResponseTime: boolean;
  theme: 'light' | 'dark' | 'system';
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  workspaceId: string;
  userId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  message: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface OverviewAnalytics {
  totalServices: number;
  operational: number;
  degraded: number;
  down: number;
  activeIncidents: number;
  overallUptimePercentage: number;
  averageResponseTimeMs: number;
  period: string;
}

export interface ServiceAnalytics {
  serviceId: string;
  serviceName: string;
  period: string;
  uptimePercentage: number;
  downtimeSeconds: number;
  averageResponseTimeMs: number;
  p95ResponseTimeMs: number;
  p99ResponseTimeMs: number;
  successfulChecks: number;
  failedChecks: number;
  totalChecks: number;
  incidentCount: number;
  statusCodeDistribution: Record<string, number>;
}

export interface PublicStatusData {
  workspace: {
    name: string;
    logoUrl: string;
    tagline: string;
  };
  statusPage: StatusPageConfig;
  overallStatus: 'OPERATIONAL' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE';
  services: Array<{
    id: string;
    name: string;
    description: string;
    status: ServiceStatus;
    uptimePercentage: number;
    averageResponseTimeMs: number;
    lastCheckedAt: string | null;
  }>;
  recentIncidents: Array<{
    id: string;
    title: string;
    description: string;
    status: IncidentStatus;
    severity: IncidentSeverity;
    startedAt: string;
    resolvedAt: string | null;
    updates: IncidentUpdate[];
  }>;
  scheduledMaintenance: Array<{
    id: string;
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    status: MaintenanceStatus;
  }>;
  historicalUptime: Array<{
    date: string;
    uptimePercentage: number;
  }>;
}

export type ActiveTab =
  | 'dashboard'
  | 'services'
  | 'incidents'
  | 'maintenance'
  | 'analytics'
  | 'status-page'
  | 'activity'
  | 'settings';
