import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  User,
  Workspace,
  Service,
  MonitorCheck,
  Incident,
  IncidentUpdate,
  Maintenance,
  Notification,
  NotificationPrefs,
  StatusPageConfig,
  ActivityLog,
} from './types';

interface DatabaseSchema {
  users: User[];
  workspaces: Workspace[];
  services: Service[];
  checks: MonitorCheck[];
  incidents: Incident[];
  incidentUpdates: IncidentUpdate[];
  maintenances: Maintenance[];
  notifications: Notification[];
  notificationPrefs: NotificationPrefs[];
  statusPages: StatusPageConfig[];
  activityLogs: ActivityLog[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'statusmith.json');

class Database {
  private data: DatabaseSchema = {
    users: [],
    workspaces: [],
    services: [],
    checks: [],
    incidents: [],
    incidentUpdates: [],
    maintenances: [],
    notifications: [],
    notificationPrefs: [],
    statusPages: [],
    activityLogs: [],
  };

  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
      } else {
        this.seedInitialData();
        this.saveImmediately();
      }
    } catch (err) {
      console.error('Failed to load database from disk, using seed data:', err);
      this.seedInitialData();
    }
  }

  private seedInitialData() {
    const userId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    const now = new Date();

    // Default password: password123
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('password123', salt);

    const demoUser: User = {
      id: userId,
      email: 'demo@statusmith.com',
      passwordHash,
      firstName: 'Alex',
      lastName: 'Smith',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const demoWorkspace: Workspace = {
      id: workspaceId,
      name: 'Acme Cloud Production',
      slug: 'acme-prod',
      ownerId: userId,
      createdAt: now.toISOString(),
    };

    const demoServices: Service[] = [
      {
        id: crypto.randomUUID(),
        workspaceId,
        name: 'GitHub REST API',
        description: 'Core GitHub API endpoint monitoring',
        url: 'https://api.github.com',
        httpMethod: 'GET',
        intervalSeconds: 60,
        timeoutSeconds: 10,
        expectedStatusCodes: [200],
        retryCount: 2,
        failureThreshold: 3,
        monitoringEnabled: true,
        status: 'OPERATIONAL',
        lastCheckedAt: now.toISOString(),
        lastResponseTimeMs: 142,
        lastHttpStatusCode: 200,
        uptimePercentage: 99.98,
        createdAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: crypto.randomUUID(),
        workspaceId,
        name: 'Cloudflare Edge Gateway',
        description: 'Global anycast edge connectivity check',
        url: 'https://1.1.1.1',
        httpMethod: 'GET',
        intervalSeconds: 60,
        timeoutSeconds: 5,
        expectedStatusCodes: [200, 301],
        retryCount: 3,
        failureThreshold: 3,
        monitoringEnabled: true,
        status: 'OPERATIONAL',
        lastCheckedAt: now.toISOString(),
        lastResponseTimeMs: 48,
        lastHttpStatusCode: 200,
        uptimePercentage: 100.0,
        createdAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: crypto.randomUUID(),
        workspaceId,
        name: 'Public DNS Health API',
        description: 'Google Public DNS JSON resolution endpoint',
        url: 'https://dns.google/resolve?name=example.com',
        httpMethod: 'GET',
        intervalSeconds: 60,
        timeoutSeconds: 8,
        expectedStatusCodes: [200],
        retryCount: 2,
        failureThreshold: 3,
        monitoringEnabled: true,
        status: 'OPERATIONAL',
        lastCheckedAt: now.toISOString(),
        lastResponseTimeMs: 76,
        lastHttpStatusCode: 200,
        uptimePercentage: 99.95,
        createdAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: crypto.randomUUID(),
        workspaceId,
        name: 'Payment Processing Microservice',
        description: 'Stripe webhook and checkout API proxy',
        url: 'https://httpbin.org/status/200',
        httpMethod: 'GET',
        intervalSeconds: 60,
        timeoutSeconds: 15,
        expectedStatusCodes: [200],
        retryCount: 3,
        failureThreshold: 3,
        monitoringEnabled: true,
        status: 'OPERATIONAL',
        lastCheckedAt: now.toISOString(),
        lastResponseTimeMs: 185,
        lastHttpStatusCode: 200,
        uptimePercentage: 99.85,
        createdAt: new Date(now.getTime() - 7 * 86400000).toISOString(),
        updatedAt: now.toISOString(),
      },
    ];

    // Generate historical checks for each service over the last 24 hours (every 15 min intervals for rich initial charts)
    const demoChecks: MonitorCheck[] = [];
    demoServices.forEach((service) => {
      for (let i = 40; i >= 0; i--) {
        const checkTime = new Date(now.getTime() - i * 15 * 60000);
        const baseLatency = service.name.includes('Cloudflare') ? 45 : service.name.includes('DNS') ? 70 : 140;
        const latency = Math.max(20, Math.round(baseLatency + (Math.sin(i) * 25) + ((i % 7) * 4)));
        demoChecks.push({
          id: crypto.randomUUID(),
          serviceId: service.id,
          status: 'UP',
          httpStatusCode: 200,
          responseTimeMs: latency,
          errorMessage: null,
          checkedAt: checkTime.toISOString(),
        });
      }
    });

    const statusPage: StatusPageConfig = {
      id: crypto.randomUUID(),
      workspaceId,
      slug: 'acme-prod',
      companyName: 'Acme Cloud Production',
      logoUrl: '',
      tagline: 'Real-time status and incident communication for Acme Cloud',
      accentColor: '#2563eb',
      showUptime: true,
      showIncidents: true,
      showMaintenance: true,
      showResponseTime: true,
      theme: 'light',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const notifPrefs: NotificationPrefs = {
      userId,
      serviceDown: true,
      serviceRecovered: true,
      incidentCreated: true,
      incidentResolved: true,
      maintenanceStarted: true,
      emailAlerts: true,
    };

    const initialLogs: ActivityLog[] = [
      {
        id: crypto.randomUUID(),
        workspaceId,
        userId,
        eventType: 'WORKSPACE_INITIALIZED',
        entityType: 'WORKSPACE',
        entityId: workspaceId,
        message: 'Statusmith workspace initialized with 4 production services',
        createdAt: new Date(now.getTime() - 3600000).toISOString(),
      },
      {
        id: crypto.randomUUID(),
        workspaceId,
        userId,
        eventType: 'MONITORING_STARTED',
        entityType: 'SERVICE',
        entityId: demoServices[0].id,
        message: 'Background worker activated real HTTP monitoring',
        createdAt: new Date(now.getTime() - 1800000).toISOString(),
      },
    ];

    const initialNotifications: Notification[] = [
      {
        id: crypto.randomUUID(),
        workspaceId,
        userId,
        type: 'SERVICE_RECOVERED',
        title: 'Monitoring Active',
        message: 'Statusmith background worker is actively monitoring your services with real HTTP checks.',
        isRead: false,
        createdAt: now.toISOString(),
      },
    ];

    this.data = {
      users: [demoUser],
      workspaces: [demoWorkspace],
      services: demoServices,
      checks: demoChecks,
      incidents: [],
      incidentUpdates: [],
      maintenances: [],
      notifications: initialNotifications,
      notificationPrefs: [notifPrefs],
      statusPages: [statusPage],
      activityLogs: initialLogs,
    };
  }

  private scheduleSave() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveImmediately();
      this.saveTimeout = null;
    }, 500);
  }

  private saveImmediately() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error persisting database to disk:', err);
    }
  }

  // --- Users ---
  getAllUsers(): User[] {
    return this.data.users;
  }

  getUserByEmail(email: string): User | undefined {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  createUser(user: User): User {
    this.data.users.push(user);
    this.scheduleSave();
    return user;
  }

  // --- Workspaces ---
  getWorkspaceById(id: string): Workspace | undefined {
    return this.data.workspaces.find((w) => w.id === id);
  }

  getWorkspaceBySlug(slug: string): Workspace | undefined {
    return this.data.workspaces.find((w) => w.slug.toLowerCase() === slug.toLowerCase());
  }

  getWorkspacesByUserId(userId: string): Workspace[] {
    return this.data.workspaces.filter((w) => w.ownerId === userId);
  }

  createWorkspace(workspace: Workspace): Workspace {
    this.data.workspaces.push(workspace);
    this.scheduleSave();
    return workspace;
  }

  // --- Services ---
  getServices(workspaceId: string): Service[] {
    return this.data.services.filter((s) => s.workspaceId === workspaceId);
  }

  getAllActiveServices(): Service[] {
    return this.data.services.filter((s) => s.monitoringEnabled);
  }

  getServiceById(id: string): Service | undefined {
    return this.data.services.find((s) => s.id === id);
  }

  createService(service: Service): Service {
    this.data.services.push(service);
    this.scheduleSave();
    return service;
  }

  updateService(id: string, updates: Partial<Service>): Service | undefined {
    const index = this.data.services.findIndex((s) => s.id === id);
    if (index === -1) return undefined;
    this.data.services[index] = {
      ...this.data.services[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.scheduleSave();
    return this.data.services[index];
  }

  deleteService(id: string): boolean {
    const before = this.data.services.length;
    this.data.services = this.data.services.filter((s) => s.id !== id);
    // Cascade remove checks
    this.data.checks = this.data.checks.filter((c) => c.serviceId !== id);
    const deleted = this.data.services.length < before;
    if (deleted) this.scheduleSave();
    return deleted;
  }

  // --- Checks ---
  addCheck(check: MonitorCheck) {
    this.data.checks.push(check);
    // Keep max 5,000 checks per service to prevent unbounded memory usage
    if (this.data.checks.length > 50000) {
      this.data.checks = this.data.checks.slice(-30000);
    }
    this.scheduleSave();
  }

  getRecentChecks(serviceId: string, limit = 50): MonitorCheck[] {
    return this.data.checks
      .filter((c) => c.serviceId === serviceId)
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())
      .slice(0, limit);
  }

  getChecksForPeriod(serviceId: string, startTime: Date): MonitorCheck[] {
    const startMs = startTime.getTime();
    return this.data.checks.filter(
      (c) => c.serviceId === serviceId && new Date(c.checkedAt).getTime() >= startMs
    );
  }

  getAllChecks(): MonitorCheck[] {
    return this.data.checks;
  }

  // --- Incidents ---
  getIncidents(workspaceId: string): Incident[] {
    return this.data.incidents
      .filter((i) => i.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getIncidentById(id: string): Incident | undefined {
    return this.data.incidents.find((i) => i.id === id);
  }

  getActiveIncidentForService(serviceId: string): Incident | undefined {
    return this.data.incidents.find((i) => i.serviceId === serviceId && i.status !== 'RESOLVED');
  }

  createIncident(incident: Incident): Incident {
    this.data.incidents.unshift(incident);
    this.scheduleSave();
    return incident;
  }

  updateIncident(id: string, updates: Partial<Incident>): Incident | undefined {
    const index = this.data.incidents.findIndex((i) => i.id === id);
    if (index === -1) return undefined;
    this.data.incidents[index] = {
      ...this.data.incidents[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.scheduleSave();
    return this.data.incidents[index];
  }

  addIncidentUpdate(update: IncidentUpdate): IncidentUpdate {
    this.data.incidentUpdates.push(update);
    this.scheduleSave();
    return update;
  }

  getIncidentUpdates(incidentId: string): IncidentUpdate[] {
    return this.data.incidentUpdates
      .filter((u) => u.incidentId === incidentId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  // --- Maintenance ---
  getMaintenances(workspaceId: string): Maintenance[] {
    return this.data.maintenances
      .filter((m) => m.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }

  getMaintenanceById(id: string): Maintenance | undefined {
    return this.data.maintenances.find((m) => m.id === id);
  }

  createMaintenance(m: Maintenance): Maintenance {
    this.data.maintenances.unshift(m);
    this.scheduleSave();
    return m;
  }

  updateMaintenance(id: string, updates: Partial<Maintenance>): Maintenance | undefined {
    const index = this.data.maintenances.findIndex((m) => m.id === id);
    if (index === -1) return undefined;
    this.data.maintenances[index] = {
      ...this.data.maintenances[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.scheduleSave();
    return this.data.maintenances[index];
  }

  deleteMaintenance(id: string): boolean {
    const before = this.data.maintenances.length;
    this.data.maintenances = this.data.maintenances.filter((m) => m.id !== id);
    const deleted = this.data.maintenances.length < before;
    if (deleted) this.scheduleSave();
    return deleted;
  }

  // --- Notifications ---
  getNotifications(userId: string): Notification[] {
    return this.data.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  addNotification(n: Notification): Notification {
    this.data.notifications.unshift(n);
    if (this.data.notifications.length > 500) {
      this.data.notifications = this.data.notifications.slice(0, 500);
    }
    this.scheduleSave();
    return n;
  }

  markNotificationAsRead(id: string, userId: string): boolean {
    const notif = this.data.notifications.find((n) => n.id === id && n.userId === userId);
    if (notif) {
      notif.isRead = true;
      this.scheduleSave();
      return true;
    }
    return false;
  }

  markAllNotificationsAsRead(userId: string) {
    this.data.notifications.forEach((n) => {
      if (n.userId === userId) n.isRead = true;
    });
    this.scheduleSave();
  }

  getNotificationPrefs(userId: string): NotificationPrefs {
    const existing = this.data.notificationPrefs.find((p) => p.userId === userId);
    if (existing) return existing;
    const defaults: NotificationPrefs = {
      userId,
      serviceDown: true,
      serviceRecovered: true,
      incidentCreated: true,
      incidentResolved: true,
      maintenanceStarted: true,
      emailAlerts: true,
    };
    this.data.notificationPrefs.push(defaults);
    this.scheduleSave();
    return defaults;
  }

  updateNotificationPrefs(userId: string, prefs: Partial<NotificationPrefs>): NotificationPrefs {
    const index = this.data.notificationPrefs.findIndex((p) => p.userId === userId);
    if (index !== -1) {
      this.data.notificationPrefs[index] = {
        ...this.data.notificationPrefs[index],
        ...prefs,
      };
      this.scheduleSave();
      return this.data.notificationPrefs[index];
    }
    const created: NotificationPrefs = {
      userId,
      serviceDown: true,
      serviceRecovered: true,
      incidentCreated: true,
      incidentResolved: true,
      maintenanceStarted: true,
      emailAlerts: true,
      ...prefs,
    };
    this.data.notificationPrefs.push(created);
    this.scheduleSave();
    return created;
  }

  // --- Status Page ---
  getStatusPage(workspaceId: string): StatusPageConfig {
    const existing = this.data.statusPages.find((sp) => sp.workspaceId === workspaceId);
    if (existing) return existing;
    const ws = this.getWorkspaceById(workspaceId);
    const newPage: StatusPageConfig = {
      id: crypto.randomUUID(),
      workspaceId,
      slug: ws?.slug || 'status',
      companyName: ws?.name || 'My Status Page',
      logoUrl: '',
      tagline: 'Service status & health dashboard',
      accentColor: '#2563eb',
      showUptime: true,
      showIncidents: true,
      showMaintenance: true,
      showResponseTime: true,
      theme: 'light',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.data.statusPages.push(newPage);
    this.scheduleSave();
    return newPage;
  }

  updateStatusPage(workspaceId: string, updates: Partial<StatusPageConfig>): StatusPageConfig {
    const page = this.getStatusPage(workspaceId);
    Object.assign(page, updates, { updatedAt: new Date().toISOString() });
    this.scheduleSave();
    return page;
  }

  // --- Activity Logs ---
  addActivityLog(log: ActivityLog) {
    this.data.activityLogs.unshift(log);
    if (this.data.activityLogs.length > 2000) {
      this.data.activityLogs = this.data.activityLogs.slice(0, 2000);
    }
    this.scheduleSave();
  }

  getActivityLogs(workspaceId: string, limit = 100): ActivityLog[] {
    return this.data.activityLogs
      .filter((l) => l.workspaceId === workspaceId)
      .slice(0, limit);
  }
}

export const db = new Database();
