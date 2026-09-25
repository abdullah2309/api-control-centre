import crypto from 'crypto';
import { db } from './db';
import { realtime } from './realtime';
import { Service, MonitorCheck, Incident } from './types';

class MonitoringWorker {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isChecking = false;

  public start() {
    console.log('Statusmith Monitoring Worker started. Checking services every 5 seconds...');
    // Tick every 5 seconds to find any services due for checking based on their intervalSeconds
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, 5000);

    // Initial check on boot so all services immediately have live fresh status
    setTimeout(() => {
      this.checkAllActiveServicesNow().catch((err) =>
        console.error('Initial background check error:', err)
      );
    }, 1000);
  }

  public async checkAllActiveServicesNow() {
    const activeServices = db.getAllActiveServices();
    await Promise.allSettled(activeServices.map((s) => this.executeCheck(s)));
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private async tick() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const activeServices = db.getAllActiveServices();
      const now = Date.now();

      for (const service of activeServices) {
        const lastChecked = service.lastCheckedAt ? new Date(service.lastCheckedAt).getTime() : 0;
        const intervalMs = (service.intervalSeconds || 60) * 1000;

        if (now - lastChecked >= intervalMs) {
          await this.executeCheck(service);
        }
      }
    } catch (err) {
      console.error('Error in monitoring worker tick:', err);
    } finally {
      this.isChecking = false;
    }
  }

  public async triggerImmediateCheck(serviceId: string): Promise<MonitorCheck | null> {
    const service = db.getServiceById(serviceId);
    if (!service) return null;
    return await this.executeCheck(service);
  }

  public async executeCheck(service: Service): Promise<MonitorCheck> {
    let checkResult: MonitorCheck | null = null;
    const retryCount = service.retryCount || 0;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      const startTime = performance.now();
      const controller = new AbortController();
      const timeoutMs = (service.timeoutSeconds || 10) * 1000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const method = service.httpMethod || 'GET';
        const response = await fetch(service.url, {
          method,
          signal: controller.signal,
          headers: {
            'User-Agent': 'Statusmith-Monitor/2.0 (+https://statusmith.com)',
            'Accept': '*/*',
          },
        });
        clearTimeout(timeoutId);

        const endTime = performance.now();
        const responseTimeMs = Math.round(endTime - startTime);
        const statusCode = response.status;
        const expectedCodes = service.expectedStatusCodes || [200];
        const isSuccess = expectedCodes.includes(statusCode);

        checkResult = {
          id: crypto.randomUUID(),
          serviceId: service.id,
          status: isSuccess ? 'UP' : 'DOWN',
          httpStatusCode: statusCode,
          responseTimeMs,
          errorMessage: isSuccess ? null : `Unexpected HTTP status code: ${statusCode}`,
          checkedAt: new Date().toISOString(),
        };

        if (isSuccess) {
          break; // Success, no need to retry
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        const endTime = performance.now();
        const responseTimeMs = Math.round(endTime - startTime);
        const isAbort = err.name === 'AbortError';
        const errorMsg = isAbort
          ? `Request timed out after ${service.timeoutSeconds}s`
          : (err.message || 'Connection failed');

        checkResult = {
          id: crypto.randomUUID(),
          serviceId: service.id,
          status: 'DOWN',
          httpStatusCode: null,
          responseTimeMs: isAbort ? timeoutMs : responseTimeMs,
          errorMessage: errorMsg,
          checkedAt: new Date().toISOString(),
        };
      }

      // If failed and retries remain, wait briefly
      if (checkResult.status === 'DOWN' && attempt < retryCount) {
        await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
      }
    }

    if (!checkResult) {
      checkResult = {
        id: crypto.randomUUID(),
        serviceId: service.id,
        status: 'DOWN',
        httpStatusCode: null,
        responseTimeMs: null,
        errorMessage: 'Check execution failed',
        checkedAt: new Date().toISOString(),
      };
    }

    // Save check record
    db.addCheck(checkResult);

    // Evaluate failure threshold and recovery
    await this.evaluateServiceStatus(service, checkResult);

    // Broadcast check completed event
    realtime.broadcast({
      type: 'CHECK_COMPLETED',
      data: {
        serviceId: service.id,
        check: checkResult,
      },
      timestamp: new Date().toISOString(),
    });

    return checkResult;
  }

  private async evaluateServiceStatus(service: Service, latestCheck: MonitorCheck) {
    const failureThreshold = service.failureThreshold || 3;
    const recentChecks = db.getRecentChecks(service.id, failureThreshold);

    // Calculate updated uptime percentage across recent checks
    const periodChecks = db.getChecksForPeriod(service.id, new Date(Date.now() - 30 * 86400000));
    const allChecks = periodChecks.length > 0 ? periodChecks : recentChecks;
    const successfulChecks = allChecks.filter((c) => c.status === 'UP').length;
    const uptimePercentage = allChecks.length > 0
      ? Number(((successfulChecks / allChecks.length) * 100).toFixed(2))
      : 100;

    let newStatus = service.status;

    // Check if threshold reached
    if (recentChecks.length >= failureThreshold) {
      const allFailed = recentChecks.every((c) => c.status === 'DOWN');

      if (allFailed && service.status !== 'DOWN') {
        newStatus = 'DOWN';

        // Check if active incident already exists
        const existingIncident = db.getActiveIncidentForService(service.id);
        if (!existingIncident) {
          const incident: Incident = {
            id: crypto.randomUUID(),
            workspaceId: service.workspaceId,
            serviceId: service.id,
            title: `Service Outage: ${service.name}`,
            description: `Health check failed ${failureThreshold} consecutive times. Last error: ${latestCheck.errorMessage || 'No response'}`,
            status: 'INVESTIGATING',
            severity: 'HIGH',
            startedAt: new Date().toISOString(),
            resolvedAt: null,
            createdBy: 'system',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          db.createIncident(incident);
          db.addIncidentUpdate({
            id: crypto.randomUUID(),
            incidentId: incident.id,
            message: `Automated detection: Health check endpoint failed ${failureThreshold} times. System investigating.`,
            status: 'INVESTIGATING',
            createdBy: 'system',
            createdAt: new Date().toISOString(),
          });

          // Notification
          const workspace = db.getWorkspaceById(service.workspaceId);
          if (workspace) {
            db.addNotification({
              id: crypto.randomUUID(),
              workspaceId: service.workspaceId,
              userId: workspace.ownerId,
              type: 'SERVICE_DOWN',
              title: `Service Down: ${service.name}`,
              message: `Service reached failure threshold (${failureThreshold}). Outage incident created automatically.`,
              isRead: false,
              metadata: { serviceId: service.id, incidentId: incident.id },
              createdAt: new Date().toISOString(),
            });
          }

          realtime.broadcast({
            type: 'INCIDENT_CREATED',
            data: incident,
            timestamp: new Date().toISOString(),
          });
        }
      } else if (!allFailed && service.status === 'DOWN') {
        // Recovery detected
        newStatus = 'OPERATIONAL';

        // Auto-resolve any active incident
        const activeIncident = db.getActiveIncidentForService(service.id);
        if (activeIncident) {
          db.updateIncident(activeIncident.id, {
            status: 'RESOLVED',
            resolvedAt: new Date().toISOString(),
          });

          db.addIncidentUpdate({
            id: crypto.randomUUID(),
            incidentId: activeIncident.id,
            message: `Service recovered. Endpoint responded with status ${latestCheck.httpStatusCode || 200} in ${latestCheck.responseTimeMs || 0}ms. Auto-resolved.`,
            status: 'RESOLVED',
            createdBy: 'system',
            createdAt: new Date().toISOString(),
          });

          realtime.broadcast({
            type: 'INCIDENT_RESOLVED',
            data: { ...activeIncident, status: 'RESOLVED' },
            timestamp: new Date().toISOString(),
          });
        }

        // Notification
        const workspace = db.getWorkspaceById(service.workspaceId);
        if (workspace) {
          db.addNotification({
            id: crypto.randomUUID(),
            workspaceId: service.workspaceId,
            userId: workspace.ownerId,
            type: 'SERVICE_RECOVERED',
            title: `Service Recovered: ${service.name}`,
            message: `Service is now operational. Latency: ${latestCheck.responseTimeMs}ms.`,
            isRead: false,
            metadata: { serviceId: service.id },
            createdAt: new Date().toISOString(),
          });
        }
      }
    } else if (latestCheck.status === 'UP' && service.status === 'DOWN') {
      newStatus = 'OPERATIONAL';
    }

    const updatedService = db.updateService(service.id, {
      status: newStatus,
      lastCheckedAt: latestCheck.checkedAt,
      lastResponseTimeMs: latestCheck.responseTimeMs,
      lastHttpStatusCode: latestCheck.httpStatusCode,
      uptimePercentage,
    });

    if (newStatus !== service.status) {
      realtime.broadcast({
        type: 'SERVICE_STATUS_CHANGED',
        data: {
          serviceId: service.id,
          previousStatus: service.status,
          newStatus,
          service: updatedService,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const monitoringWorker = new MonitoringWorker();
