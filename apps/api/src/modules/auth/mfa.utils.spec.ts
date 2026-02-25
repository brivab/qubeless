import { buildOtpAuthUrl, generateBase32Secret, verifyTotp } from './mfa.utils';

describe('mfa.utils', () => {
  let dateNowSpy: jest.SpyInstance | undefined;

  afterEach(() => {
    if (dateNowSpy) {
      dateNowSpy.mockRestore();
      dateNowSpy = undefined;
    }
  });

  it('should generate an uppercase base32 secret', () => {
    const secret = generateBase32Secret();

    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThan(0);
  });

  it('should build a valid otpauth URL with defaults', () => {
    const url = buildOtpAuthUrl({
      issuer: 'Qubeless Team',
      accountName: 'admin@example.com',
      secret: 'JBSWY3DPEHPK3PXP',
    });

    expect(url).toBe(
      'otpauth://totp/Qubeless%20Team:admin%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Qubeless%20Team&algorithm=SHA1&digits=6&period=30',
    );
  });

  it('should verify RFC6238 SHA1 test vector token', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(59_000);

    expect(verifyTotp(secret, '94287082', { digits: 8, period: 30, window: 0 })).toBe(true);
  });

  it('should normalize token and reject invalid values', () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(59_000);

    expect(verifyTotp(secret, ' 94 287 082 ', { digits: 8, period: 30, window: 0 })).toBe(true);
    expect(verifyTotp(secret, '00000000', { digits: 8, period: 30, window: 0 })).toBe(false);
    expect(verifyTotp(secret, '   ', { digits: 8, period: 30, window: 0 })).toBe(false);
  });
});
