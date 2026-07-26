import { getJwtSecretOrThrow } from './jwt-config';

describe('getJwtSecretOrThrow', () => {
  const originalSecret = process.env.JWT_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  it('throws when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;

    expect(() => getJwtSecretOrThrow()).toThrow(
      'JWT_SECRET environment variable is required',
    );
  });

  it('returns the configured secret when present', () => {
    process.env.JWT_SECRET = 'test-secret';

    expect(getJwtSecretOrThrow()).toBe('test-secret');
  });
});
