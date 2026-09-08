import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';

export interface CategoryOption {
  key: string;
  label: string;
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

  // All Frontend Categories with display labels
  categoryOptions: CategoryOption[] = [
    { key: 'Vegetables', label: 'Vegetables' },
    { key: 'Naturalhydrants', label: 'Natural Hydrants (Tender Coconut)' },
    { key: 'Fruits', label: 'Fruits' },
    { key: 'Greenssprouts', label: 'Greens & Sprouts' },
    { key: 'Flowers', label: 'Flowers' },
    { key: 'Honeyspices', label: 'Honey & Spices' },
    { key: 'Woodpressed', label: 'Woodpressed Oils' },
    { key: 'Dairyeggs', label: 'Dairy & Eggs (Milk)' },
    { key: 'Naturalsugars', label: 'Natural Sugars' },
    { key: 'Lentilspulses', label: 'Lentils & Pulses' },
    { key: 'Breakfast', label: 'Breakfast & Batter' },
    { key: 'Quickmeals', label: 'Quick Meals' },
    { key: 'Traditionalsnacks', label: 'Traditional Snacks' },
    { key: 'Skinhair', label: 'Skin & Hair Care' },
    { key: 'Veg', label: 'Veg' },
    { key: 'Oils', label: 'Oils' },
    { key: 'Eggs', label: 'Eggs' },
    { key: 'Milk', label: 'Milk' },
    { key: 'Tender', label: 'Tender Coconut' },
    { key: 'Sprouts', label: 'Sprouts' },
    { key: 'Batter', label: 'Batter' },
    { key: 'Breads', label: 'Breads' },
    { key: 'Pickles', label: 'Pickles' },
    { key: 'Pets', label: 'Pets' },
    { key: 'Vegan', label: 'Vegan' }
  ];

  isAddModalOpen: boolean = false;
  isEditModalOpen: boolean = false;

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
  message: string = '';

  constructor(private apiS: ApiService) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts() {
    this.apiS.postApi('products/download_products_sql.php', { table_name: 'zone2_products_new_1', cat: 'all' }).subscribe({
      next: (res: any) => {
        if (Array.isArray(res)) {
          this.products = res;
          this.syncCategoriesFromProducts();
          this.filterProducts();
        }
      }
    });
  }

  syncCategoriesFromProducts() {
    // Add any unique categories found in backend products that are not yet in categoryOptions
    this.products.forEach(p => {
      const c = p.cat || p.main_category;
      if (c && !this.categoryOptions.some(opt => opt.key.toLowerCase() === c.toLowerCase())) {
        this.categoryOptions.push({ key: c, label: c });
      }
    });
  }

  getCategoryLabel(key: string): string {
    if (!key) return '';
    const match = this.categoryOptions.find(c => c.key.toLowerCase() === key.toLowerCase());
    return match ? match.label : key;
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

  openAddModal() {
    this.newProduct = {
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
      },
      error: (err) => {
        alert("Error adding product: " + (err?.error?.error || err?.message));
      }
    });
  }

  openEditModal(product: any) {
    this.editingProduct = { 
      ...product,
      cat: product.cat || product.main_category || 'Vegetables',
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
