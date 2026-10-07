import { Component, OnInit, OnDestroy, Optional } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { CartService } from '../../services/cart.service';

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
  basePrice: number;           // Current Base selling price in products table
  updatedBasePrice: number;    // Updated customer selling price (auto-calculated / editable)
  initialBasePrice: number;    // Baseline product selling price
  baseStockPrice: number;      // Calculated per-unit market cost saved in DB
  initialBaseStockPrice: number;
  profitPercent: number;       // Product profit margin %
  gstPercent: number;          // GST %
  existingStock: number;       // Current available stock in inventory (Read-only)
  existingStockDisplay: string;// e.g. "2.5 kg" or "0 kg"
  totalWeightInBaseUnit: number;
  totalDisplay: string;        // e.g. "5 kg" or "3 nos"
  netProcureQty: number;       // Total Ordered - Existing Stock (min 0)
  netProcureDisplay: string;   // e.g. "5 kg" or "0 (In Stock)"
  unitName: string;            // 'kg', 'ltrs', 'nos'
  baseMultiplier: number;      // Quantity multiplier for unit price conversion
  totalClientSellingPrice: number; // Total ₹ client paid
  editTotalCost: number;       // Overall Market Purchase Cost entered by admin for this item
  initialTotalCost: number;    // Baseline overall cost to check if dirty
  profitOrLoss: number;        // totalClientSellingPrice - editTotalCost
  marginPercent: number;       // profit %
  isDirty?: boolean;           // Has uncommitted local changes
  isSaving?: boolean;
  savedSuccess?: boolean;
  formattedDetail: string;
  ordersCount: number;
}

@Component({
  selector: 'app-admin-orders',
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  orders: any[] = [];
  deliveryBoys: any[] = [];
  loading: boolean = false;

  // Products Catalog from DB for accurate pricing & profit metadata
  productsCatalog: any[] = [];
  productsCatalogMap: { [key: string]: any } = {};

  activeViewTab: 'orders' | 'purchase_list' = 'orders';

  statusFilter: string = 'ALL';
  orderTypeFilter: string = 'ALL';
  searchQuery: string = '';

  // Purchase List Search Filter
  purchaseSearchQuery: string = '';

  // 7 Days Datewise Tab Selector
  dateTabs: DateTab[] = [];
  selectedDateStr: string = 'ALL';

  // Bulk Selection
  selectedOrderMap: { [orderId: string]: boolean } = {};
  bulkTargetPartner: string = '';
  selectAllChecked: boolean = false;

  // Modal display for Delivery Partners Info
  isPartnersModalOpen: boolean = false;

  // Overall Market Purchase Cost edit map: productId -> total ₹ amount entered by admin
  totalCostEdits: { [productId: string]: number } = {};
  // Product Selling Price edit map: productId -> unit selling ₹ price (auto-calculated / admin adjusted)
  productPriceEdits: { [productId: string]: number } = {};
  savingProductMap: { [productId: string]: boolean } = {};
  savedSuccessMap: { [productId: string]: boolean } = {};

  // 30-Second Auto Save State
  autoSaveTimer: any = null;
  autoSaveCountdown: number = 30;
  dirtyProductIds: Set<string> = new Set();
  lastAutoSavedAt: string = '';
  isAutoSaving: boolean = false;

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

  // Cached purchase summary list and totals
  dailyPurchaseList: DailyPurchaseItem[] = [];
  purchaseTotals: {
    count: number;
    totalOrderedWeight: number;
    totalExistingStock: number;
    totalNetProcure: number;
    totalClientRevenue: number;
    totalMarketCost: number;
    totalProfit: number;
    marginPercent: number;
  } = {
      count: 0,
      totalOrderedWeight: 0,
      totalExistingStock: 0,
      totalNetProcure: 0,
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

  constructor(
    private apiS: ApiService,
    @Optional() private cartS?: CartService
  ) { }

  ngOnInit(): void {
    this.generateNext7Days();
    this.loadProducts();
    this.loadOrders();
    this.loadDeliveryBoys();
    this.startAutoSaveTicker();
  }

  ngOnDestroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
  }

  // 30-Second Auto Save Interval Engine
  startAutoSaveTicker() {
    this.autoSaveTimer = setInterval(() => {
      if (this.autoSaveCountdown > 1) {
        this.autoSaveCountdown--;
      } else {
        this.autoSaveCountdown = 30;
        if (this.dirtyProductIds.size > 0 && !this.isAutoSaving) {
          this.saveAllChangesNow(true);
        }
      }
    }, 1000);
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
    this.selectedDateStr = 'ALL';
  }

  loadProducts() {
    this.apiS.postApi('products/download_products_sql.php', { table_name: 'products', cat: 'all', is_admin: 1 }).subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.productsCatalog = res;
          this.productsCatalogMap = {};
          res.forEach(p => {
            if (p.id) this.productsCatalogMap[String(p.id).toLowerCase()] = p;
            if (p.name) this.productsCatalogMap[String(p.name).toLowerCase().trim()] = p;
          });
          this.recalculatePurchaseSummary();
        }
      }
    });
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

    if (this.selectedDateStr !== 'ALL') {
      list = list.filter(o => {
        if (o.delivery_date === this.selectedDateStr) return true;
        if (Array.isArray(o.delivery_dates) && o.delivery_dates.includes(this.selectedDateStr)) return true;
        return false;
      });
    }

    if (this.statusFilter !== 'ALL') {
      list = list.filter(o => String(o.status).toUpperCase() === this.statusFilter);
    }

    if (this.orderTypeFilter !== 'ALL') {
      list = list.filter(o => (o.order_type || 'regular').toLowerCase() === this.orderTypeFilter.toLowerCase());
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(o => {
        const id = (o.id || o.order_id || '').toLowerCase();
        const mobile = (o.mobile || o.user_mobile || o.address?.mobile || '').toLowerCase();
        const address = JSON.stringify(o.address || '').toLowerCase();
        const customer = (o.address?.name || o.user_name || '').toLowerCase();
        return id.includes(q) || mobile.includes(q) || address.includes(q) || customer.includes(q);
      });
    }

    return list;
  }

  get filteredPurchaseList(): DailyPurchaseItem[] {
    let list = this.dailyPurchaseList;

    if (this.purchaseSearchQuery.trim()) {
      const q = this.purchaseSearchQuery.toLowerCase().trim();
      list = list.filter(item => {
        return (item.productName || '').toLowerCase().includes(q) ||
          (item.productId || '').toLowerCase().includes(q);
      });
    }

    return list;
  }

  // Bulk Selection Methods
  toggleSelectAll(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.selectAllChecked = !this.selectAllChecked;
    const currentOrders = this.filteredOrders;
    currentOrders.forEach(o => {
      this.selectedOrderMap[o.id] = this.selectAllChecked;
    });
  }

  toggleSelectOrder(orderId: string, event: Event) {
    event.stopPropagation();
    this.selectedOrderMap[orderId] = !this.selectedOrderMap[orderId];
    const currentOrders = this.filteredOrders;
    this.selectAllChecked = currentOrders.length > 0 && currentOrders.every(o => this.selectedOrderMap[o.id]);
  }

  getSelectedCount(): number {
    return Object.keys(this.selectedOrderMap).filter(id => this.selectedOrderMap[id]).length;
  }

  assignPartner(order: any, partnerName: string) {
    if (!partnerName) return;

    this.apiS.postApi('admin/assign_delivery.php', {
      order_id: order.id,
      assigned_to: partnerName
    }).subscribe({
      next: (res: any) => {
        order.assigned_to = partnerName;
        order.status = 'OUT_FOR_DELIVERY';
        this.showToast('Delivery Partner Assigned', `Order #${order.id} assigned to ${partnerName}`);
      },
      error: () => {
        this.showToast('Assignment Failed', `Failed to assign delivery partner for Order #${order.id}`, 'error');
      }
    });
  }

  assignDeliveryBoy(order: any, event: any) {
    const partnerName = event?.target?.value || '';
    this.assignPartner(order, partnerName);
  }

  updateStatus(order: any, newStatus: string) {
    this.apiS.postApi('admin/update_order_status.php', {
      order_id: order.id,
      status: newStatus
    }).subscribe({
      next: (res: any) => {
        order.status = newStatus;
        this.showToast('Status Updated', `Order #${order.id} status changed to ${newStatus}`);
      },
      error: () => {
        this.showToast('Update Failed', `Could not update status for Order #${order.id}`, 'error');
      }
    });
  }

  updateOrderStatus(order: any, event: any) {
    const newStatus = event?.target?.value || '';
    if (newStatus) {
      this.updateStatus(order, newStatus);
    }
  }

  bulkAssignDelivery() {
    if (!this.bulkTargetPartner) {
      alert("Please select a delivery partner first.");
      return;
    }

    const selectedIds = Object.keys(this.selectedOrderMap).filter(id => this.selectedOrderMap[id]);
    if (selectedIds.length === 0) {
      alert("No orders selected.");
      return;
    }

    this.apiS.postApi('admin/bulk_assign_delivery.php', {
      order_ids: selectedIds,
      assigned_to: this.bulkTargetPartner
    }).subscribe({
      next: (res: any) => {
        this.orders.forEach(o => {
          if (selectedIds.includes(o.id)) {
            o.assigned_to = this.bulkTargetPartner;
            o.status = 'OUT_FOR_DELIVERY';
          }
        });
        this.showToast('Bulk Assigned Successfully', `${selectedIds.length} orders assigned to ${this.bulkTargetPartner}`);
        this.selectedOrderMap = {};
        this.selectAllChecked = false;
        this.bulkTargetPartner = '';
      },
      error: () => {
        this.showToast('Bulk Assignment Failed', 'Failed to perform bulk assignment.', 'error');
      }
    });
  }

  openPartnersModal() {
    this.isPartnersModalOpen = true;
  }

  closePartnersModal() {
    this.isPartnersModalOpen = false;
  }

  // Calculate Simple Daily Purchase List & Package Breakdown with Overall Market Cost Entry
  recalculatePurchaseSummary() {
    const currentOrders = this.filteredOrders;
    const productMap: {
      [key: string]: {
        productId: string;
        name: string;
        imgUrl: string;
        baseWeight: number;
        baseUnit: string;
        baseDisplay: string;
        basePrice: number;
        baseStockPrice: number;
        profitPercent: number;
        gstPercent: number;
        existingStock: number;
        unitName: string;
        basePackageSize: number;
        totalWeightInBaseUnit: number;
        totalClientSellingPrice: number;
        packageBreakdown: { [sizeLabel: string]: number };
        totalOrders: number;
      }
    } = {};

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

        const sizeLabel = String(Math.round(sizeVal * 100) / 100);
        const key = (pId || pName).toLowerCase().trim();

        // Check catalog for authoritative product metadata
        const catProd = this.productsCatalogMap[key] ||
          (pId ? this.productsCatalogMap[String(pId).toLowerCase()] : null) ||
          (pName ? this.productsCatalogMap[String(pName).toLowerCase().trim()] : null);

        const basePrice = Number(catProd?.price || it.base_product_price || it.price || 0);
        const baseStockPrice = Number(catProd?.stock_price !== undefined ? catProd.stock_price : (it.stock_price || 0));
        const profitPercent = Number(catProd?.profit_percent !== undefined ? catProd.profit_percent : 20);
        const gstPercent = Number(catProd?.gst_percent !== undefined ? catProd.gst_percent : 5);
        const existingStock = Number(catProd?.stock_qty !== undefined ? catProd.stock_qty : (it.stock_qty || 0));

        if (!productMap[key]) {
          productMap[key] = {
            productId: pId,
            name: pName,
            imgUrl: catProd?.img_url || imgUrl,
            baseWeight: baseWeightNum,
            baseUnit: rawUnit,
            baseDisplay: baseDisplay,
            basePrice: basePrice,
            baseStockPrice: baseStockPrice,
            profitPercent: profitPercent,
            gstPercent: gstPercent,
            existingStock: existingStock,
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
    let totOrderedWeight = 0;
    let totExistingStock = 0;
    let totNetProcure = 0;

    for (const key in productMap) {
      const p = productMap[key];
      const totalQtyFormatted = Math.round(p.totalWeightInBaseUnit * 100) / 100;

      const parts: string[] = [];
      for (const size in p.packageBreakdown) {
        parts.push(`${size}(${p.packageBreakdown[size]})`);
      }
      const breakdownStr = parts.join(', ');
      const formattedLine = `- ${p.name} - ${totalQtyFormatted}${p.unitName} (${breakdownStr})`;

      // Multiplier from base package size to total ordered quantity
      const baseMultiplier = p.basePackageSize > 0 ? (totalQtyFormatted / p.basePackageSize) : totalQtyFormatted;

      // Calculate initial overall market cost from DB base stock price
      const calculatedInitialCost = Math.round(p.baseStockPrice * baseMultiplier * 100) / 100;

      // Use user's edited overall total cost if already modified in session, otherwise default to calculatedInitialCost
      if (this.totalCostEdits[p.productId] === undefined) {
        this.totalCostEdits[p.productId] = calculatedInitialCost;
      }

      const activeTotalCost = Number(this.totalCostEdits[p.productId] !== undefined ? this.totalCostEdits[p.productId] : calculatedInitialCost);

      // Back-calculate per-unit base stock price for database saving
      const activeBaseStockPrice = baseMultiplier > 0 ? (activeTotalCost / baseMultiplier) : activeTotalCost;

      // Auto-calculate suggested Product Selling Price from unit market cost and profit margin
      const profitPct = p.profitPercent !== undefined ? p.profitPercent : 20;
      const gstPct = p.gstPercent !== undefined ? p.gstPercent : 5;
      const baseWithProfit = activeBaseStockPrice * (1 + profitPct / 100);
      const gstAmount = baseWithProfit * (gstPct / 100);
      let calculatedSellingPrice = Math.round(baseWithProfit + gstAmount);
      if (calculatedSellingPrice <= activeBaseStockPrice && activeBaseStockPrice > 0) {
        calculatedSellingPrice = Math.round(activeBaseStockPrice * 1.25);
      }
      if (activeBaseStockPrice <= 0 && p.basePrice > 0) {
        calculatedSellingPrice = p.basePrice;
      }

      if (this.productPriceEdits[p.productId] === undefined) {
        this.productPriceEdits[p.productId] = calculatedSellingPrice;
      }

      const activeProductPrice = Number(this.productPriceEdits[p.productId] !== undefined ? this.productPriceEdits[p.productId] : calculatedSellingPrice);

      // Net Quantity to Buy = max(0, Total Ordered - Existing Stock)
      const netProcure = Math.max(0, Math.round((totalQtyFormatted - p.existingStock) * 100) / 100);
      const netProcureDisplay = netProcure <= 0 ? '0 (In Stock)' : `${netProcure} ${p.unitName}`;

      const roundedClientSelling = Math.round(p.totalClientSellingPrice * 100) / 100;
      const profitOrLoss = Math.round((roundedClientSelling - activeTotalCost) * 100) / 100;
      const marginPct = roundedClientSelling > 0 ? Math.round((profitOrLoss / roundedClientSelling) * 1000) / 10 : 0;

      totClientRev += roundedClientSelling;
      totMarketCost += activeTotalCost;
      totProfit += profitOrLoss;
      totOrderedWeight += totalQtyFormatted;
      totExistingStock += p.existingStock;
      totNetProcure += netProcure;

      const isDirty = this.dirtyProductIds.has(p.productId);

      resultList.push({
        productId: p.productId,
        productName: p.name,
        imgUrl: p.imgUrl,
        baseWeight: p.baseWeight,
        baseUnit: p.baseUnit,
        baseDisplay: p.baseDisplay,
        basePrice: p.basePrice,
        updatedBasePrice: activeProductPrice,
        initialBasePrice: p.basePrice,
        baseStockPrice: Math.round(activeBaseStockPrice * 100) / 100,
        initialBaseStockPrice: p.baseStockPrice,
        profitPercent: p.profitPercent,
        gstPercent: p.gstPercent,
        existingStock: p.existingStock,
        existingStockDisplay: p.existingStock > 0 ? `${p.existingStock} ${p.unitName}` : '0',
        totalWeightInBaseUnit: totalQtyFormatted,
        totalDisplay: `${totalQtyFormatted} ${p.unitName}`,
        netProcureQty: netProcure,
        netProcureDisplay: netProcureDisplay,
        unitName: p.unitName,
        baseMultiplier: baseMultiplier,
        totalClientSellingPrice: roundedClientSelling,
        editTotalCost: activeTotalCost,
        initialTotalCost: calculatedInitialCost,
        profitOrLoss: profitOrLoss,
        marginPercent: marginPct,
        isDirty: isDirty,
        isSaving: !!this.savingProductMap[p.productId],
        savedSuccess: !!this.savedSuccessMap[p.productId],
        formattedDetail: formattedLine,
        ordersCount: p.totalOrders
      });
    }

    this.dailyPurchaseList = resultList;
    this.purchaseTotals = {
      count: resultList.length,
      totalOrderedWeight: Math.round(totOrderedWeight * 100) / 100,
      totalExistingStock: Math.round(totExistingStock * 100) / 100,
      totalNetProcure: Math.round(totNetProcure * 100) / 100,
      totalClientRevenue: Math.round(totClientRev * 100) / 100,
      totalMarketCost: Math.round(totMarketCost * 100) / 100,
      totalProfit: Math.round(totProfit * 100) / 100,
      marginPercent: totClientRev > 0 ? Math.round((totProfit / totClientRev) * 1000) / 10 : 0
    };
  }

  // Live recalculation when user types the overall market purchase cost -> automatically updates product price
  onOverallCostChange(item: DailyPurchaseItem) {
    const activeTotalCost = Number(this.totalCostEdits[item.productId] ?? item.editTotalCost);
    item.editTotalCost = activeTotalCost;

    // Calculate per-unit rate to be written to DB as stock_price
    const baseMult = item.baseMultiplier > 0 ? item.baseMultiplier : 1;
    item.baseStockPrice = Math.round((activeTotalCost / baseMult) * 100) / 100;

    // Automatically recalculate product selling price based on profit margin
    const profitPct = item.profitPercent !== undefined ? item.profitPercent : 20;
    const gstPct = item.gstPercent !== undefined ? item.gstPercent : 5;
    const baseWithProfit = item.baseStockPrice * (1 + profitPct / 100);
    const gstAmount = baseWithProfit * (gstPct / 100);
    let newSellingPrice = Math.round(baseWithProfit + gstAmount);
    if (newSellingPrice <= item.baseStockPrice && item.baseStockPrice > 0) {
      newSellingPrice = Math.round(item.baseStockPrice * 1.25);
    }
    if (item.baseStockPrice <= 0 && item.basePrice > 0) {
      newSellingPrice = item.basePrice;
    }

    item.updatedBasePrice = newSellingPrice;
    this.productPriceEdits[item.productId] = newSellingPrice;

    // Check if cell has changed from initial cost or price
    const hasChanged = activeTotalCost !== item.initialTotalCost || newSellingPrice !== item.initialBasePrice;
    if (hasChanged) {
      this.dirtyProductIds.add(item.productId);
      item.isDirty = true;
    } else {
      this.dirtyProductIds.delete(item.productId);
      item.isDirty = false;
    }

    // Profit / Margin recalculation
    item.profitOrLoss = Math.round((item.totalClientSellingPrice - activeTotalCost) * 100) / 100;
    item.marginPercent = item.totalClientSellingPrice > 0 ? Math.round((item.profitOrLoss / item.totalClientSellingPrice) * 1000) / 10 : 0;

    this.recalculateTotals();
  }

  // Admin directly fine-tunes the product customer selling price
  onProductPriceChange(item: DailyPurchaseItem) {
    const activePrice = Number(this.productPriceEdits[item.productId] ?? item.updatedBasePrice);
    item.updatedBasePrice = activePrice;

    const hasChanged = item.editTotalCost !== item.initialTotalCost || activePrice !== item.initialBasePrice;
    if (hasChanged) {
      this.dirtyProductIds.add(item.productId);
      item.isDirty = true;
    } else {
      this.dirtyProductIds.delete(item.productId);
      item.isDirty = false;
    }
  }

  recalculateTotals() {
    let totClientRev = 0;
    let totMarketCost = 0;
    let totProfit = 0;
    let totOrderedWeight = 0;
    let totExistingStock = 0;
    let totNetProcure = 0;

    this.dailyPurchaseList.forEach(it => {
      totClientRev += it.totalClientSellingPrice;
      totMarketCost += it.editTotalCost;
      totProfit += it.profitOrLoss;
      totOrderedWeight += it.totalWeightInBaseUnit;
      totExistingStock += it.existingStock;
      totNetProcure += it.netProcureQty;
    });

    this.purchaseTotals = {
      count: this.dailyPurchaseList.length,
      totalOrderedWeight: Math.round(totOrderedWeight * 100) / 100,
      totalExistingStock: Math.round(totExistingStock * 100) / 100,
      totalNetProcure: Math.round(totNetProcure * 100) / 100,
      totalClientRevenue: Math.round(totClientRev * 100) / 100,
      totalMarketCost: Math.round(totMarketCost * 100) / 100,
      totalProfit: Math.round(totProfit * 100) / 100,
      marginPercent: totClientRev > 0 ? Math.round((totProfit / totClientRev) * 1000) / 10 : 0
    };
  }

  // Save single item to database
  saveProductPrice(item: DailyPurchaseItem) {
    if (!item.productId) {
      alert("Product ID not found for update.");
      return;
    }

    const unitStockPrice = Math.round(item.baseStockPrice * 100) / 100;
    const unitSellingPrice = Number(this.productPriceEdits[item.productId] ?? item.updatedBasePrice ?? item.basePrice ?? Math.round(unitStockPrice * 1.25));
    const originalPrice = Math.round(unitSellingPrice * 1.18);
    this.savingProductMap[item.productId] = true;

    this.apiS.postApi('admin/update_product.php', {
      data: JSON.stringify({
        id: item.productId,
        name: item.productName,
        price: unitSellingPrice,
        stock_price: unitStockPrice,
        original_price: originalPrice,
        profit_percent: item.profitPercent,
        gst_percent: item.gstPercent
      })
    }).subscribe({
      next: (res: any) => {
        this.savingProductMap[item.productId] = false;
        this.savedSuccessMap[item.productId] = true;
        this.dirtyProductIds.delete(item.productId);
        item.isDirty = false;
        item.initialTotalCost = item.editTotalCost;
        item.initialBasePrice = unitSellingPrice;
        item.basePrice = unitSellingPrice;
        item.updatedBasePrice = unitSellingPrice;
        item.savedSuccess = true;

        // Sync local productsCatalogMap
        const pKey = String(item.productId).toLowerCase();
        if (this.productsCatalogMap[pKey]) {
          this.productsCatalogMap[pKey].price = unitSellingPrice;
          this.productsCatalogMap[pKey].stock_price = unitStockPrice;
          this.productsCatalogMap[pKey].original_price = originalPrice;
        }

        // Sync orders in-memory
        this.orders.forEach(o => {
          if (Array.isArray(o.items)) {
            o.items.forEach((it: any) => {
              if ((it.product_id || it.id) === item.productId) {
                it.stock_price = unitStockPrice;
                it.base_product_price = unitSellingPrice;
              }
            });
          }
        });

        // Sync cart service products if loaded
        if (this.cartS && Array.isArray(this.cartS.productsList)) {
          const cIdx = this.cartS.productsList.findIndex(p => p.id === item.productId || (p.name && item.productName && p.name.toLowerCase() === item.productName.toLowerCase()));
          if (cIdx !== -1) {
            this.cartS.productsList[cIdx].price = unitSellingPrice;
            this.cartS.productsList[cIdx].stock_price = unitStockPrice;
            this.cartS.productsList[cIdx].original_price = originalPrice;
          }
        }

        setTimeout(() => {
          this.savedSuccessMap[item.productId] = false;
          item.savedSuccess = false;
        }, 3000);

        this.showToast(
          'Product Price Updated!',
          `${item.productName}: Product price updated to ₹${unitSellingPrice} / ${item.baseDisplay} (Market cost ₹${unitStockPrice.toFixed(2)}).`,
          'success'
        );
      },
      error: () => {
        this.savingProductMap[item.productId] = false;
        this.showToast(
          'Update Failed',
          `Failed to update database for ${item.productName}.`,
          'error'
        );
      }
    });
  }

  // Save all modified items to DB (triggered automatically every 30s or on demand)
  saveAllChangesNow(isAutomatic: boolean = false) {
    if (this.dirtyProductIds.size === 0 || this.isAutoSaving) {
      if (!isAutomatic) {
        this.showToast('All Changes Synced', 'No pending unsaved modifications in the spreadsheet.', 'info');
      }
      return;
    }

    const dirtyList = this.dailyPurchaseList.filter(it => this.dirtyProductIds.has(it.productId));
    if (dirtyList.length === 0) return;

    this.isAutoSaving = true;
    let completed = 0;
    let hasError = false;

    dirtyList.forEach(item => {
      this.savingProductMap[item.productId] = true;
      const unitStockPrice = Math.round(item.baseStockPrice * 100) / 100;
      const unitSellingPrice = Number(this.productPriceEdits[item.productId] ?? item.updatedBasePrice ?? item.basePrice ?? Math.round(unitStockPrice * 1.25));
      const originalPrice = Math.round(unitSellingPrice * 1.18);

      this.apiS.postApi('admin/update_product.php', {
        data: JSON.stringify({
          id: item.productId,
          name: item.productName,
          price: unitSellingPrice,
          stock_price: unitStockPrice,
          original_price: originalPrice,
          profit_percent: item.profitPercent,
          gst_percent: item.gstPercent
        })
      }).subscribe({
        next: () => {
          completed++;
          this.savingProductMap[item.productId] = false;
          this.savedSuccessMap[item.productId] = true;
          this.dirtyProductIds.delete(item.productId);
          item.isDirty = false;
          item.initialTotalCost = item.editTotalCost;
          item.initialBasePrice = unitSellingPrice;
          item.basePrice = unitSellingPrice;
          item.updatedBasePrice = unitSellingPrice;
          item.savedSuccess = true;

          // Sync local catalog
          const pKey = String(item.productId).toLowerCase();
          if (this.productsCatalogMap[pKey]) {
            this.productsCatalogMap[pKey].price = unitSellingPrice;
            this.productsCatalogMap[pKey].stock_price = unitStockPrice;
            this.productsCatalogMap[pKey].original_price = originalPrice;
          }

          // Sync in-memory orders
          this.orders.forEach(o => {
            if (Array.isArray(o.items)) {
              o.items.forEach((it: any) => {
                if ((it.product_id || it.id) === item.productId) {
                  it.stock_price = unitStockPrice;
                  it.base_product_price = unitSellingPrice;
                }
              });
            }
          });

          // Sync cart service products if loaded
          if (this.cartS && Array.isArray(this.cartS.productsList)) {
            const cIdx = this.cartS.productsList.findIndex(p => p.id === item.productId || (p.name && item.productName && p.name.toLowerCase() === item.productName.toLowerCase()));
            if (cIdx !== -1) {
              this.cartS.productsList[cIdx].price = unitSellingPrice;
              this.cartS.productsList[cIdx].stock_price = unitStockPrice;
              this.cartS.productsList[cIdx].original_price = originalPrice;
            }
          }

          setTimeout(() => {
            this.savedSuccessMap[item.productId] = false;
            item.savedSuccess = false;
          }, 3000);

          if (completed === dirtyList.length) {
            this.finishAutoSaveBatch(dirtyList.length, hasError, isAutomatic);
          }
        },
        error: () => {
          completed++;
          hasError = true;
          this.savingProductMap[item.productId] = false;
          if (completed === dirtyList.length) {
            this.finishAutoSaveBatch(dirtyList.length, hasError, isAutomatic);
          }
        }
      });
    });
  }

  finishAutoSaveBatch(count: number, hasError: boolean, isAutomatic: boolean) {
    this.isAutoSaving = false;
    this.autoSaveCountdown = 30;
    const now = new Date();
    this.lastAutoSavedAt = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (!hasError) {
      this.showToast(
        isAutomatic ? 'Auto-Saved to DB' : 'All Changes Saved',
        `Successfully updated ${count} product price(s) and synced to customer app at ${this.lastAutoSavedAt}.`,
        'success'
      );
    } else {
      this.showToast('Save Partially Completed', 'Some items could not be saved to database. Check connection.', 'error');
    }
  }

  // Export Daily Purchase List to CSV/Excel Spreadsheet
  exportToExcel() {
    const items = this.filteredPurchaseList;
    if (items.length === 0) {
      alert("No purchase items to export.");
      return;
    }

    const headers = [
      "Sl No",
      "Product Name",
      "Existing Stock",
      "To Procure (Qty)",
      "Client Total Sales (₹)",
      "Market Total Cost (₹)",
      "Unit Cost Price (₹)",
      "Product Selling Price (₹)",
      "Net Profit/Loss (₹)",
      "Margin %"
    ];

    const rows = items.map((it, idx) => [
      idx + 1,
      `"${it.productName.replace(/"/g, '""')}"`,
      `${it.existingStockDisplay}`,
      `${it.netProcureDisplay}`,
      it.totalClientSellingPrice,
      it.editTotalCost,
      `"${it.baseStockPrice}/${it.baseDisplay}"`,
      `"${it.updatedBasePrice || it.basePrice}/${it.baseDisplay}"`,
      it.profitOrLoss,
      `${it.marginPercent}%`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `TomorrowNeeds_Purchase_List_${this.selectedDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast('Spreadsheet Exported', `Downloaded TomorrowNeeds_Purchase_List_${this.selectedDateStr}.csv`);
  }

  trackByProductId(index: number, item: DailyPurchaseItem): string {
    return item.productId || item.productName || String(index);
  }

  getItemsForDate(order: any): any[] {
    if (!order.items) return [];
    if (this.selectedDateStr === 'ALL' || (order.order_type || 'regular').toLowerCase() !== 'subscription') {
      return order.items;
    }

    const orderDeliveryDate = order.delivery_date || '';
    const result: any[] = [];

    order.items.forEach((it: any) => {
      const subType = it.subscriptionType;

      if (!subType || subType === 'none') {
        if (this.selectedDateStr === orderDeliveryDate) {
          result.push(it);
        }
        return;
      }

      const datesJson = subType === 'range' ? it.rangeDates : it.subscribedDates;
      if (!datesJson || datesJson === '[]' || datesJson === 'undefined') {
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
    const summaryItems = this.filteredPurchaseList;
    if (summaryItems.length === 0) {
      alert("No purchase items found for the selected filter.");
      return;
    }

    const lines = summaryItems.map((item, idx) => {
      return `${idx + 1}. ${item.productName} | Stock: ${item.existingStockDisplay} | To Buy: ${item.netProcureDisplay} | Client Sales: ₹${item.totalClientSellingPrice} | Market Cost: ₹${item.editTotalCost} | Profit: ₹${item.profitOrLoss}`;
    });
    const textToCopy = `TomorrowNeeds - Daily Purchase List (${this.selectedDateStr}):\n\n` + lines.join('\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
      this.showToast('Copied to Clipboard', 'Daily Purchase List copied to clipboard.');
    });
  }
}
