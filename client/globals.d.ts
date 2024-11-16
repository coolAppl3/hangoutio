interface AxiosErrorResponseData {
  success: false,
  message: string,
  reason?: string,
  resData?: {
    [key: string]: unknown,
  },
}