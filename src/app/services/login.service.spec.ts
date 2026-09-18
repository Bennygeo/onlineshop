import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LoginService } from './login.service';
import { StorageService } from './storage.service';
import { ApiService } from './api.service';
import { environment } from 'src/environments/environment';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
const BASE = environment.url;

function clearLoginStorage() {
  localStorage.removeItem('login');
  localStorage.removeItem('tnkspt_admin_mode');
}

// ─────────────────────────────────────────────────────────
// LoginService Tests
// ─────────────────────────────────────────────────────────
describe('LoginService', () => {
  let service: LoginService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearLoginStorage();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LoginService, ApiService, StorageService],
    });
    service = TestBed.inject(LoginService);
    httpMock = TestBed.inject(HttpTestingController);
    // Flush constructor requests
    httpMock.match(() => true).forEach(r => r.flush([]));
  });

  afterEach(() => {
    httpMock.match(() => true).forEach(r => r.flush([]));
    httpMock.verify();
    clearLoginStorage();
  });

  // ── 1. Initial state ──────────────────────────────────
  describe('initial state', () => {
    it('should start as LOGOUT when localStorage is empty', () => {
      expect(service.userStatus).toBe('LOGOUT');
    });

    it('should emit LOGOUT on loginChangeEvent when not logged in', () => {
      let status: string | undefined;
      service.loginChangeEvent.subscribe(s => (status = s));
      expect(status).toBe('LOGOUT');
    });

    it('should set userStatus to LOGIN when valid 10-digit mobile found in storage', () => {
      clearLoginStorage();
      localStorage.setItem('login', JSON.stringify(btoa('9876543210')));

      // Re-create service to trigger constructor
      const s2 = new LoginService(
        TestBed.inject(ApiService),
        TestBed.inject(StorageService)
      );

      // IMPORTANT: flush readUser with a valid user — returning [] would
      // cause LoginService to fire logoutEvent.next() which resets user.mobile
      // back to the User class default 'xxxxxxxxxx'.
      const reqs = httpMock.match(() => true);
      reqs.filter(r => r.request.url.includes('read_user')).forEach(r =>
        r.flush([{ referral_id: 'THINK543210', name: 'Test User' }])
      );
      reqs.filter(r => !r.request.url.includes('read_user')).forEach(r => r.flush([]));

      expect(s2.userStatus).toBe('LOGIN');
      expect(s2.user.mobile).toBe('9876543210');
    });

    it('should stay LOGOUT when stored value decodes to fewer than 10 chars', () => {
      localStorage.setItem('login', JSON.stringify(btoa('12345')));
      const s2 = new LoginService(
        TestBed.inject(ApiService),
        TestBed.inject(StorageService)
      );
      // For LOGOUT path, readUser is NOT called (constructor guards on length===10),
      // so flushing with [] is safe here.
      httpMock.match(() => true).forEach(r => r.flush([]));
      expect(s2.userStatus).toBe('LOGOUT');
    });

    it('should handle corrupted (non-base64) localStorage gracefully without throwing', () => {
      localStorage.setItem('login', JSON.stringify('!!!not_base64!!!'));

      // Only the construction must not throw — httpMock flush is done outside
      // the not.toThrow() block to avoid httpMock internal errors being caught.
      let s2: LoginService | undefined;
      expect(() => {
        s2 = new LoginService(
          TestBed.inject(ApiService),
          TestBed.inject(StorageService)
        );
      }).not.toThrow();

      // Flush any requests that may have been made (safe no-op if none exist)
      httpMock.match(() => true).forEach(r => r.flush([]));

      expect(s2?.userStatus).toBe('LOGOUT');
    });
  });

  // ── 2. loginstatus() helper ───────────────────────────
  describe('loginstatus()', () => {
    it('should return false when userStatus is LOGOUT', () => {
      expect(service.loginstatus()).toBeFalse();
    });

    it('should return true when userStatus is LOGIN', () => {
      service.userStatus = 'LOGIN';
      expect(service.loginstatus()).toBeTrue();
    });
  });

  // ── 3. Logout ─────────────────────────────────────────
  describe('logout', () => {
    it('should clear login from localStorage on logoutEvent', () => {
      localStorage.setItem('login', JSON.stringify(btoa('9876543210')));
      service.logoutEvent.next();
      expect(localStorage.getItem('login')).toBeNull();
    });

    it('should set userStatus to LOGOUT on logoutEvent', () => {
      service.userStatus = 'LOGIN';
      service.logoutEvent.next();
      expect(service.userStatus).toBe('LOGOUT');
    });

    it('should emit loginPromptEvent=true on logoutEvent', () => {
      let prompted = false;
      service.loginPromptEvent.subscribe(v => (prompted = v));
      service.logoutEvent.next();
      expect(prompted).toBeTrue();
    });
  });

  // ── 4. Wallet ─────────────────────────────────────────
  describe('readWallet()', () => {
    it('should update user.wallet with the total from the first wallet row', fakeAsync(() => {
      service.userStatus = 'LOGIN';
      service.user.mobile = '9876543210';

      service.readWallet();
      const req = httpMock.expectOne(`${BASE}wallet/read_wallet.php`);
      req.flush([{ total: 250, ledger_balance: 250 }]);
      tick();

      expect(service.user.wallet).toBe(250);
    }));

    it('should keep wallet at 0 when API returns empty array', fakeAsync(() => {
      service.user.mobile = '9876543210';
      service.readWallet();
      const req = httpMock.expectOne(`${BASE}wallet/read_wallet.php`);
      req.flush([]);
      tick();
      expect(service.user.wallet).toBe(0);
    }));

    it('should not crash when readWallet API returns null', fakeAsync(() => {
      service.user.mobile = '9876543210';
      service.readWallet();
      const req = httpMock.expectOne(`${BASE}wallet/read_wallet.php`);
      req.flush(null);
      tick();
      expect(service.user.wallet).toBe(0);
    }));

    it('should emit walletUpdateEvent after reading wallet', fakeAsync(() => {
      service.user.mobile = '9876543210';
      let emitted: any[] | null = null;
      service.walletUpdateEvent.subscribe(v => (emitted = v));

      service.readWallet();
      const req = httpMock.expectOne(`${BASE}wallet/read_wallet.php`);
      const walletData = [{ total: 100, ledger_balance: 100 }];
      req.flush(walletData);
      tick();

      expect(emitted).toBeTruthy();
    }));
  });

  // ── 5. Address ────────────────────────────────────────
  describe('readAddress()', () => {
    it('should select the address with is_default=1 as active', fakeAsync(() => {
      service.userStatus = 'LOGIN';
      service.user.mobile = '9876543210';
      const addresses = [
        { id: 1, address: '10 MG Road', pincode: '600001', is_default: 0, default: 0, active: 0 },
        { id: 2, address: '20 Anna Salai', pincode: '600002', is_default: 1, default: 1, active: 0 },
      ];
      service.readAddress();
      const req = httpMock.expectOne(`${BASE}user/read_address.php`);
      req.flush(addresses);
      tick();
      expect(service.user.address?.pincode).toBe('600002');
    }));

    it('should auto-select the first address when none has is_default=1', fakeAsync(() => {
      service.userStatus = 'LOGIN';
      service.user.mobile = '9876543210';
      const addresses = [
        { id: 1, address: '10 MG Road', pincode: '600001', is_default: 0, default: 0, active: 0 },
        { id: 2, address: '20 Anna Salai', pincode: '600002', is_default: 0, default: 0, active: 0 },
      ];
      service.readAddress();
      const req = httpMock.expectOne(`${BASE}user/read_address.php`);
      req.flush(addresses);
      tick();
      expect(service.user.address?.pincode).toBe('600001');
    }));

    it('should emit noAddressEvent=true when user has no saved addresses', fakeAsync(() => {
      service.userStatus = 'LOGIN';
      service.user.mobile = '9876543210';
      let noAddr = false;
      service.noAddressEvent.subscribe(v => (noAddr = v));

      service.readAddress();
      const req = httpMock.expectOne(`${BASE}user/read_address.php`);
      req.flush([]);
      tick();
      expect(noAddr).toBeTrue();
    }));
  });

  // ── 6. Admin impersonation ────────────────────────────
  describe('impersonateCustomer()', () => {
    it('should switch userStatus to LOGIN for the impersonated customer mobile', () => {
      service.impersonateCustomer('9123456789', 'Test Customer', 'admin1');
      httpMock.match(() => true).forEach(r => r.flush([]));
      expect(service.userStatus).toBe('LOGIN');
      expect(service.user.mobile).toBe('9123456789');
    });

    it('should store a valid admin mode object with active=true', () => {
      service.impersonateCustomer('9123456789', 'Test Customer', 'admin1');
      httpMock.match(() => true).forEach(r => r.flush([]));
      const adminMode = service.getAdminMode();
      expect(adminMode?.active).toBeTrue();
      expect(adminMode?.customerMobile).toBe('9123456789');
      expect(adminMode?.adminUsername).toBe('admin1');
    });

    it('should update user.name from readUser response when impersonating', fakeAsync(() => {
      service.impersonateCustomer('9123456789', 'Initial Name', 'admin1');
      // readWallet, readAddress, readUser
      const reqs = httpMock.match(() => true);
      // fulfill non-readUser ones
      reqs.filter(r => !r.request.url.includes('read_user')).forEach(r => r.flush([]));
      const userReq = reqs.find(r => r.request.url.includes('read_user'));
      userReq?.flush([{ referral_id: 'THINK123456', name: 'DB Name' }]);
      tick();
      expect(service.user.name).toBe('DB Name');
    }));
  });

  // ── 7. Exit admin mode ────────────────────────────────
  describe('exitAdminMode()', () => {
    it('should clear admin mode storage and log out', () => {
      service.impersonateCustomer('9123456789', 'Test Customer', 'admin1');
      httpMock.match(() => true).forEach(r => r.flush([]));

      service.exitAdminMode();

      expect(service.getAdminMode()).toBeNull();
      expect(service.userStatus).toBe('LOGOUT');
    });
  });

  // ── 8. getAdminMode() edge cases ──────────────────────
  describe('getAdminMode()', () => {
    it('should return null when no admin mode is stored', () => {
      localStorage.removeItem('tnkspt_admin_mode');
      expect(service.getAdminMode()).toBeNull();
    });
  });
});
