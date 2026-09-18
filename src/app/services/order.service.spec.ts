import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OrderService } from './order.service';
import { LoginService } from './login.service';
import { ApiService } from './api.service';
import { CartService } from './cart.service';
import { StorageService } from './storage.service';
import { RouterTestingModule } from '@angular/router/testing';
import { environment } from 'src/environments/environment';

const BASE = environment.url;

// ─────────────────────────────────────────────────────────
// OrderService Tests
// ─────────────────────────────────────────────────────────
describe('OrderService', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;
  let loginService: LoginService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, RouterTestingModule],
      providers: [OrderService, LoginService, ApiService, CartService, StorageService],
    });

    loginService = TestBed.inject(LoginService);
    loginService.user.mobile = '9876543210';
    loginService.userStatus = 'LOGIN';

    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
    // flush constructor getOrders + login readUser
    httpMock.match(() => true).forEach(r => r.flush([]));
  });

  afterEach(() => {
    httpMock.match(() => true).forEach(r => r.flush([]));
    httpMock.verify();
    localStorage.clear();
  });

  // ── 1. getOrders() ────────────────────────────────────
  describe('getOrders()', () => {
    it('should emit order list via ordersEvent', fakeAsync(() => {
      const mockOrders = [
        { order_id: 'ORD_001', status: 'PLACED', total_amount: 150, created_at: '2026-09-17 10:00:00' },
        { order_id: 'ORD_002', status: 'DELIVERED', total_amount: 250, created_at: '2026-09-16 10:00:00' },
      ];
      let emittedOrders: any[] | undefined;
      service.ordersEvent.subscribe(res => (emittedOrders = res));

      service.getOrders();
      const req = httpMock.expectOne(`${BASE}orders/order_history.php`);
      req.flush(mockOrders);
      tick();

      expect(emittedOrders).toEqual(mockOrders);
    }));

    it('should handle empty orders list without crashing', fakeAsync(() => {
      let emittedOrders: any;
      service.ordersEvent.subscribe(res => (emittedOrders = res));

      service.getOrders();
      const req = httpMock.expectOne(`${BASE}orders/order_history.php`);
      req.flush([]);
      tick();

      expect(emittedOrders).toEqual([]);
    }));
  });

  // ── 2. cancelOrder() ─────────────────────────────────
  describe('cancelOrder()', () => {
    const mockOrder = {
      order_id: 'ORD_TEST_001',
      mobile: '9876543210',
      status: 'PLACED',
      payment_type: 'Wallet',
      total_amount: 300,
    };

    it('should call cancel_order.php and return SUCCESS for a prepaid order', fakeAsync(() => {
      const mockResponse = {
        status: 'SUCCESS',
        order_id: 'ORD_TEST_001',
        refund_amount: 300,
        wallet_balance: 800,
        is_cod: false,
        message: 'Order #ORD_TEST_001 cancelled. ₹300 has been refunded to your wallet.',
      };

      let result: any;
      service.cancelOrder(mockOrder).subscribe(res => (result = res));

      const req = httpMock.expectOne(`${BASE}orders/cancel_order.php`);
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);
      tick();

      expect(result.status).toBe('SUCCESS');
      expect(result.refund_amount).toBe(300);
      expect(result.is_cod).toBeFalse();
    }));

    it('should return SUCCESS with 0 refund for a COD order', fakeAsync(() => {
      const codOrder = { ...mockOrder, payment_type: 'COD' };
      const mockResponse = {
        status: 'SUCCESS',
        refund_amount: 0,
        is_cod: true,
        message: 'Order cancelled (COD - No refund required).',
      };

      let result: any;
      service.cancelOrder(codOrder).subscribe(res => (result = res));

      const req = httpMock.expectOne(`${BASE}orders/cancel_order.php`);
      req.flush(mockResponse);
      tick();

      expect(result.status).toBe('SUCCESS');
      expect(result.refund_amount).toBe(0);
      expect(result.is_cod).toBeTrue();
    }));

    it('should propagate 404 error when order is not found', fakeAsync(() => {
      let errorCaught: any;
      service.cancelOrder({ order_id: 'NONEXISTENT' }).subscribe({
        next: () => {},
        error: err => (errorCaught = err),
      });

      const req = httpMock.expectOne(`${BASE}orders/cancel_order.php`);
      req.flush({ error: 'Order not found' }, { status: 404, statusText: 'Not Found' });
      tick();

      expect(errorCaught).toBeTruthy();
    }));

    it('should propagate 400 error when order_id is missing', fakeAsync(() => {
      let errorCaught: any;
      service.cancelOrder({}).subscribe({
        next: () => {},
        error: err => (errorCaught = err),
      });

      const req = httpMock.expectOne(`${BASE}orders/cancel_order.php`);
      req.flush({ error: 'Order ID is required' }, { status: 400, statusText: 'Bad Request' });
      tick();

      expect(errorCaught).toBeTruthy();
    }));
  });

  // ── 3. cancelOrderItem() ──────────────────────────────
  describe('cancelOrderItem()', () => {
    const mockItem = {
      id: 55,
      order_item_id: 55,
      product_id: 'PROD_123',
      name: 'Tomatoes',
    };

    it('should call cancel_order_item.php with correct payload', fakeAsync(() => {
      const mockResponse = {
        status: 'SUCCESS',
        refund_amount: 80,
        new_order_total: 200,
        order_status: 'PLACED',
        active_items_count: 2,
      };

      let result: any;
      service.cancelOrderItem('ORD_TEST_001', mockItem).subscribe(res => (result = res));

      const req = httpMock.expectOne(`${BASE}orders/cancel_order_item.php`);
      expect(req.request.method).toBe('POST');
      const sentDetails = JSON.parse(req.request.body.get('details'));
      expect(sentDetails.order_id).toBe('ORD_TEST_001');
      req.flush(mockResponse);
      tick();

      expect(result.status).toBe('SUCCESS');
      expect(result.refund_amount).toBe(80);
    }));

    it('should return CANCELLED order_status when last item is cancelled', fakeAsync(() => {
      const mockResponse = {
        status: 'SUCCESS',
        refund_amount: 150,
        new_order_total: 0,
        order_status: 'CANCELLED',
        active_items_count: 0,
      };

      let result: any;
      service.cancelOrderItem('ORD_SINGLE', mockItem).subscribe(res => (result = res));

      const req = httpMock.expectOne(`${BASE}orders/cancel_order_item.php`);
      req.flush(mockResponse);
      tick();

      expect(result.order_status).toBe('CANCELLED');
      expect(result.active_items_count).toBe(0);
    }));
  });

  // ── 4. getIndividualOrder() ───────────────────────────
  describe('getIndividualOrder()', () => {
    it('should call read_individual_order.php with the order_id', fakeAsync(() => {
      const mockItems = [
        { id: 1, product_id: 'P1', product_name: 'Carrot', quantity: 2, price: 60 },
      ];
      let result: any;
      service.getIndividualOrder({ order_id: 'ORD_001', status: 'PLACED' })
        .subscribe(res => (result = res));

      const req = httpMock.expectOne(`${BASE}orders/read_individual_order.php`);
      expect(req.request.method).toBe('POST');
      req.flush(mockItems);
      tick();

      expect(result).toEqual(mockItems);
    }));

    it('should return empty array when no items found for an order', fakeAsync(() => {
      let result: any;
      service.getIndividualOrder({ order_id: 'ORD_EMPTY', status: 'PLACED' })
        .subscribe(res => (result = res));

      const req = httpMock.expectOne(`${BASE}orders/read_individual_order.php`);
      req.flush([]);
      tick();

      expect(result).toEqual([]);
    }));
  });

  // ── 5. getActiveSubscriptions() ──────────────────────
  describe('getActiveSubscriptions()', () => {
    it('should return active subscription items', fakeAsync(() => {
      const mockSubs = [
        { orderID: 'ORD_SUB_001', product_name: 'Milk', subscriptionType: 'daily' },
      ];
      let result: any;
      service.getActiveSubscriptions().subscribe(res => (result = res));

      const req = httpMock.expectOne(`${BASE}orders/active_subs.php`);
      req.flush(mockSubs);
      tick();

      expect(result.length).toBe(1);
      expect(result[0].orderID).toBe('ORD_SUB_001');
    }));

    it('should return empty array when there are no active subscriptions', fakeAsync(() => {
      let result: any;
      service.getActiveSubscriptions().subscribe(res => (result = res));

      const req = httpMock.expectOne(`${BASE}orders/active_subs.php`);
      req.flush([]);
      tick();

      expect(result).toEqual([]);
    }));
  });

  // ── 6. pausePlay() ───────────────────────────────────
  describe('pausePlay()', () => {
    it('should call pause_play.php with the subscription data', fakeAsync(() => {
      const pauseData = { order_id: 'ORD_SUB_001', action: 'pause' };
      let result: any;
      service.pausePlay(pauseData).subscribe(res => (result = res));

      const req = httpMock.expectOne(`${BASE}orders/pause_play.php`);
      req.flush({ status: 'SUCCESS' });
      tick();

      expect(result.status).toBe('SUCCESS');
    }));
  });
});
