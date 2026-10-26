// Express `Request` augmentation: the request-id middleware assigns `id` before request logging and error
// handling run, so both can reference it without ad-hoc casts.
declare global {
  namespace Express {
    interface Request {
      /** Correlation id assigned by the request-id middleware. */
      id?: string;
      /** Client IP address computed by Express / reverse proxy. */
      ip?: string;
    }
  }
}

export {};
