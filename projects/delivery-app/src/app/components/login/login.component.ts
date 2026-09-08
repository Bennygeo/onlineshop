import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  loading = false;
  errorMessage = '';

  demoPartners = [
    { username: 'delivery1', name: 'Ramesh Kumar', zone: 'Zone A (North)' },
    { username: 'delivery2', name: 'Suresh Raj', zone: 'Zone B (South)' },
    { username: 'delivery3', name: 'Karthik P', zone: 'Zone C (East)' },
    { username: 'delivery4', name: 'Vignesh M', zone: 'Zone D (West)' },
    { username: 'delivery5', name: 'Manikandan S', zone: 'Zone E (Central)' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated) {
      this.router.navigate(['/portal']);
    }
  }

  fillDemo(u: string): void {
    this.username = u;
    this.password = 'partner123';
    this.errorMessage = '';
  }

  onSubmit(): void {
    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage = 'Please enter both username and password';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authService.login(this.username.trim(), this.password.trim()).subscribe({
      next: (res) => {
        this.loading = false;
        if (res && res.status === 'SUCCESS') {
          this.router.navigate(['/portal']);
        } else {
          this.errorMessage = res?.error || 'Invalid credentials. Please try again.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.error || 'Unable to connect to server. Please ensure backend is running.';
      }
    });
  }
}
