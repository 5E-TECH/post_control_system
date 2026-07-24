/// <reference types="jest" />
import { getMetadataArgsStorage, ValueTransformer } from 'typeorm';
import { LdgShipmentEntity } from 'src/core/entity/ldg-shipment.entity';
import {
  bigintTransformer,
  bigintTransformerNonNull,
} from 'src/common/database/bigint.transformer';

/**
 * REGRESSIYA GUARD: "soxta mismatch" bug'i.
 *
 * `ldg_shipment.mismatch_at` (va boshqa nullable timestamp ustunlar) null-SAQLOVCHI
 * transformer ishlatishi SHART. Agar `bigintTransformerNonNull` (null → 0) ga
 * qaytarilsa, har status saqlanganda mismatch_at=0 yozilib, admin "Mismatch"
 * kartasi (WHERE mismatch_at IS NOT NULL) har bir shipmentni nomuvofiq deb sanaydi.
 */
describe('LDG mismatch_at transformer (soxta mismatch regressiya guard)', () => {
  it('transformer variantlari null ni turlicha ishlaydi (tuzoq hujjatlashtiruvi)', () => {
    expect(bigintTransformer.to(null)).toBeNull();
    expect(bigintTransformer.to(undefined)).toBeNull();
    // nonNull — aynan tuzoq: null → 0.
    expect(bigintTransformerNonNull.to(null)).toBe(0);
    expect(bigintTransformerNonNull.to(undefined)).toBe(0);
  });

  function columnTransformer(prop: string): ValueTransformer {
    const col = getMetadataArgsStorage().columns.find(
      (c) => c.target === LdgShipmentEntity && c.propertyName === prop,
    );
    expect(col).toBeDefined();
    const t = col!.options.transformer as ValueTransformer;
    expect(t).toBeDefined();
    return t;
  }

  it.each([
    'mismatch_at',
    'ldg_status_changed_at',
    'ldg_created_at',
    'last_synced_at',
  ])('%s ustuni null ni 0 GA aylantirmaydi (null saqlaydi)', (prop) => {
    const t = columnTransformer(prop);
    expect(t.to(null)).toBeNull();
    expect(t.to(undefined)).toBeNull();
    // Haqiqiy qiymat o'zgarmaydi.
    expect(t.to(1_700_000_000_000)).toBe(1_700_000_000_000);
  });
});
