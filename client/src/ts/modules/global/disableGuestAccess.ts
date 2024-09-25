import Cookies from "./Cookies";
import { getAuthToken } from "./getAuthToken";

export function disableNonAccountAccess(redirectHref: string): void {
  const authToken: string | null = getAuthToken();

  if (!authToken || authToken.startsWith('g')) {
    window.location.href = redirectHref;
  };
};
