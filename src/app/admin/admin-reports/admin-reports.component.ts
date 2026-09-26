import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';

export interface ReportSummary {
  fromDate: string;
  toDate: string;
  totalRevenue: number;
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  placedOrders: number;
  avgOrderValue: number;
  totalCost: number;
  estimatedMargin: number;
  marginPercentage: number;
}

export interface DailySalesItem {
  date: string;
  ordersCount: number;
  regularOrders: number;
  subscriptionOrders: number;
  revenue: number;
  cost: number;
  margin: number;
  deliveredCount: number;
  cancelledCount: number;
}

export interface ProductReportItem {
  id: string;
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
  cost: number;
  margin: number;
  marginPercentage: number;
  avgPrice: number;
  ordersCount: number;
}

export interface DeliveryPartnerItem {
  partnerName: string;
  totalAssigned: number;
  delivered: number;
  pending: number;
  cancelled: number;
  completionRate: number;
  totalValue: number;
}

export interface PaymentMethodItem {
  method: string;
  count: number;
  amount: number;
}

@Component({
  selector: 'app-admin-reports',
  templateUrl: './admin-reports.component.html',
  styleUrls: ['./admin-reports.component.scss']
})
export class AdminReportsComponent implements OnInit {
  // Date Range state
  selectedPreset: string = 'month'; // 'today' | 'yesterday' | 'week' | 'month' | '30days' | 'custom'
  fromDate: string = '';
  toDate: string = '';

  // Filter state
  statusFilter: string = 'ALL'; // 'ALL' | 'DELIVERED' | 'CANCELLED' | 'PLACED'
  orderTypeFilter: string = 'ALL'; // 'ALL' | 'regular' | 'subscription'
  searchQuery: string = '';

  // Tab state
  activeTab: 'sales' | 'products' | 'delivery' | 'payments' | 'orders' = 'sales';

  // Loading & Data state
  loading: boolean = false;
  summary: ReportSummary = {
    fromDate: '',
    toDate: '',
    totalRevenue: 0,
    totalOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    placedOrders: 0,
    avgOrderValue: 0,
    totalCost: 0,
    estimatedMargin: 0,
    marginPercentage: 0
  };

  salesTrend: DailySalesItem[] = [];
  products: ProductReportItem[] = [];
  deliveryPartners: DeliveryPartnerItem[] = [];
  paymentMethods: PaymentMethodItem[] = [];
  orders: any[] = [];

  constructor(private apiS: ApiService) {}

  ngOnInit(): void {
    this.selectPreset('month');
  }

  // Format date helper: YYYY-MM-DD
  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  selectPreset(preset: string): void {
    this.selectedPreset = preset;
    const now = new Date();

    if (preset === 'today') {
      const todayStr = this.formatDate(now);
      this.fromDate = todayStr;
      this.toDate = todayStr;
    } else if (preset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yStr = this.formatDate(yesterday);
      this.fromDate = yStr;
      this.toDate = yStr;
    } else if (preset === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 6);
      this.fromDate = this.formatDate(weekAgo);
      this.toDate = this.formatDate(now);
    } else if (preset === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      this.fromDate = this.formatDate(startOfMonth);
      this.toDate = this.formatDate(now);
    } else if (preset === '30days') {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 29);
      this.fromDate = this.formatDate(thirtyDaysAgo);
      this.toDate = this.formatDate(now);
    }

    this.loadReports();
  }

  onCustomDateChange(): void {
    this.selectedPreset = 'custom';
  }

  applyFilters(): void {
    this.loadReports();
  }

  loadReports(): void {
    this.loading = true;
    const payload = {
      from_date: this.fromDate,
      to_date: this.toDate,
      status: this.statusFilter,
      order_type: this.orderTypeFilter
    };

    this.apiS.postApi('admin/get_reports.php', payload).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res && res.summary) {
          this.summary = res.summary;
          this.salesTrend = Array.isArray(res.salesTrend) ? res.salesTrend : [];
          this.products = Array.isArray(res.products) ? res.products : [];
          this.deliveryPartners = Array.isArray(res.deliveryPartners) ? res.deliveryPartners : [];
          this.paymentMethods = Array.isArray(res.paymentMethods) ? res.paymentMethods : [];
          this.orders = Array.isArray(res.orders) ? res.orders : [];
        } else {
          // Fallback if backend returns unexpected structure
          this.fallbackFromOrders();
        }
      },
      error: () => {
        // Fallback to reading orders directly
        this.fallbackFromOrders();
      }
    });
  }

  // Fallback calculation in frontend in case backend get_reports.php fails or returns 404
  private fallbackFromOrders(): void {
    this.apiS.postApi('admin/get_all_orders.php').subscribe({
      next: (allOrders: any[]) => {
        this.loading = false;
        if (!Array.isArray(allOrders)) {
          return;
        }

        const fromTs = new Date(this.fromDate + 'T00:00:00').getTime();
        const toTs = new Date(this.toDate + 'T23:59:59').getTime();

        const filtered = allOrders.filter(ord => {
          const ordDate = ord.created_at || ord.delivery_date;
          if (!ordDate) return true;
          const t = new Date(ordDate).getTime();
          if (t < fromTs || t > toTs) return false;

          if (this.statusFilter !== 'ALL' && (ord.status || '').toUpperCase() !== this.statusFilter) {
            return false;
          }
          if (this.orderTypeFilter !== 'ALL' && (ord.order_type || '').toLowerCase() !== this.orderTypeFilter) {
            return false;
          }
          return true;
        });

        let totalRev = 0;
        let delivered = 0;
        let cancelled = 0;
        let placed = 0;
        const pMap: any = {};
        const dMap: any = {};
        const dailyMap: any = {};

        filtered.forEach(o => {
          const amt = parseFloat(o.amount || o.total_amount || 0);
          const st = (o.status || 'PLACED').toUpperCase();

          if (st === 'DELIVERED') delivered++;
          else if (st === 'CANCELLED') cancelled++;
          else placed++;

          if (st !== 'CANCELLED') {
            totalRev += amt;
          }

          // Daily trend
          const dStr = o.created_at ? o.created_at.split(' ')[0] : (o.delivery_date || 'Unknown');
          if (!dailyMap[dStr]) {
            dailyMap[dStr] = {
              date: dStr,
              ordersCount: 0,
              regularOrders: 0,
              subscriptionOrders: 0,
              revenue: 0,
              cost: 0,
              margin: 0,
              deliveredCount: 0,
              cancelledCount: 0
            };
          }
          dailyMap[dStr].ordersCount++;
          if (o.order_type === 'subscription') dailyMap[dStr].subscriptionOrders++;
          else dailyMap[dStr].regularOrders++;
          if (st === 'DELIVERED') dailyMap[dStr].deliveredCount++;
          if (st === 'CANCELLED') dailyMap[dStr].cancelledCount++;
          if (st !== 'CANCELLED') {
            dailyMap[dStr].revenue += amt;
            dailyMap[dStr].cost += (amt * 0.7);
            dailyMap[dStr].margin += (amt * 0.3);
          }

          // Products
          if (Array.isArray(o.items)) {
            o.items.forEach((item: any) => {
              const pid = item.id || item.product_id || 'PROD';
              const pname = item.name || item.product_name || 'Product';
              const qty = Number(item.quantity) || 1;
              const price = parseFloat(item.price || 0);
              const cost = parseFloat(item.stock_price || (price * 0.7));

              if (!pMap[pid]) {
                pMap[pid] = {
                  id: pid,
                  name: pname,
                  category: item.category || 'General',
                  unitsSold: 0,
                  revenue: 0,
                  cost: 0,
                  margin: 0,
                  marginPercentage: 0,
                  avgPrice: price,
                  ordersCount: 0
                };
              }
              if (st !== 'CANCELLED') {
                pMap[pid].unitsSold += qty;
                pMap[pid].revenue += (price * qty);
                pMap[pid].cost += (cost * qty);
                pMap[pid].margin = pMap[pid].revenue - pMap[pid].cost;
                pMap[pid].marginPercentage = pMap[pid].revenue > 0 ? (pMap[pid].margin / pMap[pid].revenue) * 100 : 0;
                pMap[pid].ordersCount++;
              }
            });
          }

          // Delivery Partners
          const dBoy = o.assigned_to ? o.assigned_to.trim() : 'Unassigned';
          if (!dMap[dBoy]) {
            dMap[dBoy] = {
              partnerName: dBoy,
              totalAssigned: 0,
              delivered: 0,
              pending: 0,
              cancelled: 0,
              completionRate: 0,
              totalValue: 0
            };
          }
          dMap[dBoy].totalAssigned++;
          dMap[dBoy].totalValue += amt;
          if (st === 'DELIVERED') dMap[dBoy].delivered++;
          else if (st === 'CANCELLED') dMap[dBoy].cancelled++;
          else dMap[dBoy].pending++;
          dMap[dBoy].completionRate = dMap[dBoy].totalAssigned > 0 ? (dMap[dBoy].delivered / dMap[dBoy].totalAssigned) * 100 : 0;
        });

        const validCount = filtered.length - cancelled;
        const estCost = totalRev * 0.70;
        const margin = totalRev - estCost;

        this.summary = {
          fromDate: this.fromDate,
          toDate: this.toDate,
          totalRevenue: Math.round(totalRev * 100) / 100,
          totalOrders: filtered.length,
          deliveredOrders: delivered,
          cancelledOrders: cancelled,
          placedOrders: placed,
          avgOrderValue: validCount > 0 ? Math.round((totalRev / validCount) * 100) / 100 : 0,
          totalCost: Math.round(estCost * 100) / 100,
          estimatedMargin: Math.round(margin * 100) / 100,
          marginPercentage: totalRev > 0 ? Math.round((margin / totalRev) * 1000) / 10 : 0
        };

        this.salesTrend = Object.values(dailyMap).sort((a: any, b: any) => a.date.localeCompare(b.date)) as DailySalesItem[];
        this.products = Object.values(pMap).sort((a: any, b: any) => b.revenue - a.revenue) as ProductReportItem[];
        this.deliveryPartners = Object.values(dMap).sort((a: any, b: any) => b.totalAssigned - a.totalAssigned) as DeliveryPartnerItem[];
        this.orders = filtered;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  // Filtered products list based on search query
  get filteredProducts(): ProductReportItem[] {
    if (!this.searchQuery) return this.products;
    const q = this.searchQuery.toLowerCase();
    return this.products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.category.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  }

  // Filtered orders list based on search query
  get filteredOrders(): any[] {
    if (!this.searchQuery) return this.orders;
    const q = this.searchQuery.toLowerCase();
    return this.orders.filter(o => 
      (o.order_id && o.order_id.toLowerCase().includes(q)) ||
      (o.mobile && o.mobile.includes(q)) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
      (o.assigned_to && o.assigned_to.toLowerCase().includes(q))
    );
  }

  // Export current active view to CSV
  exportToCsv(): void {
    let csvRows: string[][] = [];
    let filename = `report_${this.activeTab}_${this.fromDate}_to_${this.toDate}.csv`;

    if (this.activeTab === 'sales') {
      csvRows.push(['Date', 'Total Orders', 'Regular Orders', 'Subscription Orders', 'Delivered', 'Cancelled', 'Gross Revenue (INR)', 'Est Cost (INR)', 'Margin (INR)']);
      this.salesTrend.forEach(row => {
        csvRows.push([
          row.date,
          String(row.ordersCount),
          String(row.regularOrders),
          String(row.subscriptionOrders),
          String(row.deliveredCount),
          String(row.cancelledCount),
          row.revenue.toFixed(2),
          row.cost.toFixed(2),
          row.margin.toFixed(2)
        ]);
      });
    } else if (this.activeTab === 'products') {
      csvRows.push(['Product ID', 'Product Name', 'Category', 'Units Sold', 'Orders Count', 'Avg Price (INR)', 'Gross Revenue (INR)', 'Cost (INR)', 'Est Margin (INR)', 'Margin %']);
      this.filteredProducts.forEach(p => {
        csvRows.push([
          p.id,
          `"${p.name.replace(/"/g, '""')}"`,
          p.category,
          String(p.unitsSold),
          String(p.ordersCount),
          p.avgPrice.toFixed(2),
          p.revenue.toFixed(2),
          p.cost.toFixed(2),
          p.margin.toFixed(2),
          `${p.marginPercentage}%`
        ]);
      });
    } else if (this.activeTab === 'delivery') {
      csvRows.push(['Delivery Partner', 'Assigned Orders', 'Delivered', 'Pending', 'Cancelled', 'Completion Rate %', 'Total Order Value (INR)']);
      this.deliveryPartners.forEach(dp => {
        csvRows.push([
          `"${dp.partnerName.replace(/"/g, '""')}"`,
          String(dp.totalAssigned),
          String(dp.delivered),
          String(dp.pending),
          String(dp.cancelled),
          `${dp.completionRate}%`,
          dp.totalValue.toFixed(2)
        ]);
      });
    } else if (this.activeTab === 'payments') {
      csvRows.push(['Payment Method', 'Transactions Count', 'Total Amount (INR)']);
      this.paymentMethods.forEach(pm => {
        csvRows.push([
          pm.method,
          String(pm.count),
          pm.amount.toFixed(2)
        ]);
      });
    } else if (this.activeTab === 'orders') {
      csvRows.push(['Order ID', 'Date', 'Customer Mobile', 'Type', 'Status', 'Payment Mode', 'Assigned Partner', 'Amount (INR)']);
      this.filteredOrders.forEach(o => {
        csvRows.push([
          o.order_id,
          o.created_at || o.delivery_date || '',
          o.mobile || '',
          o.order_type || 'regular',
          o.status || '',
          o.payment_mode || 'Cash on Delivery',
          `"${(o.assigned_to || 'Unassigned').replace(/"/g, '""')}"`,
          (o.amount || 0).toFixed(2)
        ]);
      });
    }

    // Build CSV content
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Print current report
  printReport(): void {
    window.print();
  }
}
