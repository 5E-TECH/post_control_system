export function generateComment(
  orderComment?: string | null,
  dtoComment?: string | null,
  extraCost?: number,
  notes: string[] = [], // qo‘shimcha ogohlantirishlar, masalan: ['Buyurtma qisman sotildi']
): string {
  const parts: string[] = [];

  if (orderComment) parts.push(orderComment.trim());
  if (dtoComment) parts.push(dtoComment.trim());
  if (extraCost && extraCost > 0) {
    parts.push(
      `!!! Bu buyurtmadan qo'shimcha ${extraCost} miqdorda pul ushlab qolingan`,
    );
  }

  for (const note of notes) {
    if (note) parts.push(`!!! ${note}`);
  }

  return parts.join('\n');
}
