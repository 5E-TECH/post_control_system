export enum Roles {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  COURIER = 'courier',
  REGISTRATOR = 'registrator',
  MARKET = 'market',
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
  EXPENSE = 'expense'
}

export enum Source_type {
  COURIER_PAYMENT = 'courier_payment',
  SELLER_PAYMENT = 'seller_payment',
  MANUAL_EXPENSE = 'manual_expense',
  MANUAL_INCOME = 'manual_income',
  CORRECTION = 'correction'
}