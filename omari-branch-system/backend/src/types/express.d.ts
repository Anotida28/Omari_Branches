import type { UserRole } from "../shared/prisma-enums";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: bigint;
        username: string;
        role: UserRole;
        name?: string;
      };
    }
  }
}

export {};
