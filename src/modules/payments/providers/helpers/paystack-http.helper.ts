import type { AxiosRequestConfig, AxiosResponse } from "axios";

import type { AxiosClient } from "../../../../infrastructure/axios/axios.client.js";
import { normalizePaystackError } from "./paystack-error.helper.js";

export const createPaystackHttpHelper = (client: AxiosClient) => {
  const request = async <T>(
    config: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => {
    try {
      return await client.request<T>(config);
    } catch (error) {
      throw normalizePaystackError(error);
    }
  };

  return {
    request,
  };
};