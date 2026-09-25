import {
  User,
  Workspace,
  Service,
  MonitorCheck,
  Incident,
  IncidentUpdate,
  Maintenance,
  NotificationItem,
  NotificationPrefs,
  StatusPageConfig,
  ActivityLog,
  OverviewAnalytics,
  ServiceAnalytics,
  PublicStatusData,
} from './types';

const API_BASE = '/api/v1';

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('statusmith_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers = { ...this.getHeaders(), ...(options.headers as any) };

    const res = await fetch(url, { ...options, headers });
    const json = await res.json();

    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'API request failed');
    }

    return json.data as T;
  }

  // --- Auth ---
  async login(email: string, password: string) {
    const data = await this.request<{
      user: User;
      workspace: Workspace;
      accessToken: string;
      refreshToken: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('statusmith_token', data.accessToken);
    return data;
  }

  async register(params: {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
    workspaceName?: string;
  }) {
    const data = await this.request<{
      user: User;
      workspace: Workspace;
      accessToken: string;
      refreshToken: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    localStorage.setItem('statusmith_token', data.accessToken);
    return data;
  }

  async getMe() {
    return this.request<{
      user: User;
      workspaces: Workspace[];
      currentWorkspace: Workspace;
    }>('/auth/me');
  }

  logout() {
    localStorage.removeItem('statusmith_token');
  }

  // --- Services ---
  async getServices(params?: { search?: string; status?: string; sortBy?: string; sortOrder?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.sortOrder) query.append('sortOrder', params.sortOrder);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<Service[]>(`/services${qs}`);
  }

  async getService(id: string) {
    return this.request<Service>(`/services/${id}`);
  }

  async createService(data: Partial<Service>) {
    return this.request<Service>('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateService(id: string, data: Partial<Service>) {
    return this.request<Service>(`/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteService(id: string) {
    return this.request<null>(`/services/${id}`, {
      method: 'DELETE',
    });
  }

  async triggerCheck(serviceId: string) {
    return this.request<MonitorCheck>(`/services/${serviceId}/check`, {
      method: 'POST',
    });
  }

  async triggerAllChecks() {
    return this.request<MonitorCheck[]>('/services/check-all', {
      method: 'POST',
    });
  }

  async enableMonitoring(serviceId: string) {
    return this.request<Service>(`/services/${serviceId}/monitoring/enable`, {
      method: 'POST',
    });
  }

  async disableMonitoring(serviceId: string) {
    return this.request<Service>(`/services/${serviceId}/monitoring/disable`, {
      method: 'POST',
    });
  }

  async getServiceChecks(serviceId: string, limit = 50) {
    return this.request<MonitorCheck[]>(`/services/${serviceId}/checks?limit=${limit}`);
  }

  async getServicePerformance(serviceId: string, hours = 24) {
    return this.request<Array<{ time: string; latency: number; status: string; httpStatusCode: number | null }>>(
      `/services/${serviceId}/performance?hours=${hours}`
    );
  }

  // --- Incidents ---
  async getIncidents() {
    return this.request<Incident[]>('/incidents');
  }

  async getIncident(id: string) {
    return this.request<Incident & { updates: IncidentUpdate[] }>(`/incidents/${id}`);
  }

  async createIncident(data: { serviceId: string; title: string; description: string; severity: string }) {
    return this.request<Incident>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addIncidentUpdate(incidentId: string, message: string, status?: string) {
    return this.request<IncidentUpdate>(`/incidents/${incidentId}/updates`, {
      method: 'POST',
      body: JSON.stringify({ message, status }),
    });
  }

  async resolveIncident(incidentId: string, message?: string) {
    return this.request<Incident>(`/incidents/${incidentId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  // --- Maintenance ---
  async getMaintenances() {
    return this.request<Maintenance[]>('/maintenance');
  }

  async createMaintenance(data: {
    title: string;
    description: string;
    serviceIds: string[];
    startAt: string;
    endAt: string;
  }) {
    return this.request<Maintenance>('/maintenance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMaintenance(id: string, data: Partial<Maintenance>) {
    return this.request<Maintenance>(`/maintenance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMaintenance(id: string) {
    return this.request<null>(`/maintenance/${id}`, {
      method: 'DELETE',
    });
  }

  // --- Analytics ---
  async getAnalyticsOverview() {
    return this.request<OverviewAnalytics>('/analytics/overview');
  }

  async getOverviewAnalytics() {
    return this.getAnalyticsOverview();
  }

  async getServiceAnalytics(serviceId: string, days = 30) {
    return this.request<ServiceAnalytics>(`/analytics/services/${serviceId}?days=${days}`);
  }

  // --- Notifications ---
  async getNotifications() {
    return this.request<NotificationItem[]>('/notifications');
  }

  async markNotificationRead(id: string) {
    return this.request<{ read: boolean }>(`/notifications/${id}/read`, {
      method: 'POST',
    });
  }

  async markAllNotificationsRead() {
    return this.request<{ success: boolean }>('/notifications/read-all', {
      method: 'POST',
    });
  }

  async getNotificationPrefs() {
    return this.request<NotificationPrefs>('/notifications/preferences');
  }

  async updateNotificationPrefs(data: Partial<NotificationPrefs>) {
    return this.request<NotificationPrefs>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // --- Status Page ---
  async getStatusPageConfig() {
    return this.request<StatusPageConfig>('/status-pages');
  }

  async updateStatusPageConfig(data: Partial<StatusPageConfig>) {
    return this.request<StatusPageConfig>('/status-pages', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getPublicStatusPage(slug: string) {
    const res = await fetch(`${API_BASE}/public/status/${slug}`);
    const json = await res.json();
    if (!res.ok || json.success === false) {
      throw new Error(json.message || 'Failed to fetch public status page');
    }
    return json.data as PublicStatusData;
  }

  // --- Activity Logs ---
  async getActivityLogs() {
    return this.request<ActivityLog[]>('/activity-logs');
  }
}

export const api = new ApiClient();
