// Investor UI uchun UZS pul va son formatlash yordamchilari.
// Loyihada markazlashgan helper yo'q — mavjud konventsiya: Intl.NumberFormat("uz-UZ") + " so'm".

export const formatMoney = (n?: number | string | null): string => {
  if (n == null || n === "") return "0 so'm";
  const num = Number(n);
  if (!Number.isFinite(num)) return "0 so'm";
  return `${new Intl.NumberFormat("uz-UZ").format(Math.round(num))} so'm`;
};

// Grafik o'qlari uchun qisqartma (K/M/B).
export const formatMoneyShort = (value?: number | string | null): string => {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
};

export const formatNumber = (n?: number | string | null): string =>
  new Intl.NumberFormat("uz-UZ").format(Number(n) || 0);
