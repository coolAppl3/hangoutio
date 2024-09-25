import Cookies from "./Cookies";

export function signOut(): void {
  removeRelevantCookies();
  document.dispatchEvent(new CustomEvent('signedOut'));
};

function removeRelevantCookies(): void {
  Cookies.remove('authToken');
  Cookies.remove('guestHangoutID');
};