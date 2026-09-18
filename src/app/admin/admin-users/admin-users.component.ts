import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { LoginService } from '../../services/login.service';
import { AdminAuthService } from '../services/admin-auth.service';

export interface AdminCustomer {
  mobile: string;
  name: string;
  email: string;
  referral_id: string;
  wallet_balance: number;
  total_orders: number;
  total_spent: number;
  last_order_date: string | null;
  created_at: string | null;
  address: string;
  address_details?: any;
}

@Component({
  selector: 'app-admin-users',
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  users: AdminCustomer[] = [];
  filteredUsers: AdminCustomer[] = [];
  loading: boolean = false;
  searchQuery: string = '';
  filterTab: 'ALL' | 'WITH_ORDERS' | 'NO_ORDERS' | 'WITH_WALLET' = 'ALL';
  sortBy: 'RECENT' | 'ORDERS_DESC' | 'WALLET_DESC' | 'NAME_ASC' = 'RECENT';

  // Stats
  totalUsersCount: number = 0;
  activeOrderingUsersCount: number = 0;
  totalLifetimeOrders: number = 0;
  totalWalletLiability: number = 0;

  // Toast / feedback message
  toastMessage: string = '';
  showToast: boolean = false;

  constructor(
    private apiService: ApiService,
    private loginService: LoginService,
    private adminAuthService: AdminAuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fetchUsers();
  }

  fetchUsers(): void {
    this.loading = true;
    this.apiService.getApi('admin/get_users.php').subscribe({
      next: (res: any) => {
        this.loading = false;
        if (Array.isArray(res)) {
          this.users = res.map((u: any) => ({
            mobile: u.mobile || '',
            name: u.name || 'Customer',
            email: u.email || '',
            referral_id: u.referral_id || ('THINK' + (u.mobile ? u.mobile.slice(-6) : '')),
            wallet_balance: Math.round(Number(u.wallet_balance || 0)),
            total_orders: Number(u.total_orders || 0),
            total_spent: Math.round(Number(u.total_spent || 0)),
            last_order_date: u.last_order_date || null,
            created_at: u.created_at || null,
            address: u.address || '',
            address_details: u.address_details || null
          }));
          this.computeStats();
          this.applyFilters();
        } else {
          this.users = [];
          this.filteredUsers = [];
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.users = [];
        this.filteredUsers = [];
        this.triggerToast('Failed to load customers list.');
      }
    });
  }

  computeStats(): void {
    this.totalUsersCount = this.users.length;
    this.activeOrderingUsersCount = this.users.filter(u => u.total_orders > 0).length;
    this.totalLifetimeOrders = this.users.reduce((acc, u) => acc + (u.total_orders || 0), 0);
    this.totalWalletLiability = this.users.reduce((acc, u) => acc + (u.wallet_balance || 0), 0);
  }

  applyFilters(): void {
    let list = [...this.users];

    // 1. Search Query
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(u =>
        u.mobile.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.referral_id.toLowerCase().includes(q) ||
        u.address.toLowerCase().includes(q)
      );
    }

    // 2. Tab Filter
    if (this.filterTab === 'WITH_ORDERS') {
      list = list.filter(u => u.total_orders > 0);
    } else if (this.filterTab === 'NO_ORDERS') {
      list = list.filter(u => u.total_orders === 0);
    } else if (this.filterTab === 'WITH_WALLET') {
      list = list.filter(u => u.wallet_balance > 0);
    }

    // 3. Sorting
    if (this.sortBy === 'ORDERS_DESC') {
      list.sort((a, b) => b.total_orders - a.total_orders);
    } else if (this.sortBy === 'WALLET_DESC') {
      list.sort((a, b) => b.wallet_balance - a.wallet_balance);
    } else if (this.sortBy === 'NAME_ASC') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // RECENT: Sort by last_order_date or created_at
      list.sort((a, b) => {
        const dateA = a.last_order_date || a.created_at || '1970-01-01';
        const dateB = b.last_order_date || b.created_at || '1970-01-01';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
    }

    this.filteredUsers = list;
  }

  setFilterTab(tab: 'ALL' | 'WITH_ORDERS' | 'NO_ORDERS' | 'WITH_WALLET'): void {
    this.filterTab = tab;
    this.applyFilters();
  }

  setSortBy(sort: 'RECENT' | 'ORDERS_DESC' | 'WALLET_DESC' | 'NAME_ASC'): void {
    this.sortBy = sort;
    this.applyFilters();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  /**
   * Log in / Impersonate Customer and navigate to storefront for Offline Order Placement
   */
  loginAsCustomer(user: AdminCustomer): void {
    if (!user.mobile) {
      alert('Cannot place order: Customer mobile number is missing.');
      return;
    }

    const currentAdmin = this.adminAuthService.currentUserValue?.displayName ||
      this.adminAuthService.currentUserValue?.username ||
      'Store Admin';

    // Activate customer session & admin impersonation mode
    this.loginService.impersonateCustomer(user.mobile, user.name, currentAdmin);

    this.triggerToast(`⚡ Entering Offline Order Mode for ${user.name} (${user.mobile})...`);

    // Navigate to customer storefront catalog
    setTimeout(() => {
      this.router.navigate(['/home/view']);
    }, 400);
  }

  copyToClipboard(text: string, label: string = 'Copied'): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.triggerToast(`${label} copied to clipboard!`);
    }).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      this.triggerToast(`${label} copied!`);
    });
  }

  triggerToast(msg: string): void {
    this.toastMessage = msg;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
    }, 3500);
  }
}
