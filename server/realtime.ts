import { Response } from 'express';
import { RealtimeEventPayload } from './types';

class RealtimeManager {
  private clients: Set<Response> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  public registerClient(res: Response) {
    this.clients.add(res);

    // Initial connection welcome
    this.sendEventToClient(res, {
      type: 'HEARTBEAT',
      data: { message: 'Connected to Statusmith Realtime Stream', clientCount: this.clients.size },
      timestamp: new Date().toISOString(),
    });

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.clients.size > 0) {
        this.broadcast({
          type: 'HEARTBEAT',
          data: { timestamp: Date.now() },
          timestamp: new Date().toISOString(),
        });
      }
    }, 15000);
  }

  public broadcast(payload: RealtimeEventPayload) {
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(message);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  private sendEventToClient(client: Response, payload: RealtimeEventPayload) {
    try {
      client.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      this.clients.delete(client);
    }
  }

  public getConnectedCount(): number {
    return this.clients.size;
  }
}

export const realtime = new RealtimeManager();
