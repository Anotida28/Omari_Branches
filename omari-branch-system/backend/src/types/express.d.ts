import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: bigint;
        username: string;
        role: UserRole;
      };
    }
  }
}

export {};
