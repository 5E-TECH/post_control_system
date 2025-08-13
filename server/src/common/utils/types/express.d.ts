// src/shared/types/express.d.ts
import { JwtPayload } from './user.type'; // or wherever you defined your user/jwt type

declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}
