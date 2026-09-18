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
  is_partial?: boolean;
  missing_qty: number;
  delivered_weight?: number;
  missing_weight?: number;
  partial_refund_notes?: string;
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
  order_source?: string;
  created_by?: string | null;
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

  // Refund / Partial Weight Modal State
  isRefundModalOpen: boolean = false;
  activeRefundOrder: DeliveryOrder | null = null;
  activeRefundItem: DeliveryItem | null = null;
  
  refundMode: 'weight' | 'quantity' | 'custom' = 'weight';
  orderedWeight: number = 1000;
  deliveredWeight: number = 800;
  missingWeight: number = 200;
  unitRate: number = 0; // price per weight unit (e.g. per gram)
  unitName: string = 'grams';
  refundMissingQty: number = 1;
  calculatedRefundAmt: number = 0;
  customRefundAmt: number = 0;
  refundReason: string = 'Weight deficit / Partial weight delivered';
  isProcessingRefund: boolean = false;
  quickSuggestions: { label: string; delivered: number; shortfall: number; refund: number }[] = [];

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
    return order.items.every(it => it.is_packed || it.is_missing || it.is_partial);
  }

  // Open Refund / Partial Weight Modal
  openRefundModal(order: DeliveryOrder, item: DeliveryItem, event?: Event) {
    if (event) event.stopPropagation();
    this.activeRefundOrder = order;
    this.activeRefundItem = item;

    // Determine unit name and base weight
    this.unitName = item.unit_name || 'grams';
    const isWeightItem = this.unitName.toLowerCase().includes('g') || 
                         this.unitName.toLowerCase().includes('kg') || 
                         this.unitName.toLowerCase().includes('gram') ||
                         (item.weight && item.weight > 1);

    // Calculate total ordered weight
    const singleWeight = Number(item.weight) || (this.unitName.toLowerCase() === 'kg' ? 1000 : 500);
    const itemQty = Number(item.quantity) || 1;
    this.orderedWeight = singleWeight * itemQty;

    // Unit rate = Price per 1 unit of weight (e.g. price per 1 gram)
    if (this.orderedWeight > 0) {
      this.unitRate = (item.price * itemQty) / this.orderedWeight;
    } else {
      this.unitRate = item.price;
    }

    if (isWeightItem) {
      this.refundMode = 'weight';
      this.refundReason = 'Weight shortfall / Partial weight delivered';

      // Default to 80% delivered or deficit of 200g (or 20%)
      const defaultDeficit = Math.min(200, Math.round(this.orderedWeight * 0.2));
      this.missingWeight = defaultDeficit > 0 ? defaultDeficit : Math.round(this.orderedWeight * 0.2);
      this.deliveredWeight = Math.max(0, this.orderedWeight - this.missingWeight);
      this.calculatedRefundAmt = Math.round(this.missingWeight * this.unitRate * 100) / 100;
      this.customRefundAmt = this.calculatedRefundAmt;

      this.generateQuickSuggestions();
    } else {
      this.refundMode = 'quantity';
      this.refundReason = 'Item missing or unavailable during packing/delivery';
      this.refundMissingQty = 1;
      this.calculatedRefundAmt = item.price;
      this.customRefundAmt = item.price;
      this.quickSuggestions = [];
    }

    this.isRefundModalOpen = true;
  }

  generateQuickSuggestions() {
    this.quickSuggestions = [];
    const totalW = this.orderedWeight;
    if (totalW <= 0) return;

    // Suggest based on common weight steps
    let steps: number[] = [];
    if (totalW >= 1000) {
      steps = [100, 200, 250, 500];
    } else if (totalW >= 500) {
      steps = [50, 100, 150, 250];
    } else if (totalW >= 250) {
      steps = [25, 50, 100, 125];
    } else {
      steps = [
        Math.round(totalW * 0.1),
        Math.round(totalW * 0.2),
        Math.round(totalW * 0.25),
        Math.round(totalW * 0.5)
      ];
    }

    steps.forEach(step => {
      if (step > 0 && step < totalW) {
        const delivered = totalW - step;
        const refund = Math.round(step * this.unitRate * 100) / 100;
        this.quickSuggestions.push({
          label: `-${step}${this.unitName} (${delivered}${this.unitName} delivered)`,
          delivered: delivered,
          shortfall: step,
          refund: refund
        });
      }
    });
  }

  onDeliveredWeightChange(val: any) {
    const num = parseFloat(val) || 0;
    this.deliveredWeight = Math.max(0, Math.min(num, this.orderedWeight));
    this.missingWeight = Math.max(0, Math.round((this.orderedWeight - this.deliveredWeight) * 100) / 100);
    this.calculatedRefundAmt = Math.round(this.missingWeight * this.unitRate * 100) / 100;
    this.customRefundAmt = this.calculatedRefundAmt;
  }

  onShortfallWeightChange(val: any) {
    const num = parseFloat(val) || 0;
    this.missingWeight = Math.max(0, Math.min(num, this.orderedWeight));
    this.deliveredWeight = Math.max(0, Math.round((this.orderedWeight - this.missingWeight) * 100) / 100);
    this.calculatedRefundAmt = Math.round(this.missingWeight * this.unitRate * 100) / 100;
    this.customRefundAmt = this.calculatedRefundAmt;
  }

  onMissingQtyChange(qty: number) {
    if (!this.activeRefundItem) return;
    this.refundMissingQty = Math.max(1, Math.min(qty, this.activeRefundItem.quantity));
    this.calculatedRefundAmt = Math.round(this.activeRefundItem.price * this.refundMissingQty * 100) / 100;
    this.customRefundAmt = this.calculatedRefundAmt;
  }

  applySuggestion(sug: { label: string; delivered: number; shortfall: number; refund: number }) {
    this.deliveredWeight = sug.delivered;
    this.missingWeight = sug.shortfall;
    this.calculatedRefundAmt = sug.refund;
    this.customRefundAmt = sug.refund;
  }

  getFinalRefundAmount(): number {
    if (this.refundMode === 'custom') {
      return Math.max(0, this.customRefundAmt || 0);
    }
    return Math.max(0, this.calculatedRefundAmt || 0);
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
    const refundAmount = this.getFinalRefundAmount();
    const reason = this.refundReason;

    const payload: any = {
      action: 'report_missing_item',
      order_id: orderId,
      item_id: itemId,
      refund_type: this.refundMode,
      refund_amount: refundAmount,
      reason: reason,
      date: this.selectedDate
    };

    if (this.refundMode === 'weight') {
      payload.delivered_weight = this.deliveredWeight;
      payload.missing_weight = this.missingWeight;
      payload.unit_name = this.unitName;
    } else {
      payload.missing_qty = this.refundMissingQty;
    }

    this.apiS.postApi('delivery/update_delivery_status.php', {
      data: JSON.stringify(payload)
    }).subscribe({
      next: (res: any) => {
        this.isProcessingRefund = false;
        this.closeRefundModal();
        this.showToast('Refund Processed', res.message || 'Refund credited to customer wallet and order updated', 'success');
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
