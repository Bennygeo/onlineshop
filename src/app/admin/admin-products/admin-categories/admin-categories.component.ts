import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../../services/api.service';

export interface CategoryOption {
  id?: number;
  key: string;
  label: string;
  img_url?: string;
  product_count?: number;
}

@Component({
  selector: 'app-admin-categories',
  templateUrl: './admin-categories.component.html',
  styleUrls: ['./admin-categories.component.scss']
})
export class AdminCategoriesComponent implements OnInit {
  categoryOptions: CategoryOption[] = [];
  categoriesLoading: boolean = false;
  categorySearchQuery: string = '';
  isAddingCategory: boolean = false;

  presetIcons = [
    { label: 'Vegetables', url: 'assets/categories/Thinkspot_veggiesIcon.png' },
    { label: 'Fruits', url: 'assets/categories/fruitsIcons.png' },
    { label: 'Greens', url: 'assets/categories/Thinkspot_greensIcon.png' },
    { label: 'Dairy / Milk', url: 'assets/categories/Thinkspot_milkIcon.png' },
    { label: 'Tender Coconut', url: 'assets/categories/Thinkspot_tenderCocoIcon.png' },
    { label: 'Batter / Staples', url: 'assets/categories/Thinkspot_BatterIcon.png' }
  ];

  newCategory: any = {
    label: '',
    key: '',
    img_url: 'assets/categories/Thinkspot_veggiesIcon.png'
  };

  get totalProductsCount(): number {
    return this.categoryOptions.reduce((acc, c) => acc + (c.product_count || 0), 0);
  }

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
            img_url: c.img_url || 'assets/categories/Thinkspot_veggiesIcon.png',
            product_count: c.product_count || 0
          }));
        }
      },
      error: () => {
        this.categoriesLoading = false;
      }
    });
  }

  getFilteredCategories(): CategoryOption[] {
    if (!this.categorySearchQuery.trim()) {
      return this.categoryOptions;
    }
    const q = this.categorySearchQuery.toLowerCase().trim();
    return this.categoryOptions.filter(c => 
      c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q)
    );
  }

  selectPresetIcon(url: string): void {
    this.newCategory.img_url = url;
  }

  submitAddCategory(): void {
    if (!this.newCategory.label || !this.newCategory.label.trim()) {
      alert("Please enter a category display name!");
      return;
    }

    if (!this.newCategory.key || !this.newCategory.key.trim()) {
      this.newCategory.key = this.newCategory.label.trim().replace(/\s+/g, '_').toLowerCase();
    }

    this.isAddingCategory = true;
    this.apiS.postApi('admin/add_category.php', { data: JSON.stringify(this.newCategory) }).subscribe({
      next: (res: any) => {
        this.isAddingCategory = false;
        alert(res?.message || `Category "${this.newCategory.label}" created successfully!`);
        this.newCategory = {
          label: '',
          key: '',
          img_url: 'assets/categories/Thinkspot_veggiesIcon.png'
        };
        this.loadCategories();
      },
      error: (err: any) => {
        this.isAddingCategory = false;
        alert("Error adding category: " + (err?.error?.error || err?.message || "Unknown error"));
      }
    });
  }

  deleteCategory(cat: CategoryOption): void {
    const warning = (cat.product_count && cat.product_count > 0)
      ? `Warning: There are ${cat.product_count} product(s) associated with "${cat.label}".\nAre you sure you want to remove this category? Products might need re-categorization.`
      : `Are you sure you want to remove the category "${cat.label}"?`;

    if (!confirm(warning)) {
      return;
    }

    this.apiS.postApi('admin/delete_category.php', { data: JSON.stringify({ id: cat.id, key: cat.key }) }).subscribe({
      next: (res: any) => {
        alert(res?.message || "Category removed successfully!");
        this.loadCategories();
      },
      error: (err: any) => {
        alert("Error removing category: " + (err?.error?.error || err?.message || "Unknown error"));
      }
    });
  }

  viewProductsInCategory(catKey: string): void {
    this.router.navigate(['/admin/products/list'], { queryParams: { category: catKey } });
  }

  goBack(): void {
    this.router.navigate(['/admin/products/list']);
  }
}
