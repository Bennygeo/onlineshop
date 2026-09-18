import { AuthGuard } from './auth-guard';

describe('AuthGuard', () => {
  it('should create an instance', () => {
    const mockLoginService: any = { loginstatus: () => true };
    expect(new AuthGuard(mockLoginService)).toBeTruthy();
  });
});
