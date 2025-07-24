import Cookies from "../../global/Cookies";
import ErrorSpan from "../../global/ErrorSpan";
import { AsyncErrorData, getAsyncErrorData } from "../../global/errorUtils";
import { InfoModal } from "../../global/InfoModal";
import LoadingModal from "../../global/LoadingModal";
import popup from "../../global/popup";
import revealPassword from "../../global/revealPassword";
import { validateConfirmPassword, validateDisplayName, validateNewPassword, validateUsername, validatePassword } from "../../global/validation";
import { JoinHangoutAsGuestBody, joinHangoutAsGuestService } from "../../services/hangoutMemberServices";
import { getInitialHangoutData } from "./hangoutDashboard";
import { handleHangoutFull, handleHangoutNotFound } from "./hangoutDashboardUtils";

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

  loadEventListeners();

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
    hangoutPassword: guestSignUpFormState.isPasswordProtected ? hangoutPasswordInput.value : null,
    username: userNameInput.value,
    password: guestPasswordInput.value,
    displayName: displayNameInput.value,
  };

  try {
    const authSessionCreated: boolean = (await joinHangoutAsGuestService(joinHangoutAsGuestBody)).data.authSessionCreated;

    popup('Successfully joined hangout.', 'success');
    LoadingModal.remove();

    if (!authSessionCreated) {
      Cookies.set('pendingSignInHangoutId', guestSignUpFormState.hangoutId);

      const infoModal: HTMLDivElement = InfoModal.display({
        title: 'Successfully joined hangout.',
        description: 'You just have to sign in before proceeding.',
        btnTitle: 'Okay',
      });

      infoModal.addEventListener('click', (e: MouseEvent) => {
        if (!(e.target instanceof HTMLButtonElement)) {
          return;
        };

        if (e.target.id === 'info-modal-btn') {
          window.location.href = 'sign-in';
        };
      });

      return;
    };

    hideGuestSignUpSection();
    await getInitialHangoutData();

  } catch (err: unknown) {
    console.log(err);
    LoadingModal.remove();

    const asyncErrorData: AsyncErrorData | null = getAsyncErrorData(err);

    if (!asyncErrorData) {
      return;
    };

    const { status, errMessage, errReason } = asyncErrorData;

    if (status === 400 && !errReason) {
      popup('Something went wrong.', 'error');
      return;
    };

    popup(errMessage, 'error');

    if (status === 404) {
      handleHangoutNotFound();
      return;
    };

    if (status === 401) {
      ErrorSpan.display(hangoutPasswordInput, errMessage);
      return;
    };

    if (status === 409) {
      if (errReason === 'usernameTaken') {
        ErrorSpan.display(userNameInput, errMessage);
        return;
      };

      if (errReason === 'passwordEqualsUsername') {
        ErrorSpan.display(guestPasswordInput, errMessage);
        return;
      };

      handleHangoutFull();
      return;
    };

    if (status === 400) {
      const inputRecord: Record<string, HTMLInputElement | undefined> = {
        invalidHangoutPassword: hangoutPasswordInput,
        invalidUsername: userNameInput,
        invalidUserPassword: guestPasswordInput,
        usernamePasswordIdentical: guestPasswordInput,
        invalidDisplayName: displayNameInput,
      };

      const input: HTMLInputElement | undefined = inputRecord[`${errReason}`];
      if (input) {
        ErrorSpan.display(input, errMessage);
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
    validateUsername(userNameInput),
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
  userNameInput?.addEventListener('input', () => validateUsername(userNameInput));

  guestPasswordInput?.addEventListener('input', () => {
    validateNewPassword(guestPasswordInput);
    confirmGuestPasswordInput && validateConfirmPassword(guestPasswordInput, guestPasswordInput);
  });

  confirmGuestPasswordInput?.addEventListener('input', () => {
    guestPasswordInput && validateConfirmPassword(confirmGuestPasswordInput, guestPasswordInput);
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