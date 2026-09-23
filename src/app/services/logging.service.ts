import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

export interface ClientLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  message: string;
  stack?: string;
  component?: string;
  url: string;
  user?: any;
  extra?: any;
}

@Injectable({
  providedIn: 'root'
})
export class LoggingService {

  private readonly maxMemoryLogs = 50;
  private readonly maxStoredLogs = 20;
  private readonly throttleWindowMs = 15000; // 15 seconds deduplication window
  private recentThrottleMap = new Map<string, number>();

  public inMemoryLogs: ClientLogEntry[] = [];

  constructor() {
    this.loadFromStorage();
  }

  info(message: string, extra?: any): void {
    this.recordLog('INFO', message, undefined, extra);
    console.info(`[TomorrowNeeds INFO] ${message}`, extra || '');
  }

  warn(message: string, extra?: any): void {
    this.recordLog('WARN', message, undefined, extra);
    console.warn(`[TomorrowNeeds WARN] ${message}`, extra || '');
  }

  error(message: string, errorObj?: any, component?: string, extra?: any): void {
    const stack = errorObj?.stack || (typeof errorObj === 'string' ? errorObj : undefined);
    const resolvedMsg = errorObj?.message ? `${message}: ${errorObj.message}` : message;

    this.recordLog('ERROR', resolvedMsg, stack, extra, component);
    console.error(`[TomorrowNeeds ERROR] ${resolvedMsg}`, errorObj || '', extra || '');

    // Send error telemetry to backend
    this.sendToBackend({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: resolvedMsg,
      stack,
      component,
      url: window.location.href,
      user: this.getCurrentUser(),
      extra
    });
  }

  logHttpError(url: string, status: number, statusText: string, errorBody?: any): void {
    // Avoid recursion if logging endpoint itself fails
    if (url.includes('log_client_error.php')) {
      return;
    }

    const message = `HTTP ${status} ${statusText} on ${url}`;
    const extra = { status, statusText, errorBody };

    this.recordLog('ERROR', message, undefined, extra, 'HttpInterceptor');
    console.error(`[TomorrowNeeds HTTP Error] ${message}`, errorBody);

    this.sendToBackend({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message,
      component: 'HttpInterceptor',
      url: window.location.href,
      user: this.getCurrentUser(),
      extra
    });
  }

  getLogs(): ClientLogEntry[] {
    return [...this.inMemoryLogs];
  }

  clearLogs(): void {
    this.inMemoryLogs = [];
    try {
      localStorage.removeItem('thinkspot_client_errors');
    } catch (_) {}
  }

  private recordLog(level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL', message: string, stack?: string, extra?: any, component?: string): void {
    const entry: ClientLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      stack,
      component,
      url: window.location.href,
      user: this.getCurrentUser(),
      extra
    };

    // Ring buffer
    this.inMemoryLogs.unshift(entry);
    if (this.inMemoryLogs.length > this.maxMemoryLogs) {
      this.inMemoryLogs.pop();
    }

    if (level === 'ERROR' || level === 'CRITICAL') {
      this.saveToStorage(entry);
    }
  }

  private sendToBackend(entry: ClientLogEntry): void {
    // Rate limit duplicate errors
    const throttleKey = `${entry.message}_${entry.component || ''}`;
    const now = Date.now();
    const lastSent = this.recentThrottleMap.get(throttleKey);

    if (lastSent && (now - lastSent) < this.throttleWindowMs) {
      return; // Skip duplicate
    }
    this.recentThrottleMap.set(throttleKey, now);

    const endpoint = `${environment.url}logs/log_client_error.php`;
    const payload = JSON.stringify(entry);

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true
        }).catch(() => {
          // Fail silently to prevent cascade
        });
      }
    } catch (_) {
      // Fail silently
    }
  }

  private getCurrentUser(): any {
    try {
      const userStr = localStorage.getItem('thinkspot_user') || localStorage.getItem('user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        return {
          mobile: parsed.mobile || parsed.phone || undefined,
          id: parsed.id || parsed.user_id || undefined,
          name: parsed.name || undefined
        };
      }
    } catch (_) {}
    return null;
  }

  private saveToStorage(entry: ClientLogEntry): void {
    try {
      const existingStr = localStorage.getItem('thinkspot_client_errors');
      let list: ClientLogEntry[] = existingStr ? JSON.parse(existingStr) : [];
      list.unshift(entry);
      if (list.length > this.maxStoredLogs) {
        list = list.slice(0, this.maxStoredLogs);
      }
      localStorage.setItem('thinkspot_client_errors', JSON.stringify(list));
    } catch (_) {}
  }

  private loadFromStorage(): void {
    try {
      const existingStr = localStorage.getItem('thinkspot_client_errors');
      if (existingStr) {
        const list: ClientLogEntry[] = JSON.parse(existingStr);
        this.inMemoryLogs = [...list];
      }
    } catch (_) {}
  }
}
