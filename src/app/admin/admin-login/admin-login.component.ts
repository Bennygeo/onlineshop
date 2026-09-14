import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.scss']
})
export class AdminLoginComponent implements OnInit {
  loginForm: FormGroup;
  loading: boolean = false;
  submitted: boolean = false;
  errorMessage: string = '';
  showPassword: boolean = false;
  returnUrl: string = '/admin/dashboard';

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AdminAuthService
  ) {
    // If already authenticated, redirect immediately
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/admin/dashboard']);
    }

    let loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.remove();

    this.loginForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(4)]],
      rememberMe: [true]
    });
  }

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/admin/dashboard';
  }

  get f() {
    return this.loginForm.controls;
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  fillDemoCredentials(): void {
    this.loginForm.patchValue({
      username: 'admin',
      password: 'admin123'
    });
    this.errorMessage = '';
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    const { username, password } = this.loginForm.value;

    this.authService.login({ username, password }).subscribe({
      next: (res) => {
        this.loading = false;
        if (res && res.status === 'SUCCESS') {
          this.router.navigateByUrl(this.returnUrl);
        } else {
          this.errorMessage = res?.error || 'Invalid credentials. Please try again.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.message || 'Login failed. Please verify username and password.';
      }
    });
  }
}
