import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  dashboardData: any = {
    totalRevenue: 0,
    totalOrders: 0,
    pendingDeliveries: 0,
    activeCustomers: 0,
    statusBreakdown: {
      PLACED: 0,
      PACKED: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      CANCELLED: 0
    }
  };

  loading: boolean = true;

  constructor(private apiS: ApiService) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.loading = true;
    this.apiS.postApi('admin/sales_dashboard.php').subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res) {
          this.dashboardData = res;
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
