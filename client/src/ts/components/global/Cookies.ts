export default class Cookies {
  public static get(cookieName: string): string | undefined {
    const cookieMap: Map<string, string> = this.createCookieMap();
    const cookie: string | undefined = cookieMap.get(cookieName);

    if (!cookie) {
      return;
    };

    return cookie;
  };

  public static set(cookieName: string, cookieValue: string, maxAgeInSeconds?: number | undefined): void {
    if (this.isEmptyString(cookieName) || this.isEmptyString(cookieValue)) {
      return;
    };

    if (!maxAgeInSeconds) {
      document.cookie = `${cookieName}=${cookieValue}; path=/; Secure`;
      return;
    };

    document.cookie = `${cookieName}=${cookieValue}; max-age=${maxAgeInSeconds}; path=/; Secure`;
  };

  public static remove(cookieName: string): void {
    if (this.isEmptyString(cookieName)) {
      return;
    };

    document.cookie = `${cookieName}=; max-age=0`;
  };

  private static createCookieMap(): Map<string, string> {
    const cookies: string = document.cookie;
    const cookieMap: Map<string, string> = new Map();

    if (!cookies) {
      return cookieMap;
    };

    const cookiesArray: string[] = cookies.split('; ');
    for (const cookie of cookiesArray) {
      const mapKey: string = cookie.split('=')[0];
      const mapValue: string = cookie.split('=')[1];

      cookieMap.set(mapKey, mapValue);
    };

    return cookieMap;
  };

  private static isEmptyString(string: string): boolean {
    if (!string || string.trim() === '') {
      return true;
    };

    return false;
  };
};