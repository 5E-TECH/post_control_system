import 'reflect-metadata';
import { HttpException, RequestMethod } from '@nestjs/common';
import {
  EXCEPTION_FILTERS_METADATA,
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
} from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CARRIER_IDEMPOTENCY_KEY_MAX,
  CarrierPublicController,
  parseCarrierOrderId,
  readCarrierIdempotencyKey,
} from './carrier-public.controller';
import {
  CARRIER_PROOF_MULTER_MAX_BYTES,
  assertCarrierProofFile,
} from './carrier.service';
import { CarrierApiKeyGuard } from './guards/carrier-api-key.guard';
import { CarrierThrottlerGuard } from './guards/carrier-throttler.guard';
import { CarrierIpThrottlerGuard } from './guards/carrier-ip-throttler.guard';
import { CarrierExceptionFilter } from './filters/carrier-exception.filter';
import {
  CarrierCashboxQueryDto,
  CarrierOrderListQueryDto,
  CarrierOrderStatus,
  CarrierOrderStatusRequestDto,
  CarrierReturnRequestDto,
  CarrierScanRequestDto,
} from './dto/carrier-public.dto';

/**
 * CarrierPublicController — so'rov chegarasi: `Idempotency-Key`, UUID id,
 * isbot faylini servisga uzatish, DTO validatsiyasi (multipart `items`
 * ham) va marshrutlar Elchi bilan bir xil ekanligi. Biznes mantiq
 * `carrier.service.spec.ts` da.
 */

const CARRIER = {
  id: '0d1e2f3a-4b5c-4d6e-8f9a-0b1c2d3e4f5a',
  name: 'BTS Express',
  courier_user_id: '11111111-1111-4111-8111-111111111111',
};
const ORDER_ID = '3f6c2a9e-8b1d-4c7e-9a2f-1d5b8e7c4a90';

const setup = () => {
  const carrierService = {
    scan: jest.fn(async () => 'scan-result'),
    updateStatus: jest.fn(async () => 'status-result'),
    createReturns: jest.fn(async () => 'returns-result'),
    listOrders: jest.fn(async () => 'orders-result'),
    cashbox: jest.fn(async () => 'cashbox-result'),
  };
  const controller = new CarrierPublicController(carrierService as any);
  return { controller, carrierService };
};

const req = (headers: Record<string, unknown> = {}) => ({
  carrier: CARRIER,
  headers,
});

const caught = (fn: () => unknown): HttpException => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    return error as HttpException;
  }
  throw new Error('xato kutilgan edi');
};

/** Global ValidationPipe bilan bir xil sozlama (app.service.ts). */
const check = async <T extends object>(cls: new () => T, body: object) => {
  const dto = plainToInstance(cls, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, props: errors.map((e) => e.property) };
};

describe('CarrierPublicController — Idempotency-Key', () => {
  it("yo'q yoki bo'sh → 400 CARRIER_IDEMPOTENCY_KEY_REQUIRED, servis chaqirilmaydi", () => {
    const { controller, carrierService } = setup();
    for (const headers of [
      {},
      { 'idempotency-key': '   ' },
      { 'idempotency-key': 42 },
    ]) {
      const error = caught(() =>
        controller.updateStatus(ORDER_ID, {} as any, undefined, req(headers)),
      );
      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({
        code: 'CARRIER_IDEMPOTENCY_KEY_REQUIRED',
      });
    }
    expect(carrierService.updateStatus).not.toHaveBeenCalled();
  });

  it(`${CARRIER_IDEMPOTENCY_KEY_MAX} belgidan uzun → 400`, () => {
    const error = caught(() =>
      readCarrierIdempotencyKey({ 'idempotency-key': 'x'.repeat(256) }),
    );
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain('255');
    expect(
      readCarrierIdempotencyKey({ 'idempotency-key': 'x'.repeat(255) }),
    ).toHaveLength(255);
  });

  it('kalit trim qilinadi; takroriy sarlavhada birinchisi olinadi', () => {
    expect(readCarrierIdempotencyKey({ 'idempotency-key': '  abc  ' })).toBe(
      'abc',
    );
    expect(readCarrierIdempotencyKey({ 'idempotency-key': ['k1', 'k2'] })).toBe(
      'k1',
    );
  });
});

describe('CarrierPublicController — buyurtma id', () => {
  it("UUID emas (Elchi bigint id, matn, bo'sh) → 400, 404/422 emas", () => {
    for (const raw of [
      '901',
      'abc',
      '',
      '3f6c2a9e-8b1d-4c7e-9a2f-1d5b8e7c4a9',
    ]) {
      const error = caught(() => parseCarrierOrderId(raw));
      expect(error.getStatus()).toBe(400);
      expect(error.message).toBe("Buyurtma id noto'g'ri");
    }
  });

  it('id tekshiruvi kalitdan OLDIN (Elchi tartibi)', () => {
    const { controller } = setup();
    const error = caught(() =>
      controller.updateStatus('901', {} as any, undefined, req({})),
    );
    expect(error.message).toBe("Buyurtma id noto'g'ri");
  });

  it('katta harfli UUID kichikka keltirilib servisga uzatiladi, isbot fayli bilan', async () => {
    const { controller, carrierService } = setup();
    const dto = { status: 'sold' } as any;
    const proof = { mimetype: 'image/png', size: 10 } as any;
    await expect(
      controller.updateStatus(
        ORDER_ID.toUpperCase(),
        dto,
        proof,
        req({ 'idempotency-key': ' key-1 ' }),
      ),
    ).resolves.toBe('status-result');
    expect(carrierService.updateStatus).toHaveBeenCalledWith(
      CARRIER,
      ORDER_ID,
      dto,
      'key-1',
      proof,
    );
  });

  it("isbot fayli yo'q → servisga null (tekshiruv servisda, egalikdan keyin)", async () => {
    const { controller, carrierService } = setup();
    await controller.updateStatus(
      ORDER_ID,
      { status: 'rollback' } as any,
      undefined,
      req({ 'idempotency-key': 'k' }),
    );
    expect(
      (carrierService.updateStatus.mock.calls[0] as unknown[])[4],
    ).toBeNull();
  });

  it('multer chegarasi — eng katta ruxsat (video 50 MB)', () => {
    expect(CARRIER_PROOF_MULTER_MAX_BYTES).toBe(50 * 1024 * 1024);
  });

  it('isbot fayli qoidasi Elchi bilan bir xil (tur va hajm; rollback’da taqiq)', () => {
    // Qoida servisda — egalik tekshiruvidan KEYIN chaqiriladi (Elchi tartibi:
    // begona buyurtmaga noto'g'ri fayl → 404, 400 emas).
    const MB = 1024 * 1024;
    const fail = (status: CarrierOrderStatus, file: object) =>
      caught(() => assertCarrierProofFile(status, file));
    expect(
      fail(CarrierOrderStatus.SOLD, { mimetype: 'image/heic', size: 1 })
        .message,
    ).toContain('Isbot fayli turi qabul qilinmaydi');
    expect(
      fail(CarrierOrderStatus.SOLD, { mimetype: 'image/webp', size: 11 * MB })
        .message,
    ).toBe('Isbot fayli 10 MB dan oshmasin (video — 50 MB)');
    expect(
      fail(CarrierOrderStatus.ROLLBACK, { mimetype: 'image/png', size: 1 })
        .message,
    ).toBe('rollback uchun proof kerak emas');
    expect(() =>
      assertCarrierProofFile(CarrierOrderStatus.PARTLY_SOLD, {
        mimetype: 'video/quicktime',
        size: 49 * MB,
      }),
    ).not.toThrow();
  });
});

describe('CarrierPublicController — boshqa marshrutlar', () => {
  it("ping — akkaunt id va nomi, Elchi bilan bir xil qobiq ('ok')", () => {
    const { controller } = setup();
    expect(controller.ping(req())).toEqual({
      statusCode: 200,
      message: 'ok',
      data: {
        authenticated: true,
        carrier: { id: CARRIER.id, name: CARRIER.name },
      },
    });
  });

  it('scan / returns / orders / cashbox servisga carrier bilan uzatiladi', async () => {
    const { controller, carrierService } = setup();
    await controller.scan({ qr_token: 'abc' }, req());
    expect(carrierService.scan).toHaveBeenCalledWith(CARRIER, 'abc');
    await controller.returns({ order_ids: [ORDER_ID] }, req());
    expect(carrierService.createReturns).toHaveBeenCalledWith(CARRIER, [
      ORDER_ID,
    ]);
    const listQuery = { status: 'waiting' } as CarrierOrderListQueryDto;
    await controller.listOrders(listQuery, req());
    expect(carrierService.listOrders).toHaveBeenCalledWith(CARRIER, listQuery);
    const cashQuery = { from: '2026-11-01' } as CarrierCashboxQueryDto;
    await controller.cashbox(cashQuery, req());
    expect(carrierService.cashbox).toHaveBeenCalledWith(CARRIER, cashQuery);
  });

  it('marshrutlar va metod nomlari Elchi bilan bir xil (OpenAPI operationId)', () => {
    const proto = CarrierPublicController.prototype as any;
    expect(Reflect.getMetadata(PATH_METADATA, CarrierPublicController)).toBe(
      'carrier',
    );
    const routes = Object.fromEntries(
      ['ping', 'scan', 'updateStatus', 'returns', 'listOrders', 'cashbox'].map(
        (name) => [
          name,
          [
            Reflect.getMetadata(METHOD_METADATA, proto[name]),
            Reflect.getMetadata(PATH_METADATA, proto[name]),
          ],
        ],
      ),
    );
    expect(routes).toEqual({
      ping: [RequestMethod.GET, 'ping'],
      scan: [RequestMethod.POST, 'scan'],
      updateStatus: [RequestMethod.POST, 'orders/:id/status'],
      returns: [RequestMethod.POST, 'returns'],
      listOrders: [RequestMethod.GET, 'orders'],
      cashbox: [RequestMethod.GET, 'cashbox'],
    });
  });

  it('IP limiti kalitdan OLDIN, kalit akkaunt limitidan OLDIN, kontrakt filtri faqat shu controller’da', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, CarrierPublicController),
    ).toEqual([
      CarrierIpThrottlerGuard,
      CarrierApiKeyGuard,
      CarrierThrottlerGuard,
    ]);
    expect(
      Reflect.getMetadata(EXCEPTION_FILTERS_METADATA, CarrierPublicController),
    ).toEqual([CarrierExceptionFilter]);
  });
});

describe('CarrierOrderStatusRequestDto validatsiyasi (Elchi bilan bir xil)', () => {
  it('extraCost / paidAmount qabul qilinmaydi (v1)', async () => {
    expect(
      (
        await check(CarrierOrderStatusRequestDto, {
          status: 'sold',
          extraCost: 5000,
        })
      ).props,
    ).toContain('extraCost');
    expect(
      (
        await check(CarrierOrderStatusRequestDto, {
          status: 'sold',
          paidAmount: 1,
        })
      ).props,
    ).toContain('paidAmount');
  });

  it("cancelled reason'siz yoki noma'lum sabab → xato; sold — reason shart emas", async () => {
    expect(
      (await check(CarrierOrderStatusRequestDto, { status: 'cancelled' }))
        .props,
    ).toContain('reason');
    expect(
      (
        await check(CarrierOrderStatusRequestDto, {
          status: 'cancelled',
          reason: 'BORED',
        })
      ).props,
    ).toContain('reason');
    expect(
      (await check(CarrierOrderStatusRequestDto, { status: 'sold' })).props,
    ).toEqual([]);
    expect(
      (await check(CarrierOrderStatusRequestDto, { status: 'delivered' }))
        .props,
    ).toContain('status');
  });

  it("partly_sold items va total_price'siz → xato", async () => {
    const { props } = await check(CarrierOrderStatusRequestDto, {
      status: 'partly_sold',
    });
    expect(props).toEqual(expect.arrayContaining(['items', 'total_price']));
  });

  it('multipart: takroriy `items` qismlari (har biri JSON obyekt) va bitta obyekt ham', async () => {
    const repeated = await check(CarrierOrderStatusRequestDto, {
      status: 'partly_sold',
      total_price: '100000',
      items: [
        '{"order_item_id":"5501","quantity":"1"}',
        '{"order_item_id":"5502","quantity":"0"}',
      ],
    });
    expect(repeated.props).toEqual([]);
    expect(repeated.dto.total_price).toBe(100000);
    expect(repeated.dto.items!.map((i) => i.quantity)).toEqual([1, 0]);

    const single = await check(CarrierOrderStatusRequestDto, {
      status: 'partly_sold',
      total_price: '1',
      items: '{"order_item_id":"5501","quantity":1}',
    });
    expect(single.props).toEqual([]);
    expect(single.dto.items).toHaveLength(1);
  });

  it('multipart: items JSON-massiv satri, total_price va old_item_collected satri', async () => {
    const { props, dto } = await check(CarrierOrderStatusRequestDto, {
      status: 'partly_sold',
      total_price: '100000',
      items:
        '[{"order_item_id":"5501","quantity":"1"},{"product_id":"p-2","quantity":"0"}]',
      old_item_collected: 'true',
    });
    expect(props).toEqual([]);
    expect(dto.items).toHaveLength(2);
    expect(dto.old_item_collected).toBe(true);
  });

  it("qator ichidagi noma'lum maydon, manfiy yoki kasr dona → xato", async () => {
    for (const item of [
      { order_item_id: 'a', quantity: 1, price: 5 },
      { order_item_id: 'a', quantity: -1 },
      { order_item_id: 'a', quantity: 1.5 },
      { quantity: 1 },
    ]) {
      const { props } = await check(CarrierOrderStatusRequestDto, {
        status: 'partly_sold',
        total_price: 1,
        items: [item],
      });
      expect(props).toContain('items');
    }
  });

  it('izoh 1000 belgidan uzun → xato', async () => {
    const { props } = await check(CarrierOrderStatusRequestDto, {
      status: 'sold',
      comment: 'x'.repeat(1001),
    });
    expect(props).toContain('comment');
  });
});

describe('Boshqa so‘rov DTO’lari', () => {
  it('returns: 1–50 ta UUID; bigint id yoki bo‘sh ro‘yxat → xato', async () => {
    expect(
      (await check(CarrierReturnRequestDto, { order_ids: [ORDER_ID] })).props,
    ).toEqual([]);
    expect(
      (await check(CarrierReturnRequestDto, { order_ids: ['901'] })).props,
    ).toContain('order_ids');
    expect(
      (await check(CarrierReturnRequestDto, { order_ids: [] })).props,
    ).toContain('order_ids');
    expect(
      (
        await check(CarrierReturnRequestDto, {
          order_ids: Array(51).fill(ORDER_ID),
        })
      ).props,
    ).toContain('order_ids');
  });

  it('scan: qr_token majburiy, ≤255', async () => {
    expect((await check(CarrierScanRequestDto, {})).props).toContain(
      'qr_token',
    );
    expect(
      (await check(CarrierScanRequestDto, { qr_token: 'x'.repeat(256) })).props,
    ).toContain('qr_token');
    expect(
      (await check(CarrierScanRequestDto, { qr_token: 'abc' })).props,
    ).toEqual([]);
  });

  it('orders: limit faqat 10/25/50/100, page satri songa, sana YYYY-MM-DD', async () => {
    const ok = await check(CarrierOrderListQueryDto, {
      page: '2',
      limit: '25',
      from: '2026-11-01',
    });
    expect(ok.props).toEqual([]);
    expect(ok.dto).toMatchObject({ page: 2, limit: 25 });
    expect(
      (await check(CarrierOrderListQueryDto, { limit: '30' })).props,
    ).toContain('limit');
    expect(
      (await check(CarrierOrderListQueryDto, { page: '0' })).props,
    ).toContain('page');
    expect(
      (await check(CarrierOrderListQueryDto, { from: '01.11.2026' })).props,
    ).toContain('from');
  });

  it('cashbox: sana formati', async () => {
    expect(
      (await check(CarrierCashboxQueryDto, { to: '2026-13-01' })).props,
    ).toContain('to');
    expect(
      (
        await check(CarrierCashboxQueryDto, {
          from: '2026-11-01',
          to: '2026-11-10',
        })
      ).props,
    ).toEqual([]);
  });
});
