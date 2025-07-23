import axios, { AxiosError, AxiosResponse } from 'axios';
import { getAsyncErrorData } from '../../../../src/ts/modules/global/errorUtils';

beforeEach(() => {
  const newBody: HTMLBodyElement = document.createElement('body');
  document.documentElement.replaceChild(newBody, document.body);
});

describe('getAsyncErrorData()', () => {
  it('should return null if the err provided is not an axios error, and append a popup to the body informing the user that something went wrong', () => {
    function testNonAxiosError(err: any): void {
      expect(getAsyncErrorData(err)).toBeNull();

      const createdPopup: HTMLDivElement | null = document.querySelector('#popup');
      expect(createdPopup).toBeInstanceOf(HTMLDivElement);
    };

    testNonAxiosError(null);
    testNonAxiosError(undefined);
    testNonAxiosError(NaN);
    testNonAxiosError(23);
    testNonAxiosError(23.5);
    testNonAxiosError('');
    testNonAxiosError({});
  });

  it('should return null if the error does not contain a status, and append a popup to the body informing the user that something went wrong', () => {
    const axiosError = new AxiosError();
    expect(getAsyncErrorData(axiosError)).toBeNull();

    const createdPopup: HTMLDivElement | null = document.querySelector('#popup');
    expect(createdPopup).toBeInstanceOf(HTMLDivElement);
  });

  it('should return null if the error does not contain a response object, and append a popup to the body informing the user that something went wrong', () => {
    const axiosError = new AxiosError();
    expect(getAsyncErrorData(axiosError)).toBeNull();

    const createdPopup: HTMLDivElement | null = document.querySelector('#popup');
    expect(createdPopup).toBeInstanceOf(HTMLDivElement);
  });

  it(`should return null, and append both a popup and an info modal to let the user know they're making too many requests, if the status is 429`, () => {
    const axiosError = new AxiosError();

    axiosError.status = 429;
    axiosError.response = {
      data: {
        message: 'Too many requests.',
        reason: 'rateLimitReached',
        resData: undefined,
      },
    } as unknown as AxiosResponse<unknown>;

    expect(getAsyncErrorData(axiosError)).toBeNull();

    const createdPopup: HTMLDivElement | null = document.querySelector('#popup');
    expect(createdPopup).toBeInstanceOf(HTMLDivElement);

    const createdInfoModal: HTMLDivElement | null = document.querySelector('#info-modal');
    expect(createdInfoModal).toBeInstanceOf(HTMLDivElement);
  });

  it('should return the AsyncErrorData if a valid axios error is received, that is not related to the rate limiter', () => {
    const axiosError = new AxiosError();

    axiosError.status = 401;
    axiosError.response = {
      data: {
        message: 'Invalid credentials. Request denied.',
        reason: 'invalidCredentials',
        resData: undefined,
      },
    } as unknown as AxiosResponse<unknown>;;

    expect(getAsyncErrorData(axiosError)).toEqual({
      status: 401,
      errMessage: 'Invalid credentials. Request denied.',
      errReason: 'invalidCredentials',
      resData: undefined,
    });
  });
});