export enum Roles {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  COURIER = 'courier',
  REGISTRATOR = 'registrator',
  MARKET = 'market',
  CUSTOMER = 'customer',
  OPERATOR = 'operator',
  LOGIST = 'logist',
  // Faqat o'qish uchun ulushdor (equity investor) roli. Hozircha hech qanday
  // endpointga ulanmagan — INVESTOR surface Faza 1'da qo'shiladi.
  INVESTOR = 'investor',
}

export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

// export enum AddOrder {
//   ALLOW = "true",
//   FORBID = 'forbid',
// }

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
  // Investorga foyda taqsimoti (kassadan chiqim; OpEx EMAS). DB enumida
  // allaqachon mavjud. financial_balance_history'ga YOZILMAYDI.
  INVESTOR_PAYOUT = 'investor_payout',
}

export enum Order_status {
  CREATED = 'created',
  NEW = 'new',
  RECEIVED = 'received',
  ON_THE_ROAD = 'on the road',
  WAITING = 'waiting',
  SOLD = 'sold',
  CANCELLED = 'cancelled',
  PAID = 'paid',
  PARTLY_PAID = 'partly_paid',
  CANCELLED_SENT = 'cancelled (sent)',
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

// Buyurtma qanday yaratilgani (audit/tracking + AI dashboard):
//   MANUAL — web forma orqali qo'lda kiritilgan
//   AI     — web platforma AI oqimi (matndan ekstraksiya)
//   BOT    — Telegram bot orqali (AI yordamida bo'lsa ham kanal = bot)
export enum OrderCreatedSource {
  MANUAL = 'manual',
  AI = 'ai',
  BOT = 'bot',
}

export enum Post_status {
  NEW = 'new',
  SENT = 'sent',
  RECEIVED = 'received',
  CANCELED = 'canceled',
  CANCELED_RECEIVED = 'canceled_received',
}

// Almashtirish (kafolat-swap) buyurtmasi holati. YANGI buyurtmada turadi va
// kuryer "eski mahsulotni oldim" tasdig'ini boshqaradi:
//   AWAITING_OLD_PICKUP → kuryer hali eskini olmagan (sotuv BLOKLANADI)
//   OLD_COLLECTED       → kuryer eskini mijozdan oldi (sotuvga ruxsat)
//   OLD_RETURNED        → eski mahsulot marketga topshirildi
// Eski (almashtirilayotgan) buyurtmaning STATUSI o'zgarmaydi (SOTILGAN qoladi,
// pul muzlatiladi) — bu enum faqat jismoniy qaytarishni kuzatadi.
export enum Replacement_state {
  AWAITING_OLD_PICKUP = 'awaiting_old_pickup',
  OLD_COLLECTED = 'old_collected',
  OLD_RETURNED = 'old_returned',
}

export enum Manual_payment_methods {
  CASH = 'cash',
  CARD = 'card',
}

export enum Group_type {
  CANCEL = 'cancel',
  CREATE = 'create',
}

export enum Commission_type {
  PERCENT = 'percent',
  FIXED = 'fixed',
}

// Asosiy kassa virtual kartalari orasidagi ichki ko'chirma turlari.
// Bular kirim/chiqim EMAS — umumiy `balance` ni o'zgartirmaydi, faqat
// kartalararo yoki naqd↔karta ajratimni o'zgartiradi. Shu sababli ular
// `cashbox_history` ga emas, alohida `cashbox_card_movement` jadvaliga yoziladi.
export enum CardMovementType {
  CARD_TO_CARD = 'card_to_card', // Kartadan kartaga o'tkazma
  CARD_TO_CASH = 'card_to_cash', // Kartadan naqdga yechish (bankomat)
  CASH_TO_CARD = 'cash_to_card', // Naqddan kartaga solish
}

// Moliyaviy taroziga ta'sir qiluvchi manba turlari
export enum FinancialSource_type {
  SELL_PROFIT = 'sell_profit', // Sotuvdan pochta foydasi
  MANUAL_EXPENSE = 'manual_expense', // Qo'lda chiqim
  MANUAL_INCOME = 'manual_income', // Qo'lda kirim
  SALARY = 'salary', // Maosh to'lovi
  CORRECTION = 'correction', // Tuzatish (rollback)
  BILLS = 'bills', // Hisob-fakturalar
}
