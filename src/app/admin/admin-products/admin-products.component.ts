import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';

export interface CategoryOption {
  id?: number;
  key: string;
  label: string;
  img_url?: string;
  product_count?: number;
}

@Component({
  selector: 'app-admin-products',
  templateUrl: './admin-products.component.html',
  styleUrls: ['./admin-products.component.scss']
})
export class AdminProductsComponent implements OnInit {
  products: any[] = [];
  filteredProducts: any[] = [];
  searchQuery: string = '';
  selectedCategory: string = 'All';

  // Standard Unit Options (grams, kg, pack, ltr, etc.)
  unitOptions: string[] = ['grams', 'kg', 'pack', 'ltr', 'ml', 'pcs'];

  // Categories list
  categoryOptions: CategoryOption[] = [];
  categoriesLoading: boolean = false;

  // Modals state
  isAddModalOpen: boolean = false;
  isEditModalOpen: boolean = false;
  isCategoryModalOpen: boolean = false;
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

  newCategory: any = {
    label: '',
    key: '',
    img_url: 'assets/categories/Thinkspot_veggiesIcon.png'
  };

  newProduct: any = {
    name: '',
    tamil_name: '',
    cat: 'Vegetables',
    sub_cat: 'General',
    price: 100,
    original_price: 120,
    stock_price: 80,
    profit_percent: 20,
    show_off_percent: 15,
    weight: 500,
    unit_name: 'grams',
    img_url: 'assets/categories/Thinkspot_veggiesIcon.png',
    zone: 'both',
    gst_percent: 5,
    in_stock: 1,
    stock_qty: 100,
    disabled: 0
  };

  editingProduct: any = null;
  categorySearchQuery: string = '';

  constructor(private apiS: ApiService) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
  }

  loadCategories() {
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

  loadProducts() {
    this.apiS.postApi('products/download_products_sql.php', { table_name: 'zone2_products_new_1', cat: 'all', is_admin: 1 }).subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.products = res;
          this.filterProducts();
        }
      }
    });
  }

  getCategoryLabel(key: string): string {
    if (!key) return '';
    const match = this.categoryOptions.find(c => c.key.toLowerCase() === key.toLowerCase());
    return match ? match.label : key;
  }

  getFilteredCategoriesList(): CategoryOption[] {
    if (!this.categorySearchQuery.trim()) {
      return this.categoryOptions;
    }
    const q = this.categorySearchQuery.toLowerCase().trim();
    return this.categoryOptions.filter(c => 
      c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q)
    );
  }

  filterProducts() {
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

  // --- Category Management ---
  openCategoryModal() {
    this.newCategory = {
      label: '',
      key: '',
      img_url: 'assets/categories/Thinkspot_veggiesIcon.png'
    };
    this.categorySearchQuery = '';
    this.loadCategories();
    this.isCategoryModalOpen = true;
  }

  closeCategoryModal() {
    this.isCategoryModalOpen = false;
  }

  submitAddCategory() {
    if (!this.newCategory.label.trim()) {
      alert("Please enter a category name!");
      return;
    }

    this.apiS.postApi('admin/add_category.php', { data: JSON.stringify(this.newCategory) }).subscribe({
      next: (res: any) => {
        alert(res?.message || "Category added successfully!");
        this.newCategory = {
          label: '',
          key: '',
          img_url: 'assets/categories/Thinkspot_veggiesIcon.png'
        };
        this.loadCategories();
      },
      error: (err) => {
        alert("Error adding category: " + (err?.error?.error || err?.message || "Unknown error"));
      }
    });
  }

  deleteCategory(cat: CategoryOption) {
    const warning = (cat.product_count && cat.product_count > 0)
      ? `Warning: There are ${cat.product_count} product(s) associated with "${cat.label}".\nAre you sure you want to remove this category?`
      : `Are you sure you want to remove the category "${cat.label}"?`;

    if (!confirm(warning)) {
      return;
    }

    this.apiS.postApi('admin/delete_category.php', { data: JSON.stringify({ id: cat.id, key: cat.key }) }).subscribe({
      next: (res: any) => {
        alert(res?.message || "Category removed successfully!");
        if (this.selectedCategory === cat.key) {
          this.selectedCategory = 'All';
        }
        this.loadCategories();
        this.loadProducts();
      },
      error: (err) => {
        alert("Error removing category: " + (err?.error?.error || err?.message || "Unknown error"));
      }
    });
  }

  // --- Product Modals ---
  openAddModal() {
    const defaultCat = this.categoryOptions.length > 0 ? this.categoryOptions[0].key : 'Vegetables';
    this.newProduct = {
      name: '',
      tamil_name: '',
      cat: defaultCat,
      sub_cat: 'General',
      price: 100,
      original_price: 120,
      stock_price: 80,
      profit_percent: 20,
      show_off_percent: 15,
      weight: 500,
      unit_name: 'grams',
      img_url: 'assets/categories/Thinkspot_veggiesIcon.png',
      zone: 'both',
      gst_percent: 5,
      in_stock: 1,
      stock_qty: 100,
      disabled: 0,
      allow_next_day: 1,
      allow_immediate_10: 0,
      allow_immediate_30: 0,
      allow_immediate_60: 0
    };
    this.isAddModalOpen = true;
  }

  closeAddModal() {
    this.isAddModalOpen = false;
  }

  submitAddProduct() {
    if (!this.newProduct.name) {
      alert("Product Name is required!");
      return;
    }
    if (!this.newProduct.unit_name) {
      alert("Unit name is required!");
      return;
    }

    this.apiS.postApi('admin/add_product.php', { data: JSON.stringify(this.newProduct) }).subscribe({
      next: (res: any) => {
        alert("Product added successfully!");
        this.isAddModalOpen = false;
        this.loadProducts();
        this.loadCategories();
      },
      error: (err) => {
        alert("Error adding product: " + (err?.error?.error || err?.message));
      }
    });
  }

  openEditModal(product: any) {
    const fallbackCat = this.categoryOptions.length > 0 ? this.categoryOptions[0].key : 'Vegetables';
    this.editingProduct = { 
      ...product,
      cat: product.cat || product.main_category || fallbackCat,
      weight: (product.weight !== undefined && product.weight !== null) ? product.weight : 500,
      unit_name: product.unit_name || 'grams',
      gst_percent: product.gst_percent !== undefined ? product.gst_percent : 5,
      in_stock: (product.in_stock !== false && product.in_stock !== 0) ? 1 : 0,
      stock_qty: product.stock_qty !== undefined ? product.stock_qty : 100,
      disabled: product.disabled ? 1 : 0,
      allow_next_day: (product.allow_next_day !== 0 && product.allow_next_day !== false) ? 1 : 0,
      allow_immediate_10: (product.allow_immediate_10 == 1) ? 1 : 0,
      allow_immediate_30: (product.allow_immediate_30 == 1) ? 1 : 0,
      allow_immediate_60: (product.allow_immediate_60 == 1) ? 1 : 0
    };
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editingProduct = null;
  }

  submitUpdateProduct() {
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
    const stockQtyNum = parseFloat(updated.stock_qty) || 0;
    updated.stock_qty = stockQtyNum;
    updated.in_stock = (stockQtyNum > 0 && updated.in_stock != 0);

    // Optimistically update local array immediately
    const idx = this.products.findIndex(p => p.id === updated.id || (p.name && updated.name && p.name.toLowerCase() === updated.name.toLowerCase()));
    if (idx !== -1) {
      this.products[idx] = { ...this.products[idx], ...updated };
      this.filterProducts();
    }

    this.apiS.postApi('admin/update_product.php', { data: JSON.stringify(this.editingProduct) }).subscribe({
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
      error: (err) => {
        alert("Error updating product: " + (err?.error?.error || err?.message));
      }
    });
  }

  // Toggle Inventory Availability (In Stock / Out of Stock)
  toggleStockStatus(product: any) {
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

  // Toggle Customer Visibility (Active: visible to customer / Disabled: hidden from customer)
  toggleVisibilityStatus(product: any) {
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

  // --- Add Stock / Record Purchase Modal Methods ---
  openAddStockModal(product: any) {
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

  closeAddStockModal() {
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
    
    // If no prior cost recorded, the new weighted average is simply this purchase's unit cost
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

  submitAddStock() {
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
        
        // Update local product reference immediately
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
  openPurchaseHistoryModal(product: any) {
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

  closePurchaseHistoryModal() {
    this.isPurchaseHistoryModalOpen = false;
    this.selectedProductForHistory = null;
    this.purchaseHistory = [];
  }

  getHistorySummary() {
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

