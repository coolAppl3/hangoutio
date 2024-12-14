import axios, { AxiosError } from "../../../../node_modules/axios/index";
import { signOutService } from "../services/authServices";
import Cookies from "./Cookies";
import LoadingModal from "./LoadingModal";
import popup from "./popup";

export async function signOut(): Promise<void> {
  LoadingModal.display();

  try {
    await signOutService();

    removeRelevantCookies();
    document.dispatchEvent(new CustomEvent('signedOut'));

    popup('Signed out.', 'success');
    LoadingModal.remove();

    return;

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.href = 'home', 1000);

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status) {
      popup('Something went wrong.', 'error');
      setTimeout(() => window.location.href = 'home', 1000);

      return;
    };

    const status: number = axiosError.status;
    if (status === 409) {
      LoadingModal.remove();
      popup('Not signed in.', 'error');

      removeRelevantCookies();
      return;
    };

    popup('Something went wrong.', 'error');
    setTimeout(() => window.location.href = 'home', 1000);

    return;
  };
};

function removeRelevantCookies(): void {
  Cookies.remove('signedInAs');
  Cookies.remove('guestHangoutId');
};