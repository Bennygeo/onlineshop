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
    },
    today: {
      revenue: 0,
      orders: 0,
      pending: 0,
      customers: 0
    },
    expenses: {
      procurement: 0,
      rent: 0,
      delivery: 0,
      other: 0
    }
  };

  // Editable expense fields
  expenseInputs: any = {
    procurement: 0,
    rent: 0,
    delivery: 0,
    other: 0
  };

  editingExpense: string = '';
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
          // Sync expense inputs with loaded data
          if (res.expenses) {
            this.expenseInputs = { ...res.expenses };
          }
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get todayTotalExpenses(): number {
    return (this.dashboardData.expenses?.procurement || 0) +
           (this.dashboardData.expenses?.rent || 0) +
           (this.dashboardData.expenses?.delivery || 0) +
           (this.dashboardData.expenses?.other || 0);
  }

  get todayProfit(): number {
    return (this.dashboardData.today?.revenue || 0) - this.todayTotalExpenses;
  }

  startEditExpense(type: string) {
    this.editingExpense = type;
  }

  saveExpense(type: string) {
    const amount = Number(this.expenseInputs[type] || 0);
    this.apiS.postApi('admin/save_expense.php', {
      data: JSON.stringify({
        expense_type: type,
        amount: amount,
        expense_date: new Date().toISOString().split('T')[0]
      })
    }).subscribe({
      next: () => {
        this.dashboardData.expenses[type] = amount;
        this.editingExpense = '';
      },
      error: () => {
        this.editingExpense = '';
      }
    });
  }

  cancelEditExpense() {
    this.editingExpense = '';
    // Reset inputs to saved values
    if (this.dashboardData.expenses) {
      this.expenseInputs = { ...this.dashboardData.expenses };
    }
  }
}
