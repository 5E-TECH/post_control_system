export enum Roles {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  COURIER = 'courier',
  REGISTRATOR = 'registrator',
  MARKET = 'market',
  CUSTOMER = 'customer',
}

export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum AddOrder {
  ALLOW = 'allow',
  FORBID = 'forbid',
}

export enum PaymentMethod {
  CASH = 'cash',
  CLICK = 'click',
  CLICK_TO_MARKET = 'click_to_market',
}

export enum Operation_type {
  INCOME = 'income',
  EXPENSE = 'expense',
}

export enum Source_type {
  COURIER_PAYMENT = 'courier_payment',
  MARKET_PAYMENT = 'market_payment',
  MANUAL_EXPENSE = 'manual_expense',
  MANUAL_INCOME = 'manual_income',
  CORRECTION = 'correction',
  SALARY = 'salary',
  SELL = 'sell',
  CANCEL = 'cancel',
  EXTRA_COST = 'extra_cost',
  BILLS = 'bills',
}

export enum Order_status {
  NEW = 'new',
  RECEIVED = 'received',
  ON_THE_ROAD = 'on_the_road',
  WAITING = 'waiting',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
  PAID = 'paid',
  PARTLY_PAID = 'partly_paid',
  CANCELLED_SENT = 'cancelled_(sent)',
  CLOSED = 'closed',
}

export enum Cashbox_type {
  MAIN = 'main',
  FOR_COURIER = 'couriers',
  FOR_MARKET = 'markets',
}

export enum Where_deliver {
  CENTER = 'center',
  ADDRESS = 'address',
}

export enum Post_status {
  NEW = 'new',
  SENT = 'sent',
  RECEIVED = 'received',
  CANCELED = 'canceled',
  CANCELED_RECEIVED = 'canceled_received',
}

export enum Manual_payment_methods {
  CASH = 'cash',
  CARD = 'card',
}
