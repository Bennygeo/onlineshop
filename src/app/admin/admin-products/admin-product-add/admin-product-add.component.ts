import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';

export interface CategoryOption {
  id?: number;
  key: string;
  label: string;
  img_url?: string;
}

@Component({
  selector: 'app-admin-product-add',
  templateUrl: './admin-product-add.component.html',
  styleUrls: ['./admin-product-add.component.scss']
})
export class AdminProductAddComponent implements OnInit {
  Math = Math;
  categoryOptions: CategoryOption[] = [];
  categoriesLoading: boolean = false;
  isSubmitting: boolean = false;

  unitOptions: string[] = ['grams', 'kg', 'pack', 'ltr', 'ml', 'pcs'];
  weekDaysList: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  presetImages = [
    { label: 'Vegetables', url: 'assets/categories/Thinkspot_veggiesIcon.png' },
    { label: 'Fruits', url: 'assets/categories/fruitsIcons.png' },
    { label: 'Greens', url: 'assets/categories/Thinkspot_greensIcon.png' },
    { label: 'Milk / Dairy', url: 'assets/categories/Thinkspot_milkIcon.png' },
    { label: 'Tender Coconut', url: 'assets/categories/Thinkspot_tenderCocoIcon.png' },
    { label: 'Batter / Idli', url: 'assets/categories/Thinkspot_BatterIcon.png' }
  ];

  product: any = {
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
    stock_qty: 0,
    is_unlimited: 1,
    disabled: 0,
    allow_next_day: 1,
    allow_immediate_10: 0,
    allow_immediate_30: 0,
    allow_immediate_60: 0,
    subscribe_flg: 0,
    preferred_days: []
  };

  constructor(
    private apiS: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCategories();
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
            img_url: c.img_url
          }));
          if (this.categoryOptions.length > 0 && !this.product.cat) {
            this.product.cat = this.categoryOptions[0].key;
          }
        }
      },
      error: () => {
        this.categoriesLoading = false;
      }
    });
  }

  // Live Auto Pricing Calculation Helpers
  get calculatedBaseWithProfit(): number {
    const cost = parseFloat(this.product.stock_price) || 0;
    const profit = parseFloat(this.product.profit_percent) || 0;
    return Math.round(cost * (1 + profit / 100));
  }

  get calculatedGstAmount(): number {
    const base = this.calculatedBaseWithProfit;
    const gst = parseFloat(this.product.gst_percent) || 0;
    return Math.round(base * (gst / 100));
  }

  get calculatedSuggestedPrice(): number {
    return this.calculatedBaseWithProfit + this.calculatedGstAmount;
  }

  get calculatedSuggestedMRP(): number {
    return Math.round(this.calculatedSuggestedPrice * 1.18);
  }

  applyCalculatedPricing(): void {
    this.product.price = this.calculatedSuggestedPrice;
    this.product.original_price = this.calculatedSuggestedMRP;
  }

  // Delivery Days Management
  isDaySelected(day: string): boolean {
    if (!this.product.preferred_days) return false;
    const days = Array.isArray(this.product.preferred_days) ? this.product.preferred_days : [];
    return days.includes(day);
  }

  togglePreferredDay(day: string): void {
    if (!Array.isArray(this.product.preferred_days)) {
      this.product.preferred_days = [];
    }
    const idx = this.product.preferred_days.indexOf(day);
    if (idx > -1) {
      this.product.preferred_days.splice(idx, 1);
    } else {
      this.product.preferred_days.push(day);
    }
  }

  setAllDaysPreferred(): void {
    this.product.preferred_days = [];
  }

  getPreferredDaysBadge(): string {
    const days = this.product.preferred_days;
    if (!days || days.length === 0 || days.length >= 7) return 'All Days (No restriction)';
    if (days.length === 1) return `${days[0]} only`;
    return days.join(', ');
  }

  selectPresetImage(url: string): void {
    this.product.img_url = url;
  }

  resetForm(): void {
    const defaultCat = this.categoryOptions.length > 0 ? this.categoryOptions[0].key : 'Vegetables';
    this.product = {
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
      stock_qty: 0,
      is_unlimited: 1,
      disabled: 0,
      allow_next_day: 1,
      allow_immediate_10: 0,
      allow_immediate_30: 0,
      allow_immediate_60: 0,
      subscribe_flg: 0,
      preferred_days: []
    };
  }

  submitProduct(createAnother: boolean = false): void {
    if (!this.product.name || !this.product.name.trim()) {
      alert("Product Name is required!");
      return;
    }
    if (!this.product.unit_name) {
      alert("Unit name is required!");
      return;
    }
    if (this.product.price === undefined || this.product.price === null || this.product.price < 0) {
      alert("Please provide a valid Selling Price!");
      return;
    }

    const payload = { ...this.product };
    const stockQtyNum = (payload.stock_qty !== undefined && payload.stock_qty !== null && payload.stock_qty !== '') ? parseFloat(payload.stock_qty) : 0;
    payload.stock_qty = stockQtyNum;
    if (payload.is_unlimited == 1 || payload.is_unlimited === true) {
      payload.is_unlimited = 1;
      payload.in_stock = 1;
    } else {
      payload.is_unlimited = 0;
      payload.in_stock = (stockQtyNum > 0 && payload.in_stock != 0) ? 1 : 0;
    }

    this.isSubmitting = true;
    this.apiS.postApi('admin/add_product.php', { data: JSON.stringify(payload) }).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        alert(res?.message || `"${payload.name}" was successfully added to the catalog!`);
        if (createAnother) {
          this.resetForm();
        } else {
          this.router.navigate(['/admin/products/list']);
        }
      },
      error: (err: any) => {
        this.isSubmitting = false;
        alert("Error adding product: " + (err?.error?.error || err?.message || 'Server error'));
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/products/list']);
  }
}
