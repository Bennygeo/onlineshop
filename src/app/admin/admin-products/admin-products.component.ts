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
    zone: 'both'
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
    this.apiS.postApi('products/download_products_sql.php', { table_name: 'zone2_products_new_1', cat: 'all' }).subscribe({
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
      zone: 'both'
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
      unit_name: product.unit_name || 'grams'
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

    this.apiS.postApi('admin/update_product.php', { data: JSON.stringify(this.editingProduct) }).subscribe({
      next: (res: any) => {
        alert("Product updated successfully!");
        this.isEditModalOpen = false;
        this.loadProducts();
        this.loadCategories();
      },
      error: (err) => {
        alert("Error updating product: " + (err?.error?.error || err?.message));
      }
    });
  }

  toggleStockStatus(product: any) {
    const newStatus = product.disabled ? 0 : 1;
    this.apiS.postApi('admin/update_product.php', {
      data: JSON.stringify({ id: product.id, disabled: newStatus })
    }).subscribe({
      next: () => {
        product.disabled = newStatus;
      }
    });
  }
}

