import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';

export interface DateTab {
  dateStr: string;      // 'YYYY-MM-DD' or 'ALL'
  dayLabel: string;     // 'Mon, Sep 7 (Today)', etc.
  dateFormatted: string;
  count: number;
}

export interface DailyPurchaseItem {
  productId: string;
  productName: string;
  imgUrl: string;
  baseWeight: number;
  baseUnit: string;
  baseDisplay: string;         // e.g. "500 grams" or "1 kg"
  basePrice: number;           // Base selling price in products table
  baseStockPrice: number;      // Market purchase / cost price in products table
  editStockPrice: number;      // Editable model for market stock cost
  editSellingPrice: number;    // Editable model for base selling price
  isEditing: boolean;
  isSaving: boolean;
  savedSuccess?: boolean;
  totalWeightInBaseUnit: number;
  totalDisplay: string;        // e.g. "5 kg" or "3 nos"
  unitName: string;            // 'kg', 'ltrs', 'nos'
  formattedDetail: string;     // e.g. "- Tomato - 5kg (1(2), 0.5(6))"
  breakdownSummary: string;
  ordersCount: number;
  totalClientSellingPrice: number; // Total ₹ client paid
  totalMarketCost: number;         // Total ₹ market purchase cost
  profitOrLoss: number;            // totalClientSellingPrice - totalMarketCost
}

@Component({
  selector: 'app-admin-orders',
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit {
  orders: any[] = [];
  deliveryBoys: any[] = [];
  loading: boolean = false;

  activeViewTab: 'orders' | 'purchase_list' = 'orders';

  statusFilter: string = 'ALL';
  orderTypeFilter: string = 'ALL';
  searchQuery: string = '';

  // 7 Days Datewise Tab Selector
  dateTabs: DateTab[] = [];
  selectedDateStr: string = 'ALL';

  // Bulk Selection
  selectedOrderMap: { [orderId: string]: boolean } = {};
  bulkTargetPartner: string = '';
  selectAllChecked: boolean = false;

  // Modal display for Delivery Partners Info
  isPartnersModalOpen: boolean = false;

  // Persistent edit maps for stock cost and selling price
  stockPriceEdits: { [productId: string]: number } = {};
  sellingPriceEdits: { [productId: string]: number } = {};
  savingProductMap: { [productId: string]: boolean } = {};
  savedSuccessMap: { [productId: string]: boolean } = {};

  // Floating Toast Notification
  toastNotification: {
    show: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  } = {
    show: false,
    title: '',
    message: '',
    type: 'success'
  };
  toastTimeout: any = null;

  // Cached purchase summary list and totals (prevents Angular infinite change-detection loops)
  dailyPurchaseList: DailyPurchaseItem[] = [];
  purchaseTotals: {
    count: number;
    totalClientRevenue: number;
    totalMarketCost: number;
    totalProfit: number;
    marginPercent: number;
  } = {
    count: 0,
    totalClientRevenue: 0,
    totalMarketCost: 0,
    totalProfit: 0,
    marginPercent: 0
  };

  showToast(title: string, message: string, type: 'success' | 'error' | 'info' = 'success') {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.toastNotification = {
      show: true,
      title: title,
      message: message,
      type: type
    };
    this.toastTimeout = setTimeout(() => {
      this.toastNotification.show = false;
    }, 4500);
  }

  closeToast() {
    this.toastNotification.show = false;
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  constructor(private apiS: ApiService) {}

  ngOnInit(): void {
    this.generateNext7Days();
    this.loadOrders();
    this.loadDeliveryBoys();
  }

  generateNext7Days() {
    const tabs: DateTab[] = [];
    const today = new Date();

    // Option for All Dates
    tabs.push({
      dateStr: 'ALL',
      dayLabel: 'All Dates',
      dateFormatted: 'All',
      count: 0
    });

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      let label = '';
      if (i === 0) label = 'Today';
      else if (i === 1) label = 'Tomorrow';
      else {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        label = days[d.getDay()];
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dateFormatted = `${monthNames[d.getMonth()]} ${d.getDate()}`;

      tabs.push({
        dateStr: dateStr,
        dayLabel: `${label}, ${dateFormatted}`,
        dateFormatted: dateFormatted,
        count: 0
      });
    }

    this.dateTabs = tabs;
    // Default to All Dates view so all orders show up
    this.selectedDateStr = 'ALL';
  }

  loadOrders() {
    this.loading = true;
    this.apiS.postApi('admin/get_all_orders.php').subscribe({
      next: (res: any) => {
        this.loading = false;
        if (Array.isArray(res)) {
          this.orders = res;
          this.updateDateCounts();
          this.recalculatePurchaseSummary();
        }
      },
      error: () => { this.loading = false; }
    });
  }

  loadDeliveryBoys() {
    this.apiS.postApi('admin/get_delivery_boys.php').subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.deliveryBoys = res;
        }
      }
    });
  }

  updateDateCounts() {
    this.dateTabs.forEach(tab => {
      if (tab.dateStr === 'ALL') {
        tab.count = this.orders.length;
      } else {
        tab.count = this.orders.filter(o => {
          if (o.delivery_date === tab.dateStr) return true;
          if (Array.isArray(o.delivery_dates) && o.delivery_dates.includes(tab.dateStr)) return true;
          return false;
        }).length;
      }
    });
  }

  selectDateTab(dateStr: string) {
    this.selectedDateStr = dateStr;
    this.selectedOrderMap = {};
    this.selectAllChecked = false;
    this.recalculatePurchaseSummary();
  }

  switchViewTab(tab: 'orders' | 'purchase_list') {
    this.activeViewTab = tab;
    if (tab === 'purchase_list') {
      this.recalculatePurchaseSummary();
    }
  }

  toggleExpand(order: any, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    order.expanded = !order.expanded;
  }

  get filteredOrders() {
    let list = this.orders;

    // Filter by Date
    if (this.selectedDateStr !== 'ALL') {
      list = list.filter(o => {
        if (o.delivery_date === this.selectedDateStr) return true;
        if (Array.isArray(o.delivery_dates) && o.delivery_dates.includes(this.selectedDateStr)) return true;
        return false;
      });
    }

    // Filter by Status
    if (this.statusFilter !== 'ALL') {
      list = list.filter(o => String(o.status).toUpperCase() === this.statusFilter);
    }

    // Filter by Order Type (regular vs subscription)
    if (this.orderTypeFilter !== 'ALL') {
      list = list.filter(o => (o.order_type || 'regular').toLowerCase() === this.orderTypeFilter.toLowerCase());
    }

    // Search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(o => {
        const idMatch = String(o.order_id || o.id || '').toLowerCase().includes(q);
        const mobMatch = String(o.mobile || '').toLowerCase().includes(q);
        const addrStr = typeof o.address === 'object' ? JSON.stringify(o.address).toLowerCase() : String(o.address || '').toLowerCase();
        return idMatch || mobMatch || addrStr.includes(q);
      });
    }

    return list;
  }

  toggleSelectAll(event: any) {
    const isChecked = event.target.checked;
    this.selectAllChecked = isChecked;
    const currentList = this.filteredOrders;
    currentList.forEach(o => {
      const oid = o.order_id || o.id;
      this.selectedOrderMap[oid] = isChecked;
    });
  }

  getSelectedCount(): number {
    return Object.keys(this.selectedOrderMap).filter(k => this.selectedOrderMap[k]).length;
  }

  assignDeliveryBoy(order: any, event: any) {
    const dboyName = event.target.value;
    const oid = order.order_id || order.id;

    this.apiS.postApi('admin/assign_delivery.php', {
      data: JSON.stringify({ order_id: oid, assignedTo: dboyName, status: dboyName ? 'OUT_FOR_DELIVERY' : order.status })
    }).subscribe({
      next: () => {
        order.assigned_to = dboyName;
        if (dboyName && order.status === 'PLACED') {
          order.status = 'OUT_FOR_DELIVERY';
        }
        this.loadDeliveryBoys();
      }
    });
  }

  bulkAssignDelivery() {
    if (!this.bulkTargetPartner) {
      alert("Please select a delivery partner first!");
      return;
    }

    const selectedIds = Object.keys(this.selectedOrderMap).filter(k => this.selectedOrderMap[k]);
    if (selectedIds.length === 0) {
      alert("No orders selected for bulk assignment!");
      return;
    }

    let completed = 0;
    selectedIds.forEach(oid => {
      this.apiS.postApi('admin/assign_delivery.php', {
        data: JSON.stringify({ order_id: oid, assignedTo: this.bulkTargetPartner, status: 'OUT_FOR_DELIVERY' })
      }).subscribe({
        next: () => {
          completed++;
          const order = this.orders.find(o => (o.order_id || o.id) === oid);
          if (order) {
            order.assigned_to = this.bulkTargetPartner;
            order.status = 'OUT_FOR_DELIVERY';
          }
          if (completed === selectedIds.length) {
            alert(`Successfully assigned ${selectedIds.length} orders to ${this.bulkTargetPartner}!`);
            this.selectedOrderMap = {};
            this.selectAllChecked = false;
            this.loadDeliveryBoys();
          }
        }
      });
    });
  }

  updateOrderStatus(order: any, event: any) {
    const newStatus = event.target.value;
    const oid = order.order_id || order.id;
    this.apiS.postApi('admin/assign_delivery.php', {
      data: JSON.stringify({ order_id: oid, status: newStatus })
    }).subscribe({
      next: () => {
        order.status = newStatus;
      }
    });
  }

  openPartnersModal() {
    this.isPartnersModalOpen = true;
  }

  closePartnersModal() {
    this.isPartnersModalOpen = false;
  }

  // Calculate Combined Daily Purchase List & Package Breakdown with Procurement Pricing
  recalculatePurchaseSummary() {
    const currentOrders = this.filteredOrders;
    const productMap: { [key: string]: {
      productId: string;
      name: string;
      imgUrl: string;
      baseWeight: number;
      baseUnit: string;
      baseDisplay: string;
      basePrice: number;
      baseStockPrice: number;
      unitName: string;
      basePackageSize: number;
      totalWeightInBaseUnit: number;
      totalClientSellingPrice: number;
      packageBreakdown: { [sizeLabel: string]: number };
      totalOrders: number;
    }} = {};

    currentOrders.forEach(order => {
      const items = this.getItemsForDate(order);

      items.forEach((it: any) => {
        const pId = it.product_id || it.id || it.name;
        const pName = it.name || it.product_name || 'General Product';
        const imgUrl = it.img_url || 'assets/categories/Thinkspot_veggiesIcon.png';
        const rawUnit = (it.unit_name || it.unit || 'grams').toLowerCase().trim();
        const rawWeight = Number(it.weight || it.quantity || it.units || 1);
        const qty = Number(it.qty || it.quantity || 1);
        const itemLinePrice = Number(it.price || 0);

        let unitName = rawUnit;
        if (rawUnit === 'grams' || rawUnit === 'gram' || rawUnit === 'g') unitName = 'kg';
        else if (rawUnit === 'ltr' || rawUnit === 'liter' || rawUnit === 'liters' || rawUnit === 'ml') unitName = 'ltrs';
        else if (rawUnit === 'pack' || rawUnit === 'piece' || rawUnit === 'pcs' || rawUnit === 'nos') unitName = 'nos';

        let sizeVal = rawWeight;
        if (rawUnit.includes('gram') || rawUnit === 'g') {
          sizeVal = rawWeight / 1000;
        } else if (rawUnit === 'ml') {
          sizeVal = rawWeight / 1000;
        }
        if (sizeVal <= 0) sizeVal = 1;

        const baseWeightNum = Number(it.base_weight || (rawUnit.includes('gram') ? 500 : 1));
        let basePackageSize = baseWeightNum;
        if (rawUnit.includes('gram') || rawUnit === 'g') {
          basePackageSize = baseWeightNum / 1000;
        } else if (rawUnit === 'ml') {
          basePackageSize = baseWeightNum / 1000;
        }
        if (basePackageSize <= 0) basePackageSize = sizeVal || 1;

        let baseDisplay = `${baseWeightNum} ${rawUnit}`;
        if (rawUnit.includes('gram') || rawUnit === 'g') {
          baseDisplay = baseWeightNum >= 1000 ? `${baseWeightNum / 1000} kg` : `${baseWeightNum} g`;
        }

        const basePrice = Number(it.base_product_price || it.price || 0);
        const baseStockPrice = Number(it.stock_price || 0);

        const sizeLabel = String(Math.round(sizeVal * 100) / 100);
        const key = (pId || pName).toLowerCase().trim();

        if (!productMap[key]) {
          productMap[key] = {
            productId: pId,
            name: pName,
            imgUrl: imgUrl,
            baseWeight: baseWeightNum,
            baseUnit: rawUnit,
            baseDisplay: baseDisplay,
            basePrice: basePrice,
            baseStockPrice: baseStockPrice,
            unitName: unitName,
            basePackageSize: basePackageSize,
            totalWeightInBaseUnit: 0,
            totalClientSellingPrice: 0,
            packageBreakdown: {},
            totalOrders: 0
          };
        }

        productMap[key].totalWeightInBaseUnit += (sizeVal * qty);
        productMap[key].totalClientSellingPrice += itemLinePrice;
        productMap[key].packageBreakdown[sizeLabel] = (productMap[key].packageBreakdown[sizeLabel] || 0) + qty;
        productMap[key].totalOrders += 1;
      });
    });

    const resultList: DailyPurchaseItem[] = [];
    let totClientRev = 0;
    let totMarketCost = 0;
    let totProfit = 0;

    for (const key in productMap) {
      const p = productMap[key];
      const totalQtyFormatted = Math.round(p.totalWeightInBaseUnit * 100) / 100;
      
      const parts: string[] = [];
      for (const size in p.packageBreakdown) {
        parts.push(`${size}(${p.packageBreakdown[size]})`);
      }
      const breakdownStr = parts.join(', ');

      let formattedLine = '';
      if (p.unitName === 'nos') {
        formattedLine = `- ${p.name} - ${totalQtyFormatted} (${breakdownStr}) nos`;
      } else {
        formattedLine = `- ${p.name} - ${totalQtyFormatted}${p.unitName} (${breakdownStr})`;
      }

      // Initialize edit models if not set
      if (this.stockPriceEdits[p.productId] === undefined) {
        this.stockPriceEdits[p.productId] = p.baseStockPrice;
      }
      if (this.sellingPriceEdits[p.productId] === undefined) {
        this.sellingPriceEdits[p.productId] = p.basePrice;
      }

      const activeStockPrice = Number(this.stockPriceEdits[p.productId] !== undefined ? this.stockPriceEdits[p.productId] : p.baseStockPrice);
      const activeSellingPrice = Number(this.sellingPriceEdits[p.productId] !== undefined ? this.sellingPriceEdits[p.productId] : p.basePrice);

      // Base multiplier = total weight / base package size
      const baseMultiplier = p.basePackageSize > 0 ? (p.totalWeightInBaseUnit / p.basePackageSize) : p.totalWeightInBaseUnit;
      const totalMarketCost = Math.round(activeStockPrice * baseMultiplier * 100) / 100;
      const roundedClientSelling = Math.round(p.totalClientSellingPrice * 100) / 100;
      const profitOrLoss = Math.round((roundedClientSelling - totalMarketCost) * 100) / 100;

      totClientRev += roundedClientSelling;
      totMarketCost += totalMarketCost;
      totProfit += profitOrLoss;

      resultList.push({
        productId: p.productId,
        productName: p.name,
        imgUrl: p.imgUrl,
        baseWeight: p.baseWeight,
        baseUnit: p.baseUnit,
        baseDisplay: p.baseDisplay,
        basePrice: p.basePrice,
        baseStockPrice: p.baseStockPrice,
        editStockPrice: activeStockPrice,
        editSellingPrice: activeSellingPrice,
        isEditing: false,
        isSaving: !!this.savingProductMap[p.productId],
        savedSuccess: !!this.savedSuccessMap[p.productId],
        totalWeightInBaseUnit: totalQtyFormatted,
        totalDisplay: `${totalQtyFormatted} ${p.unitName}`,
        unitName: p.unitName,
        formattedDetail: formattedLine,
        breakdownSummary: `(${breakdownStr})`,
        ordersCount: p.totalOrders,
        totalClientSellingPrice: roundedClientSelling,
        totalMarketCost: totalMarketCost,
        profitOrLoss: profitOrLoss
      });
    }

    this.dailyPurchaseList = resultList;
    this.purchaseTotals = {
      count: resultList.length,
      totalClientRevenue: Math.round(totClientRev * 100) / 100,
      totalMarketCost: Math.round(totMarketCost * 100) / 100,
      totalProfit: Math.round(totProfit * 100) / 100,
      marginPercent: totClientRev > 0 ? Math.round((totProfit / totClientRev) * 1000) / 10 : 0
    };
  }

  // Live recalculation when user types a new stock price in the input
  onStockPriceChange(item: DailyPurchaseItem) {
    const newPrice = Number(this.stockPriceEdits[item.productId] ?? 0);
    const baseUnitWeight = item.baseWeight || 500;
    let basePackageSize = baseUnitWeight;
    if (item.baseUnit.includes('gram') || item.baseUnit === 'g') {
      basePackageSize = baseUnitWeight / 1000;
    }
    if (basePackageSize <= 0) basePackageSize = 1;

    const baseMultiplier = basePackageSize > 0 ? (item.totalWeightInBaseUnit / basePackageSize) : item.totalWeightInBaseUnit;
    item.totalMarketCost = Math.round(newPrice * baseMultiplier * 100) / 100;
    item.profitOrLoss = Math.round((item.totalClientSellingPrice - item.totalMarketCost) * 100) / 100;

    // Recalculate totals
    let totClientRev = 0;
    let totMarketCost = 0;
    let totProfit = 0;
    this.dailyPurchaseList.forEach(it => {
      totClientRev += it.totalClientSellingPrice;
      totMarketCost += it.totalMarketCost;
      totProfit += it.profitOrLoss;
    });

    this.purchaseTotals = {
      count: this.dailyPurchaseList.length,
      totalClientRevenue: Math.round(totClientRev * 100) / 100,
      totalMarketCost: Math.round(totMarketCost * 100) / 100,
      totalProfit: Math.round(totProfit * 100) / 100,
      marginPercent: totClientRev > 0 ? Math.round((totProfit / totClientRev) * 1000) / 10 : 0
    };
  }

  trackByProductId(index: number, item: DailyPurchaseItem): string {
    return item.productId || item.productName || String(index);
  }

  // Update product market stock price & base selling price in database
  saveProductPrice(item: DailyPurchaseItem) {
    if (!item.productId) {
      alert("Product ID not found for update.");
      return;
    }

    const newStockPrice = Number(this.stockPriceEdits[item.productId] ?? item.editStockPrice);
    const newSellingPrice = Number(this.sellingPriceEdits[item.productId] ?? item.editSellingPrice);

    this.savingProductMap[item.productId] = true;

    this.apiS.postApi('admin/update_product.php', {
      data: JSON.stringify({
        id: item.productId,
        stock_price: newStockPrice,
        price: newSellingPrice
      })
    }).subscribe({
      next: (res: any) => {
        this.savingProductMap[item.productId] = false;
        this.savedSuccessMap[item.productId] = true;
        setTimeout(() => {
          this.savedSuccessMap[item.productId] = false;
        }, 3000);

        // Update in-memory orders cache
        this.orders.forEach(o => {
          if (Array.isArray(o.items)) {
            o.items.forEach((it: any) => {
              if ((it.product_id || it.id) === item.productId) {
                it.stock_price = newStockPrice;
                it.base_product_price = newSellingPrice;
              }
            });
          }
        });

        item.baseStockPrice = newStockPrice;
        item.basePrice = newSellingPrice;
        item.savedSuccess = true;
        this.onStockPriceChange(item);

        this.showToast(
          'Product Price Updated!',
          `${item.productName}: Market purchase cost set to ₹${newStockPrice.toFixed(2)} per ${item.baseDisplay}. Updated in products database!`,
          'success'
        );

        setTimeout(() => {
          this.savedSuccessMap[item.productId] = false;
          item.savedSuccess = false;
        }, 4000);
      },
      error: () => {
        this.savingProductMap[item.productId] = false;
        this.showToast(
          'Update Failed',
          `Failed to update price for ${item.productName}. Please check network or database.`,
          'error'
        );
      }
    });
  }

  /**
   * Return items for the current selected date.
   * For regular orders or when 'ALL' dates are selected, return all items.
   * For subscription orders, filter items whose delivery dates include the selected date
   * and override qty with the per-date count from the subscription dates array.
   */
  getItemsForDate(order: any): any[] {
    if (!order.items) return [];
    if (this.selectedDateStr === 'ALL' || (order.order_type || 'regular').toLowerCase() !== 'subscription') {
      return order.items;
    }

    // For subscription orders on a specific date tab:
    // - Regular items: show ONLY on the order's delivery_date
    // - Subscription items: show ONLY on dates in their subscribedDates/rangeDates
    const orderDeliveryDate = order.delivery_date || '';
    const result: any[] = [];

    order.items.forEach((it: any) => {
      const subType = it.subscriptionType;

      // Regular item (no subscription) — only show on delivery_date
      if (!subType || subType === 'none') {
        if (this.selectedDateStr === orderDeliveryDate) {
          result.push(it);
        }
        return;
      }

      // Subscription item — check if selected date is in its dates array
      const datesJson = subType === 'range' ? it.rangeDates : it.subscribedDates;
      if (!datesJson || datesJson === '[]' || datesJson === 'undefined') {
        // Has subscriptionType but no dates — treat as regular, show on delivery_date
        if (this.selectedDateStr === orderDeliveryDate) {
          result.push(it);
        }
        return;
      }
      try {
        const dates = JSON.parse(datesJson);
        if (Array.isArray(dates) && dates.length > 0) {
          const match = dates.find((d: any) => d.date && d.date === this.selectedDateStr);
          if (match) {
            const dateQty = match.count != null ? Number(match.count) : (it.quantity || 1);
            result.push({ ...it, qty: dateQty, quantity: dateQty });
          }
        } else {
          // Empty dates — treat as regular
          if (this.selectedDateStr === orderDeliveryDate) {
            result.push(it);
          }
        }
      } catch (e) {
        if (this.selectedDateStr === orderDeliveryDate) {
          result.push(it);
        }
      }
    });
    return result;
  }

  copyPurchaseListText() {
    const summaryItems = this.dailyPurchaseList;
    if (summaryItems.length === 0) {
      alert("No purchase items found for the selected filter.");
      return;
    }

    const lines = summaryItems.map(item => item.formattedDetail);
    const textToCopy = `Daily Purchase & Packing List (${this.selectedDateStr}):\n\n` + lines.join('\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
      alert("Purchase & Packing List copied to clipboard!");
    });
  }
}
