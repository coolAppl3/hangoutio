import axios, { AxiosError } from "../../../../node_modules/axios/index";
import { InfoModal } from "./InfoModal";
import popup from "./popup";

export interface AsyncErrorData {
  status: number,
  errMessage: string,
  errReason?: string,
  errResData?: unknown,
};

export function getAsyncErrorData(err: unknown): AsyncErrorData | null {
  if (!axios.isAxiosError(err)) {
    popup('Something went wrong.', 'error');
    return null;
  };

  const axiosError: AxiosError<AxiosErrorResponseData> = err;

  if (!axiosError.status || !axiosError.response) {
    popup('Something went wrong.', 'error');
    return null;
  };

  if (axiosError.status === 429) {
    handleRateLimitReached();
    return null;
  };

  return {
    status: axiosError.status,
    errMessage: axiosError.response.data.message,
    errReason: axiosError.response.data.reason,
    errResData: axiosError.response.data.resData,
  };
};

function handleRateLimitReached(): void {
  popup('Too many requests.', 'error');

  InfoModal.display({
    title: 'Please slow down.',
    description: `You're making too many requests.\nYou'll be allowed to make further requests within 30 to 60 seconds.`,
    btnTitle: 'Okay',
  }, { simple: true });
};