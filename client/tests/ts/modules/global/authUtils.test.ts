import { authUtilsTestOnlyExports } from '../../../../src/ts/modules/global/authUtils';
import Cookies from '../../../../src/ts/modules/global/Cookies';

const { removeAuthDetails, removeRelevantCookies } = authUtilsTestOnlyExports;

beforeEach(() => {
  for (const cookie of document.cookie.split('; ')) {
    const cookieName: string | undefined = cookie.split('=')[0];
    cookieName && (document.cookie = `${cookieName}=; max-age=0`);
  };

  const newBody: HTMLBodyElement = document.createElement('body');
  document.documentElement.replaceChild(newBody, document.body);
});

describe('removeAuthDetails()', () => {
  it('should remove the signedInAs and guestHangoutId cookies, dispatch a customer signedOut event, and append a confirm modal into the body', () => {
    Cookies.set('signedInAs', 'guest');
    Cookies.set('guestHangoutId', 'someId');

    const dispatchEventSpy = jest.spyOn(document, 'dispatchEvent');
    removeAuthDetails('', 'Some Title.', 'Some description.');

    expect(dispatchEventSpy).toHaveBeenCalledWith(new CustomEvent('signedOUt'));

    const createdConfirmModal: HTMLDivElement | null = document.querySelector('#confirm-modal');
    expect(createdConfirmModal).toBeInstanceOf(HTMLDivElement);

    expect(Cookies.get('signedInAs')).toBe(null);
    expect(Cookies.get('guestHangoutId')).toBe(null);
  });

  it('should listen for click events on the confirm modal, and if confirm button is clicked, it should set an afterAuthRedirectHref equal to the passed value, then redirect the user to the sign in page', () => {
    removeAuthDetails('somePage', 'Some Title.', 'Some description.');

    const confirmModalConfirmBtn: HTMLButtonElement | null = document.querySelector('#confirm-modal-confirm-btn');

    if (!confirmModalConfirmBtn) {
      fail('Confirm modal was not created or appended to the body.');
    };

    confirmModalConfirmBtn.click();

    expect(Cookies.get('afterAuthRedirectHref')).toBe('somePage');
    expect(window.location.href).toBe('sign-in');
  });

  it('should listen for click events on the confirm modal, and if cancel button is clicked, it should redirect the user to home page', () => {
    removeAuthDetails('somePage', 'Some Title.', 'Some description.');

    const confirmModalCancelBtn: HTMLButtonElement | null = document.querySelector('#confirm-modal-cancel-btn');

    if (!confirmModalCancelBtn) {
      throw new Error('Confirm modal was not created or appended to the body.');
    };

    confirmModalCancelBtn.click();
    expect(window.location.href).toBe('home');
  });
});

describe('removeRelevantCookies()', () => {
  it('should remove the signedInAs and guestHangoutId cookies', () => {
    Cookies.set('signedInAs', 'guest');
    Cookies.set('guestHangoutId', 'someId');

    removeRelevantCookies();

    expect(Cookies.get('signedInAs')).toBe(null);
    expect(Cookies.get('guestHangoutId')).toBe(null);
  });
});