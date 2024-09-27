import Cookies from "./Cookies";
import { isValidAuthToken } from "./validation";

export function disableNonAccountAccess(redirectHref: string): void {
  const authToken: string | null = Cookies.get('authToken');

  if (!authToken || !isValidAuthToken(authToken) || authToken.startsWith('g')) {
    window.location.href = redirectHref;
  };
};
