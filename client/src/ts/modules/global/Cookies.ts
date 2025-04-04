export default class Cookies {
  public static get(cookieName: string): string | null {
    const cookie: string | undefined = this.createCookieMap().get(cookieName);

    if (!cookie) {
      return null;
    };

    return cookie;
  };

  public static set(cookieName: string, cookieValue: string, maxAgeSeconds?: number): void {
    if (!maxAgeSeconds) {
      document.cookie = `${cookieName}=${cookieValue}; path=/; Secure; SameSite=Strict`;
      return;
    };

    document.cookie = `${cookieName}=${cookieValue}; max-age=${maxAgeSeconds}; path=/; Secure; SameSite=Strict`;
  };

  public static remove(cookieName: string): void {
    document.cookie = `${cookieName}=; max-age=0`;
  };

  private static createCookieMap(): Map<string, string> {
    const cookies: string = document.cookie;
    const cookieMap: Map<string, string> = new Map();

    if (cookies === '') {
      return cookieMap;
    };

    const cookiesArray: string[] = cookies.split('; ');

    for (const cookie of cookiesArray) {
      const firstEqualsSignIndex: number = cookie.indexOf('=');

      const key: string = cookie.slice(0, firstEqualsSignIndex);
      const value: string = cookie.slice(firstEqualsSignIndex + 1);

      cookieMap.set(key, value);
    };

    return cookieMap;
  };
};