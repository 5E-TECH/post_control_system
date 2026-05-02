/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PostEntity } from 'src/core/entity/post.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { UserEntity } from 'src/core/entity/users.entity';
import { DataSource } from 'typeorm';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { Order_status, Post_status } from 'src/common/enums';
import { BadRequestException, NotFoundException } from '@nestjs/common';

// ─── Mock helpers ───────────────────────────────────────────────
const uuid = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

const makeDistrict = (regionId: string) => ({
  id: uuid(90),
  name: 'Test District',
  assigned_region: regionId,
});

const makeOrder = (overrides: Record<string, any>): any => ({
  id: uuid(1),
  total_price: 50000,
  status: Order_status.WAITING,
  return_requested: true,
  post_id: uuid(80),
  district: makeDistrict(uuid(70)),
  customer: null,
  post: { id: uuid(80), region_id: uuid(70), courier_id: uuid(60) },
  ...overrides,
});

// ─── QueryRunner mock factory ───────────────────────────────────
function createQueryRunnerMock() {
  const saved: any[] = [];
  const updated: { entity: any; criteria: any; partial: any }[] = [];

  const manager = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((Entity: any, data: any) => ({ ...data })),
    save: jest.fn((entity: any) => {
      // Yangi post yaratilganda ID qo'shib qaytaramiz
      if (!entity.id) entity.id = uuid(99);
      saved.push(entity);
      return Promise.resolve(entity);
    }),
    update: jest.fn((Entity: any, criteria: any, partial: any) => {
      updated.push({ entity: Entity, criteria, partial });
      return Promise.resolve({ affected: 1 });
    }),
  };

  const qr = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };

  return { qr, manager, saved, updated };
}

// ─── Test suite ─────────────────────────────────────────────────
describe('PostService — Return Requests', () => {
  let service: PostService;
  let dataSourceMock: { createQueryRunner: jest.Mock };
  let orderRepoMock: any;
  let activityLogMock: any;

  beforeEach(async () => {
    dataSourceMock = { createQueryRunner: jest.fn() };
    orderRepoMock = {
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    activityLogMock = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: getRepositoryToken(PostEntity),
          useValue: { find: jest.fn() },
        },
        { provide: getRepositoryToken(OrderEntity), useValue: orderRepoMock },
        { provide: getRepositoryToken(UserEntity), useValue: {} },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: ActivityLogService, useValue: activityLogMock },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
  });

  // ═══════════════════════════════════════════════════════════════
  // approveReturnRequests
  // ═══════════════════════════════════════════════════════════════
  describe('approveReturnRequests', () => {
    it("buyurtmalarni to'g'ri regiondagi yangi pochtaga ko'chirishi kerak", async () => {
      const regionId = uuid(70);
      const oldPostId = uuid(80);
      const order = makeOrder({ id: uuid(1), post_id: oldPostId });

      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);

      // manager.find — return-requested orderlarni qaytaradi
      manager.find.mockResolvedValue([order]);

      // manager.findOne (1-chi chaqiruv) — eski pochta statistikasi uchun
      // manager.findOne (2-chi chaqiruv) — NEW post mavjudligini tekshirish
      manager.findOne
        .mockResolvedValueOnce({
          id: oldPostId,
          order_quantity: 5,
          post_total_price: 250000,
        }) // eski pochta
        .mockResolvedValueOnce(null); // NEW post yo'q — yangisi yaratiladi

      const result = await service.approveReturnRequests({
        order_ids: [uuid(1)],
      });

      // ✅ Tranzaksiya commit bo'ldi
      expect(qr.commitTransaction).toHaveBeenCalled();
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();

      // ✅ Order to'g'ri relations bilan yuklandi
      expect(manager.find).toHaveBeenCalledWith(OrderEntity, {
        where: expect.objectContaining({
          return_requested: true,
          status: Order_status.WAITING,
        }),
        relations: ['district', 'customer', 'customer.district', 'post'],
      });

      // ✅ Eski pochta statistikasi kamaytirildi
      const oldPostUpdate = manager.update.mock.calls.find(
        (call: any[]) => call[0] === PostEntity && call[1]?.id === oldPostId,
      );
      expect(oldPostUpdate).toBeTruthy();
      expect(oldPostUpdate![2]).toEqual({
        order_quantity: 4, // 5 - 1
        post_total_price: 200000, // 250000 - 50000
      });

      // ✅ Yangi pochta to'g'ri region bilan yaratildi
      expect(manager.create).toHaveBeenCalledWith(PostEntity, {
        region_id: regionId,
        order_quantity: 0,
        post_total_price: 0,
        status: Post_status.NEW,
        qr_code_token: expect.any(String),
      });

      // ✅ Order yangi pochtaga update() bilan ko'chirildi
      const orderUpdate = manager.update.mock.calls.find(
        (call: any[]) => call[0] === OrderEntity && call[1]?.id === uuid(1),
      );
      expect(orderUpdate).toBeTruthy();
      expect(orderUpdate![2]).toEqual({
        status: Order_status.RECEIVED,
        return_requested: false,
        post_id: uuid(99), // yangi post ID
      });

      // ✅ Yangi pochta statistikasi yangilandi
      const newPostUpdate = manager.update.mock.calls.find(
        (call: any[]) => call[0] === PostEntity && call[1]?.id === uuid(99),
      );
      expect(newPostUpdate).toBeTruthy();
      expect(newPostUpdate![2]).toEqual({
        order_quantity: 1,
        post_total_price: 50000,
      });

      // ✅ Activity log yozildi
      expect(activityLogMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'return_approved',
          entity_id: uuid(1),
        }),
      );

      // ✅ Muvaffaqiyatli javob
      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
    });

    it("mavjud NEW pochtaga qo'shishi kerak (yangi yaratmasdan)", async () => {
      const regionId = uuid(70);
      const existingNewPostId = uuid(55);
      const order = makeOrder({ id: uuid(1) });

      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);

      manager.find.mockResolvedValue([order]);

      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(80),
          order_quantity: 3,
          post_total_price: 150000,
        }) // eski pochta
        .mockResolvedValueOnce({
          id: existingNewPostId,
          region_id: regionId,
          order_quantity: 2,
          post_total_price: 100000,
          status: Post_status.NEW,
        }); // mavjud NEW post

      await service.approveReturnRequests({ order_ids: [uuid(1)] });

      // ✅ Yangi post yaratilMAdi
      expect(manager.create).not.toHaveBeenCalledWith(
        PostEntity,
        expect.anything(),
      );

      // ✅ Buyurtma mavjud NEW pochtaga update() bilan biriktirildi
      const orderUpdate = manager.update.mock.calls.find(
        (call: any[]) => call[0] === OrderEntity && call[1]?.id === uuid(1),
      );
      expect(orderUpdate).toBeTruthy();
      expect(orderUpdate![2].post_id).toBe(existingNewPostId);

      // ✅ Mavjud pochta statistikasi oshirildi
      const postUpdate = manager.update.mock.calls.find(
        (call: any[]) =>
          call[0] === PostEntity && call[1]?.id === existingNewPostId,
      );
      expect(postUpdate).toBeTruthy();
      expect(postUpdate![2]).toEqual({
        order_quantity: 3, // 2 + 1
        post_total_price: 150000, // 100000 + 50000
      });
    });

    it('bir nechta regiondagi buyurtmalarni alohida pochtalarga tarqatishi kerak', async () => {
      const region1 = uuid(70);
      const region2 = uuid(71);

      const order1 = makeOrder({
        id: uuid(1),
        post_id: uuid(80),
        district: makeDistrict(region1),
        post: { id: uuid(80), order_quantity: 5, post_total_price: 250000 },
      });
      const order2 = makeOrder({
        id: uuid(2),
        total_price: 80000,
        post_id: uuid(81),
        district: makeDistrict(region2),
        post: { id: uuid(81), order_quantity: 3, post_total_price: 200000 },
      });

      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);

      manager.find.mockResolvedValue([order1, order2]);

      // Eski pochtalar uchun findOne
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(80),
          order_quantity: 5,
          post_total_price: 250000,
        })
        .mockResolvedValueOnce({
          id: uuid(81),
          order_quantity: 3,
          post_total_price: 200000,
        })
        // Yangi pochtalar uchun findOne (NEW post yo'q)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      // save har chaqirilganda turli ID bersin
      let saveCounter = 90;
      manager.save.mockImplementation((entity: any) => {
        if (!entity.id) entity.id = uuid(saveCounter++);
        return Promise.resolve(entity);
      });

      await service.approveReturnRequests({
        order_ids: [uuid(1), uuid(2)],
      });

      // ✅ 2 ta alohida pochta yaratildi (har bir region uchun)
      expect(manager.create).toHaveBeenCalledTimes(2);

      // ✅ Har bir buyurtma alohida pochtaga update() bilan biriktirildi
      const orderUpdates = manager.update.mock.calls.filter(
        (call: any[]) => call[0] === OrderEntity,
      );
      expect(orderUpdates.length).toBe(2);
      // Ikki buyurtma turli pochtalarga tayinlangan
      expect(orderUpdates[0][2].post_id).not.toBe(orderUpdates[1][2].post_id);

      // ✅ Activity log 2 marta yozildi
      expect(activityLogMock.log).toHaveBeenCalledTimes(2);
    });

    it('district topilmasa xato tashlashi kerak', async () => {
      const order = makeOrder({ id: uuid(1), district: null, customer: null });

      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);

      manager.find.mockResolvedValue([order]);

      // ✅ catchError ichida HttpException tashlanadi
      await expect(
        service.approveReturnRequests({ order_ids: [uuid(1)] }),
      ).rejects.toThrow();

      // ✅ Rollback qilindi
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      expect(qr.commitTransaction).not.toHaveBeenCalled();
    });

    it("bo'sh order_ids bo'lsa xato tashlashi kerak", async () => {
      const { qr } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);

      await expect(
        service.approveReturnRequests({ order_ids: [] }),
      ).rejects.toThrow();

      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it("return_requested bo'lmagan orderlar topilmasa xato tashlashi kerak", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);

      manager.find.mockResolvedValue([]);

      await expect(
        service.approveReturnRequests({ order_ids: [uuid(1)] }),
      ).rejects.toThrow();

      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it("customer.district dan region aniqlanishi kerak (order.district null bo'lsa)", async () => {
      const regionId = uuid(70);
      const order = makeOrder({
        id: uuid(1),
        district: null,
        customer: { district: makeDistrict(regionId) },
      });

      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);

      manager.find.mockResolvedValue([order]);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(80),
          order_quantity: 1,
          post_total_price: 50000,
        })
        .mockResolvedValueOnce(null); // NEW post yo'q

      await service.approveReturnRequests({ order_ids: [uuid(1)] });

      // ✅ Yangi pochta customer.district.assigned_region bilan yaratildi
      expect(manager.create).toHaveBeenCalledWith(PostEntity, {
        region_id: regionId,
        order_quantity: 0,
        post_total_price: 0,
        status: Post_status.NEW,
        qr_code_token: expect.any(String),
      });

      expect(qr.commitTransaction).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // rejectReturnRequests
  // ═══════════════════════════════════════════════════════════════
  describe('rejectReturnRequests', () => {
    it('return_requested ni false qilib, buyurtmani kuryerda qoldirishi kerak', async () => {
      const result = await service.rejectReturnRequests({
        order_ids: [uuid(1), uuid(2)],
      });

      // ✅ return_requested = false ga yangilandi
      expect(orderRepoMock.update).toHaveBeenCalledWith(
        {
          id: expect.anything(),
          return_requested: true,
          status: Order_status.WAITING,
        },
        { return_requested: false },
      );

      // ✅ Activity log yozildi
      expect(activityLogMock.log).toHaveBeenCalledTimes(2);
      expect(activityLogMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'return_rejected',
          entity_id: uuid(1),
        }),
      );

      // ✅ Status WAITING bo'lib qoladi (o'zgarmaydi)
      // update faqat return_requested: false o'zgaradi
      const updateCall = orderRepoMock.update.mock.calls[0];
      expect(updateCall[1]).toEqual({ return_requested: false });
      expect(updateCall[1]).not.toHaveProperty('status');

      // ✅ Muvaffaqiyatli javob
      expect(result).toEqual(expect.objectContaining({ statusCode: 200 }));
    });

    it("bo'sh order_ids bo'lsa xato tashlashi kerak", async () => {
      await expect(
        service.rejectReturnRequests({ order_ids: [] }),
      ).rejects.toThrow();

      // ✅ update chaqirilmadi
      expect(orderRepoMock.update).not.toHaveBeenCalled();
    });

    it("post_id o'zgarmasligi kerak (buyurtma eski pochtada qoladi)", async () => {
      await service.rejectReturnRequests({ order_ids: [uuid(1)] });

      // ✅ Faqat return_requested yangilandi, post_id yoki boshqa field emas
      const updatePartial = orderRepoMock.update.mock.calls[0]?.[1];
      expect(updatePartial).toEqual({ return_requested: false });
      expect(updatePartial).not.toHaveProperty('post_id');
      expect(updatePartial).not.toHaveProperty('status');
    });
  });
});
