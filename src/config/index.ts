import { config } from 'dotenv';
config();

export default {
  PORT: Number(process.env.PORT),
  DB_URL: String(process.env.DB_URL),
  ADMIN_FIRSTNAME: String(process.env.SUPERADMIN_FIRSTNAME),
  ADMIN_LASTRNAME: String(process.env.SUPERADMIN_LASTNAME),
  ADMIN_PHONE_NUMBER: String(process.env.SUPERADMIN_PHONE_NUMBER),
  ADMIN_PASSWORD: String(process.env.SUPERADMIN_PASSWORD),

  ACCESS_TOKEN_KEY: String(process.env.ACCESS_TOKEN_KEY),
  ACCESS_TOKEN_TIME: String(process.env.ACCESS_TOKEN_TIME),
  REFRESH_TOKEN_KEY: String(process.env.REFRESH_TOKEN_KEY),
  REFRESH_TOKEN_TIME: String(process.env.REFRESH_TOKEN_TIME),
};
