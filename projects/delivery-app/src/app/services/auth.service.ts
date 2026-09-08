import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { DeliveryPartner } from '../models/delivery';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentPartnerSubject = new BehaviorSubject<DeliveryPartner | null>(null);
  public currentPartner$ = this.currentPartnerSubject.asObservable();

  constructor(private api: ApiService, private router: Router) {
    const saved = localStorage.getItem('tnkspt_partner_auth');
    if (saved) {
      try {
        const partner = JSON.parse(saved);
        this.currentPartnerSubject.next(partner);
      } catch (e) {
        localStorage.removeItem('tnkspt_partner_auth');
      }
    }
  }

  public get currentPartner(): DeliveryPartner | null {
    return this.currentPartnerSubject.value;
  }

  public get isAuthenticated(): boolean {
    return !!this.currentPartnerSubject.value;
  }

  login(username: string, password: string):Observable<any> {
    return this.api.post<any>('delivery/partner_login.php', { username, password }).pipe(
      tap(res => {
        if (res && res.status === 'SUCCESS' && res.partner) {
          localStorage.setItem('tnkspt_partner_auth', JSON.stringify(res.partner));
          if (res.token) {
            localStorage.setItem('tnkspt_partner_token', res.token);
          }
          this.currentPartnerSubject.next(res.partner);
        }
      })
    );
  }

  logout() {
    localStorage.removeItem('tnkspt_partner_auth');
    localStorage.removeItem('tnkspt_partner_token');
    this.currentPartnerSubject.next(null);
    this.router.navigate(['/login']);
  }
}
