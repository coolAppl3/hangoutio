import Cookies from "./Cookies";
import { signOut } from "./signOut";
import { isValidAuthToken } from "./validation";

export function getAuthToken(): string | null {
  const authToken: string | null = Cookies.get('authToken');

  if (!authToken) {
    return null;
  };

  if (!isValidAuthToken(authToken)) {
    signOut();
    return null;
  };

  return authToken;
};