import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  role: string;
}

export interface AdminLoginResponse {
  status: string;
  message?: string;
  token?: string;
  user?: AdminUser;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminAuthService {
  private readonly TOKEN_KEY = 'tnkspt_admin_token';
  private readonly USER_KEY = 'tnkspt_admin_user';

  private currentUserSubject = new BehaviorSubject<AdminUser | null>(this.getStoredUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasValidSession());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  public get currentUserValue(): AdminUser | null {
    return this.currentUserSubject.value;
  }

  public isAuthenticated(): boolean {
    return this.hasValidSession();
  }

  private hasValidSession(): boolean {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const user = localStorage.getItem(this.USER_KEY);
    return !!(token && user);
  }

  private getStoredUser(): AdminUser | null {
    try {
      const userStr = localStorage.getItem(this.USER_KEY);
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  login(credentials: { username: string; password: string }): Observable<AdminLoginResponse> {
    const url = `${environment.url}admin/login.php`;
    return this.http.post<AdminLoginResponse>(url, credentials).pipe(
      tap((res) => {
        if (res && res.status === 'SUCCESS' && res.token && res.user) {
          localStorage.setItem(this.TOKEN_KEY, res.token);
          localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
          this.isAuthenticatedSubject.next(true);
        }
      }),
      catchError((error) => {
        const errorMsg = error?.error?.error || error?.message || 'Login failed. Please check credentials.';
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/admin/login']);
  }
}
