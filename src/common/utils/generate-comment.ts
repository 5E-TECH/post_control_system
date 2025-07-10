export function generateComment(
  orderComment: string | null | undefined,
  dtoComment: string | null | undefined,
  extraCost?: number,
): string {
  const parts: string[] = [];

  if (orderComment) parts.push(orderComment);
  if (dtoComment) parts.push(dtoComment);
  if (extraCost) {
    parts.push(
      `!!! Bu buyurtmadan qo'shimcha ${extraCost} miqdorda pul ushlab qolingan`,
    );
  }

  return parts.join('\n');
}
