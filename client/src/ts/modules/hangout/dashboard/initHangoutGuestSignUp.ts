import axios, { AxiosError, AxiosResponse } from "../../../../../node_modules/axios/index";
import Cookies from "../../global/Cookies";
import ErrorSpan from "../../global/ErrorSpan";
import { InfoModal } from "../../global/InfoModal";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import revealPassword from "../../global/revealPassword";
import { validateConfirmPassword, validateDisplayName, validateNewPassword, validateNewUsername, validatePassword } from "../../global/validation";
import { JoinHangoutAsGuestBody, JoinHangoutAsGuestData, joinHangoutAsGuestService } from "../../services/hangoutServices";
import { getHangoutDashboardData } from "./hangoutDashboard";
import { handleHangoutFull } from "./hangoutDashboardUtils";

const guestSignUpForm: HTMLFormElement | null = document.querySelector('#guest-sign-up-form');

const hangoutPasswordInput: HTMLInputElement | null = document.querySelector('#hangout-password-input');
const displayNameInput: HTMLInputElement | null = document.querySelector('#display-name-input');
const userNameInput: HTMLInputElement | null = document.querySelector('#username-input');
const guestPasswordInput: HTMLInputElement | null = document.querySelector('#guest-password-input');
const confirmGuestPasswordInput: HTMLInputElement | null = document.querySelector('#confirm-guest-password-input');

const hangoutPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#hangout-password-input-reveal-btn');
const guestPasswordRevalBtn: HTMLButtonElement | null = document.querySelector('#guest-password-input-reveal-btn');
const confirmGuestPasswordRevalBtn: HTMLButtonElement | null = document.querySelector('#confirm-guest-password-input-reveal-btn');
const keepSignedInBtn: HTMLButtonElement | null = document.querySelector('#keep-signed-in-btn');

interface GuestSignUpFormState {
  hangoutId: string,
  isPasswordProtected: boolean,
  keepSignedIn: boolean,
};

let guestSignUpFormState: GuestSignUpFormState | null = null;

export function initHangoutGuestSignUp(hangoutId: string, isPasswordProtected: boolean): void {
  guestSignUpFormState = {
    hangoutId,
    isPasswordProtected,
    keepSignedIn: false,
  };

  init();
  loadEventListeners();
};

function init(): void {
  revealGuestSignUpSection();

  setActiveValidation();
  enableFormUtilButtons();
};

function loadEventListeners(): void {
  guestSignUpForm?.addEventListener('submit', joinHangoutAsGuest);
};

async function joinHangoutAsGuest(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  LoadingModal.display();

  if (!guestSignUpFormState) {
    popup('Something went wrong.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!isValidSignUpData()) {
    popup('Invalid sign up details.', 'error');
    LoadingModal.remove();

    return;
  };

  if (!hangoutPasswordInput || !displayNameInput || !userNameInput || !guestPasswordInput) {
    popup('Invalid sign up details.', 'error');
    LoadingModal.remove();

    return;
  };

  const joinHangoutAsGuestBody: JoinHangoutAsGuestBody = {
    hangoutId: guestSignUpFormState.hangoutId,
    hangoutPassword: hangoutPasswordInput.value,
    username: userNameInput.value,
    password: guestPasswordInput.value,
    displayName: displayNameInput.value,
  };

  try {
    const joinHangoutAsGuestData: AxiosResponse<JoinHangoutAsGuestData> = await joinHangoutAsGuestService(joinHangoutAsGuestBody);
    const authToken: string = joinHangoutAsGuestData.data.resData.authToken;

    if (guestSignUpFormState.keepSignedIn) {
      const daySeconds: number = 60 * 60 * 24;
      Cookies.set('authToken', authToken, 14 * daySeconds);

    } else {
      Cookies.set('authToken', authToken);
    };

    popup('Signed up successfully.', 'success');
    LoadingModal.remove();

    hideGuestSignUpSection();
    await getHangoutDashboardData();

  } catch (err: unknown) {
    console.log(err);

    if (!axios.isAxiosError(err)) {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    const axiosError: AxiosError<AxiosErrorResponseData> = err;

    if (!axiosError.status || !axiosError.response) {
      popup('Something went wrong.', 'error');
      LoadingModal.remove();

      return;
    };

    const status: number = axiosError.status;
    const errMessage: string = axiosError.response.data.message;
    const errReason: string | undefined = axiosError.response.data.reason;

    popup(errMessage, 'error');
    LoadingModal.remove();

    if (status === 400) {
      const inputRecord: Record<string, HTMLInputElement | undefined> = {
        hangoutPassword: hangoutPasswordInput,
        username: userNameInput,
        userPassword: guestPasswordInput,
        usernamePasswordIdentical: guestPasswordInput,
        displayName: displayNameInput,
      };

      const input: HTMLInputElement | undefined = inputRecord[`${errReason}`];
      if (input) {
        ErrorSpan.display(input, errMessage);
      };

      return;
    };

    if (status === 404) {
      const infoModal: HTMLDivElement = InfoModal.display({
        title: 'Hangout not found.',
        description: 'Reach out to the hangout leader to request a valid link.',
        btnTitle: 'Go to homepage',
      });

      infoModal.addEventListener('click', (e: MouseEvent) => {
        if (!(e.target instanceof HTMLElement)) {
          return;
        };

        if (e.target.id === 'info-modal-btn') {
          window.location.href = 'index.html';
        };
      });

      return;
    };

    if (status === 401) {
      ErrorSpan.display(hangoutPasswordInput, errMessage);
      return;
    };

    if (status === 409) {
      if (errReason === 'hangoutFull') {
        handleHangoutFull();
        return;
      };

      if (errReason === 'usernameTaken') {
        ErrorSpan.display(userNameInput, errMessage);
      };
    };
  };
};

function revealGuestSignUpSection(): void {
  const guestSignUpSection: HTMLElement | null = document.querySelector('#guest-sign-up-section');
  const hangoutLoadingSkeleton: HTMLDivElement | null = document.querySelector('#hangout-loading-skeleton');

  guestSignUpSection?.classList.remove('hidden');
  hangoutLoadingSkeleton?.classList.add('hidden');

  if (guestSignUpFormState?.isPasswordProtected) {
    guestSignUpForm?.classList.add('is-password-protected');
  };
};

function hideGuestSignUpSection(): void {
  const guestSignUpSection: HTMLElement | null = document.querySelector('#guest-sign-up-section');
  const hangoutLoadingSkeleton: HTMLDivElement | null = document.querySelector('#hangout-loading-skeleton');

  guestSignUpSection?.classList.add('hidden');
  hangoutLoadingSkeleton?.classList.remove('hidden');
};

function isValidSignUpData(): boolean {
  if (!hangoutPasswordInput || !displayNameInput || !userNameInput || !guestPasswordInput || !confirmGuestPasswordInput) {
    return false;
  };

  const validationArray: boolean[] = [
    guestSignUpFormState?.isPasswordProtected ? validatePassword(hangoutPasswordInput) : true,
    validateDisplayName(displayNameInput),
    validateNewUsername(userNameInput),
    validateNewPassword(guestPasswordInput),
  ];

  if (validationArray.includes(false)) {
    return false;
  };

  if (userNameInput.value === guestPasswordInput.value) {
    ErrorSpan.display(guestPasswordInput, `Your password can't be identical to your username.`);
    return false;
  };

  return true;
};

function setActiveValidation(): void {
  hangoutPasswordInput?.addEventListener('input', () => validatePassword(hangoutPasswordInput));
  displayNameInput?.addEventListener('input', () => validateDisplayName(displayNameInput));
  userNameInput?.addEventListener('input', () => validateNewUsername(userNameInput));

  guestPasswordInput?.addEventListener('input', () => {
    validateNewPassword(guestPasswordInput);
    confirmGuestPasswordInput ? validateConfirmPassword(guestPasswordInput, guestPasswordInput) : undefined;
  });

  confirmGuestPasswordInput?.addEventListener('input', () => {
    guestPasswordInput ? validateConfirmPassword(confirmGuestPasswordInput, guestPasswordInput) : undefined;
  });
};

function enableFormUtilButtons(): void {
  hangoutPasswordRevealBtn?.addEventListener('click', () => revealPassword(hangoutPasswordRevealBtn));
  guestPasswordRevalBtn?.addEventListener('click', () => revealPassword(guestPasswordRevalBtn));
  confirmGuestPasswordRevalBtn?.addEventListener('click', () => revealPassword(confirmGuestPasswordRevalBtn));

  keepSignedInBtn?.addEventListener('click', updateSignInDurationPreferences);
};

function updateSignInDurationPreferences(): void {
  if (!guestSignUpFormState) {
    return;
  };

  guestSignUpFormState.keepSignedIn = !guestSignUpFormState.keepSignedIn

  if (keepSignedInBtn?.classList.contains('checked')) {
    keepSignedInBtn.classList.remove('checked');
    return;
  };

  keepSignedInBtn?.classList.add('checked');
};