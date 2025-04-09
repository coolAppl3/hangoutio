import axios, { AxiosError } from "../../../../node_modules/axios/index";

export interface AsyncErrorData {
  status: number,
  errMessage: string,
  errReason?: string,
  errResData?: unknown,
};

export function getAsyncErrorData(err: unknown): AsyncErrorData | null {
  if (!axios.isAxiosError(err)) {
    return null;
  };

  const axiosError: AxiosError<AxiosErrorResponseData> = err;

  if (!axiosError.status || !axiosError.response) {
    return null;
  };

  return {
    status: axiosError.status,
    errMessage: axiosError.response.data.message,
    errReason: axiosError.response.data.reason,
    errResData: axiosError.response.data.resData,
  };
};