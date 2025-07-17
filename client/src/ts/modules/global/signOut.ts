import axios, { AxiosError } from 'axios';
import { signOutService } from "../services/authServices";
import Cookies from "./Cookies";
import LoadingModal from "./LoadingModal";
import popup from "./popup";

export async function signOut(): Promise<void> {
  LoadingModal.display();

  try {
    await signOutService();

    removeSignInCookies();
    document.dispatchEvent(new CustomEvent('signedOut'));

    popup('Signed out.', 'success');
    LoadingModal.remove();

    return;

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status) {
      popup('Something went wrong.', 'error');
      return;
    };

    const status: number = axiosError.status;

    if (status === 409) {
      popup('Not signed in.', 'error');

      document.dispatchEvent(new CustomEvent('signedOut'));
      removeSignInCookies();

      return;
    };

    popup('Something went wrong.', 'error');
    return;
  };
};

export function removeSignInCookies(): void {
  Cookies.remove('signedInAs');
  Cookies.remove('guestHangoutId');
};