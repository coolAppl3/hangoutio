// import axios, { AxiosError, AxiosResponse } from "../../../../node_modules/axios/index";
// import { ConfirmModalConfig, ConfirmModal } from "../global/ConfirmModal";
// import Cookies from "../global/Cookies";
// import ErrorSpan from "../global/ErrorSpan";
// import { InfoModal, InfoModalConfig } from "../global/InfoModal";
// import LoadingModal from "../global/LoadingModal";
// import popup from "../global/popup";
// import { signOut } from "../global/signOut";
// import { isValidAuthToken, isValidQueryString, isValidTimestamp, isValidUniqueToken, validateConfirmPassword, validateEmail, validateNewPassword } from "../global/validation";
// import { SendRecoveryEmailData, sendRecoveryEmailService } from "../services/accountServices";

// interface RecoveryFormState {
//   recoveryEmailsSent: number,
//   failedRecoveryAttempts: number,

//   recoveryAccountID: number | null,
//   recoveryStartTimestamp: number | null,
//   recoveryToken: string | null,
// };

// const recoveryFormState: RecoveryFormState = {
//   recoveryEmailsSent: 0,
//   failedRecoveryAttempts: 3,

//   recoveryAccountID: null,
//   recoveryStartTimestamp: null,
//   recoveryToken: null,
// };

// const recoveryEmailForm: HTMLFormElement | null = document.querySelector('#recovery-start-form');
// const recoveryEmailInput: HTMLInputElement | null = document.querySelector('#recovery-email-input');

// const passwordUpdateForm: HTMLFormElement | null = document.querySelector('#password-update-form');
// const newPasswordInput: HTMLInputElement | null = document.querySelector('#new-password-input');
// const confirmNewPasswordInput: HTMLInputElement | null = document.querySelector('#confirm-new-password-input');

// const newPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#new-password-input-reveal-btn');
// const confirmNewPasswordRevealBtn: HTMLButtonElement | null = document.querySelector('#confirm-new-password-input-reveal-btn');

// function accountRecoveryForm(): void {
//   loadEventListeners();
//   init();
// };

// function init(): void {
//   setActiveValidation();

//   if (recoveryLinkDetected()) {
//     signOut();
//     switchToPasswordUpdateForm();

//     return;
//   };

//   detectSignedInUser();
//   detectVerificationCookies();
// };

// function loadEventListeners(): void {
//   recoveryEmailForm?.addEventListener('submit', startAccountRecovery);
//   passwordUpdateForm?.addEventListener('submit', updateAccountPassword);
// };

// async function startAccountRecovery(e: SubmitEvent): Promise<void> {
//   e.preventDefault();
//   LoadingModal.display();

//   if (!recoveryEmailInput) {
//     LoadingModal.remove();
//     popup('Something went wrong', 'error');

//     return;
//   };

//   const isValidEmail: boolean = validateEmail(recoveryEmailInput);
//   if (!isValidEmail) {
//     LoadingModal.remove();
//     ErrorSpan.display(recoveryEmailInput, 'Invalid email address.');
//     popup('Invalid email address.', 'error');
//   };

//   if (recoveryFormState.recoveryEmailsSent >= 3) {
//     LoadingModal.remove();
//     ErrorSpan.display(recoveryEmailInput, 'Recovery emails limit reached.');
//     popup('Recovery emails limit reached.', 'error');

//     return;
//   };

//   try {
//     const sendRecoveryEmailData: AxiosResponse<SendRecoveryEmailData> = await sendRecoveryEmailService({ email: recoveryEmailInput.value });
//     const { requestTimestamp, failedRecoveryAttempts } = sendRecoveryEmailData.data.resData;

//     recoveryFormState.recoveryStartTimestamp = requestTimestamp;
//     recoveryFormState.failedRecoveryAttempts = failedRecoveryAttempts;
//     recoveryFormState.recoveryEmailsSent++;

//     disableRecoveryEmailInput();
//     renameSendEmailBtn();

//     popup('Recovery email sent.', 'success');
//     LoadingModal.remove();

//     // fix me

//   } catch (err: unknown) {
//     console.log(err);

//     if (!axios.isAxiosError(err)) {
//       LoadingModal.remove();
//       popup('Something went wrong.', 'error');

//       return;
//     };

//     const axiosError: AxiosError<AxiosErrorResponseData> = err;

//     if (!axiosError.status || !axiosError.response) {
//       LoadingModal.remove();
//       popup('Something went wrong.', 'error');

//       return;
//     };

//     const status: number = axiosError.status;
//     const errMessage: string = axiosError.response.data.message;
//     const errReason: string | undefined = axiosError.response.data.reason;
//     const errResData: { [key: string]: unknown } | undefined = axiosError.response.data.resData;

//     LoadingModal.remove();
//     popup(errMessage, 'error');

//     if (status === 400 && errReason === 'email') {
//       ErrorSpan.display(recoveryEmailInput, errMessage);
//       return;
//     };

//     if (status === 404) {
//       ErrorSpan.display(recoveryEmailInput, errMessage);
//       return;
//     };

//     if (status === 403) {
//       ErrorSpan.display(recoveryEmailInput, errMessage);

//       if (errReason === 'emailLimitReached') {
//         recoveryFormState.recoveryEmailsSent = 3;
//       };

//       if (errReason === 'failureLimitReached') {
//         recoveryFormState.failedRecoveryAttempts = 3;
//       };

//       if (errResData && 'requestTimestamp' in errResData && typeof errResData.requestTimestamp === 'number') {
//         recoveryFormState.recoveryStartTimestamp = errResData.requestTimestamp;

//         const recoveryPeriod: number = 1000 * 60 * 60;
//         const expiryTimestamp: number = recoveryFormState.recoveryStartTimestamp + recoveryPeriod;

//         const timeTillRequestExpiry: number = expiryTimestamp - Date.now();
//         const minutesTillExpiry: number = timeTillRequestExpiry < 1000 ? 1 : Math.ceil(timeTillRequestExpiry / (1000 * 60));


//         let infoModalDescription: string = '';
//         if (errReason === 'emailLimitReached') {
//           infoModalDescription = `Make sure to check your spam and junk folders. \n If you still can't find the recovery email, you can start the recovery process again in ${minutesTillExpiry === 1 ? '1 minute' : `${minutesTillExpiry} minutes`}.`;

//         } else if (errReason === 'failureLimitReached') {
//           infoModalDescription = `You can start the recovery process again in ${minutesTillExpiry === 1 ? '1 minute' : `${minutesTillExpiry} minutes`}.`;

//         } else {
//           return;
//         };

//         const infoModalConfig: InfoModalConfig = {
//           title: errMessage,
//           description: infoModalDescription,
//           btnTitle: 'Okay',
//         };

//         const infoModal: HTMLDivElement = InfoModal.display(infoModalConfig);
//         infoModal.addEventListener('click', (e: MouseEvent) => {
//           if (!(e.target instanceof HTMLElement)) {
//             return;
//           };

//           if (e.target.id === 'info-modal-btn') {
//             InfoModal.remove();
//           };
//         });
//       };
//     };
//   };
// };

// async function updateAccountPassword(e: SubmitEvent): Promise<void> {
//   e.preventDefault();
//   LoadingModal.display();
// };

// function setActiveValidation(): void {
//   recoveryEmailInput?.addEventListener('input', () => validateEmail(recoveryEmailInput));

//   newPasswordInput?.addEventListener('input', () => {
//     validateNewPassword(newPasswordInput);
//     confirmNewPasswordInput ? validateConfirmPassword(confirmNewPasswordInput, newPasswordInput) : undefined;
//   });

//   confirmNewPasswordInput?.addEventListener('input', () => {
//     newPasswordInput ? validateConfirmPassword(confirmNewPasswordInput, newPasswordInput) : undefined;
//   });
// };

// function detectVerificationCookies(): void {
//   const existingRecoveryAccountID: string | null = Cookies.get('recoveryAccountID');
//   const existingRecoveryStartTimestamp: string | null = Cookies.get('recoveryStartTimestamp');
//   const existingRecoveryToken: string | null = Cookies.get('recoveryToken');

//   if (!existingRecoveryAccountID || !existingRecoveryStartTimestamp || !existingRecoveryToken) {
//     clearRecoveryCookies();
//     return;
//   };

//   if (+existingRecoveryAccountID === 0 || !Number.isInteger(+existingRecoveryAccountID)) {
//     clearRecoveryCookies();
//     return;
//   };

//   if (!isValidTimestamp(+existingRecoveryStartTimestamp)) {
//     clearRecoveryCookies();
//     return;
//   };

//   if (!isValidUniqueToken(existingRecoveryToken)) {
//     clearRecoveryCookies();
//     return;
//   };

//   const recoveryAccountID: number = +existingRecoveryAccountID;
//   const recoveryStartTimestamp: number = +existingRecoveryStartTimestamp;
//   const recoveryToken: string = existingRecoveryToken;

//   const recoveryPeriod: number = 1000 * 60 * 60;
//   if (Date.now() - recoveryStartTimestamp >= recoveryPeriod) {
//     return;
//   };

//   const confirmModalConfig: ConfirmModalConfig = {
//     title: 'Account recovery request detected.',
//     description: 'There seems to be an ongoing recovery request. \n Would you like to proceed with recovering your account?',
//     confirmBtnTitle: 'Proceed',
//     cancelBtnTitle: 'Remove request',
//     extraBtnTitle: null,
//     isDangerousAction: false,
//   };

//   const confirmModal: HTMLDivElement = ConfirmModal.display(confirmModalConfig);
//   confirmModal.addEventListener('click', (e: MouseEvent) => {
//     if (!(e.target instanceof HTMLElement)) {
//       return;
//     };

//     if (e.target.id === 'confirm-modal-confirm-btn') {
//       recoveryFormState.recoveryAccountID = recoveryAccountID;
//       recoveryFormState.recoveryStartTimestamp = recoveryStartTimestamp;
//       recoveryFormState.recoveryToken = recoveryToken;

//       switchToPasswordUpdateForm();
//       ConfirmModal.remove();

//       return;
//     };

//     if (e.target.id === 'confirm-modal-cancel-btn') {
//       clearRecoveryCookies();
//       ConfirmModal.remove();
//       popup('Recovery request removed.', 'success');
//     };
//   });
// };

// function recoveryLinkDetected(): boolean {
//   const queryString: string = window.location.search;

//   if (queryString === '') {
//     return false;
//   };

//   if (!isValidQueryString(queryString)) {
//     displayInvalidRecoveryLinkModal();
//     return false;
//   };

//   const recoveryLinkDetails: RecoveryLinkDetails | null = getRecoveryLinkDetails(queryString);
//   if (!recoveryLinkDetails) {
//     displayInvalidRecoveryLinkModal();
//     return false;
//   };

//   const { recoveryAccountID, recoveryStartTimestamp, recoveryToken } = recoveryLinkDetails;

//   const recoveryPeriod: number = 1000 * 60 * 60;
//   if (Date.now() - +recoveryStartTimestamp >= recoveryPeriod) {
//     displayRecoveryExpiryInfoModal();
//     return false;
//   };

//   Cookies.set('recoveryAccountID', recoveryAccountID);
//   Cookies.set('recoveryStartTimestamp', recoveryStartTimestamp);
//   Cookies.set('recoveryToken', recoveryToken);

//   recoveryFormState.recoveryAccountID = +recoveryAccountID;
//   recoveryFormState.recoveryStartTimestamp = +recoveryStartTimestamp;
//   recoveryFormState.recoveryToken = recoveryToken;

//   return true;
// };

// interface RecoveryLinkDetails {
//   recoveryAccountID: string,
//   recoveryStartTimestamp: string,
//   recoveryToken: string,
// };

// function getRecoveryLinkDetails(queryString: string): RecoveryLinkDetails | null {
//   const queryParams: string[] = queryString.substring(1).split('&');
//   const queryMap: Map<string, string> = new Map();

//   if (queryParams.length !== 3) {
//     return null;
//   };

//   for (const param of queryParams) {
//     const keyValuePair: string[] = param.split('=');

//     if (keyValuePair.length !== 2) {
//       return null;
//     };

//     if (keyValuePair[0] === '' || keyValuePair[1] === '') {
//       return null;
//     };

//     queryMap.set(keyValuePair[0], keyValuePair[1]);
//   };

//   const recoveryAccountID: string | undefined = queryMap.get('recoveryAccountID');
//   const recoveryStartTimestamp: string | undefined = queryMap.get('recoveryStartTimestamp');
//   const recoveryToken: string | undefined = queryMap.get('recoveryToken');

//   if (!recoveryAccountID || !recoveryStartTimestamp || !recoveryToken) {
//     return null;
//   };

//   if (!Number.isInteger(+recoveryAccountID)) {
//     return null;
//   };

//   if (!isValidTimestamp(+recoveryStartTimestamp)) {
//     return null;
//   };

//   if (!isValidUniqueToken(recoveryToken)) {
//     return null;
//   };

//   const recoveryLinkDetails: RecoveryLinkDetails = {
//     recoveryAccountID,
//     recoveryStartTimestamp,
//     recoveryToken,
//   };

//   return recoveryLinkDetails;
// };

// function detectSignedInUser(): void {
//   const authToken: string | null = Cookies.get('authToken');

//   if (!authToken) {
//     return;
//   };

//   if (!isValidAuthToken(authToken)) {
//     signOut();
//     return;
//   };

//   const confirmModalConfig: ConfirmModalConfig = {
//     title: `You're signed in.`,
//     description: 'You must sign out before being able to start the account recovery process.',
//     confirmBtnTitle: 'Sign out',
//     cancelBtnTitle: 'Take me to my account',
//     extraBtnTitle: null,
//     isDangerousAction: false,
//   };

//   const confirmModal: HTMLDivElement = ConfirmModal.display(confirmModalConfig);
//   confirmModal.addEventListener('click', (e: MouseEvent) => {
//     if (!(e.target instanceof HTMLElement)) {
//       return;
//     };

//     if (e.target.id === 'confirm-modal-confirm-btn') {
//       signOut();
//       ConfirmModal.remove();

//       return;
//     };

//     if (e.target.id === 'confirm-modal-cancel-btn') {
//       window.location.href = 'account.html';
//     };
//   });
// };

// function displayInvalidRecoveryLinkModal(): void {
//   const infoModalConfig: InfoModalConfig = {
//     title: 'Invalid recovery link.',
//     description: `Please ensure your click the correct link in your recovery email.`,
//     btnTitle: 'Okay'
//   };

//   const infoModal: HTMLDivElement = InfoModal.display(infoModalConfig);
//   infoModal.addEventListener('click', (e: MouseEvent) => {
//     if (!(e.target instanceof HTMLElement)) {
//       return;
//     };

//     if (e.target.id === 'info-modal-btn') {
//       window.location.href = 'account-recovery.html';
//     };
//   });
// };

// function displayRecoveryExpiryInfoModal(): void {
//   const infoModalConfig: InfoModalConfig = {
//     title: 'Recovery request expired.',
//     description: 'Have no worries, you can start the account recovery process again.',
//     btnTitle: 'Okay',
//   };

//   const infoModal: HTMLDivElement = InfoModal.display(infoModalConfig);
//   infoModal.addEventListener('click', (e: MouseEvent) => {
//     if (!(e.target instanceof HTMLElement)) {
//       return;
//     };

//     if (e.target.id === 'info-modal-btn') {
//       clearRecoveryCookies();
//       reloadWithoutQueryString();
//     };
//   });
// };

// function clearRecoveryCookies(): void {
//   Cookies.remove('recoveryAccountID');
//   Cookies.remove('recoveryStartTimestamp');
//   Cookies.remove('recoveryToken');
// };

// function reloadWithoutQueryString(): void {
//   const hrefWithoutQueryString: string = window.location.href.split('?')[0];
//   window.location.href = hrefWithoutQueryString;
// };

// function switchToPasswordUpdateForm(): void {
//   recoveryEmailForm?.classList.add('hidden');
//   passwordUpdateForm?.classList.remove('hidden');
// };

// function renameSendEmailBtn(): void {
//   const recoveryStartFormBtn: HTMLButtonElement | null = document.querySelector('#recovery-start-form-btn');
//   recoveryStartFormBtn ? recoveryStartFormBtn.textContent = 'Resend recovery email' : undefined;
// };

// function disableRecoveryEmailInput(): void {
//   if (!recoveryEmailInput) {
//     return;
//   };

//   recoveryEmailInput.parentElement?.classList.add('disabled');
//   recoveryEmailInput.setAttribute('disabled', 'disabled');
// };