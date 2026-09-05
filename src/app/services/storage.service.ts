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
    this.ourStorage.setItem(key, JSON.stringify(value));
  }
  public getItem(key: string): any {
    return this.ourStorage.getItem(key) ? JSON.parse(this.ourStorage.getItem(key)) : undefined;
  }
  removeItem(key: string) {
    this.ourStorage.removeItem(key);
  }
  clear(): void {
    this.ourStorage.clear();
  }
}