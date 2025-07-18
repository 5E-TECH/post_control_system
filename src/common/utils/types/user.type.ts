import { Status } from 'src/common/enums';

export interface JwtPayload {
  id: string;
  role: string;
  status: Status;
}
