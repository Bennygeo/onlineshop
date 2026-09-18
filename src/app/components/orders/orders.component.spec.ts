import { TestBed } from '@angular/core/testing';
import { OrdersComponent } from './orders.component';
import { ComponentFixture } from '@angular/core/testing';
import { CartService } from 'src/app/services/cart.service';
import { OrderService } from 'src/app/services/order.service';
import { LoginService } from 'src/app/services/login.service';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { StorageService } from 'src/app/services/storage.service';
import { ApiService } from 'src/app/services/api.service';
import { BehaviorSubject, of, throwError } from 'rxjs';

// ─────────────────────────────────────────────────────────
// OrdersComponent Tests
// ─────────────────────────────────────────────────────────
describe('OrdersComponent', () => {
  let component: OrdersComponent;
  let fixture: ComponentFixture<OrdersComponent>;
  let mockOrderService: jasmine.SpyObj<OrderService>;
  let mockCartService: any;
  let mockLoginService: any;

  beforeEach(async () => {
    mockOrderService = jasmine.createSpyObj('OrderService', [
      'getOrders',
      'getActiveSubscriptions',
      'cancelOrder',
      'cancelOrderItem',
      'getIndividualOrder',
      'getMultipleProducts',
      'orderAgain',
    ]);
    mockOrderService.ordersEvent = new BehaviorSubject<any>(undefined);
    mockOrderService.orderIndividualEvent = new BehaviorSubject<any>(undefined);
    mockOrderService.orderCancelEvent = new BehaviorSubject<any>(undefined);
    mockOrderService.getActiveSubscriptions.and.returnValue(of([]));
    mockOrderService.getOrders.and.stub();

    mockLoginService = {
      user: { mobile: '9876543210', wallet: 500 },
      userStatus: 'LOGIN',
      readWallet: jasmine.createSpy('readWallet'),
      loginChangeEvent: new BehaviorSubject('LOGIN'),
    };

    mockCartService = {
      router: { navigate: jasmine.createSpy('navigate') },
      headerChangeEvent: { next: jasmine.createSpy('next') },
      editSubsPaymentTrack: false,
    };

    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      declarations: [OrdersComponent],
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        { provide: CartService, useValue: mockCartService },
        { provide: LoginService, useValue: mockLoginService },
        ApiService,
        StorageService,
        { provide: 'Utils', useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersComponent);
    component = fixture.componentInstance;

    // Stub DOM queries used by openTab
    spyOn(document, 'querySelector').and.callFake((selector: string) => {
      return { style: { display: '' } } as any;
    });
  });

  afterEach(() => localStorage.clear());

  // ── 1. safeDate() ─────────────────────────────────────
  describe('safeDate()', () => {
    it('should return today for null input', () => {
      const result = component.safeDate(null);
      expect(result instanceof Date).toBeTrue();
      expect(isNaN(result.getTime())).toBeFalse();
    });

    it('should return today for "undefined" string', () => {
      const result = component.safeDate('undefined');
      expect(isNaN(result.getTime())).toBeFalse();
    });

    it('should return today for "0000-00-00" invalid date string', () => {
      const result = component.safeDate('0000-00-00');
      expect(isNaN(result.getTime())).toBeFalse();
    });

    it('should return today for an already-invalid Date object', () => {
      const result = component.safeDate(new Date('invalid'));
      expect(isNaN(result.getTime())).toBeFalse();
    });

    it('should correctly parse a valid date string', () => {
      const result = component.safeDate('2026-09-18 07:30:00');
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(8); // September = 8
    });

    it('should return the same valid Date object unchanged', () => {
      const d = new Date('2026-01-15');
      const result = component.safeDate(d);
      expect(result.getFullYear()).toBe(2026);
    });
  });

  // ── 2. formatShortId() ────────────────────────────────
  describe('formatShortId()', () => {
    it('should return empty string for falsy input', () => {
      expect(component.formatShortId('')).toBe('');
    });

    it('should return last segment for ORD_YYYYMMDDHHMMSS_NNN format', () => {
      expect(component.formatShortId('ORD_20260918123456_789')).toBe('#789');
    });

    it('should return last 5 chars for IDs longer than 8 chars with no underscores', () => {
      expect(component.formatShortId('ABCDE12345')).toBe('#12345');
    });

    it('should return full id with # for short IDs', () => {
      expect(component.formatShortId('ABC')).toBe('#ABC');
    });
  });

  // ── 3. getStatusBadge() ───────────────────────────────
  describe('getStatusBadge()', () => {
    it('should return correct badge for PLACED status', () => {
      const badge = component.getStatusBadge('PLACED');
      expect(badge.label).toBe('Order Placed');
      expect(badge.class).toBe('status-placed');
    });

    it('should return correct badge for DELIVERED status', () => {
      const badge = component.getStatusBadge('DELIVERED');
      expect(badge.label).toBe('Delivered');
      expect(badge.class).toBe('status-delivered');
    });

    it('should return correct badge for CANCELLED status', () => {
      const badge = component.getStatusBadge('CANCELLED');
      expect(badge.label).toBe('Cancelled');
      expect(badge.class).toBe('status-cancelled');
    });

    it('should return correct badge for OUT_FOR_DELIVERY status', () => {
      const badge = component.getStatusBadge('OUT_FOR_DELIVERY');
      expect(badge.label).toBe('Out for Delivery');
    });

    it('should return default badge for unknown status', () => {
      const badge = component.getStatusBadge('SOME_RANDOM_STATUS');
      expect(badge.class).toBe('status-placed');
      expect(badge.icon).toBe('info');
    });

    it('should handle null status without crashing', () => {
      const badge = component.getStatusBadge(null as any);
      expect(badge).toBeTruthy();
    });
  });

  // ── 4. getDeliveryModeText() ──────────────────────────
  describe('getDeliveryModeText()', () => {
    it('should return "Leave at door" for mode=0', () => {
      expect(component.getDeliveryModeText('0')).toBe('Leave at door');
    });
    it('should return "Ring the bell" for mode=1', () => {
      expect(component.getDeliveryModeText('1')).toBe('Ring the bell');
    });
    it('should return "Hand it over to me" for mode=2', () => {
      expect(component.getDeliveryModeText('2')).toBe('Hand it over to me');
    });
    it('should return "Leave at door" for null mode', () => {
      expect(component.getDeliveryModeText(null)).toBe('Leave at door');
    });
  });

  // ── 5. getDeliveryOptionBadge() ───────────────────────
  describe('getDeliveryOptionBadge()', () => {
    it('should return 10-min badge for IMMEDIATE_10', () => {
      const badge = component.getDeliveryOptionBadge('IMMEDIATE_10');
      expect(badge.label).toBe('10 Mins Delivery');
      expect(badge.class).toBe('opt-10m');
    });

    it('should return next-day badge for NEXT_DAY_7AM', () => {
      const badge = component.getDeliveryOptionBadge('NEXT_DAY_7AM');
      expect(badge.label).toBe('Tomorrow 7:00 AM IST');
    });

    it('should return next-day badge for empty/null delivery option', () => {
      const badge = component.getDeliveryOptionBadge('');
      expect(badge.label).toBe('Tomorrow 7:00 AM IST');
    });
  });

  // ── 6. isSubscriptionProduct() ───────────────────────
  describe('isSubscriptionProduct()', () => {
    it('should return false for null input', () => {
      expect(component.isSubscriptionProduct(null)).toBeFalse();
    });

    it('should return true when is_subscription is explicitly true', () => {
      expect(component.isSubscriptionProduct({ is_subscription: true })).toBeTrue();
    });

    it('should return true for subscriptionType = "daily"', () => {
      expect(component.isSubscriptionProduct({ subscriptionType: 'daily' })).toBeTrue();
    });

    it('should return true for subscriptionType = "range"', () => {
      expect(component.isSubscriptionProduct({ subscriptionType: 'range' })).toBeTrue();
    });

    it('should return true when rangeDates is a non-empty array', () => {
      expect(component.isSubscriptionProduct({ rangeDates: ['2026-09-18', '2026-09-19'] })).toBeTrue();
    });

    it('should return false for empty rangeDates array', () => {
      expect(component.isSubscriptionProduct({ rangeDates: [] })).toBeFalse();
    });

    it('should return false for rangeDates = "[]" string', () => {
      expect(component.isSubscriptionProduct({ rangeDates: '[]' })).toBeFalse();
    });

    it('should return false for malformed JSON in rangeDates', () => {
      expect(() => component.isSubscriptionProduct({ rangeDates: '{bad json}' })).not.toThrow();
    });
  });

  // ── 7. getItemDaysCount() ─────────────────────────────
  describe('getItemDaysCount()', () => {
    it('should return 1 for null product', () => {
      expect(component.getItemDaysCount(null)).toBe(1);
    });

    it('should count dates from rangeDates array', () => {
      const item = { subscriptionType: 'range', rangeDates: ['2026-09-18', '2026-09-19', '2026-09-20'] };
      expect(component.getItemDaysCount(item)).toBe(3);
    });

    it('should fallback to subscribedDates when rangeDates empty', () => {
      const item = {
        subscribedDates: JSON.stringify(['2026-09-20', '2026-09-21']),
        rangeDates: '[]',
      };
      expect(component.getItemDaysCount(item)).toBe(2);
    });

    it('should return 1 when both date arrays are empty', () => {
      expect(component.getItemDaysCount({ rangeDates: [], subscribedDates: [] })).toBe(1);
    });
  });

  // ── 8. getItemTotalPrice() ────────────────────────────
  describe('getItemTotalPrice()', () => {
    it('should return 0 for null product', () => {
      expect(component.getItemTotalPrice(null)).toBe(0);
    });

    it('should return the raw price directly when price > 0', () => {
      expect(component.getItemTotalPrice({ price: 500 })).toBe(500);
    });

    it('should compute unit_price * qty when price is 0', () => {
      const item = { price: 0, unit_price: 50, units: 3, subscriptionType: 'none' };
      // 3 units * 50 price = 150 (days=1 for non-subscription)
      expect(component.getItemTotalPrice(item)).toBe(150);
    });
  });

  // ── 9. getOrderThumbnails() ───────────────────────────
  describe('getOrderThumbnails()', () => {
    it('should return [] for null order', () => {
      expect(component.getOrderThumbnails(null)).toEqual([]);
    });

    it('should return up to 4 thumbnails from products array', () => {
      const order = {
        products: [
          { img_url: 'img1.jpg', name: 'P1' },
          { img_url: 'img2.jpg', name: 'P2' },
          { img_url: 'img3.jpg', name: 'P3' },
          { img_url: 'img4.jpg', name: 'P4' },
          { img_url: 'img5.jpg', name: 'P5' }, // 5th should be excluded
        ],
      };
      const thumbs = component.getOrderThumbnails(order);
      expect(thumbs.length).toBe(4);
    });

    it('should fallback to itemsList when products is empty', () => {
      const order = {
        products: [],
        itemsList: [
          { img_url: 'item1.jpg', product_name: 'Item 1' },
          { img_url: 'item2.jpg', product_name: 'Item 2' },
        ],
      };
      const thumbs = component.getOrderThumbnails(order);
      expect(thumbs.length).toBe(2);
    });

    it('should use fallback image when img_url is missing', () => {
      const order = { products: [{ name: 'No Image Product' }] };
      const thumbs = component.getOrderThumbnails(order);
      expect(thumbs[0].img).toBe('assets/orders/orders_veg.png');
    });
  });

  // ── 10. orderCancelConfirmAction() ────────────────────
  describe('orderCancelConfirmAction()', () => {
    it('should do nothing when targetOrder is null', () => {
      component.targetOrder = null;
      component.orderCancelConfirmAction();
      expect(mockOrderService.cancelOrder).not.toHaveBeenCalled();
    });

    it('should call cancelOrder and show success toast on SUCCESS response', () => {
      component.targetOrder = {
        order_id: 'ORD_001',
        status: 'PLACED',
        payment_type: 'Wallet',
      };
      mockOrderService.cancelOrder.and.returnValue(of({
        status: 'SUCCESS',
        refund_amount: 200,
        wallet_balance: 700,
      }));
      spyOn(component, 'showToast');

      component.orderCancelConfirmAction();

      expect(mockOrderService.cancelOrder).toHaveBeenCalled();
      expect(component.targetOrder.status).toBe('CANCELLED');
      expect(component.showToast).toHaveBeenCalledWith(
        jasmine.stringContaining('refunded'), 'success'
      );
    });

    it('should show info toast for COD order cancellation (no refund)', () => {
      component.targetOrder = {
        order_id: 'ORD_COD_001',
        status: 'PLACED',
        payment_type: 'COD',
      };
      mockOrderService.cancelOrder.and.returnValue(of({
        status: 'SUCCESS',
        refund_amount: 0,
        is_cod: true,
      }));
      spyOn(component, 'showToast');

      component.orderCancelConfirmAction();

      expect(component.showToast).toHaveBeenCalledWith(
        jasmine.stringContaining('COD'), 'info'
      );
    });

    it('should show error toast when cancelOrder API returns error response', () => {
      component.targetOrder = { order_id: 'ORD_ERR' };
      mockOrderService.cancelOrder.and.returnValue(of({
        error: 'Order not found',
      }));
      spyOn(component, 'showToast');

      component.orderCancelConfirmAction();

      expect(component.showToast).toHaveBeenCalledWith(
        jasmine.stringContaining('not found'), 'error'
      );
    });

    it('should show error toast on HTTP error', () => {
      component.targetOrder = { order_id: 'ORD_HTTP_ERR' };
      mockOrderService.cancelOrder.and.returnValue(throwError(() => ({ error: { error: 'Server error' } })));
      spyOn(component, 'showToast');

      component.orderCancelConfirmAction();

      expect(component.showToast).toHaveBeenCalledWith(
        jasmine.stringContaining('Server error'), 'error'
      );
    });

    it('should move cancelled order from upcomingOrders to pastOrders', () => {
      const order = { order_id: 'ORD_MOVE', status: 'PLACED', payment_type: 'Wallet' };
      component.upcomingOrders = [order];
      component.pastOrders = [];
      component.targetOrder = order;

      mockOrderService.cancelOrder.and.returnValue(of({
        status: 'SUCCESS',
        refund_amount: 0,
      }));

      component.orderCancelConfirmAction();

      expect(component.upcomingOrders.length).toBe(0);
      expect(component.pastOrders.some(o => o.order_id === 'ORD_MOVE')).toBeTrue();
    });
  });

  // ── 11. alertClose() ─────────────────────────────────
  describe('alertClose()', () => {
    it('should reset all cancel flags and targets', () => {
      component.orderCancelFlag = true;
      component.itemCancelFlag = true;
      component.orderViewFlag = true;
      component.targetOrder = { order_id: 'X' };
      component.targetItemToCancel = { id: 1 };
      component.targetItemOrder = { order_id: 'X' };

      component.alertClose();

      expect(component.orderCancelFlag).toBeFalse();
      expect(component.itemCancelFlag).toBeFalse();
      expect(component.orderViewFlag).toBeFalse();
      expect(component.targetOrder).toBeNull();
      expect(component.targetItemToCancel).toBeNull();
      expect(component.targetItemOrder).toBeNull();
    });
  });

  // ── 12. showToast() ───────────────────────────────────
  describe('showToast()', () => {
    it('should set show=true and auto-hide after 4500ms', (done) => {
      jasmine.clock().install();
      component.showToast('Test message', 'success');
      expect(component.toastNotification.show).toBeTrue();
      expect(component.toastNotification.message).toBe('Test message');
      expect(component.toastNotification.type).toBe('success');

      jasmine.clock().tick(4501);
      expect(component.toastNotification.show).toBeFalse();
      jasmine.clock().uninstall();
      done();
    });
  });
});
