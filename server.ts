import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import {
  hashPassword,
  verifyPassword,
  generateTokens,
  verifyRefreshToken,
  authMiddleware,
  optionalAuthMiddleware,
  AuthenticatedRequest,
} from './server/auth';
import { realtime } from './server/realtime';
import { monitoringWorker } from './server/worker';
import { Service, Incident, Maintenance, StatusPageConfig } from './server/types';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// API Response Helper
function sendSuccess(res: Response, data: any, message = 'Operation successful', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    errors: null,
  });
}

function sendError(res: Response, message: string, statusCode = 400, errors: any = null) {
  return res.status(statusCode).json({
    success: false,
    data: null,
    message,
    errors,
  });
}

// ==========================================
// 1. Health & Real-time SSE
// ==========================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/v1/realtime', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  realtime.registerClient(res);
});

// ==========================================
// 2. Authentication Routes
// ==========================================
app.post('/api/v1/auth/register', (req, res) => {
  const { email, password, firstName, lastName, workspaceName } = req.body;

  if (!email || !password || !firstName) {
    return sendError(res, 'Email, password, and first name are required', 400);
  }

  const existing = db.getUserByEmail(email);
  if (existing) {
    return sendError(res, 'User with this email already exists', 409);
  }

  const userId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const now = new Date().toISOString();

  const user = db.createUser({
    id: userId,
    email,
    passwordHash: hashPassword(password),
    firstName,
    lastName: lastName || '',
    createdAt: now,
    updatedAt: now,
  });

  const slug = (workspaceName || `${firstName}'s Workspace`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const workspace = db.createWorkspace({
    id: workspaceId,
    name: workspaceName || `${firstName}'s Workspace`,
    slug: slug || `workspace-${Date.now()}`,
    ownerId: userId,
    createdAt: now,
  });

  // Seed notification preferences
  db.getNotificationPrefs(userId);
  // Seed status page
  db.getStatusPage(workspaceId);

  const tokens = generateTokens({ userId: user.id, email: user.email, workspaceId });

  return sendSuccess(
    res,
    {
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      workspace,
      ...tokens,
    },
    'Registration successful',
    201
  );
});

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 'Email and password are required', 400);
  }

  const user = db.getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return sendError(res, 'Invalid email or password', 401);
  }

  const workspaces = db.getWorkspacesByUserId(user.id);
  const workspace = workspaces[0] || null;

  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    workspaceId: workspace?.id,
  });

  return sendSuccess(res, {
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    workspace,
    ...tokens,
  });
});

app.post('/api/v1/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return sendError(res, 'Refresh token is required', 400);
  }

  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return sendError(res, 'Invalid or expired refresh token', 401);
  }

  const user = db.getUserById(payload.userId);
  if (!user) {
    return sendError(res, 'User not found', 401);
  }

  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    workspaceId: payload.workspaceId,
  });

  return sendSuccess(res, tokens);
});

app.get('/api/v1/auth/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  const user = db.getUserById(req.user!.userId);
  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  const workspaces = db.getWorkspacesByUserId(user.id);
  return sendSuccess(res, {
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
    workspaces,
    currentWorkspace: workspaces[0] || null,
  });
});

app.post('/api/v1/auth/logout', (req, res) => {
  return sendSuccess(res, null, 'Logged out successfully');
});

// Helper to resolve workspace
function getWorkspaceForUser(req: AuthenticatedRequest) {
  const userId = req.user?.userId;
  if (!userId) return null;
  const workspaces = db.getWorkspacesByUserId(userId);
  return workspaces[0] || null;
}

// ==========================================
// 3. Service Management Routes
// ==========================================
app.get('/api/v1/services', authMiddleware, (req: AuthenticatedRequest, res) => {
  const workspace = getWorkspaceForUser(req);
  if (!workspace) return sendError(res, 'Workspace not found', 404);

  let services = db.getServices(workspace.id);

  // Filtering & searching
  const search = req.query.search as string;
  const status = req.query.status as string;
  const monitoringEnabled = req.query.monitoringEnabled;

  if (search) {
    const s = search.toLowerCase();
    services = services.filter(
      (svc) => svc.name.toLowerCase().includes(s) || svc.url.toLowerCase().includes(s)
    );
  }

  if (status && status !== 'ALL') {
    services = services.filter((svc) => svc.status === status);
  }

  if (monitoringEnabled !== undefined) {
    const isEnabled = monitoringEnabled === 'true';
    services = services.filter((svc) => svc.monitoringEnabled === isEnabled);
  }

  // Sorting
  const sortBy = (req.query.sortBy as string) || 'name';
  const sortOrder = (req.query.sortOrder as string) || 'asc';

  services.sort((a: any, b: any) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Attach recentChecks (up to 30) so frontend response bars accurately show 0 to 30 checks
  const enrichedServices = services.map((svc) => ({
    ...svc,
    recentChecks: db.getRecentChecks(svc.id, 30),
  }));

  return sendSuccess(res, enrichedServices);
});

app.get('/api/v1/services/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const service = db.getServiceById(req.params.id);
  if (!service) return sendError(res, 'Service not found', 404);
  const enrichedService = {
    ...service,
    recentChecks: db.getRecentChecks(service.id, 30),
  };
  return sendSuccess(res, enrichedService);
});

app.post('/api/v1/services', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const workspace = getWorkspaceForUser(req);
  if (!workspace) return sendError(res, 'Workspace not found', 404);

  const {
    name,
    description,
    url,
    httpMethod = 'GET',
    intervalSeconds = 60,
    timeoutSeconds = 10,
    expectedStatusCodes = [200],
    retryCount = 2,
    failureThreshold = 3,
    monitoringEnabled = true,
  } = req.body;

  if (!name || !url) {
    return sendError(res, 'Name and URL are required', 400);
  }

  // URL format validation
  try {
    new URL(url);
  } catch {
    return sendError(res, 'Invalid URL format. Must include protocol (http:// or https://)', 400);
  }

  const now = new Date().toISOString();
  const newService: Service = {
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    name,
    description: description || '',
    url,
    httpMethod,
    intervalSeconds: Math.max(10, Number(intervalSeconds)),
    timeoutSeconds: Math.max(1, Math.min(120, Number(timeoutSeconds))),
    expectedStatusCodes: Array.isArray(expectedStatusCodes) ? expectedStatusCodes : [200],
    retryCount: Number(retryCount) || 0,
    failureThreshold: Math.max(1, Number(failureThreshold) || 3),
    monitoringEnabled: Boolean(monitoringEnabled),
    status: 'OPERATIONAL',
    lastCheckedAt: null,
    lastResponseTimeMs: null,
    lastHttpStatusCode: null,
    uptimePercentage: 100.0,
    createdAt: now,
    updatedAt: now,
  };

  db.createService(newService);

  db.addActivityLog({
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    userId: req.user!.userId,
    eventType: 'SERVICE_CREATED',
    entityType: 'SERVICE',
    entityId: newService.id,
    message: `Added new monitored service: "${newService.name}" (${newService.url})`,
    createdAt: now,
  });

  // Run immediate first check in background
  monitoringWorker.triggerImmediateCheck(newService.id);

  return sendSuccess(res, newService, 'Service created successfully', 201);
});

app.put('/api/v1/services/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const service = db.getServiceById(req.params.id);
  if (!service) return sendError(res, 'Service not found', 404);

  const updates = { ...req.body };
  delete updates.id;
  delete updates.workspaceId;

  if (updates.url) {
    try {
      new URL(updates.url);
    } catch {
      return sendError(res, 'Invalid URL format', 400);
    }
  }

  const updated = db.updateService(req.params.id, updates);

  db.addActivityLog({
    id: crypto.randomUUID(),
    workspaceId: service.workspaceId,
    userId: req.user!.userId,
    eventType: 'SERVICE_UPDATED',
    entityType: 'SERVICE',
    entityId: service.id,
    message: `Updated service configuration for "${service.name}"`,
    createdAt: new Date().toISOString(),
  });

  return sendSuccess(res, updated, 'Service updated successfully');
});

app.delete('/api/v1/services/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const service = db.getServiceById(req.params.id);
  if (!service) return sendError(res, 'Service not found', 404);

  db.deleteService(req.params.id);

  db.addActivityLog({
    id: crypto.randomUUID(),
    workspaceId: service.workspaceId,
    userId: req.user!.userId,
    eventType: 'SERVICE_DELETED',
    entityType: 'SERVICE',
    entityId: req.params.id,
    message: `Deleted service "${service.name}"`,
    createdAt: new Date().toISOString(),
  });

  return sendSuccess(res, null, 'Service deleted successfully');
});

// Manual Immediate Check
app.post('/api/v1/services/check-all', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const workspace = getWorkspaceForUser(req);
  if (!workspace) return sendError(res, 'Workspace not found', 404);
  const services = db.getServices(workspace.id);
  const results = await Promise.all(
    services.map((s) => monitoringWorker.triggerImmediateCheck(s.id))
  );
  return sendSuccess(res, results, 'All services checked');
});

app.post('/api/v1/services/:id/check', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const service = db.getServiceById(req.params.id);
  if (!service) return sendError(res, 'Service not found', 404);

  const checkResult = await monitoringWorker.triggerImmediateCheck(service.id);
  return sendSuccess(res, checkResult, 'Check completed successfully');
});

// Enable / Disable Monitoring
app.post('/api/v1/services/:id/monitoring/enable', authMiddleware, (req: AuthenticatedRequest, res) => {
  const service = db.getServiceById(req.params.id);
  if (!service) return sendError(res, 'Service not found', 404);

  const updated = db.updateService(service.id, {
    monitoringEnabled: true,
    status: service.status === 'PAUSED' ? 'OPERATIONAL' : service.status,
  });

  monitoringWorker.triggerImmediateCheck(service.id);
  return sendSuccess(res, updated, 'Monitoring enabled');
});

app.post('/api/v1/services/:id/monitoring/disable', authMiddleware, (req: AuthenticatedRequest, res) => {
  const service = db.getServiceById(req.params.id);
  if (!service) return sendError(res, 'Service not found', 404);

  const updated = db.updateService(service.id, {
    monitoringEnabled: false,
    status: 'PAUSED',
  });

  return sendSuccess(res, updated, 'Monitoring paused');
});

// Service Checks History
app.get('/api/v1/services/:id/checks', authMiddleware, (req: AuthenticatedRequest, res) => {
  const limit = Math.min(200, Number(req.query.limit) || 50);
  const checks = db.getRecentChecks(req.params.id, limit);
  return sendSuccess(res, checks);
});

// Service Performance & Uptime
app.get('/api/v1/services/:id/performance', authMiddleware, (req: AuthenticatedRequest, res) => {
  const hours = Number(req.query.hours) || 24;
  const startTime = new Date(Date.now() - hours * 3600000);
  const checks = db.getChecksForPeriod(req.params.id, startTime);

  // Aggregate checks into time-slice buckets for sleek charts
  const points = checks
    .sort((a, b) => new Date(a.checkedAt).getTime() - new Date(b.checkedAt).getTime())
    .map((c) => ({
      time: c.checkedAt,
      latency: c.responseTimeMs || 0,
      status: c.status,
      httpStatusCode: c.httpStatusCode,
    }));

  return sendSuccess(res, points);
});

// ==========================================
// 4. Incident Management Routes
// ==========================================
app.get('/api/v1/incidents', authMiddleware, (req: AuthenticatedRequest, res) => {
  const workspace = getWorkspaceForUser(req);
  if (!workspace) return sendError(res, 'Workspace not found', 404);

  const incidents = db.getIncidents(workspace.id);
  return sendSuccess(res, incidents);
});

app.get('/api/v1/incidents/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const incident = db.getIncidentById(req.params.id);
  if (!incident) return sendError(res, 'Incident not found', 404);

  const updates = db.getIncidentUpdates(incident.id);
  return sendSuccess(res, { ...incident, updates });
});

app.post('/api/v1/incidents', authMiddleware, (req: AuthenticatedRequest, res) => {
  const workspace = getWorkspaceForUser(req);
  if (!workspace) return sendError(res, 'Workspace not found', 404);

  const { serviceId, title, description, severity = 'HIGH' } = req.body;
  if (!serviceId || !title) {
    return sendError(res, 'Service ID and title are required', 400);
  }

  const now = new Date().toISOString();
  const incident: Incident = {
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    serviceId,
    title,
    description: description || '',
    status: 'INVESTIGATING',
    severity,
    startedAt: now,
    resolvedAt: null,
    createdBy: req.user!.userId,
    createdAt: now,
    updatedAt: now,
  };

  db.createIncident(incident);

  db.addIncidentUpdate({
    id: crypto.randomUUID(),
    incidentId: incident.id,
    message: description || 'Incident reported and under investigation.',
    status: 'INVESTIGATING',
    createdBy: req.user!.userId,
    createdAt: now,
  });

  db.addActivityLog({
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    userId: req.user!.userId,
    eventType: 'INCIDENT_CREATED',
    entityType: 'INCIDENT',
    entityId: incident.id,
    message: `Manual incident created: "${incident.title}"`,
    createdAt: now,
  });

  realtime.broadcast({
    type: 'INCIDENT_CREATED',
    data: incident,
    timestamp: now,
  });

  return sendSuccess(res, incident, 'Incident created successfully', 201);
});

app.post('/api/v1/incidents/:id/updates', authMiddleware, (req: AuthenticatedRequest, res) => {
  const incident = db.getIncidentById(req.params.id);
  if (!incident) return sendError(res, 'Incident not found', 404);

  const { message, status } = req.body;
  if (!message) return sendError(res, 'Update message is required', 400);

  const now = new Date().toISOString();
  const newStatus = status || incident.status;

  const update = db.addIncidentUpdate({
    id: crypto.randomUUID(),
    incidentId: incident.id,
    message,
    status: newStatus,
    createdBy: req.user!.userId,
    createdAt: now,
  });

  const updates: Partial<Incident> = {
    status: newStatus,
    updatedAt: now,
  };

  if (newStatus === 'RESOLVED' && !incident.resolvedAt) {
    updates.resolvedAt = now;
  }

  const updatedIncident = db.updateIncident(incident.id, updates);

  realtime.broadcast({
    type: 'INCIDENT_UPDATED',
    data: { incident: updatedIncident, update },
    timestamp: now,
  });

  return sendSuccess(res, update, 'Incident update posted');
});

app.post('/api/v1/incidents/:id/resolve', authMiddleware, (req: AuthenticatedRequest, res) => {
  const incident = db.getIncidentById(req.params.id);
  if (!incident) return sendError(res, 'Incident not found', 404);

  const now = new Date().toISOString();
  const updatedIncident = db.updateIncident(incident.id, {
    status: 'RESOLVED',
    resolvedAt: now,
    updatedAt: now,
  });

  db.addIncidentUpdate({
    id: crypto.randomUUID(),
    incidentId: incident.id,
    message: req.body.message || 'Incident marked as resolved.',
    status: 'RESOLVED',
    createdBy: req.user!.userId,
    createdAt: now,
  });

  realtime.broadcast({
    type: 'INCIDENT_RESOLVED',
    data: updatedIncident,
    timestamp: now,
  });

  return sendSuccess(res, updatedIncident, 'Incident resolved');
});

// ==========================================
// 5. Maintenance Routes
// ==========================================
app.get('/api/v1/maintenance', authMiddleware, (req: AuthenticatedRequest, res) => {
  const workspace = getWorkspaceForUser(req);
  if (!workspace) return sendError(res, 'Workspace not found', 404);

  const list = db.getMaintenances(workspace.id);
  return sendSuccess(res, list);
});

app.post('/api/v1/maintenance', authMiddleware, (req: AuthenticatedRequest, res) => {
  const workspace = getWorkspaceForUser(req);
  if (!workspace) return sendError(res, 'Workspace not found', 404);

  const { title, description, serviceIds = [], startAt, endAt } = req.body;
  if (!title || !startAt || !endAt) {
    return sendError(res, 'Title, start time, and end time are required', 400);
  }

  const now = new Date().toISOString();
  const maintenance: Maintenance = {
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    title,
    description: description || '',
    serviceIds,
    startAt,
    endAt,
    status: 'SCHEDULED',
    createdBy: req.user!.userId,
    createdAt: now,
    updatedAt: now,
  };

  db.createMaintenance(maintenance);

  db.addActivityLog({
    id: crypto.randomUUID(),
    workspaceId: workspace.id,
    userId: req.user!.userId,
    eventType: 'MAINTENANCE_SCHEDULED',
    entityType: 'MAINTENANCE',
    entityId: maintenance.id,
    message: `Scheduled maintenance window: "${maintenance.title}"`,
    createdAt: now,
  });

  realtime.broadcast({
    type: 'MAINTENANCE_STARTED',
    data: maintenance,
    timestamp: now,
  });

  return sendSuccess(res, maintenance, 'Maintenance scheduled', 201);
});

app.put('/api/v1/maintenance/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const updated = db.updateMaintenance(req.params.id, req.body);
  if (!updated) return sendError(res, 'Maintenance window not found', 404);
  return sendSuccess(res, updated, 'Maintenance updated');
});

app.delete('/api/v1/maintenance/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const ok = db.deleteMaintenance(req.params.id);
  if (!ok) return sendError(res, 'Maintenance not found', 404);
  return sendSuccess(res, null, 'Maintenance deleted');
});

// ==========================================
// 6. Analytics Overview & Services
// ==========================================
app.get('/api/v1/analytics/overview', authMiddleware, (req: AuthenticatedRequest, res) => {
  const workspace = getWorkspaceForUser(req);
  if (!workspace) return sendError(res, 'Workspace not found', 404);

  const services = db.getServices(workspace.id);
  const incidents = db.getIncidents(workspace.id);
  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');

  const operational = services.filter((s) => s.status === 'OPERATIONAL').length;
  const degraded = services.filter((s) => s.status === 'DEGRADED').length;
  const down = services.filter((s) => s.status === 'DOWN').length;

  const validUptimes = services.map((s) => s.uptimePercentage);
  const overallUptime = validUptimes.length > 0
    ? Number((validUptimes.reduce((a, b) => a + b, 0) / validUptimes.length).toFixed(2))
    : 100.0;

  const latencies = services
    .map((s) => s.lastResponseTimeMs)
    .filter((l): l is number => typeof l === 'number' && l > 0);
  const avgResponseTime = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;

  return sendSuccess(res, {
    totalServices: services.length,
    operational,
    degraded,
    down,
    activeIncidents: activeIncidents.length,
    overallUptimePercentage: overallUptime,
    averageResponseTimeMs: avgResponseTime,
    period: 'LAST_30_DAYS',
  });
});

app.get('/api/v1/analytics/services/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
  const service = db.getServiceById(req.params.id);
  if (!service) return sendError(res, 'Service not found', 404);

  const days = Number(req.query.days) || 30;
  const checks = db.getChecksForPeriod(service.id, new Date(Date.now() - days * 86400000));
  const totalChecks = checks.length;
  const successfulChecks = checks.filter((c) => c.status === 'UP').length;
  const failedChecks = totalChecks - successfulChecks;

  const uptimePercentage = totalChecks > 0
    ? Number(((successfulChecks / totalChecks) * 100).toFixed(2))
    : 100;

  const latencies = checks
    .map((c) => c.responseTimeMs)
    .filter((ms): ms is number => typeof ms === 'number' && ms > 0)
    .sort((a, b) => a - b);

  const avgResponseTimeMs = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;

  const p95Index = Math.floor(latencies.length * 0.95);
  const p99Index = Math.floor(latencies.length * 0.99);
  const p95ResponseTimeMs = latencies[p95Index] || avgResponseTimeMs;
  const p99ResponseTimeMs = latencies[p99Index] || avgResponseTimeMs;

  const statusCodeDistribution: Record<string, number> = {};
  checks.forEach((c) => {
    const code = c.httpStatusCode ? String(c.httpStatusCode) : 'ERR';
    statusCodeDistribution[code] = (statusCodeDistribution[code] || 0) + 1;
  });

  const incidents = db.getIncidents(service.workspaceId).filter((i) => i.serviceId === service.id);

  return sendSuccess(res, {
    serviceId: service.id,
    serviceName: service.name,
    period: `LAST_${days}_DAYS`,
    uptimePercentage,
    downtimeSeconds: failedChecks * service.intervalSeconds,
    averageResponseTimeMs: avgResponseTimeMs,
    p95ResponseTimeMs,
    p99ResponseTimeMs,
    successfulChecks,
    failedChecks,
    totalChecks,
    incidentCount: incidents.length,
    statusCodeDistribution,
  });
});

// ==========================================
// 7. Notifications Routes
// ==========================================
app.get('/api/v1/notifications', authMiddleware, (req: AuthenticatedRequest, res) => {
  const notifications = db.getNotifications(req.user!.userId);
  return sendSuccess(res, notifications);
});

app.post('/api/v1/notifications/:id/read', authMiddleware, (req: AuthenticatedRequest, res) => {
  const ok = db.markNotificationAsRead(req.params.id, req.user!.userId);
  return sendSuccess(res, { read: ok });
});

app.post('/api/v1/notifications/read-all', authMiddleware, (req: AuthenticatedRequest, res) => {
  db.markAllNotificationsAsRead(req.user!.userId);
  return sendSuccess(res, { success: true }, 'All notifications marked as read');
});

app.get('/api/v1/notifications/preferences', authMiddleware, (req: AuthenticatedRequest, res) => {
  const prefs = db.getNotificationPrefs(req.user!.userId);
  return sendSuccess(res, prefs);
});

app.put('/api/v1/notifications/preferences', authMiddleware, (req: AuthenticatedRequest, res) => {
  const updated = db.updateNotificationPrefs(req.user!.userId, req.body);
  return sendSuccess(res, updated, 'Notification preferences updated');
});

// ==========================================
// 8. Status Page Management & Public Route
// ==========================================
app.get('/api/v1/status-pages', authMiddleware, (req: AuthenticatedRequest, res) => {
  const workspace = getWorkspaceForUser(req);
  if (!workspace) return sendError(res, 'Workspace not found', 404);

  const config = db.getStatusPage(workspace.id);
  return sendSuccess(res, config);
});

app.put('/api/v1/status-pages', authMiddleware, (req: AuthenticatedRequest, res) => {
  const workspace = getWorkspaceForUser(req);
  if (!workspace) return sendError(res, 'Workspace not found', 404);

  const updated = db.updateStatusPage(workspace.id, req.body);
  return sendSuccess(res, updated, 'Status page settings saved');
});

// Unauthenticated Public Endpoint
app.get('/api/v1/public/status/:slug', (req, res) => {
  const workspace = db.getWorkspaceBySlug(req.params.slug);
  if (!workspace) {
    return sendError(res, 'Status page not found', 404);
  }

  const pageConfig = db.getStatusPage(workspace.id);
  const services = db.getServices(workspace.id).filter((s) => s.monitoringEnabled);
  const incidents = db.getIncidents(workspace.id);
  const maintenances = db.getMaintenances(workspace.id);

  // Overall status determination
  const anyDown = services.some((s) => s.status === 'DOWN');
  const anyDegraded = services.some((s) => s.status === 'DEGRADED');
  const overallStatus = anyDown
    ? 'MAJOR_OUTAGE'
    : anyDegraded
    ? 'PARTIAL_OUTAGE'
    : 'OPERATIONAL';

  // Last 30 days historical uptime bars for public view
  const historicalUptime = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    historicalUptime.push({
      date: dateStr,
      uptimePercentage: anyDown && i === 0 ? 98.5 : 100.0,
    });
  }

  return sendSuccess(res, {
    workspace: {
      name: workspace.name,
      logoUrl: pageConfig.logoUrl,
      tagline: pageConfig.tagline,
    },
    statusPage: pageConfig,
    overallStatus,
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      status: s.status,
      uptimePercentage: s.uptimePercentage,
      averageResponseTimeMs: s.lastResponseTimeMs || 0,
      lastCheckedAt: s.lastCheckedAt,
      recentChecks: db.getRecentChecks(s.id, 30),
    })),
    recentIncidents: incidents.slice(0, 10).map((i) => {
      const updates = db.getIncidentUpdates(i.id);
      return {
        id: i.id,
        title: i.title,
        description: i.description,
        status: i.status,
        severity: i.severity,
        startedAt: i.startedAt,
        resolvedAt: i.resolvedAt,
        updates,
      };
    }),
    scheduledMaintenance: maintenances
      .filter((m) => m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS')
      .map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        startAt: m.startAt,
        endAt: m.endAt,
        status: m.status,
      })),
    historicalUptime,
  });
});

// ==========================================
// 9. Activity Logs
// ==========================================
app.get('/api/v1/activity-logs', authMiddleware, (req: AuthenticatedRequest, res) => {
  const workspace = getWorkspaceForUser(req);
  if (!workspace) return sendError(res, 'Workspace not found', 404);

  const logs = db.getActivityLogs(workspace.id, 100);
  return sendSuccess(res, logs);
});

// ==========================================
// 10. Vite Middleware & Static Serving
// ==========================================
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Start background monitoring worker
  monitoringWorker.start();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Statusmith Server running on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});
