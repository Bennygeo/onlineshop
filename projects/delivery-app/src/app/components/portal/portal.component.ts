import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { DeliveryPartner, DeliveryOrder, DeliveryItem } from '../../models/delivery';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.component.html',
  styleUrls: ['./portal.component.scss']
})
export class PortalComponent implements OnInit {
  partner: DeliveryPartner | null = null;
  selectedDate: string = '';
  selectedTab: 'all' | 'packed' | 'delivered' | 'undelivered' = 'all';
  searchQuery: string = '';

  orders: DeliveryOrder[] = [];
  loading = false;
  actionLoading: { [key: string]: boolean } = {};
  errorMessage = '';
  successToast = '';

  // Undelivered modal state
  showUndeliveredModal = false;
  activeOrderForUndelivered: DeliveryOrder | null = null;
  selectedReason = '';
  customReason = '';

  readonly undeliveredReasons = [
    'Customer not reachable / Phone switched off',
    'Customer unavailable at address / Door locked',
    'Customer requested delivery reschedule',
    'Incorrect / Incomplete address provided',
    'Customer refused delivery',
    'Other / Custom Reason'
  ];

  constructor(
    private authService: AuthService,
    private api: ApiService
  ) {}

  ngOnInit(): void {
    this.partner = this.authService.currentPartner;
    const today = new Date();
    this.selectedDate = this.formatDate(today);
    this.loadOrders();
  }

  formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadOrders(): void {
    if (!this.partner) return;
    this.loading = true;
    this.errorMessage = '';

    this.api.get<DeliveryOrder[]>('delivery/get_partner_orders.php', {
      partner: this.partner.name,
      date: this.selectedDate
    }).subscribe({
      next: (data) => {
        this.loading = false;
        if (Array.isArray(data)) {
          // Initialize expanded state
          this.orders = data.map(o => ({
            ...o,
            expanded: o.expanded !== undefined ? o.expanded : true
          }));
        } else {
          this.orders = [];
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.error || 'Failed to fetch assigned delivery orders.';
      }
    });
  }

  changeDate(offsetDays: number): void {
    const parts = this.selectedDate.split('-');
    const cur = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    cur.setDate(cur.getDate() + offsetDays);
    this.selectedDate = this.formatDate(cur);
    this.loadOrders();
  }

  onDateChange(event: any): void {
    if (event.target.value) {
      this.selectedDate = event.target.value;
      this.loadOrders();
    }
  }

  setToday(): void {
    this.selectedDate = this.formatDate(new Date());
    this.loadOrders();
  }

  get filteredOrders(): DeliveryOrder[] {
    return this.orders.filter(order => {
      // Tab filter
      if (this.selectedTab !== 'all' && order.delivery_category !== this.selectedTab) {
        return false;
      }
      // Search query filter
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase().trim();
        const matchId = order.order_id.toLowerCase().includes(q);
        const matchCust = (order.customer_name || '').toLowerCase().includes(q);
        const matchPhone = (order.phone || '').includes(q) || (order.mobile || '').includes(q);
        const matchAddr = (order.address_text || '').toLowerCase().includes(q);
        if (!matchId && !matchCust && !matchPhone && !matchAddr) {
          return false;
        }
      }
      return true;
    });
  }

  get totalOrdersCount(): number {
    return this.orders.length;
  }

  get toDeliverCount(): number {
    return this.orders.filter(o => o.delivery_category === 'packed').length;
  }

  get deliveredCount(): number {
    return this.orders.filter(o => o.delivery_category === 'delivered').length;
  }

  get undeliveredCount(): number {
    return this.orders.filter(o => o.delivery_category === 'undelivered').length;
  }

  toggleExpand(order: DeliveryOrder): void {
    order.expanded = !order.expanded;
  }

  toggleItemPacked(order: DeliveryOrder, item: DeliveryItem, event: Event): void {
    event.stopPropagation();
    const newPackedState = !item.is_packed;
    item.is_packed = newPackedState;
    item.item_status = newPackedState ? 'packed' : 'pending';

    this.api.post<any>('delivery/partner_action.php', {
      action: 'toggle_pack',
      order_id: order.order_id,
      item_id: item.id,
      packed: newPackedState ? 1 : 0,
      partner: this.partner?.name
    }).subscribe({
      next: (res) => {
        // Success
      },
      error: (err) => {
        // Revert on error
        item.is_packed = !newPackedState;
        item.item_status = item.is_packed ? 'packed' : 'pending';
        this.showToast('Failed to update item pack status');
      }
    });
  }

  markDelivered(order: DeliveryOrder): void {
    if (this.actionLoading[order.order_id]) return;
    if (!confirm(`Confirm delivery for Order #${order.order_id}?`)) return;

    this.actionLoading[order.order_id] = true;

    this.api.post<any>('delivery/partner_action.php', {
      action: 'mark_delivered',
      order_id: order.order_id,
      partner: this.partner?.name
    }).subscribe({
      next: (res) => {
        this.actionLoading[order.order_id] = false;
        order.status = 'DELIVERED';
        order.delivery_category = 'delivered';
        order.delivered_at = new Date().toISOString();
        order.items.forEach(i => {
          i.is_packed = true;
          i.item_status = 'delivered';
        });
        this.showToast(`Order #${order.order_id} marked as DELIVERED successfully!`);
      },
      error: (err) => {
        this.actionLoading[order.order_id] = false;
        this.showToast(err?.error?.error || 'Failed to mark order as delivered');
      }
    });
  }

  openUndeliveredModal(order: DeliveryOrder): void {
    this.activeOrderForUndelivered = order;
    this.selectedReason = this.undeliveredReasons[0];
    this.customReason = '';
    this.showUndeliveredModal = true;
  }

  closeUndeliveredModal(): void {
    this.showUndeliveredModal = false;
    this.activeOrderForUndelivered = null;
  }

  confirmUndelivered(): void {
    if (!this.activeOrderForUndelivered) return;
    const order = this.activeOrderForUndelivered;
    const finalReason = this.selectedReason === 'Other / Custom Reason'
      ? (this.customReason.trim() || 'Other delivery issue')
      : this.selectedReason;

    this.actionLoading[order.order_id] = true;
    this.closeUndeliveredModal();

    this.api.post<any>('delivery/partner_action.php', {
      action: 'mark_undelivered',
      order_id: order.order_id,
      reason: finalReason,
      partner: this.partner?.name
    }).subscribe({
      next: (res) => {
        this.actionLoading[order.order_id] = false;
        order.status = 'UNDELIVERED';
        order.delivery_category = 'undelivered';
        order.undelivered_reason = finalReason;
        this.showToast(`Order #${order.order_id} reported as UNDELIVERED.`);
      },
      error: (err) => {
        this.actionLoading[order.order_id] = false;
        this.showToast(err?.error?.error || 'Failed to report undelivered status');
      }
    });
  }

  showToast(msg: string): void {
    this.successToast = msg;
    setTimeout(() => {
      if (this.successToast === msg) {
        this.successToast = '';
      }
    }, 3500);
  }

  getGoogleMapsUrl(address: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }

  logout(): void {
    if (confirm('Are you sure you want to log out?')) {
      this.authService.logout();
    }
  }
}
