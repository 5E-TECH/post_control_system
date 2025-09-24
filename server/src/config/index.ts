import { config } from 'dotenv';
config();

export default {
  PORT: Number(process.env.PORT),
  PROD_HOST: String(process.env.PROD_HOST),
  DB_URL: String(process.env.DB_URL),
  HOST_URL: String(process.env.HOST_URL),
  ADMIN_NAME: String(process.env.SUPERADMIN_NAME),
  ADMIN_PHONE_NUMBER: String(process.env.SUPERADMIN_PHONE_NUMBER),
  ADMIN_PASSWORD: String(process.env.SUPERADMIN_PASSWORD),

  ACCESS_TOKEN_KEY: String(process.env.ACCESS_TOKEN_KEY),
  ACCESS_TOKEN_TIME: String(process.env.ACCESS_TOKEN_TIME),
  REFRESH_TOKEN_KEY: String(process.env.REFRESH_TOKEN_KEY),
  REFRESH_TOKEN_TIME: String(process.env.REFRESH_TOKEN_TIME),

  BOT_TOKEN: String(process.env.BOT_TOKEN),
};
