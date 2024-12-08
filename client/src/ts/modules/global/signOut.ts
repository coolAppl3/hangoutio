import axios, { AxiosError } from "../../../../node_modules/axios/index";
import { signOUtService } from "../services/authServices";
import Cookies from "./Cookies";
import { InfoModal } from "./InfoModal";
import LoadingModal from "./LoadingModal";
import popup from "./popup";

export async function signOut(): Promise<void> {
  LoadingModal.display();

  try {
    await signOUtService();

    removeRelevantCookies();
    document.dispatchEvent(new CustomEvent('signedOut'));

    popup('Signed out.', 'success');
    LoadingModal.remove();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    if (!axios.isAxiosError(err)) {
      handleFailedSignOut();
      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status) {
      handleFailedSignOut();
      return;
    };

    const status: number = axiosError.status;
    if (status === 409) {
      popup('Not signed in.', 'error');
      return;
    };

    handleFailedSignOut();
    return;
  };
};

function removeRelevantCookies(): void {
  Cookies.remove('signedInAs');
  Cookies.remove('guestHangoutId');
};

function handleFailedSignOut(): void {
  popup('Internal server error.', 'error');

  const infoModal: HTMLDivElement = InfoModal.display({
    title: 'Failed to sign out.',
    description: `An internal server error occurred while trying to sign you out.\nClear your browser's cache and cookies then try again.`,
    btnTitle: 'Go to homepage',
  });

  infoModal.addEventListener('click', (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) {
      return;
    };

    if (e.target.id === 'info-modal-btn') {
      window.location.href = 'home';
    };
  });
};