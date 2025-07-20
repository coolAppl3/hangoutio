import Cookies from '../../../../src/ts/modules/global/Cookies';

beforeEach(() => {
  for (const cookie of document.cookie.split('; ')) {
    const cookieName: string | undefined = cookie.split('=')[0];
    cookieName && (document.cookie = `${cookieName}=; max-age=0`);
  };
});

// can't really test organic behavior in jest - close enough

describe('get()', () => {
  it('should return null if the cookie is not found', () => {
    expect(Cookies.get('nonExistentCookie')).toBe(null);
  });

  it('should return the cookie value if the cookie is found', () => {
    document.cookie = 'someCookie=someValue; someOtherCookie=someOtherValue';

    expect(Cookies.get('someCookie')).toBe('someValue');
    expect(Cookies.get('someOtherCookie')).toBe('someOtherValue');
  });
});

describe('set()', () => {
  it('should set the cookie with its value', () => {
    Cookies.set('someCookie', 'someValue');
    expect(Cookies.get('someCookie')).toBe('someValue');
  });
});

describe('remove()', () => {
  it('should remove the cookie if it is found', () => {
    document.cookie = 'someCookie=someValue; someOtherCookie=someOtherValue';
    Cookies.remove('someCookie');

    expect(Cookies.get('someCookie')).toBe(null);
  });
});