/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getBotToken } from 'nestjs-telegraf';
import { DataSource } from 'typeorm';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { OrderBotService } from './order-bot.service';
import { UserEntity } from 'src/core/entity/users.entity';
import { TelegramEntity } from 'src/core/entity/telegram-market.entity';
import { OrderEntity } from 'src/core/entity/order.entity';
import { Token } from 'src/infrastructure/lib/token-generator/token';
import { BcryptEncryption } from 'src/infrastructure/lib/bcrypt';
import { MyLogger } from 'src/logger/logger.service';
import { Group_type, Order_status, Roles, Status } from 'src/common/enums';
import config from 'src/config';

const uuid = (n: number) =>
  `00000000-0000-0000-0000-0000000000${n.toString().padStart(2, '0')}`;

function createQueryRunnerMock() {
  const savedEntities: any[] = [];
  const manager = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((_Entity: any, data: any) => ({ ...data })),
    save: jest.fn((arg1: any, arg2?: any) => {
      const entity = arg2 !== undefined ? arg2 : arg1;
      if (!entity.id) entity.id = uuid(99);
      savedEntities.push(entity);
      return Promise.resolve(entity);
    }),
    update: jest.fn(() => Promise.resolve({ affected: 1 })),
    softDelete: jest.fn(() => Promise.resolve({ affected: 1 })),
  };

  const qr = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager,
  };

  return { qr, savedEntities };
}

function makeBotMock() {
  return {
    telegram: {
      sendMessage: jest.fn().mockResolvedValue({
        chat: { id: 1 },
        message_id: 10,
      }),
      editMessageText: jest.fn().mockResolvedValue(true),
      editMessageReplyMarkup: jest.fn().mockResolvedValue(true),
    },
  };
}

function makeCtx(
  overrides: Partial<{
    session: any;
    from: any;
    chat: any;
    callbackQuery: any;
  }> = {},
) {
  return {
    session: { step: 'initial', waitingForPhone: false },
    from: { id: 123456, first_name: 'Test' },
    chat: { id: 100 },
    ...overrides,
  } as any;
}

describe('OrderBotService', () => {
  let service: OrderBotService;
  let userRepo: any;
  let telegramRepo: any;
  let orderRepo: any;
  let bot: ReturnType<typeof makeBotMock>;
  let dataSource: any;
  let queryRunnerFactory: { qr: any; savedEntities: any[] };

  const originalWebAppUrl = config.WEB_APP_URL;

  beforeEach(async () => {
    config.WEB_APP_URL = 'https://example.test/bot';
    queryRunnerFactory = createQueryRunnerMock();
    bot = makeBotMock();

    userRepo = { findOne: jest.fn(), save: jest.fn() };
    telegramRepo = { findOne: jest.fn() };
    orderRepo = { findOne: jest.fn() };

    dataSource = {
      createQueryRunner: jest.fn(() => queryRunnerFactory.qr),
      manager: { update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderBotService,
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        { provide: getRepositoryToken(TelegramEntity), useValue: telegramRepo },
        { provide: getRepositoryToken(OrderEntity), useValue: orderRepo },
        { provide: getBotToken(config.ORDER_BOT_NAME), useValue: bot },
        { provide: Token, useValue: { generateAccessToken: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
        {
          provide: BcryptEncryption,
          useValue: { encrypt: jest.fn().mockResolvedValue('hashed') },
        },
        { provide: MyLogger, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<OrderBotService>(OrderBotService);
  });

  afterEach(() => {
    config.WEB_APP_URL = originalWebAppUrl;
    jest.clearAllMocks();
  });

  describe('openWebApp', () => {
    it('uses configured WEB_APP_URL and strips trailing slash', () => {
      config.WEB_APP_URL = 'https://example.test/bot/';
      const result = service.openWebApp();
      expect(result.inline_keyboard[0][0].web_app.url).toBe(
        'https://example.test/bot',
      );
    });

    it('throws if WEB_APP_URL is empty', () => {
      config.WEB_APP_URL = '   ';
      expect(() => service.openWebApp()).toThrow();
    });
  });

  describe('checkTokenRateLimit', () => {
    it('allows first 5 attempts within window', () => {
      const userId = 42;
      for (let i = 0; i < 5; i++) {
        expect(service.checkTokenRateLimit(userId)).toBe(true);
      }
    });

    it('blocks 6th attempt within window', () => {
      const userId = 43;
      for (let i = 0; i < 5; i++) {
        service.checkTokenRateLimit(userId);
      }
      expect(service.checkTokenRateLimit(userId)).toBe(false);
    });

    it('rate limits per user independently', () => {
      for (let i = 0; i < 5; i++) service.checkTokenRateLimit(100);
      expect(service.checkTokenRateLimit(100)).toBe(false);
      expect(service.checkTokenRateLimit(101)).toBe(true);
    });
  });

  describe('registerNewOperator — existing MARKET', () => {
    it('links telegram_id when missing and returns MARKET success', async () => {
      const market = {
        id: uuid(1),
        phone_number: '+998900000001',
        role: Roles.MARKET,
        status: Status.ACTIVE,
        is_deleted: false,
        telegram_id: null,
      };
      queryRunnerFactory.qr.manager.findOne.mockResolvedValueOnce(market);

      const ctx = makeCtx({
        session: {
          marketData: { id: market.id, name: 'TestMarket', add_order: true },
        },
      });

      const res: any = await service.registerNewOperator('998900000001', ctx);

      expect(res.statusCode).toBe(200);
      expect(market.telegram_id).toBe(123456);
      expect(queryRunnerFactory.qr.manager.save).toHaveBeenCalledWith(market);
      expect(queryRunnerFactory.qr.commitTransaction).toHaveBeenCalled();
      expect(res.message).toMatch(/market sifatida/i);
    });

    it('does NOT create a new user when phone matches existing MARKET', async () => {
      const market = {
        id: uuid(2),
        phone_number: '+998900000002',
        role: Roles.MARKET,
        status: Status.ACTIVE,
        is_deleted: false,
        telegram_id: 123456,
      };
      queryRunnerFactory.qr.manager.findOne.mockResolvedValueOnce(market);

      const ctx = makeCtx({
        session: { marketData: { id: market.id, name: 'TestMarket' } },
      });

      await service.registerNewOperator('998900000002', ctx);

      expect(queryRunnerFactory.qr.manager.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when telegram_id differs from current user', async () => {
      const market = {
        id: uuid(3),
        phone_number: '+998900000003',
        role: Roles.MARKET,
        status: Status.ACTIVE,
        is_deleted: false,
        telegram_id: 999999,
      };
      queryRunnerFactory.qr.manager.findOne.mockResolvedValueOnce(market);

      const ctx = makeCtx({
        session: { marketData: { id: market.id, name: 'TestMarket' } },
      });

      await expect(
        service.registerNewOperator('998900000003', ctx),
      ).rejects.toThrow(HttpException);
    });

    it('throws when existing user is blocked', async () => {
      queryRunnerFactory.qr.manager.findOne.mockResolvedValueOnce({
        id: uuid(4),
        phone_number: '+998900000004',
        role: Roles.MARKET,
        status: Status.INACTIVE,
        is_deleted: false,
        telegram_id: null,
      });

      const ctx = makeCtx({
        session: { marketData: { id: uuid(4), name: 'TestMarket' } },
      });

      await expect(
        service.registerNewOperator('998900000004', ctx),
      ).rejects.toThrow(HttpException);
    });

    it('refuses to link to CUSTOMER account', async () => {
      queryRunnerFactory.qr.manager.findOne.mockResolvedValueOnce({
        id: uuid(5),
        phone_number: '+998900000005',
        role: Roles.CUSTOMER,
        status: Status.ACTIVE,
        is_deleted: false,
        telegram_id: null,
      });

      const ctx = makeCtx({
        session: { marketData: { id: uuid(5), name: 'TestMarket' } },
      });

      await expect(
        service.registerNewOperator('998900000005', ctx),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('registerNewOperator — new operator', () => {
    it('creates new operator when phone does not exist', async () => {
      queryRunnerFactory.qr.manager.findOne
        .mockResolvedValueOnce(null) // existingUser by phone
        .mockResolvedValueOnce(null) // existingByTelegramId
        .mockResolvedValueOnce({
          id: uuid(6),
          role: Roles.MARKET,
          is_deleted: false,
        }); // market

      const ctx = makeCtx({
        session: {
          marketData: { id: uuid(6), name: 'TestMarket', add_order: true },
          name: 'NewOp',
        },
      });

      const res: any = await service.registerNewOperator('998900000006', ctx);

      expect(res.statusCode).toBe(201);
      expect(queryRunnerFactory.qr.manager.create).toHaveBeenCalled();
      const createdOperator =
        queryRunnerFactory.qr.manager.create.mock.calls[0][1];
      expect(createdOperator.role).toBe(Roles.OPERATOR);
      expect(createdOperator.market_id).toBe(uuid(6));
      expect(createdOperator.telegram_id).toBe(123456);
      expect(createdOperator.phone_number).toBe('+998900000006');
    });

    it('rejects when telegram_id is already linked to another user', async () => {
      queryRunnerFactory.qr.manager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: uuid(7), telegram_id: 123456 });

      const ctx = makeCtx({
        session: { marketData: { id: uuid(7), name: 'TestMarket' } },
      });

      await expect(
        service.registerNewOperator('998900000007', ctx),
      ).rejects.toThrow(HttpException);
    });

    it('rejects when market session id does not match any MARKET', async () => {
      queryRunnerFactory.qr.manager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const ctx = makeCtx({
        session: { marketData: { id: uuid(8), name: 'TestMarket' } },
      });

      await expect(
        service.registerNewOperator('998900000008', ctx),
      ).rejects.toThrow(HttpException);
    });

    it('rejects if session has no marketData', async () => {
      const ctx = makeCtx({ session: {} });
      await expect(
        service.registerNewOperator('998900000009', ctx),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('signInWithTelegram', () => {
    it('returns access_token for OPERATOR user', async () => {
      const user = {
        id: uuid(10),
        role: Roles.OPERATOR,
        status: Status.ACTIVE,
        is_deleted: false,
        name: 'OpUser',
      };
      userRepo.findOne.mockResolvedValue(user);
      const token = service['token'] as any;
      token.generateAccessToken.mockResolvedValue('jwt-token');

      const ctx = makeCtx();
      const res: any = await service.signInWithTelegram(ctx);

      expect(res.statusCode).toBe(200);
      expect(res.data.access_token).toBe('jwt-token');
    });

    it('returns access_token for MARKET user', async () => {
      const user = {
        id: uuid(11),
        role: Roles.MARKET,
        status: Status.ACTIVE,
        is_deleted: false,
        name: 'MarketUser',
      };
      userRepo.findOne.mockResolvedValue(user);
      const token = service['token'] as any;
      token.generateAccessToken.mockResolvedValue('market-jwt');

      const ctx = makeCtx();
      const res: any = await service.signInWithTelegram(ctx);

      expect(res.statusCode).toBe(200);
      expect(res.data.access_token).toBe('market-jwt');
    });

    it('throws when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.signInWithTelegram(makeCtx())).rejects.toThrow(
        HttpException,
      );
    });

    it('throws when user is INACTIVE', async () => {
      userRepo.findOne.mockResolvedValue({
        id: uuid(12),
        role: Roles.OPERATOR,
        status: Status.INACTIVE,
      });
      await expect(service.signInWithTelegram(makeCtx())).rejects.toThrow(
        HttpException,
      );
    });

    it('throws when user role is CUSTOMER or SUPERADMIN', async () => {
      userRepo.findOne.mockResolvedValue({
        id: uuid(13),
        role: Roles.CUSTOMER,
        status: Status.ACTIVE,
      });
      await expect(service.signInWithTelegram(makeCtx())).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('processOrderAction', () => {
    const makeOrder = (overrides: any = {}): any => ({
      id: uuid(20),
      status: Order_status.CREATED,
      deleted_at: null,
      user_id: uuid(30),
      customer: { name: 'Cust', phone_number: '+998901111111', district: null },
      items: [],
      total_price: 10000,
      operator: 'OpA',
      comment: null,
      create_bot_messages: [{ chatId: 500, messageId: 600 }],
      ...overrides,
    });

    it('rejects if chat is not authorized for market', async () => {
      queryRunnerFactory.qr.manager.findOne.mockResolvedValue(makeOrder());
      telegramRepo.findOne.mockResolvedValue(null);

      const ctx = makeCtx({ chat: { id: 999 } });

      await expect(
        service.processOrderAction('approve', uuid(20), ctx),
      ).rejects.toThrow(HttpException);
    });

    it('approves order when callback chat is authorized', async () => {
      const order = makeOrder();
      queryRunnerFactory.qr.manager.findOne.mockResolvedValue(order);
      telegramRepo.findOne.mockResolvedValue({
        group_id: '500',
        market_id: order.user_id,
        group_type: Group_type.CREATE,
      });

      const ctx = makeCtx({
        chat: { id: 500 },
        callbackQuery: {
          message: { chat: { id: 500 }, message_id: 600 },
        },
      });

      const res: any = await service.processOrderAction(
        'approve',
        order.id,
        ctx,
      );

      expect(res.statusCode).toBe(200);
      expect(order.status).toBe(Order_status.NEW);
    });

    it('cancels order (marks deleted) when authorized', async () => {
      const order = makeOrder();
      queryRunnerFactory.qr.manager.findOne.mockResolvedValue(order);
      telegramRepo.findOne.mockResolvedValue({
        group_id: '500',
        market_id: order.user_id,
        group_type: Group_type.CREATE,
      });

      const ctx = makeCtx({
        chat: { id: 500 },
        callbackQuery: {
          message: { chat: { id: 500 }, message_id: 600 },
        },
      });

      await service.processOrderAction('cancel', order.id, ctx);
      // Soft-delete: deleted_at TypeORM softDelete chaqiriqi orqali yoziladi
      expect(queryRunnerFactory.qr.manager.softDelete).toHaveBeenCalled();
    });

    it('returns early if order already processed', async () => {
      const order = makeOrder({ status: Order_status.NEW });
      queryRunnerFactory.qr.manager.findOne.mockResolvedValue(order);
      telegramRepo.findOne.mockResolvedValue({
        group_id: '500',
        market_id: order.user_id,
        group_type: Group_type.CREATE,
      });

      const ctx = makeCtx({ chat: { id: 500 } });
      const res: any = await service.processOrderAction(
        'approve',
        order.id,
        ctx,
      );

      expect(res.statusCode).toBe(200);
      expect(res.message).toMatch(/allaqachon/);
      expect(order.status).toBe(Order_status.NEW);
    });

    it('throws NotFoundException when order missing', async () => {
      queryRunnerFactory.qr.manager.findOne.mockResolvedValue(null);
      const ctx = makeCtx({ chat: { id: 500 } });
      await expect(
        service.processOrderAction('approve', uuid(21), ctx),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('markdown safety in buildOrderMessage', () => {
    it('escapes * and _ in customer name to prevent broken markdown', () => {
      const order: any = {
        customer: {
          name: '*Mad_Hacker*',
          phone_number: '+998',
          district: null,
        },
        items: [],
        total_price: 0,
        operator: 'Op',
        comment: null,
        created_at: '1700000000000',
      };
      const msg = (service as any).buildOrderMessage(order);
      expect(msg).toContain('\\*Mad\\_Hacker\\*');
    });
  });
});
