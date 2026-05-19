/**
 * LDG POST /orders so'rov tanasi (LDG bizdan kutadi).
 *
 * Sxema LDG API hujjati asosida (sandbox sample):
 *   {
 *     "external_order_id": "SHOP-1001",
 *     "sender":   { name, phone, region_soato, district_soato, address },
 *     "receiver": { name, phone, region_soato, district_soato, address },
 *     "package":  { weight, length, width, height, seats, description, declared_value },
 *     "payment":  { payer_type, cod_amount },
 *     "comment":  "..."
 *   }
 *
 * MUHIM: SOATO kodlari STRING shaklida yuboriladi ("1726" — number emas).
 */

export interface LdgPartyDto {
  name: string;
  phone: string;
  region_soato: string;
  district_soato: string;
  address: string;
  // LDG xizmat hududlari sozlanmagan tenant'lar uchun explicit branch ID
  branch_id?: number;
}

export interface LdgPackageDto {
  // Bizning order.qr_code_token — LDG scan qilganda avtomatik qabul qiladi
  barcode?: string;
  weight: number;
  length: number;
  width: number;
  height: number;
  seats: number;
  description: string;
  declared_value: number;
}

export interface LdgPaymentDto {
  payer_type: 'receiver' | 'sender' | 'third_party';
  cod_amount: number;
}

export interface LdgCreateOrderRequestDto {
  external_order_id: string;
  sender: LdgPartyDto;
  receiver: LdgPartyDto;
  package: LdgPackageDto;
  payment: LdgPaymentDto;
  comment?: string;
}

/**
 * LDG POST /orders javobining `data` qismi.
 * Real javob misoli (sandbox):
 *   {
 *     "order_id": 29,
 *     "external_order_id": "SHOP-1001",
 *     "tracking_number": "PKGPY18N0YR",
 *     "status": { "code": "created", "name": null },
 *     "created_at": "2026-05-04T18:18:13+00:00"
 *   }
 */
export interface LdgCreateOrderResponseDto {
  order_id: number;
  external_order_id: string;
  tracking_number: string;
  status: {
    code: string;
    name: string | null;
  };
  created_at: string;
}
