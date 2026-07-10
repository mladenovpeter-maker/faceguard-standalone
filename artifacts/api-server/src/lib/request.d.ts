import type { AuthTokenData } from "./auth-tokens";

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthTokenData;
    }
  }
}

export {};
