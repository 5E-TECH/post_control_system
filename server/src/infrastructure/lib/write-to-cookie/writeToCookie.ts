import { Response } from 'express';
import config from 'src/config';
import { parseDurationToMs } from 'src/common/utils/parse-duration.util';

export const writeToCookie = (
  res: Response,
  dataName: string,
  data: string,
) => {
  res.cookie(dataName, data, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: parseDurationToMs(config.REFRESH_TOKEN_TIME),
  });
};
