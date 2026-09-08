import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../services/api.service';

export interface DeliveryPartner {
  id: string;
  name: string;
  phone: string;
  zone: string;
  vehicle: string;
  status: string;
  activeOrders: number;
}

export interface DeliveryItem {
  id: number;
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  weight: number;
  unit_name: string;
  img_url: string;
  is_subscription: boolean;
  subscription_type: string;
  item_status: string;
  is_packed: boolean;
  is_missing: boolean;
  missing_qty: number;
  refund_amount: number;
  scheduled_today: boolean;
  today_delivery_status: string;
}

export interface DeliveryOrder {
  order_id: string;
  id: string;
  mobile: string;
  customer_name: string;
  phone: string;
  address: any;
  address_text: string;
  total_amount: number;
  payment_type: string;
  status: string;
  delivery_category: 'packed' | 'delivered' | 'undelivered';
  delivery_date: string;
  assigned_to: string;
  delivery_inst: string;
  delivery_mode: string;
  delivered_at: string | null;
  undelivered_reason: string;
  refund_amount: number;
  refund_notes: string;
  order_type: 'regular' | 'subscription';
  items: DeliveryItem[];
  items_count: number;
  created_at: string;
  expanded?: boolean;
}

@Component({
  selector: 'app-admin-delivery',
  templateUrl: './admin-delivery.component.html',
  styleUrls: ['./admin-delivery.component.scss']
})
export class AdminDeliveryComponent implements OnInit {
  loading: boolean = false;
  orders: DeliveryOrder[] = [];
  deliveryPartners: DeliveryPartner[] = [];
  
  selectedPartner: string = 'ALL';
  selectedDate: string = '';
  activeTab: 'packed' | 'delivered' | 'undelivered' = 'packed';
  searchQuery: string = '';

  // Stats
  stats = {
    total: 0,
    packed: 0,
    delivered: 0,
    undelivered: 0
  };

  // Missing Item Refund Modal State
  isRefundModalOpen: boolean = false;
  activeRefundOrder: DeliveryOrder | null = null;
  activeRefundItem: DeliveryItem | null = null;
  refundMissingQty: number = 1;
  refundReason: string = 'Item missing or unavailable during packing/delivery';
  isProcessingRefund: boolean = false;

  // Undelivered Order Modal State
  isUndeliveredModalOpen: boolean = false;
  activeUndeliveredOrder: DeliveryOrder | null = null;
  undeliveredReason: string = 'Customer unavailable / Door locked';
  undeliveredRefundWallet: boolean = true;
  isProcessingUndelivered: boolean = false;

  // Toast notification
  toast = {
    show: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  };
  toastTimeout: any = null;

  constructor(private apiS: ApiService) {}

  ngOnInit(): void {
    const today = new Date();
    this.selectedDate = this.formatDate(today);
    this.loadDeliveryPartners();
    this.loadOrders();
  }

  formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  showToast(title: string, message: string, type: 'success' | 'error' | 'info' = 'success') {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.toast = { show: true, title, message, type };
    this.toastTimeout = setTimeout(() => {
      this.toast.show = false;
    }, 4500);
  }

  loadDeliveryPartners() {
    this.apiS.getApi('admin/get_delivery_boys.php').subscribe({
      next: (res: DeliveryPartner[]) => {
        if (Array.isArray(res)) {
          this.deliveryPartners = res;
        }
      },
      error: () => {}
    });
  }

  loadOrders() {
    this.loading = true;
    this.apiS.getApi(`delivery/get_delivery_orders.php?date=${this.selectedDate}&partner=${encodeURIComponent(this.selectedPartner)}`).subscribe({
      next: (res: DeliveryOrder[]) => {
        this.loading = false;
        if (Array.isArray(res)) {
          this.orders = res.map(o => ({
            ...o,
            expanded: true
          }));
          this.calculateStats();
        } else {
          this.orders = [];
          this.calculateStats();
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.showToast('Error', 'Failed to load delivery orders', 'error');
      }
    });
  }

  calculateStats() {
    this.stats.total = this.orders.length;
    this.stats.packed = this.orders.filter(o => o.delivery_category === 'packed').length;
    this.stats.delivered = this.orders.filter(o => o.delivery_category === 'delivered').length;
    this.stats.undelivered = this.orders.filter(o => o.delivery_category === 'undelivered').length;
  }

  switchTab(tab: 'packed' | 'delivered' | 'undelivered') {
    this.activeTab = tab;
  }

  onPartnerChange() {
    this.loadOrders();
  }

  onDateChange(event: any) {
    this.selectedDate = event.target.value;
    this.loadOrders();
  }

  shiftDate(days: number) {
    const current = new Date(this.selectedDate || new Date());
    current.setDate(current.getDate() + days);
    this.selectedDate = this.formatDate(current);
    this.loadOrders();
  }

  isToday(): boolean {
    return this.selectedDate === this.formatDate(new Date());
  }

  get filteredOrders(): DeliveryOrder[] {
    let list = this.orders.filter(o => o.delivery_category === this.activeTab);

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(o => 
        o.order_id.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.phone.toLowerCase().includes(q) ||
        o.address_text.toLowerCase().includes(q) ||
        (o.assigned_to && o.assigned_to.toLowerCase().includes(q))
      );
    }

    return list;
  }

  // Toggle item packing checklist
  toggleItemPacked(order: DeliveryOrder, item: DeliveryItem, event: any) {
    const isPacked = event.target.checked;
    item.is_packed = isPacked;
    item.item_status = isPacked ? 'packed' : 'unpacked';

    this.apiS.postApi('delivery/update_delivery_status.php', {
      data: JSON.stringify({
        action: 'toggle_item_packed',
        item_id: item.id,
        is_packed: isPacked
      })
    }).subscribe({
      next: () => {
        this.showToast('Item Updated', `${item.name} marked as ${isPacked ? 'Packed' : 'Unpacked'}`, 'info');
      },
      error: () => {
        item.is_packed = !isPacked;
        this.showToast('Error', 'Failed to update item status', 'error');
      }
    });
  }

  // Check if all items in order are packed
  isOrderAllPacked(order: DeliveryOrder): boolean {
    if (!order.items || order.items.length === 0) return true;
    return order.items.every(it => it.is_packed || it.is_missing);
  }

  // Open Refund / Missing Item Modal
  openRefundModal(order: DeliveryOrder, item: DeliveryItem, event?: Event) {
    if (event) event.stopPropagation();
    this.activeRefundOrder = order;
    this.activeRefundItem = item;
    this.refundMissingQty = 1;
    this.refundReason = 'Item missing or damaged during dispatch';
    this.isRefundModalOpen = true;
  }

  closeRefundModal() {
    this.isRefundModalOpen = false;
    this.activeRefundOrder = null;
    this.activeRefundItem = null;
  }

  confirmRefund() {
    if (!this.activeRefundOrder || !this.activeRefundItem) return;

    this.isProcessingRefund = true;
    const orderId = this.activeRefundOrder.order_id;
    const itemId = this.activeRefundItem.id;
    const qty = this.refundMissingQty;
    const reason = this.refundReason;

    this.apiS.postApi('delivery/update_delivery_status.php', {
      data: JSON.stringify({
        action: 'report_missing_item',
        order_id: orderId,
        item_id: itemId,
        missing_qty: qty,
        reason: reason,
        date: this.selectedDate
      })
    }).subscribe({
      next: (res: any) => {
        this.isProcessingRefund = false;
        this.closeRefundModal();
        this.showToast('Refund Processed', res.message || 'Refund credited to wallet and ledger updated', 'success');
        this.loadOrders();
      },
      error: (err: any) => {
        this.isProcessingRefund = false;
        this.showToast('Refund Failed', err.message || 'Error processing refund', 'error');
      }
    });
  }

  // Mark as Delivered
  markOrderDelivered(order: DeliveryOrder) {
    const confirmMsg = `Confirm delivery for Order #${order.order_id} (${order.customer_name})?`;
    if (!confirm(confirmMsg)) return;

    this.apiS.postApi('delivery/update_delivery_status.php', {
      data: JSON.stringify({
        action: 'mark_delivered',
        order_id: order.order_id,
        date: this.selectedDate
      })
    }).subscribe({
      next: (res: any) => {
        order.status = 'DELIVERED';
        order.delivery_category = 'delivered';
        order.delivered_at = new Date().toISOString();
        this.calculateStats();
        this.showToast('Delivered!', `Order #${order.order_id} marked as Delivered`, 'success');
      },
      error: (err: any) => {
        this.showToast('Error', err.message || 'Failed to update delivery status', 'error');
      }
    });
  }

  // Open Undelivered Modal
  openUndeliveredModal(order: DeliveryOrder) {
    this.activeUndeliveredOrder = order;
    this.undeliveredReason = 'Customer unavailable / Door locked';
    this.undeliveredRefundWallet = true;
    this.isUndeliveredModalOpen = true;
  }

  closeUndeliveredModal() {
    this.isUndeliveredModalOpen = false;
    this.activeUndeliveredOrder = null;
  }

  confirmUndelivered() {
    if (!this.activeUndeliveredOrder) return;

    this.isProcessingUndelivered = true;
    const orderId = this.activeUndeliveredOrder.order_id;

    this.apiS.postApi('delivery/update_delivery_status.php', {
      data: JSON.stringify({
        action: 'mark_undelivered',
        order_id: orderId,
        reason: this.undeliveredReason,
        refund_to_wallet: this.undeliveredRefundWallet,
        date: this.selectedDate
      })
    }).subscribe({
      next: (res: any) => {
        this.isProcessingUndelivered = false;
        this.closeUndeliveredModal();
        this.showToast('Marked Undelivered', `Order #${orderId} marked as undelivered`, 'info');
        this.loadOrders();
      },
      error: (err: any) => {
        this.isProcessingUndelivered = false;
        this.showToast('Error', err.message || 'Failed to update status', 'error');
      }
    });
  }

  getGoogleMapsUrl(address: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
}
