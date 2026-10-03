import axios from "axios";

type CreateAxiosClientOptions = {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
};

export const createAxiosClient = ({
  baseUrl,
  headers,
  timeout = 10_000,
}: CreateAxiosClientOptions) => {
  return axios.create({
    baseURL: baseUrl,
    timeout,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
};

export type AxiosClient = ReturnType<typeof createAxiosClient>;