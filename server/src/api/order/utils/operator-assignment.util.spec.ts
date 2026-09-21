import { BadRequestException } from '@nestjs/common';
import { Roles, Status } from 'src/common/enums';
import {
  resolveOperatorAssignment,
  type OperatorCandidate,
} from './operator-assignment.util';

const MARKET = 'market-1';
const NOW = 1_700_000_000_000;

const candidate = (over: Partial<OperatorCandidate> = {}): OperatorCandidate => ({
  id: 'op-1',
  name: 'Aliyev Vali',
  status: Status.ACTIVE,
  market_id: MARKET,
  is_deleted: false,
  ...over,
});

const run = (over: Partial<Parameters<typeof resolveOperatorAssignment>[0]> = {}) =>
  resolveOperatorAssignment({
    creatorId: MARKET,
    creatorRole: Roles.MARKET,
    marketId: MARKET,
    requestedOperatorId: null,
    candidate: null,
    now: NOW,
    ...over,
  });

describe('resolveOperatorAssignment', () => {
  it('market boshqa operatorni tanladi — QABUL KUTILADI', () => {
    const r = run({ requestedOperatorId: 'op-1', candidate: candidate() });
    expect(r.operator_id).toBe('op-1');
    expect(r.operator_name).toBe('Aliyev Vali');
    expect(r.operator_assigned_by).toBe(MARKET);
    expect(r.operator_assigned_at).toBe(NOW);
    // Eng muhimi: boshqa odam biriktirgani uchun AVTO-QABUL BO'LMAYDI.
    expect(r.operator_accepted_at).toBeNull();
  });

  it('operator O\'ZINI tanladi — avtomatik qabul qilingan', () => {
    const r = run({
      creatorId: 'op-1',
      creatorRole: Roles.OPERATOR,
      requestedOperatorId: 'op-1',
      candidate: candidate(),
    });
    expect(r.operator_accepted_at).toBe(NOW);
  });

  it('operator hech kimni tanlamay yaratdi — o\'ziga biriktiriladi (eski xatti-harakat)', () => {
    const r = run({ creatorId: 'op-9', creatorRole: Roles.OPERATOR });
    expect(r.operator_id).toBe('op-9');
    expect(r.operator_accepted_at).toBe(NOW);
    // Chekdagi matn tegilmaydi — eski oqim buzilmasin.
    expect(r.operator_name).toBeNull();
  });

  it('market tanlamadi — BO\'SH qoladi (majburlash yo\'q)', () => {
    const r = run();
    expect(r).toEqual({
      operator_id: null,
      operator_name: null,
      operator_assigned_by: null,
      operator_assigned_at: null,
      operator_accepted_at: null,
    });
  });

  it('BOSHQA marketning operatori — rad etiladi (IDOR)', () => {
    expect(() =>
      run({
        requestedOperatorId: 'op-1',
        candidate: candidate({ market_id: 'market-2' }),
      }),
    ).toThrow(BadRequestException);
  });

  it('nomzod topilmadi — rad etiladi', () => {
    expect(() => run({ requestedOperatorId: 'yo-q', candidate: null })).toThrow(
      BadRequestException,
    );
  });

  it("o'chirilgan operator — rad etiladi", () => {
    expect(() =>
      run({
        requestedOperatorId: 'op-1',
        candidate: candidate({ is_deleted: true }),
      }),
    ).toThrow(BadRequestException);
  });

  it('bloklangan (INACTIVE) operator — rad etiladi', () => {
    expect(() =>
      run({
        requestedOperatorId: 'op-1',
        candidate: candidate({ status: Status.INACTIVE }),
      }),
    ).toThrow(BadRequestException);
  });

  it('admin market nomidan tanladi — biriktiruvchi ADMIN bo\'ladi', () => {
    const r = run({
      creatorId: 'admin-1',
      creatorRole: Roles.ADMIN,
      requestedOperatorId: 'op-1',
      candidate: candidate(),
    });
    expect(r.operator_assigned_by).toBe('admin-1');
    expect(r.operator_accepted_at).toBeNull();
  });
});
