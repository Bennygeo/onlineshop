import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  constructor() { }

  private get ourStorage(): Storage {
    return localStorage;
  }
  public setItem(key: string, value: any) {
    try {
      const seen = new WeakSet();
      const serialized = JSON.stringify(value, (k, v) => {
        if (k === 'changeInProduct') return undefined;
        if (typeof v === 'object' && v !== null) {
          if (v._teardowns || v.observers || (v.closed !== undefined && typeof v.next === 'function')) {
            return undefined;
          }
          if (seen.has(v)) return undefined;
          seen.add(v);
        }
        return v;
      });
      this.ourStorage.setItem(key, serialized);
    } catch (e) {
      console.warn("StorageService setItem warning:", e);
    }
  }
  public getItem(key: string): any {
    try {
      const item = this.ourStorage.getItem(key);
      return item ? JSON.parse(item) : undefined;
    } catch (e) {
      return undefined;
    }
  }
  removeItem(key: string) {
    this.ourStorage.removeItem(key);
  }
  clear(): void {
    this.ourStorage.clear();
  }
}