export type UserRole =
  | "superadmin"
  | "admin"
  | "courier"
  | "market"
  | "registrator"
  | "logist"
  | "operator"
  // Faqat o'qish uchun ulushdor (equity investor) roli — INVESTOR surface Faza 1'da ulanadi.
  | "investor";
