import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin-orders',
  templateUrl: './admin-orders.component.html',
  styleUrls: ['./admin-orders.component.scss']
})
export class AdminOrdersComponent implements OnInit {
  orders: any[] = [];
  deliveryBoys: any[] = [];
  loading: boolean = false;

  statusFilter: string = 'ALL';

  constructor(private apiS: ApiService) {}

  ngOnInit(): void {
    this.loadOrders();
    this.loadDeliveryBoys();
  }

  loadOrders() {
    this.loading = true;
    this.apiS.postApi('admin/get_all_orders.php').subscribe({
      next: (res: any) => {
        this.loading = false;
        if (Array.isArray(res)) {
          this.orders = res;
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

  get filteredOrders() {
    if (this.statusFilter === 'ALL') return this.orders;
    return this.orders.filter(o => String(o.status).toUpperCase() === this.statusFilter);
  }

  assignDeliveryBoy(order: any, event: any) {
    const dboyName = event.target.value;
    this.apiS.postApi('admin/assign_delivery.php', {
      data: JSON.stringify({ order_id: order.order_id || order.id, assignedTo: dboyName })
    }).subscribe({
      next: () => {
        order.assigned_to = dboyName;
        alert(`Order ${order.order_id || order.id} assigned to ${dboyName}`);
      }
    });
  }

  updateOrderStatus(order: any, event: any) {
    const newStatus = event.target.value;
    this.apiS.postApi('admin/assign_delivery.php', {
      data: JSON.stringify({ order_id: order.order_id || order.id, status: newStatus })
    }).subscribe({
      next: () => {
        order.status = newStatus;
        alert(`Order status updated to ${newStatus}`);
      }
    });
  }
}
