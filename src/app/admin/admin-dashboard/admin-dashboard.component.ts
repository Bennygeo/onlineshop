import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  // Payment methods control
  enableRazorpay: boolean = true;
  enableCod: boolean = true;
  paymentSettingsLoading: boolean = false;
  paymentSettingsSaving: string = '';
  paymentSuccessToast: string = '';

  // Period filter
  selectedPeriod: string = 'lifetime';
  customStartDate: string = '';
  customEndDate: string = '';
  showCustomDatePicker: boolean = false;

  // Active sub-tab for deep dive sections (e.g. 'overview', 'products', 'marketing', 'expenses')
  activeAnalyticsTab: string = 'overview';

  dashboardData: any = {
    period: 'lifetime',
    periodLabel: 'Lifetime (All Time)',
    totalRevenue: 0,
    totalOrders: 0,
    aov: 0,
    totalExpenses: 0,
    totalRefunds: 0,
    totalRefundCount: 0,
    totalPromoDiscounts: 0,
    totalPromoCount: 0,
    totalReferralBonuses: 0,
    totalReferralCount: 0,
    totalProfit: 0,
    profitMargin: 0,
    totalWalletBalance: 0,
    totalLedgerBalance: 0,
    pendingDeliveries: 0,
    activeCustomers: 0,
    repeatCustomerRate: 0,
    statusBreakdown: {
      PLACED: 0,
      PACKED: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      CANCELLED: 0
    },
    paymentBreakdown: {
      COD: { count: 0, amount: 0 },
      ONLINE: { count: 0, amount: 0 },
      WALLET: { count: 0, amount: 0 },
      OFFLINE: { count: 0, amount: 0 }
    },
    topProducts: [],
    categoryBreakdown: [],
    dailyTrend: [],
    recentOrders: [],
    today: {
      date: '',
      revenue: 0,
      orders: 0,
      aov: 0,
      refunds: 0,
      refundCount: 0,
      promoDiscounts: 0,
      promoCount: 0,
      referralBonuses: 0,
      referralCount: 0,
      walletCredit: 0,
      walletCreditCount: 0,
      walletDebit: 0,
      walletDebitCount: 0,
      pending: 0,
      customers: 0,
      profit: 0
    },
    promoBreakdown: [],
    recentPromoOrders: [],
    recentReferralBonuses: [],
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

  constructor(
    private apiS: ApiService,
    public cartS: CartService
  ) {
    const today = new Date().toISOString().split('T')[0];
    this.customStartDate = today;
    this.customEndDate = today;
  }

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadPaymentSettings();
  }

  loadPaymentSettings() {
    this.paymentSettingsLoading = true;
    this.apiS.getApi('admin/store_settings.php').subscribe({
      next: (res: any) => {
        this.paymentSettingsLoading = false;
        const s = res?.settings || res;
        if (s) {
          this.enableRazorpay = (s.enable_razorpay !== '0' && s.enable_razorpay !== false);
          this.enableCod = (s.enable_cod !== '0' && s.enable_cod !== false);
        }
      },
      error: () => {
        this.paymentSettingsLoading = false;
      }
    });
  }

  togglePaymentSetting(method: 'razorpay' | 'cod') {
    if (this.paymentSettingsSaving) return;

    const targetState = method === 'razorpay' ? !this.enableRazorpay : !this.enableCod;
    this.paymentSettingsSaving = method;

    const key = method === 'razorpay' ? 'enable_razorpay' : 'enable_cod';
    const val = targetState ? '1' : '0';

    const payload: any = {
      key: key,
      value: val
    };
    payload[key] = val;

    this.apiS.postApi('admin/store_settings.php', payload).subscribe({
      next: () => {
        this.paymentSettingsSaving = '';
        if (method === 'razorpay') {
          this.enableRazorpay = targetState;
          this.cartS.enableRazorpay = targetState;
          if (this.cartS.storeSettings) {
            this.cartS.storeSettings['enable_razorpay'] = val;
          }
        } else {
          this.enableCod = targetState;
          this.cartS.enableCod = targetState;
          if (this.cartS.storeSettings) {
            this.cartS.storeSettings['enable_cod'] = val;
          }
        }
        this.cartS.storeSettingsUpdateEvent.next(this.cartS.storeSettings);

        const methodLabel = method === 'razorpay' ? 'Razorpay (Online & Wallet)' : 'Cash on Delivery (COD)';
        this.paymentSuccessToast = `${methodLabel} is now ${targetState ? 'ENABLED' : 'DISABLED'} for storefront customers.`;
        setTimeout(() => {
          this.paymentSuccessToast = '';
        }, 4000);
      },
      error: () => {
        this.paymentSettingsSaving = '';
        alert('Failed to save payment setting. Please try again.');
      }
    });
  }

  changePeriod(period: string) {
    this.selectedPeriod = period;
    if (period === 'custom') {
      this.showCustomDatePicker = true;
      return;
    }
    this.showCustomDatePicker = false;
    this.loadDashboardData();
  }

  applyCustomDateRange() {
    if (!this.customStartDate || !this.customEndDate) {
      alert('Please select both start and end dates.');
      return;
    }
    this.selectedPeriod = 'custom';
    this.loadDashboardData();
  }

  loadDashboardData() {
    this.loading = true;
    const payload: any = {
      period: this.selectedPeriod
    };
    if (this.selectedPeriod === 'custom') {
      payload.start_date = this.customStartDate;
      payload.end_date = this.customEndDate;
    }

    this.apiS.postApi('admin/sales_dashboard.php', payload).subscribe({
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

  get maxDailyRevenue(): number {
    if (!this.dashboardData.dailyTrend || this.dashboardData.dailyTrend.length === 0) return 1;
    return Math.max(...this.dashboardData.dailyTrend.map((d: any) => Number(d.revenue) || 0), 1);
  }

  get totalPaymentAmount(): number {
    const pb = this.dashboardData.paymentBreakdown;
    if (!pb) return 1;
    return (pb.COD?.amount || 0) + (pb.ONLINE?.amount || 0) + (pb.WALLET?.amount || 0) + (pb.OFFLINE?.amount || 0) || 1;
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
        if (!this.dashboardData.expenses) {
          this.dashboardData.expenses = {};
        }
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
