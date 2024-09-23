import Cookies from "./Cookies";

export function signOut(): void {
  Cookies.remove('authToken');
  document.dispatchEvent(new CustomEvent('signedOut'));
};