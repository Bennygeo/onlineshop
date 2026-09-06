import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';

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

  categories: string[] = ['All', 'Vegetables', 'Fruits', 'Naturalhydrants', 'Greenssprouts', 'Woodpressed', 'Honeyspices'];

  isAddModalOpen: boolean = false;
  isEditModalOpen: boolean = false;

  newProduct: any = {
    name: '',
    tamil_name: '',
    cat: 'Vegetables',
    sub_cat: 'General',
    price: 120,
    original_price: 140,
    stock_price: 90,
    profit_percent: 25,
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
          this.filterProducts();
        }
      }
    });
  }

  filterProducts() {
    let list = this.products;
    if (this.selectedCategory !== 'All') {
      list = list.filter(p => p.cat === this.selectedCategory || p.main_category === this.selectedCategory);
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
    this.editingProduct = { ...product };
    this.isEditModalOpen = true;
  }

  closeEditModal() {
    this.isEditModalOpen = false;
    this.editingProduct = null;
  }

  submitUpdateProduct() {
    if (!this.editingProduct) return;

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
