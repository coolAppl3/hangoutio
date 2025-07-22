import { AxiosResponse } from 'axios';
import { signOut } from '../../../../src/ts/modules/global/signOut';
import * as authServicesModule from '../../../../src/ts/modules/services/authServices';
import Cookies from '../../../../src/ts/modules/global/Cookies';

beforeEach(() => {
  for (const cookie of document.cookie.split('; ')) {
    const cookieName: string | undefined = cookie.split('=')[0];
    cookieName && (document.cookie = `${cookieName}=; max-age=0`);
  };

  const newBody: HTMLBodyElement = document.createElement('body');
  document.documentElement.replaceChild(newBody, document.body);
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('signOut()', () => {
  it('should call signOUtService(), remove the signedInAs and guestHangoutId cookies, and dispatch a signedOUt custom event to the document', async () => {
    const signOutServiceMock = jest.spyOn(authServicesModule, 'signOutService').mockResolvedValueOnce({} as unknown as AxiosResponse);

    let signedOutEventDispatched: boolean = false;
    document.addEventListener('signedOut', () => signedOutEventDispatched = true);

    Cookies.set('signedInAs', 'guest');
    Cookies.set('guestHangoutId', 'someId');

    await signOut();

    expect(signOutServiceMock).toHaveBeenCalled();
    expect(signedOutEventDispatched).toBe(true);

    expect(Cookies.get('signedInAs')).toBeNull();
    expect(Cookies.get('guestHangoutId')).toBeNull();
  });
});