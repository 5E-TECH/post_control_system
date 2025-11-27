import { Context } from 'telegraf';

// bots/order_create-bot/session.interface.ts
export interface MySession {
  marketData?: any;
  step?: string;
  phoneNumber?: string;
  waitingForPhone?: boolean;
  userId?: number;
  chatId?: number;
  name?: string;
}

export interface MyContext extends Context {
  session: MySession;
}
