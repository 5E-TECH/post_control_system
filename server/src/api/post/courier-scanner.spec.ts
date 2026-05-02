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
import { HttpException } from '@nestjs/common';

// catchError NestJS BadRequestException/NotFoundException larni qayta HttpException
// sifatida otadi (status saqlangan holda). Testlarda statusCode'ni shu yerdan olamiz.
async function expectHttpStatus(
  promise: Promise<any>,
  status: number,
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected HttpException, but promise resolved');
  } catch (e: any) {
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getStatus()).toBe(status);
  }
}

const uuid = (n: number) => `00000000-0000-0000-0000-00000000000${n}`;

function createQueryRunnerMock() {
  const manager = {
    find: jest.fn(),
    findOne: jest.fn(),
    count: jest.fn(),
    save: jest.fn((entity: any) => Promise.resolve(entity)),
  };

  const qr = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };

  return { qr, manager };
}

describe('PostService — Courier Scanner & Return Request (yangi qo\'shilgan)', () => {
  let service: PostService;
  let dataSourceMock: { createQueryRunner: jest.Mock };
  let orderRepoMock: any;
  let activityLogMock: any;

  const courierUser: any = {
    id: uuid(50),
    role: 'courier',
    status: 'active',
  };

  beforeEach(async () => {
    dataSourceMock = { createQueryRunner: jest.fn() };
    orderRepoMock = {
      findOne: jest.fn(),
      save: jest.fn((entity: any) => Promise.resolve(entity)),
    };
    activityLogMock = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        { provide: getRepositoryToken(PostEntity), useValue: {} },
        { provide: getRepositoryToken(OrderEntity), useValue: orderRepoMock },
        { provide: getRepositoryToken(UserEntity), useValue: {} },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: ActivityLogService, useValue: activityLogMock },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
  });

  // ═══════════════════════════════════════════════════════════════
  // receiveOrderByQrTokenForCourier
  // ═══════════════════════════════════════════════════════════════
  describe('receiveOrderByQrTokenForCourier', () => {
    it('order topilmasa — 404 throw', async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne.mockResolvedValueOnce(null);

      await expectHttpStatus(
        service.receiveOrderByQrTokenForCourier('invalid-token', courierUser),
        404,
      );
      expect(qr.rollbackTransaction).toHaveBeenCalled();
    });

    it("order'da post_id bo'lmasa — 400 throw", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne.mockResolvedValueOnce({
        id: uuid(1),
        post_id: null,
        status: Order_status.NEW,
      });

      await expectHttpStatus(
        service.receiveOrderByQrTokenForCourier('token', courierUser),
        400,
      );
    });

    it("post boshqa kuryer'niki bo'lsa — 404 throw", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(1),
          post_id: uuid(80),
          status: Order_status.ON_THE_ROAD,
        })
        .mockResolvedValueOnce(null);

      await expectHttpStatus(
        service.receiveOrderByQrTokenForCourier('token', courierUser),
        404,
      );
    });

    it("post SENT statusda bo'lmasa — 400 throw", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(1),
          post_id: uuid(80),
          status: Order_status.WAITING,
        })
        .mockResolvedValueOnce({
          id: uuid(80),
          courier_id: courierUser.id,
          status: Post_status.RECEIVED,
        });

      await expectHttpStatus(
        service.receiveOrderByQrTokenForCourier('token', courierUser),
        400,
      );
    });

    it("order ON_THE_ROAD bo'lmasa — 400 throw", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(1),
          post_id: uuid(80),
          status: Order_status.WAITING,
        })
        .mockResolvedValueOnce({
          id: uuid(80),
          courier_id: courierUser.id,
          status: Post_status.SENT,
        });

      await expectHttpStatus(
        service.receiveOrderByQrTokenForCourier('token', courierUser),
        400,
      );
    });

    it("muvaffaqiyatli qabul + qoldiq buyurtma bor — post SENT'da qoladi", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(1),
          post_id: uuid(80),
          status: Order_status.ON_THE_ROAD,
          customer: { name: 'Test Mijoz' },
        })
        .mockResolvedValueOnce({
          id: uuid(80),
          courier_id: courierUser.id,
          status: Post_status.SENT,
          qr_code_token: 'post-token',
        });
      // Hali 2 ta order ON_THE_ROAD
      manager.count.mockResolvedValueOnce(2);

      const result: any = await service.receiveOrderByQrTokenForCourier(
        'token-1',
        courierUser,
      );

      expect(result.statusCode).toBe(200);
      expect(result.data.remaining).toBe(2);
      expect(result.data.postReceived).toBe(false);
      expect(result.data.customer_name).toBe('Test Mijoz');
      expect(qr.commitTransaction).toHaveBeenCalled();

      // 1-marta order saqlandi (status=WAITING)
      const orderSaveCall = manager.save.mock.calls.find(
        (c) => c[0]?.status === Order_status.WAITING,
      );
      expect(orderSaveCall).toBeTruthy();

      // Post saqlanmadi (status o'zgarmadi)
      const postSaveCall = manager.save.mock.calls.find(
        (c) => c[0]?.status === Post_status.RECEIVED,
      );
      expect(postSaveCall).toBeFalsy();
    });

    it("oxirgi buyurtma — post RECEIVED bo'ladi", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(1),
          post_id: uuid(80),
          status: Order_status.ON_THE_ROAD,
          customer: { name: 'Mijoz' },
        })
        .mockResolvedValueOnce({
          id: uuid(80),
          courier_id: courierUser.id,
          status: Post_status.SENT,
          qr_code_token: 'post-token',
        });
      // Hech qancha qolmadi — oxirgisi
      manager.count.mockResolvedValueOnce(0);

      const result: any = await service.receiveOrderByQrTokenForCourier(
        'token-last',
        courierUser,
      );

      expect(result.statusCode).toBe(200);
      expect(result.data.remaining).toBe(0);
      expect(result.data.postReceived).toBe(true);
      expect(qr.commitTransaction).toHaveBeenCalled();

      // Post status RECEIVED bo'lib saqlandi
      const postSaveCall = manager.save.mock.calls.find(
        (c) => c[0]?.status === Post_status.RECEIVED,
      );
      expect(postSaveCall).toBeTruthy();
    });

    it("activity log yoziladi (source: 'scanner')", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(1),
          post_id: uuid(80),
          status: Order_status.ON_THE_ROAD,
          customer: null,
        })
        .mockResolvedValueOnce({
          id: uuid(80),
          courier_id: courierUser.id,
          status: Post_status.SENT,
          qr_code_token: 'pt',
        });
      manager.count.mockResolvedValueOnce(3);

      await service.receiveOrderByQrTokenForCourier('the-token', courierUser);

      expect(activityLogMock.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entity_type: 'order',
          action: 'status_change',
          metadata: expect.objectContaining({
            source: 'scanner',
            scan_target: 'order',
            token: 'the-token',
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // markOrderForReturnRequestByCourier
  // ═══════════════════════════════════════════════════════════════
  describe('markOrderForReturnRequestByCourier', () => {
    it('order topilmasa — 404 throw', async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne.mockResolvedValueOnce(null);
      await expectHttpStatus(
        service.markOrderForReturnRequestByCourier(uuid(1), courierUser),
        404,
      );
    });

    it("order'da post_id bo'lmasa — 400 throw", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne.mockResolvedValueOnce({
        id: uuid(1),
        post_id: null,
        status: Order_status.NEW,
      });
      await expectHttpStatus(
        service.markOrderForReturnRequestByCourier(uuid(1), courierUser),
        400,
      );
    });

    it("post boshqa kuryer'niki bo'lsa — 404 throw", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(1),
          post_id: uuid(80),
          status: Order_status.ON_THE_ROAD,
          return_requested: false,
        })
        .mockResolvedValueOnce(null);
      await expectHttpStatus(
        service.markOrderForReturnRequestByCourier(uuid(1), courierUser),
        404,
      );
    });

    it("post SENT bo'lmasa — 400 throw (allaqachon qabul qilingan)", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(1),
          post_id: uuid(80),
          status: Order_status.WAITING,
          return_requested: false,
        })
        .mockResolvedValueOnce({
          id: uuid(80),
          courier_id: courierUser.id,
          status: Post_status.RECEIVED,
        });
      await expectHttpStatus(
        service.markOrderForReturnRequestByCourier(uuid(1), courierUser),
        400,
      );
    });

    it("order ON_THE_ROAD bo'lmasa — 400 throw", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(1),
          post_id: uuid(80),
          status: Order_status.WAITING, // hali skanerlanmagan ON_THE_ROAD bo'lishi kerak
          return_requested: false,
        })
        .mockResolvedValueOnce({
          id: uuid(80),
          courier_id: courierUser.id,
          status: Post_status.SENT,
        });
      await expectHttpStatus(
        service.markOrderForReturnRequestByCourier(uuid(1), courierUser),
        400,
      );
    });

    it("muvaffaqiyatli — order WAITING + return_requested=true; postda yana ON_THE_ROAD bor", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(1),
          post_id: uuid(80),
          status: Order_status.ON_THE_ROAD,
          return_requested: false,
        })
        .mockResolvedValueOnce({
          id: uuid(80),
          courier_id: courierUser.id,
          status: Post_status.SENT,
        });
      manager.count.mockResolvedValueOnce(2); // hali 2 ta qoldi

      const r: any = await service.markOrderForReturnRequestByCourier(
        uuid(1),
        courierUser,
      );

      expect(r.statusCode).toBe(200);
      expect(r.data.return_requested).toBe(true);
      expect(r.data.remaining).toBe(2);
      expect(r.data.postReceived).toBe(false);

      // Order saqlandi: status=WAITING, return_requested=true
      const orderSaveCall = manager.save.mock.calls.find(
        (c) =>
          c[0]?.status === Order_status.WAITING &&
          c[0]?.return_requested === true,
      );
      expect(orderSaveCall).toBeTruthy();

      // Post saqlanmadi (status hali SENT)
      const postSaveCall = manager.save.mock.calls.find(
        (c) => c[0]?.status === Post_status.RECEIVED,
      );
      expect(postSaveCall).toBeFalsy();

      expect(activityLogMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'return_requested' }),
      );
    });

    it("oxirgi ON_THE_ROAD — post RECEIVED bo'ladi", async () => {
      const { qr, manager } = createQueryRunnerMock();
      dataSourceMock.createQueryRunner.mockReturnValue(qr);
      manager.findOne
        .mockResolvedValueOnce({
          id: uuid(1),
          post_id: uuid(80),
          status: Order_status.ON_THE_ROAD,
          return_requested: false,
        })
        .mockResolvedValueOnce({
          id: uuid(80),
          courier_id: courierUser.id,
          status: Post_status.SENT,
        });
      manager.count.mockResolvedValueOnce(0); // oxirgisi edi

      const r: any = await service.markOrderForReturnRequestByCourier(
        uuid(1),
        courierUser,
      );

      expect(r.statusCode).toBe(200);
      expect(r.data.postReceived).toBe(true);
      expect(r.data.remaining).toBe(0);
      expect(qr.commitTransaction).toHaveBeenCalled();

      // Post RECEIVED bo'lib saqlandi
      const postSaveCall = manager.save.mock.calls.find(
        (c) => c[0]?.status === Post_status.RECEIVED,
      );
      expect(postSaveCall).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // cancelReturnRequestByCourier
  // ═══════════════════════════════════════════════════════════════
  describe('cancelReturnRequestByCourier', () => {
    it("return_requested false bo'lsa — 400 throw", async () => {
      orderRepoMock.findOne.mockResolvedValueOnce({
        id: uuid(1),
        return_requested: false,
        post: { courier_id: courierUser.id },
      });
      await expectHttpStatus(
        service.cancelReturnRequestByCourier(uuid(1), courierUser),
        400,
      );
    });

    it('muvaffaqiyatli bekor qilish — return_requested=false', async () => {
      orderRepoMock.findOne.mockResolvedValueOnce({
        id: uuid(1),
        return_requested: true,
        post: { courier_id: courierUser.id },
      });

      const r: any = await service.cancelReturnRequestByCourier(
        uuid(1),
        courierUser,
      );

      expect(r.statusCode).toBe(200);
      expect(r.data.return_requested).toBe(false);
      expect(orderRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ return_requested: false }),
      );
      expect(activityLogMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'return_request_cancelled' }),
      );
    });
  });
});
