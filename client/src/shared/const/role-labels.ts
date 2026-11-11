/**
 * FOYDALANUVCHI ROLLARINING O'ZBEKCHA NOMLARI (tizim jurnalidagi
 * `user_role` uchun).
 *
 * Bitta joyda: "Tizim jurnallari" sahifasi (`pages/logs-page`) va Carrier
 * API panelidagi akkaunt tarixi bir xil so'zlarni ko'rsatsin. Topilmasa
 * chaqiruvchi xom qiymatni ko'rsatadi (`ROLE_LABEL[role] || role`).
 */
export const ROLE_LABEL: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  registrator: "Registrator",
  courier: "Kuryer",
  market: "Market",
  operator: "Operator",
  logist: "Logist",
  customer: "Mijoz",
};
