import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminAuthService, AdminUser } from './services/admin-auth.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  mobileMenuOpen: boolean = false;
  isProductsNavOpen: boolean = true;
  currentUser: AdminUser | null = null;

  constructor(
    public router: Router,
    private authService: AdminAuthService
  ) {
    let loadingEl = document.getElementById("loading");
    if (loadingEl) loadingEl.remove();
  }

  toggleProductsNav(): void {
    this.isProductsNavOpen = !this.isProductsNavOpen;
  }

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen = false;
  }

  logout(): void {
    this.closeMobileMenu();
    this.authService.logout();
  }
}
