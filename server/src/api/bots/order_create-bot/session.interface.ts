import { Context } from 'telegraf';

export type BotStep =
  | 'initial'
  | 'waiting_for_token'
  | 'waiting_for_phone'
  | 'ready';

export interface MarketSessionData {
  id: string;
  name: string;
  add_order?: boolean;
  role?: string;
}

export interface MySession {
  step: BotStep;
  waitingForPhone: boolean;
  marketData?: MarketSessionData;
  phoneNumber?: string;
  userId?: number;
  chatId?: number;
  name?: string;
  lastTokenAttemptAt?: number;
  tokenAttemptsInWindow?: number;
}

export interface MyContext extends Context {
  session: MySession;
}
