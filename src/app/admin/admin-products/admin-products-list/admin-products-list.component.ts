import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { CartService } from '../../../services/cart.service';

export interface CategoryOption {
  id?: number;
  key: string;
  label: string;
  img_url?: string;
  product_count?: number;
}

@Component({
  selector: 'app-admin-products-list',
  templateUrl: './admin-products-list.component.html',
  styleUrls: ['./admin-products-list.component.scss']
})
export class AdminProductsListComponent implements OnInit {
  products: any[] = [];
  filteredProducts: any[] = [];
  searchQuery: string = '';
  selectedCategory: string = 'All';

  // Standard Unit Options
  unitOptions: string[] = ['grams', 'kg', 'pack', 'ltr', 'ml', 'pcs'];

  // Categories list
  categoryOptions: CategoryOption[] = [];
  categoriesLoading: boolean = false;
  productsLoading: boolean = false;

  // Modals state
  isEditModalOpen: boolean = false;
  isAddStockModalOpen: boolean = false;
  isPurchaseHistoryModalOpen: boolean = false;

  // Stock Purchase Modal State
  selectedProductForStock: any = null;
  stockPurchaseForm: any = {
    product_id: '',
    product_name: '',
    quantity: 5,
    total_cost: 300,
    unit_name: 'kg',
    vendor_name: '',
    notes: '',
    purchase_date: new Date().toISOString().substring(0, 10)
  };
  addStockSubmitting: boolean = false;

  // Purchase History State
  selectedProductForHistory: any = null;
  purchaseHistory: any[] = [];
  purchaseHistoryLoading: boolean = false;

  // Store Settings (Weekly Leave)
  weeklyOffDay: string = 'None';
  storeSettingsSaving: boolean = false;
  storeSettingsLoaded: boolean = false;
  weekDaysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  editingProduct: any = null;

  get totalProductsCount(): number {
    return this.products?.length || 0;
  }

  get inStockProductsCount(): number {
    return this.products?.filter(p => p.in_stock !== false && p.in_stock !== 0 && (p.is_unlimited || (p.stock_qty || 0) > 0)).length || 0;
  }

  get outOfStockProductsCount(): number {
    return this.products?.filter(p => !p.is_unlimited && (p.in_stock === false || p.in_stock === 0 || (p.stock_qty !== undefined && p.stock_qty <= 0))).length || 0;
  }

  get hiddenProductsCount(): number {
    return this.products?.filter(p => p.disabled).length || 0;
  }

  constructor(
    private apiS: ApiService,
    private cartS: CartService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadStoreSettings();
    this.loadCategories();
    this.loadProducts();

    // Check query params for category filter if navigated from categories page
    this.route.queryParams.subscribe(params => {
      if (params['category']) {
        this.selectedCategory = params['category'];
        this.filterProducts();
      }
    });
  }

  goToAddProduct(): void {
    this.router.navigate(['/admin/products/add']);
  }

  goToCategories(): void {
    this.router.navigate(['/admin/products/categories']);
  }

  goToBulkUpload(): void {
    this.router.navigate(['/admin/products/bulk']);
  }

  loadStoreSettings(): void {
    this.apiS.getApi('admin/store_settings.php').subscribe({
      next: (res: any) => {
        if (res && res.weekly_off_day) {
          this.weeklyOffDay = res.weekly_off_day;
        } else {
          this.weeklyOffDay = 'None';
        }
        this.storeSettingsLoaded = true;
      },
      error: () => {
        this.weeklyOffDay = 'None';
        this.storeSettingsLoaded = true;
      }
    });
  }

  saveWeeklyLeaveSetting(): void {
    this.storeSettingsSaving = true;
    this.apiS.postApi('admin/store_settings.php', {
      key: 'weekly_off_day',
      value: this.weeklyOffDay,
      weekly_off_day: this.weeklyOffDay
    }).subscribe({
      next: (res: any) => {
        this.storeSettingsSaving = false;
        this.cartS.storeSettings = { weekly_off_day: this.weeklyOffDay };
        this.cartS.storeSettingsUpdateEvent.next(this.cartS.storeSettings);
        this.cartS.recalculateDeliveryDate();
        alert(res?.message || `Weekly leave set to "${this.weeklyOffDay}". Orders placed on the day prior will automatically deliver the next operating morning!`);
      },
      error: (err: any) => {
        this.storeSettingsSaving = false;
        alert('Failed to save weekly leave setting: ' + (err?.error?.error || err?.message || 'Server error'));
      }
    });
  }

  loadCategories(): void {
    this.categoriesLoading = true;
    this.apiS.getApi('admin/get_categories.php').subscribe({
      next: (res: any) => {
        this.categoriesLoading = false;
        if (Array.isArray(res)) {
          this.categoryOptions = res.map((c: any) => ({
            id: c.id,
            key: c.key_name || c.key || c.cat,
            label: c.label || c.name || c.key_name,
            img_url: c.img_url,
            product_count: c.product_count || 0
          }));
        }
      },
      error: () => {
        this.categoriesLoading = false;
      }
    });
  }

  loadProducts(): void {
    this.productsLoading = true;
    this.apiS.postApi('products/download_products_sql.php', { table_name: 'zone2_products_new_1', cat: 'all', is_admin: 1 }).subscribe({
      next: (res: any) => {
        this.productsLoading = false;
        if (Array.isArray(res)) {
          this.products = res;
          this.filterProducts();
        }
      },
      error: () => {
        this.productsLoading = false;
      }
    });
  }

  getCategoryLabel(key: string): string {
    if (!key) return '';
    const match = this.categoryOptions.find(c => c.key.toLowerCase() === key.toLowerCase());
    return match ? match.label : key;
  }

  filterProducts(): void {
    let list = this.products;
    if (this.selectedCategory !== 'All') {
      list = list.filter(p => (p.cat && p.cat.toLowerCase() === this.selectedCategory.toLowerCase()) || 
                              (p.main_category && p.main_category.toLowerCase() === this.selectedCategory.toLowerCase()));
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) || 
        (p.tamil_name && p.tamil_name.toLowerCase().includes(q))
      );
    }
    this.filteredProducts = list;
  }

  // Preferred days helper methods
  isDaySelected(productObj: any, day: string): boolean {
    if (!productObj || !productObj.preferred_days) return false;
    const days = Array.isArray(productObj.preferred_days) ? productObj.preferred_days : [];
    return days.includes(day);
  }

  togglePreferredDay(productObj: any, day: string): void {
    if (!productObj) return;
    if (!Array.isArray(productObj.preferred_days)) {
      productObj.preferred_days = [];
    }
    const idx = productObj.preferred_days.indexOf(day);
    if (idx > -1) {
      productObj.preferred_days.splice(idx, 1);
    } else {
      productObj.preferred_days.push(day);
    }
  }

  setAllDaysPreferred(productObj: any): void {
    if (!productObj) return;
    productObj.preferred_days = [];
  }

  getPreferredDaysBadge(productObj: any): string {
    if (!productObj || !productObj.preferred_days) return 'All Days';
    let days: string[] = [];
    if (Array.isArray(productObj.preferred_days)) {
      days = productObj.preferred_days;
    } else if (typeof productObj.preferred_days === 'string') {
      try {
        const p = JSON.parse(productObj.preferred_days);
        if (Array.isArray(p)) days = p;
      } catch (e) {
        days = productObj.preferred_days.split(',').map(s => s.trim());
      }
    }
    if (!days || days.length === 0 || days.length >= 7) return 'All Days';
    if (days.length === 1) return `${days[0]} only`;
    return days.map(d => d.slice(0, 3)).join(', ');
  }

  openEditModal(product: any): void {
    const fallbackCat = this.categoryOptions.length > 0 ? this.categoryOptions[0].key : 'Vegetables';
    let pDays: string[] = [];
    if (Array.isArray(product.preferred_days)) {
      pDays = [...product.preferred_days];
    } else if (typeof product.preferred_days === 'string' && product.preferred_days.trim()) {
      try {
        const p = JSON.parse(product.preferred_days);
        if (Array.isArray(p)) pDays = p;
        else pDays = product.preferred_days.split(',').map((s: string) => s.trim());
      } catch (e) {
        pDays = product.preferred_days.split(',').map((s: string) => s.trim());
      }
    }

    const isUnlim = (product.is_unlimited == 1 || product.is_unlimited === true || String(product.is_unlimited) === '1') ? 1 : 0;
    const isSub = (product.subscribe_flg == 1 || product.subscribeFlg === true || String(product.subscribe_flg) === '1') ? 1 : 0;

    this.editingProduct = { 
      ...product,
      cat: product.cat || product.main_category || fallbackCat,
      weight: (product.weight !== undefined && product.weight !== null) ? product.weight : 500,
      unit_name: product.unit_name || 'grams',
      gst_percent: product.gst_percent !== undefined ? product.gst_percent : 5,
      in_stock: (product.in_stock !== false && product.in_stock !== 0) ? 1 : 0,
      stock_qty: (product.stock_qty !== undefined && product.stock_qty !== null) ? parseFloat(product.stock_qty) : 0,
      is_unlimited: isUnlim,
      disabled: product.disabled ? 1 : 0,
      subscribe_flg: isSub,
      allow_next_day: (product.allow_next_day !== 0 && product.allow_next_day !== false) ? 1 : 0,
      allow_immediate_10: (product.allow_immediate_10 == 1) ? 1 : 0,
      allow_immediate_30: (product.allow_immediate_30 == 1) ? 1 : 0,
      allow_immediate_60: (product.allow_immediate_60 == 1) ? 1 : 0,
      preferred_days: pDays
    };
    this.isEditModalOpen = true;
  }

  closeEditModal(): void {
    this.isEditModalOpen = false;
    this.editingProduct = null;
  }

  submitUpdateProduct(): void {
    if (!this.editingProduct) return;

    if (!this.editingProduct.name) {
      alert("Product Name is required!");
      return;
    }
    if (!this.editingProduct.unit_name) {
      alert("Unit name is required!");
      return;
    }

    const updated = { ...this.editingProduct };
    const stockQtyNum = (updated.stock_qty !== undefined && updated.stock_qty !== null && updated.stock_qty !== '') ? parseFloat(updated.stock_qty) : 0;
    updated.stock_qty = stockQtyNum;
    if (updated.is_unlimited == 1 || updated.is_unlimited === true) {
      updated.is_unlimited = 1;
    } else {
      updated.is_unlimited = 0;
      updated.in_stock = (stockQtyNum > 0 && updated.in_stock != 0) ? 1 : 0;
    }

    const idx = this.products.findIndex(p => p.id === updated.id || (p.name && updated.name && p.name.toLowerCase() === updated.name.toLowerCase()));
    if (idx !== -1) {
      this.products[idx] = { ...this.products[idx], ...updated, subscribeFlg: (updated.subscribe_flg == 1) };
      this.filterProducts();
    }

    this.apiS.postApi('admin/update_product.php', { data: JSON.stringify(updated) }).subscribe({
      next: (res: any) => {
        alert("Product updated successfully!");
        this.isEditModalOpen = false;
        if (res && res.product) {
          const fresh = res.product;
          const fIdx = this.products.findIndex(p => p.id === fresh.id || (p.name && fresh.name && p.name.toLowerCase() === fresh.name.toLowerCase()));
          if (fIdx !== -1) {
            this.products[fIdx] = { ...this.products[fIdx], ...fresh };
            this.filterProducts();
          }
        }
        this.loadProducts();
        this.loadCategories();
      },
      error: (err: any) => {
        alert("Error updating product: " + (err?.error?.error || err?.message));
      }
    });
  }

  toggleStockStatus(product: any): void {
    const isCurrentlyInStock = (product.in_stock !== false && product.in_stock !== 0);
    const newStockVal = isCurrentlyInStock ? 0 : 1;
    product.in_stock = (newStockVal === 1);
    this.filterProducts();
    this.apiS.postApi('admin/update_product.php', {
      data: JSON.stringify({ id: product.id, in_stock: newStockVal })
    }).subscribe({
      next: () => {
        this.filterProducts();
      }
    });
  }

  toggleVisibilityStatus(product: any): void {
    const newDisabledVal = product.disabled ? 0 : 1;
    product.disabled = (newDisabledVal === 1);
    this.filterProducts();
    this.apiS.postApi('admin/update_product.php', {
      data: JSON.stringify({ id: product.id, disabled: newDisabledVal })
    }).subscribe({
      next: () => {
        this.filterProducts();
      }
    });
  }

  toggleSubscriptionStatus(product: any): void {
    const isCurrentlySub = (product.subscribe_flg == 1 || product.subscribeFlg === true || String(product.subscribe_flg) === '1');
    const newSubVal = isCurrentlySub ? 0 : 1;
    product.subscribe_flg = newSubVal;
    product.subscribeFlg = (newSubVal === 1);
    this.filterProducts();
    this.apiS.postApi('admin/update_product.php', {
      data: JSON.stringify({ id: product.id, subscribe_flg: newSubVal })
    }).subscribe({
      next: () => {
        this.filterProducts();
      }
    });
  }

  // --- Add Stock / Record Purchase Modal Methods ---
  openAddStockModal(product: any): void {
    this.selectedProductForStock = product;
    const defaultQty = product.unit_name === 'grams' || product.unit_name === 'ml' ? 1000 : 5;
    const currentUnitCost = (product.stock_price && product.stock_price > 0) ? product.stock_price : (product.price ? Math.round(product.price * 0.75) : 50);
    const estimatedCost = Math.round(defaultQty * currentUnitCost);
    const profitPct = product.profit_percent !== undefined && product.profit_percent !== null ? product.profit_percent : 10;
    const gstPct = product.gst_percent !== undefined && product.gst_percent !== null ? product.gst_percent : 5;
    
    this.stockPurchaseForm = {
      product_id: product.id,
      product_name: product.name,
      quantity: defaultQty,
      total_cost: estimatedCost,
      unit_name: product.unit_name || 'kg',
      profit_percent: profitPct,
      gst_percent: gstPct,
      vendor_name: '',
      notes: '',
      purchase_date: new Date().toISOString().substring(0, 10)
    };
    this.isAddStockModalOpen = true;
  }

  closeAddStockModal(): void {
    this.isAddStockModalOpen = false;
    this.selectedProductForStock = null;
    this.addStockSubmitting = false;
  }

  getCalculatedUnitCost(): number {
    const qty = parseFloat(this.stockPurchaseForm?.quantity) || 0;
    const cost = parseFloat(this.stockPurchaseForm?.total_cost) || 0;
    return qty > 0 ? Math.round(cost / qty) : 0;
  }

  getCalculatedNewStock(): number {
    const currentStock = parseFloat(this.selectedProductForStock?.stock_qty) || 0;
    const addedQty = parseFloat(this.stockPurchaseForm?.quantity) || 0;
    return Math.round(currentStock + addedQty);
  }

  getCalculatedNewWeightedAvg(): number {
    const currentStock = parseFloat(this.selectedProductForStock?.stock_qty) || 0;
    const currentAvgCost = parseFloat(this.selectedProductForStock?.stock_price || this.selectedProductForStock?.avg_cost) || 0;
    const addedQty = parseFloat(this.stockPurchaseForm?.quantity) || 0;
    const addedCost = parseFloat(this.stockPurchaseForm?.total_cost) || 0;
    
    if (currentAvgCost <= 0 || currentStock <= 0) {
      return addedQty > 0 ? Math.round(addedCost / addedQty) : 0;
    }
    
    const totalQty = currentStock + addedQty;
    if (totalQty <= 0) return 0;
    
    const totalCost = (currentStock * currentAvgCost) + addedCost;
    return Math.round(totalCost / totalQty);
  }

  getCalculatedBaseWithProfit(): number {
    const avgCost = this.getCalculatedNewWeightedAvg();
    const profitPct = parseFloat(this.stockPurchaseForm?.profit_percent) || 0;
    return Math.round(avgCost * (1 + profitPct / 100));
  }

  getCalculatedGstAmount(): number {
    const baseWithProfit = this.getCalculatedBaseWithProfit();
    const gstPct = parseFloat(this.stockPurchaseForm?.gst_percent) || 0;
    return Math.round(baseWithProfit * (gstPct / 100));
  }

  getCalculatedFinalSellingPrice(): number {
    const baseWithProfit = this.getCalculatedBaseWithProfit();
    const gstAmount = this.getCalculatedGstAmount();
    return Math.round(baseWithProfit + gstAmount);
  }

  getCalculatedMRP(): number {
    const finalSellingPrice = this.getCalculatedFinalSellingPrice();
    return Math.round(finalSellingPrice * 1.18);
  }

  submitAddStock(): void {
    if (!this.stockPurchaseForm.quantity || this.stockPurchaseForm.quantity <= 0) {
      alert("Please enter a valid purchase quantity greater than 0!");
      return;
    }
    if (this.stockPurchaseForm.total_cost === undefined || this.stockPurchaseForm.total_cost === null || this.stockPurchaseForm.total_cost < 0) {
      alert("Please enter a valid purchase cost!");
      return;
    }

    const payload = {
      ...this.stockPurchaseForm,
      new_total_stock: this.getCalculatedNewStock(),
      selling_price: this.getCalculatedFinalSellingPrice(),
      original_price: this.getCalculatedMRP()
    };

    this.addStockSubmitting = true;
    this.apiS.postApi('admin/add_purchase.php', { data: JSON.stringify(payload) }).subscribe({
      next: (res: any) => {
        this.addStockSubmitting = false;
        alert(res?.message || `Successfully added ${this.stockPurchaseForm.quantity} ${this.stockPurchaseForm.unit_name} to inventory!`);
        
        if (this.selectedProductForStock) {
          const newQty = res?.current_stock_qty !== undefined ? res.current_stock_qty : this.getCalculatedNewStock();
          const newCost = res?.weighted_avg_cost !== undefined ? res.weighted_avg_cost : this.getCalculatedNewWeightedAvg();
          const newPrice = res?.selling_price !== undefined ? res.selling_price : this.getCalculatedFinalSellingPrice();
          const newOrigPrice = res?.original_price !== undefined ? res.original_price : this.getCalculatedMRP();
          const newProfit = res?.profit_percent !== undefined ? res.profit_percent : this.stockPurchaseForm.profit_percent;
          const newGst = res?.gst_percent !== undefined ? res.gst_percent : this.stockPurchaseForm.gst_percent;

          this.selectedProductForStock.stock_qty = newQty;
          this.selectedProductForStock.stock_price = newCost;
          this.selectedProductForStock.avg_cost = newCost;
          this.selectedProductForStock.price = newPrice;
          this.selectedProductForStock.original_price = newOrigPrice;
          this.selectedProductForStock.profit_percent = newProfit;
          this.selectedProductForStock.gst_percent = newGst;
          this.selectedProductForStock.in_stock = (newQty > 0);

          const idx = this.products.findIndex(p => p.id === this.selectedProductForStock.id || (p.name && this.selectedProductForStock.name && p.name.toLowerCase() === this.selectedProductForStock.name.toLowerCase()));
          if (idx !== -1) {
            this.products[idx] = { ...this.products[idx], ...this.selectedProductForStock };
          }
          this.filterProducts();
        }
        
        this.closeAddStockModal();
        this.loadProducts();
      },
      error: (err: any) => {
        this.addStockSubmitting = false;
        alert("Error adding stock: " + (err?.error?.error || err?.message || "Unknown error"));
      }
    });
  }

  // --- Purchase History Modal Methods ---
  openPurchaseHistoryModal(product: any): void {
    this.selectedProductForHistory = product;
    this.purchaseHistory = [];
    this.purchaseHistoryLoading = true;
    this.isPurchaseHistoryModalOpen = true;

    this.apiS.getApi(`admin/get_purchase_history.php?product_id=${product.id}`).subscribe({
      next: (res: any) => {
        this.purchaseHistoryLoading = false;
        if (Array.isArray(res)) {
          this.purchaseHistory = res;
        } else {
          this.purchaseHistory = [];
        }
      },
      error: (err: any) => {
        this.purchaseHistoryLoading = false;
        console.error("Error loading purchase history:", err);
      }
    });
  }

  closePurchaseHistoryModal(): void {
    this.isPurchaseHistoryModalOpen = false;
    this.selectedProductForHistory = null;
    this.purchaseHistory = [];
  }

  getHistorySummary(): any {
    let totalQty = 0;
    let totalCost = 0;
    for (const item of this.purchaseHistory) {
      totalQty += parseFloat(item.quantity) || 0;
      totalCost += parseFloat(item.total_cost) || 0;
    }
    const weightedAvg = totalQty > 0 ? parseFloat((totalCost / totalQty).toFixed(2)) : 0;
    return {
      count: this.purchaseHistory.length,
      totalQty: parseFloat(totalQty.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      weightedAvg: weightedAvg
    };
  }
}
