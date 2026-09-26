import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import * as XLSX from 'xlsx';
import { ApiService } from '../../../services/api.service';

export interface BulkProductRow {
  rowIndex: number;
  id?: string;
  name: string;
  tamil_name?: string;
  cat?: string;
  sub_cat?: string;
  price: number;
  original_price?: number;
  stock_price?: number;
  profit_percent?: number;
  show_off_percent?: number;
  weight: number;
  unit_name: string;
  img_url?: string;
  gst_percent?: number;
  is_unlimited: number;
  stock_qty: number;
  in_stock: number;
  disabled: number;
  subscribe_flg: number;
  allow_next_day: number;
  allow_immediate_10: number;
  allow_immediate_30: number;
  allow_immediate_60: number;
  preferred_days: string;
  actionType: 'NEW' | 'UPDATE' | 'INVALID';
  validationErrors: string[];
}

@Component({
  selector: 'app-admin-product-bulk',
  templateUrl: './admin-product-bulk.component.html',
  styleUrls: ['./admin-product-bulk.component.scss']
})
export class AdminProductBulkComponent implements OnInit {
  isDragging: boolean = false;
  fileName: string = '';
  fileSizeText: string = '';

  parsedRows: BulkProductRow[] = [];
  existingProducts: any[] = [];
  existingCategories: any[] = [];

  isUploading: boolean = false;
  uploadProgress: number = 0;
  uploadResult: any = null;

  activeFilter: 'ALL' | 'NEW' | 'UPDATE' | 'INVALID' = 'ALL';

  get newCount(): number {
    return this.parsedRows.filter(r => r.actionType === 'NEW').length;
  }

  get updateCount(): number {
    return this.parsedRows.filter(r => r.actionType === 'UPDATE').length;
  }

  get invalidCount(): number {
    return this.parsedRows.filter(r => r.actionType === 'INVALID').length;
  }

  get filteredPreviewRows(): BulkProductRow[] {
    if (this.activeFilter === 'NEW') return this.parsedRows.filter(r => r.actionType === 'NEW');
    if (this.activeFilter === 'UPDATE') return this.parsedRows.filter(r => r.actionType === 'UPDATE');
    if (this.activeFilter === 'INVALID') return this.parsedRows.filter(r => r.actionType === 'INVALID');
    return this.parsedRows;
  }

  constructor(
    private apiS: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCatalogContext();
  }

  loadCatalogContext(): void {
    this.apiS.getApi('admin/get_categories.php').subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) this.existingCategories = res;
      }
    });

    this.apiS.postApi('products/download_products_sql.php', { table_name: 'zone2_products_new_1', cat: 'all', is_admin: 1 }).subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) this.existingProducts = res;
      }
    });
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: any): void {
    const files = event.target?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  processFile(file: File): void {
    this.fileName = file.name;
    this.fileSizeText = (file.size / 1024).toFixed(1) + ' KB';
    this.uploadResult = null;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          alert("The selected Excel sheet contains no product rows.");
          return;
        }

        this.parseAndValidateRows(rawJson);
      } catch (err: any) {
        alert("Error parsing Excel file: " + (err?.message || 'Invalid format'));
      }
    };
    reader.readAsArrayBuffer(file);
  }

  parseAndValidateRows(rawJson: any[]): void {
    const rows: BulkProductRow[] = [];

    rawJson.forEach((raw, idx) => {
      const getVal = (...keys: string[]): any => {
        for (const k of keys) {
          if (raw[k] !== undefined && raw[k] !== '') return raw[k];
          // Check case-insensitive
          const found = Object.keys(raw).find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
          if (found && raw[found] !== undefined && raw[found] !== '') return raw[found];
        }
        return '';
      };

      const id = String(getVal('Product ID', 'id', 'Product Code', 'ID')).trim();
      const name = String(getVal('Product Name', 'name', 'Name')).trim();
      const tamil_name = String(getVal('Tamil Name', 'tamil_name', 'Regional Name')).trim();
      const cat = String(getVal('Category', 'cat', 'category')).trim() || 'Vegetables';
      const sub_cat = String(getVal('Sub Category', 'sub_cat', 'SubCategory')).trim() || 'General';

      const priceVal = parseFloat(getVal('Selling Price', 'price', 'Price (INR)', 'Price'));
      const price = isNaN(priceVal) ? 0 : priceVal;

      const mrpVal = parseFloat(getVal('MRP', 'original_price', 'Original Price'));
      const original_price = isNaN(mrpVal) || mrpVal <= 0 ? price : mrpVal;

      const costVal = parseFloat(getVal('Cost Price', 'stock_price', 'Cost', 'Cost (INR)'));
      const stock_price = isNaN(costVal) || costVal <= 0 ? Math.round(price * 0.8) : costVal;

      const weightVal = parseFloat(getVal('Weight', 'weight', 'Quantity', 'Pack Weight'));
      const weight = isNaN(weightVal) || weightVal <= 0 ? 500 : weightVal;

      const unit_name = String(getVal('Unit', 'unit_name', 'Unit Name', 'Measurement')).trim() || 'grams';

      // Stock Mode
      const stockModeRaw = String(getVal('Stock Mode', 'is_unlimited', 'Inventory Mode')).toLowerCase().trim();
      let is_unlimited = 1;
      if (stockModeRaw === 'track inventory' || stockModeRaw === '0' || stockModeRaw === 'limited' || stockModeRaw === 'physical') {
        is_unlimited = 0;
      }

      const stockQtyVal = parseFloat(getVal('Stock Qty', 'stock_qty', 'Available Stock'));
      const stock_qty = isNaN(stockQtyVal) ? 0 : stockQtyVal;

      // In Stock
      const inStockRaw = String(getVal('In Stock', 'in_stock')).toLowerCase().trim();
      let in_stock = 1;
      if (inStockRaw === 'no' || inStockRaw === '0' || inStockRaw === 'false' || inStockRaw === 'out of stock') {
        in_stock = 0;
      }
      if (is_unlimited === 0 && stock_qty <= 0) {
        in_stock = 0;
      }

      // GST %
      const gstVal = parseFloat(getVal('GST %', 'gst_percent', 'GST'));
      const gst_percent = isNaN(gstVal) ? 5 : gstVal;

      // Status
      const statusRaw = String(getVal('Status', 'disabled')).toLowerCase().trim();
      let disabled = 0;
      if (statusRaw === 'hidden' || statusRaw === '1' || statusRaw === 'disabled') {
        disabled = 1;
      }

      // Subscription
      const subRaw = String(getVal('Subscription', 'subscribe_flg', 'Recurring')).toLowerCase().trim();
      let subscribe_flg = 0;
      if (subRaw === 'yes' || subRaw === '1' || subRaw === 'true' || subRaw === 'enabled') {
        subscribe_flg = 1;
      }

      // Delivery slots
      const parseSlot = (val: string, defaultVal: number): number => {
        const s = String(val).toLowerCase().trim();
        if (s === 'yes' || s === '1' || s === 'true') return 1;
        if (s === 'no' || s === '0' || s === 'false') return 0;
        return defaultVal;
      };

      const allow_next_day = parseSlot(getVal('Next Day Delivery', 'allow_next_day', 'Next Day'), 1);
      const allow_immediate_10 = parseSlot(getVal('Immediate 10 Min', 'allow_immediate_10', '10 Min'), 0);
      const allow_immediate_30 = parseSlot(getVal('Immediate 30 Min', 'allow_immediate_30', '30 Min'), 0);
      const allow_immediate_60 = parseSlot(getVal('Immediate 60 Min', 'allow_immediate_60', '60 Min'), 0);

      // Delivery days
      const daysRaw = String(getVal('Delivery Days', 'preferred_days', 'Schedule')).trim();
      const preferred_days = daysRaw || 'All Days';

      const img_url = String(getVal('Image URL', 'img_url', 'Image')).trim() || 'assets/categories/Thinkspot_veggiesIcon.png';

      // Validation & Action Detection
      const errors: string[] = [];
      if (!name) {
        errors.push('Product Name is required');
      }
      if (price <= 0) {
        errors.push('Selling price must be greater than 0');
      }

      let actionType: 'NEW' | 'UPDATE' | 'INVALID' = 'NEW';
      if (errors.length > 0) {
        actionType = 'INVALID';
      } else {
        const matchById = id ? this.existingProducts.find(p => String(p.id).toLowerCase() === id.toLowerCase()) : null;
        const matchByName = this.existingProducts.find(p => p.name && p.name.toLowerCase().trim() === name.toLowerCase().trim());
        if (matchById || matchByName) {
          actionType = 'UPDATE';
        } else {
          actionType = 'NEW';
        }
      }

      rows.push({
        rowIndex: idx + 2,
        id: id || undefined,
        name,
        tamil_name,
        cat,
        sub_cat,
        price,
        original_price,
        stock_price,
        profit_percent: 20,
        show_off_percent: original_price > price ? Math.round(((original_price - price) / original_price) * 100) : 0,
        weight,
        unit_name,
        img_url,
        gst_percent,
        is_unlimited,
        stock_qty,
        in_stock,
        disabled,
        subscribe_flg,
        allow_next_day,
        allow_immediate_10,
        allow_immediate_30,
        allow_immediate_60,
        preferred_days,
        actionType,
        validationErrors: errors
      });
    });

    this.parsedRows = rows;
  }

  downloadSampleTemplate(): void {
    const templateData = [
      {
        'Product ID': '',
        'Product Name': 'Fresh Organic Country Tomatoes',
        'Tamil Name': 'நாட்டு தக்காளி',
        'Category': 'Vegetables',
        'Sub Category': 'Country',
        'Selling Price': 45,
        'MRP': 55,
        'Cost Price': 35,
        'Weight': 500,
        'Unit': 'grams',
        'Stock Mode': 'Market Sourced',
        'Stock Qty': 0,
        'In Stock': 'Yes',
        'GST %': 5,
        'Status': 'Active',
        'Subscription': 'Yes',
        'Next Day Delivery': 'Yes',
        'Immediate 10 Min': 'No',
        'Immediate 30 Min': 'Yes',
        'Immediate 60 Min': 'Yes',
        'Delivery Days': 'All Days',
        'Image URL': 'assets/categories/Thinkspot_veggiesIcon.png'
      },
      {
        'Product ID': '',
        'Product Name': 'Alphonso Mango Grade A',
        'Tamil Name': 'அல்போன்சா மாம்பழம்',
        'Category': 'Fruits',
        'Sub Category': 'Exotic',
        'Selling Price': 180,
        'MRP': 220,
        'Cost Price': 140,
        'Weight': 1,
        'Unit': 'kg',
        'Stock Mode': 'Track Inventory',
        'Stock Qty': 25,
        'In Stock': 'Yes',
        'GST %': 5,
        'Status': 'Active',
        'Subscription': 'No',
        'Next Day Delivery': 'Yes',
        'Immediate 10 Min': 'No',
        'Immediate 30 Min': 'No',
        'Immediate 60 Min': 'Yes',
        'Delivery Days': 'Wednesday, Friday, Saturday',
        'Image URL': 'assets/categories/fruitsIcons.png'
      },
      {
        'Product ID': '',
        'Product Name': 'Farm Fresh Cow Milk',
        'Tamil Name': 'பசும்பால்',
        'Category': 'Dairy',
        'Sub Category': 'Fresh Milk',
        'Selling Price': 38,
        'MRP': 40,
        'Cost Price': 32,
        'Weight': 500,
        'Unit': 'ml',
        'Stock Mode': 'Market Sourced',
        'Stock Qty': 0,
        'In Stock': 'Yes',
        'GST %': 0,
        'Status': 'Active',
        'Subscription': 'Yes',
        'Next Day Delivery': 'Yes',
        'Immediate 10 Min': 'Yes',
        'Immediate 30 Min': 'Yes',
        'Immediate 60 Min': 'Yes',
        'Delivery Days': 'All Days',
        'Image URL': 'assets/categories/Thinkspot_milkIcon.png'
      },
      {
        'Product ID': '',
        'Product Name': 'Fresh Palak Spinach (Pasalai Keerai)',
        'Tamil Name': 'பசலைக்கீரை',
        'Category': 'Greens',
        'Sub Category': 'Fresh Greens',
        'Selling Price': 25,
        'MRP': 30,
        'Cost Price': 18,
        'Weight': 1,
        'Unit': 'pack',
        'Stock Mode': 'Market Sourced',
        'Stock Qty': 0,
        'In Stock': 'Yes',
        'GST %': 0,
        'Status': 'Active',
        'Subscription': 'Yes',
        'Next Day Delivery': 'Yes',
        'Immediate 10 Min': 'No',
        'Immediate 30 Min': 'Yes',
        'Immediate 60 Min': 'Yes',
        'Delivery Days': 'Monday, Tuesday, Thursday, Saturday',
        'Image URL': 'assets/categories/Thinkspot_greensIcon.png'
      },
      {
        'Product ID': '',
        'Product Name': 'Fresh Natural Tender Coconut',
        'Tamil Name': 'இளநீர்',
        'Category': 'Tender Coconut',
        'Sub Category': 'Fresh Nut',
        'Selling Price': 55,
        'MRP': 60,
        'Cost Price': 42,
        'Weight': 1,
        'Unit': 'pcs',
        'Stock Mode': 'Track Inventory',
        'Stock Qty': 40,
        'In Stock': 'Yes',
        'GST %': 5,
        'Status': 'Active',
        'Subscription': 'Yes',
        'Next Day Delivery': 'Yes',
        'Immediate 10 Min': 'Yes',
        'Immediate 30 Min': 'Yes',
        'Immediate 60 Min': 'Yes',
        'Delivery Days': 'All Days',
        'Image URL': 'assets/categories/Thinkspot_tenderCocoIcon.png'
      }
    ];

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(templateData);

    // Auto-fit column widths
    const colWidths = [
      { wch: 16 }, // Product ID
      { wch: 34 }, // Product Name
      { wch: 22 }, // Tamil Name
      { wch: 16 }, // Category
      { wch: 16 }, // Sub Category
      { wch: 14 }, // Selling Price
      { wch: 12 }, // MRP
      { wch: 12 }, // Cost Price
      { wch: 10 }, // Weight
      { wch: 10 }, // Unit
      { wch: 18 }, // Stock Mode
      { wch: 12 }, // Stock Qty
      { wch: 12 }, // In Stock
      { wch: 8 },  // GST %
      { wch: 10 }, // Status
      { wch: 14 }, // Subscription
      { wch: 18 }, // Next Day Delivery
      { wch: 18 }, // Immediate 10 Min
      { wch: 18 }, // Immediate 30 Min
      { wch: 18 }, // Immediate 60 Min
      { wch: 30 }, // Delivery Days
      { wch: 45 }  // Image URL
    ];
    ws['!cols'] = colWidths;

    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products Template');

    XLSX.writeFile(wb, 'thinkspot_product_bulk_template.xlsx');
  }

  exportCurrentCatalog(): void {
    if (!this.existingProducts || this.existingProducts.length === 0) {
      alert("No products currently loaded in catalog to export.");
      return;
    }

    const exportRows = this.existingProducts.map(p => {
      let prefDays = 'All Days';
      if (p.preferred_days) {
        if (Array.isArray(p.preferred_days)) prefDays = p.preferred_days.join(', ');
        else if (typeof p.preferred_days === 'string') {
          try {
            const arr = JSON.parse(p.preferred_days);
            if (Array.isArray(arr) && arr.length > 0) prefDays = arr.join(', ');
          } catch (e) {
            prefDays = p.preferred_days;
          }
        }
      }

      return {
        'Product ID': p.id,
        'Product Name': p.name,
        'Tamil Name': p.tamil_name || '',
        'Category': p.cat || p.main_category || 'Vegetables',
        'Sub Category': p.sub_cat || 'General',
        'Selling Price': p.price,
        'MRP': p.original_price || p.price,
        'Cost Price': p.stock_price || p.avg_cost || 0,
        'Weight': p.weight || 500,
        'Unit': p.unit_name || 'grams',
        'Stock Mode': (p.is_unlimited == 1 || p.is_unlimited === true) ? 'Market Sourced' : 'Track Inventory',
        'Stock Qty': p.stock_qty || 0,
        'In Stock': (p.in_stock !== false && p.in_stock !== 0) ? 'Yes' : 'No',
        'GST %': p.gst_percent !== undefined ? p.gst_percent : 5,
        'Status': p.disabled ? 'Hidden' : 'Active',
        'Subscription': (p.subscribe_flg == 1 || p.subscribeFlg === true) ? 'Yes' : 'No',
        'Next Day Delivery': (p.allow_next_day !== 0 && p.allow_next_day !== false) ? 'Yes' : 'No',
        'Immediate 10 Min': p.allow_immediate_10 == 1 ? 'Yes' : 'No',
        'Immediate 30 Min': p.allow_immediate_30 == 1 ? 'Yes' : 'No',
        'Immediate 60 Min': p.allow_immediate_60 == 1 ? 'Yes' : 'No',
        'Delivery Days': prefDays,
        'Image URL': p.img_url || ''
      };
    });

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportRows);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Live Catalog');
    XLSX.writeFile(wb, `thinkspot_catalog_export_${new Date().toISOString().substring(0, 10)}.xlsx`);
  }

  submitBulkUpload(): void {
    const validRows = this.parsedRows.filter(r => r.actionType !== 'INVALID');
    if (validRows.length === 0) {
      alert("No valid product rows to upload. Please correct any validation issues in your Excel file.");
      return;
    }

    if (this.invalidCount > 0) {
      if (!confirm(`Warning: ${this.invalidCount} row(s) have validation errors and will be skipped.\nDo you want to proceed with uploading the remaining ${validRows.length} valid product(s)?`)) {
        return;
      }
    }

    this.isUploading = true;
    this.uploadProgress = 20;

    const payload = validRows.map(r => ({
      id: r.id,
      name: r.name,
      tamil_name: r.tamil_name,
      cat: r.cat,
      sub_cat: r.sub_cat,
      price: r.price,
      original_price: r.original_price,
      stock_price: r.stock_price,
      profit_percent: r.profit_percent,
      show_off_percent: r.show_off_percent,
      weight: r.weight,
      unit_name: r.unit_name,
      img_url: r.img_url,
      gst_percent: r.gst_percent,
      is_unlimited: r.is_unlimited,
      stock_qty: r.stock_qty,
      in_stock: r.in_stock,
      disabled: r.disabled,
      subscribe_flg: r.subscribe_flg,
      allow_next_day: r.allow_next_day,
      allow_immediate_10: r.allow_immediate_10,
      allow_immediate_30: r.allow_immediate_30,
      allow_immediate_60: r.allow_immediate_60,
      preferred_days: r.preferred_days
    }));

    this.uploadProgress = 60;
    this.apiS.postApi('admin/bulk_upload_products.php', { data: JSON.stringify({ products: payload }) }).subscribe({
      next: (res: any) => {
        this.uploadProgress = 100;
        this.isUploading = false;
        this.uploadResult = res;
        alert(res?.message || `Bulk upload completed successfully! ${res.inserted || 0} product(s) added, ${res.updated || 0} product(s) updated.`);
        this.loadCatalogContext();
      },
      error: (err: any) => {
        this.isUploading = false;
        alert("Bulk upload failed: " + (err?.error?.error || err?.message || 'Server error'));
      }
    });
  }

  clearLoadedFile(): void {
    this.fileName = '';
    this.fileSizeText = '';
    this.parsedRows = [];
    this.uploadResult = null;
  }

  goBack(): void {
    this.router.navigate(['/admin/products/list']);
  }
}
