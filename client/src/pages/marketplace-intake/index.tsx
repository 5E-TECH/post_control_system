import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Result,
  Segmented,
  Select,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { InputRef } from "antd";
import {
  AlertTriangle,
  Ban,
  PackageCheck,
  QrCode,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import {
  MARKETPLACE_REJECT_REASONS,
  useMarketplaceAvailable,
  useMarketplaceScan,
  type MarketplaceRejectReason,
  type MarketplaceScanOutcome,
} from "../../shared/api/hooks/useMarketplaceScan";

const money = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString("ru-RU") : "—";

/** Backend xato kontrakti: `{message, error}` — ikkisi ham STRING. */
const errText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ?? fallback;

const errStatus = (e: unknown): number | undefined =>
  (e as { response?: { status?: number } })?.response?.status;

/**
 * Circuit breaker ochilganda server 503 va «N soniyadan keyin» qaytaradi.
 *
 * Xato kontrakti maydonlarni tekislaydi (`{message, error}` — faqat
 * STRING), shuning uchun soniya MATNDAN olinadi. Topilmasa — breaker'ning
 * sovish davri (60 s) zaxira sifatida ishlatiladi.
 */
const PAUSE_FALLBACK_SEC = 60;
const pauseSecondsFrom = (e: unknown): number | null => {
  if (errStatus(e) !== 503) return null;
  const m = /(\d+)\s*soniya/.exec(errText(e, ""));
  return m ? Number(m[1]) : PAUSE_FALLBACK_SEC;
};

/**
 * ⚠️ `crypto.randomUUID` HTTPS yoki localhost'dagina bor. Planshet HTTP
 * orqali ochilsa u `undefined` bo'ladi va qabul qilish butunlay ishlamay
 * qolardi — shuning uchun zaxira.
 */
const newIdempotencyKey = (): string => {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  (c?.getRandomValues
    ? c.getRandomValues.bind(c)
    : (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++)
          arr[i] = Math.floor(Math.random() * 256);
        return arr;
      })(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
    16,
    20,
  )}-${h.slice(20)}`;
};

/**
 * MARKETPLACE QABUL EKRANI — operatorning kundalik ishi.
 *
 * ⚠️ HOLAT SERVERDA. Skanerlangan posilkalar ro'yxati brauzerda emas,
 * `marketplace_parcel` jadvalida yashaydi. Planshet o'chsa yoki sahifa
 * yangilansa, operator o'nlab posilkani qaytadan skanerlamaydi — ochiq
 * sessiya qayta tiklanadi.
 */
const MarketplaceIntakePage = () => {
  const [slug, setSlug] = useState<string | undefined>();
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [token, setToken] = useState("");
  const [rows, setRows] = useState<MarketplaceScanOutcome[]>([]);
  const [rejectFor, setRejectFor] = useState<MarketplaceScanOutcome | null>(null);
  const [rejectReason, setRejectReason] = useState<MarketplaceRejectReason>("DAMAGED");
  const [rejectNote, setRejectNote] = useState("");
  const [result, setResult] = useState<{
    accepted: Array<{ external_parcel_id: string; order_number: number }>;
    failed: Array<{ external_parcel_id: string; reason: string }>;
  } | null>(null);

  /**
   * ⚠️ Qabul kaliti BIR MARTA yaratiladi va muvaffaqiyatgacha SAQLANADI.
   * Qayta urinishda yangi kalit yuborilsa server uni yangi qop deb biladi
   * va buyurtmalar IKKI MARTA yaratilardi.
   */
  const idemKey = useRef<string>(newIdempotencyKey());
  const inputRef = useRef<InputRef>(null);

  // ⚠️ Sozlash ro'yxati EMAS — u admin-only. Bu endpoint registratorga
  // ham ochiq va faqat yoqilgan ulanishlarning nomini beradi.
  const available = useMarketplaceAvailable();
  const { session, openSession, scan, undoLast, reject, accept } =
    useMarketplaceScan(slug, sessionId);

  const integrations = useMemo(() => available.data ?? [], [available.data]);

  useEffect(() => {
    if (!slug && integrations.length) setSlug(integrations[0].slug);
  }, [integrations, slug]);

  // Ochiq sessiyani olish (yoki yangisini ochish).
  useEffect(() => {
    if (!slug) return;
    setSessionId(undefined);
    setRows([]);
    openSession
      .mutateAsync(slug)
      .then((s) => setSessionId(s.id))
      .catch((e) => message.error(errText(e, "Sessiyani ochib bo'lmadi")));
    // `openSession` mutatsiya obyekti har renderda yangi — bog'liqlikka
    // qo'shilsa cheksiz halqa bo'lardi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  /**
   * Serverdagi sessiyani ekranga tiklash.
   *
   * Bazadagi qator `ScanOutcome` emas — `raw_payload` dan mijoz/sotuvchi
   * ma'lumotini qayta yig'amiz. Bloker/ogohlantirish saqlanmagani uchun
   * tiklangan qatorlarda ular bo'sh bo'ladi: ular skan PAYTIDAGI xabar,
   * qabulda server baribir qaytadan tekshiradi.
   */
  useEffect(() => {
    const data = session.data;
    if (!data) return;
    setRows((prev) => {
      // ⚠️ Bloker va ogohlantirishlar SERVERDA saqlanmaydi — ular skan
      // PAYTIDAGI xabar. Sessiya har skandan keyin qayta so'ralgani uchun
      // bu ro'yxat ularni O'CHIRIB yuborardi: operator «tuman topilmadi»
      // ogohlantirishini ko'rib, keyingi skanda uni yo'qotardi.
      const seen = new Map(prev.map((r) => [r.parcel_id, r]));
      return data.parcels
        .filter((p) => p.scan_state === "scanned")
        .map((p) => {
          const raw = (p.raw_payload ?? {}) as Record<string, unknown>;
          const cust = (raw.customer ?? {}) as Record<string, unknown>;
          const seller = (raw.seller ?? {}) as Record<string, unknown>;
          return {
            parcel_id: p.id,
            external_parcel_id: p.external_parcel_id,
            external_order_id: p.external_order_id,
            qr_token: p.qr_token_raw,
            seller_id: p.seller_id,
            seller_name: (seller.seller_name as string | undefined) ?? null,
            customer_name: String(cust.full_name ?? "Marketplace mijozi"),
            phone: String(cust.phone ?? ""),
            district_name: null,
            address: cust.address ? String(cust.address) : null,
            cod_amount: Number(p.cod_amount ?? 0),
            prepaid: !!p.prepaid,
            parcel_index: p.parcel_index,
            parcel_count: p.parcel_count,
            where_deliver:
              String(raw.where_deliver ?? "center") === "address"
                ? "address"
                : "center",
            blockers: seen.get(p.id)?.blockers ?? [],
            warnings: seen.get(p.id)?.warnings ?? [],
            duplicate_in_session: false,
          } satisfies MarketplaceScanOutcome;
        });
    });
  }, [session.data]);

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  /**
   * ⚠️ SKANLAR KETMA-KET NAVBATDA ISHLANADI, maydon esa HECH QACHON
   * o'chirilmaydi.
   *
   * Haqiqiy skaner klaviatura kabi ishlaydi va juda tez yuboradi: bitta
   * so'rov ketayotganda ikkinchi kod keladi. Maydon `disabled` bo'lsa
   * o'sha bosishlar JIMGINA yo'qoladi — operator posilkani skanerladim
   * deb o'ylaydi, ro'yxatda esa u yo'q. Navbat bilan har kod o'z
   * navbatida serverga boradi.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());

  /**
   * SKANERLASH TO'XTATILGANI — turg'un banner.
   *
   * Avval faqat `message.error` chiqardi: u 3 soniyada yo'qoladi, keyin
   * operator yana skanerlaydi, yana yo'qoladi — va skaneri buzuq deb
   * o'ylaydi. Banner sanoq tugaguncha yoki muvaffaqiyatli skangacha
   * turadi.
   */
  const [pausedUntil, setPausedUntil] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const pauseLeft =
    pausedUntil === null
      ? 0
      : Math.max(0, Math.ceil((pausedUntil - nowTick) / 1000));

  useEffect(() => {
    if (pausedUntil === null) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pausedUntil]);

  useEffect(() => {
    if (pausedUntil !== null && pauseLeft === 0) setPausedUntil(null);
  }, [pausedUntil, pauseLeft]);

  const doScan = (raw: string) => {
    const qr = raw.trim();
    if (!qr || !sessionId) return;
    setToken("");
    queue.current = queue.current.then(() => runScan(qr, sessionId));
  };

  const runScan = async (qr: string, sid: string) => {
    try {
      const outcome = await scan.mutateAsync({ session_id: sid, qr_token: qr });
      setRows((prev) => {
        // Ayni posilka qayta skanerlansa dublikat qator yaratmaymiz.
        const rest = prev.filter((r) => r.parcel_id !== outcome.parcel_id);
        return [outcome, ...rest];
      });
      if (outcome.blockers.length) {
        message.error(outcome.blockers[0]);
      } else if (outcome.duplicate_in_session) {
        message.warning("Bu posilka allaqachon skanerlangan");
      } else {
        message.success(`${outcome.external_parcel_id} qo'shildi`);
      }
      setPausedUntil(null); // aloqa tiklandi
    } catch (e) {
      const sec = pauseSecondsFrom(e);
      if (sec !== null) setPausedUntil(Date.now() + sec * 1000);
      message.error(errText(e, "Skan qilib bo'lmadi"));
    } finally {
      focusInput();
    }
  };

  /**
   * KO'P QUTILI BUYURTMA TO'LIQLIGI.
   *
   * Server ham tekshiradi va chala buyurtmani qabul qilmaydi, lekin
   * operator buni QABULDAN OLDIN ko'rishi kerak — yo'qolgan quti hali
   * mashinada bo'lishi mumkin.
   */
  const incomplete = useMemo(() => {
    const byOrder = new Map<string, { seen: Set<number>; total: number }>();
    for (const r of rows) {
      const e = byOrder.get(r.external_order_id) ?? {
        seen: new Set<number>(),
        total: r.parcel_count,
      };
      e.seen.add(r.parcel_index);
      e.total = Math.max(e.total, r.parcel_count);
      byOrder.set(r.external_order_id, e);
    }
    return [...byOrder.entries()]
      .filter(([, v]) => v.seen.size < v.total)
      .map(([orderId, v]) => ({
        order_id: orderId,
        have: v.seen.size,
        total: v.total,
      }));
  }, [rows]);

  const blocked = rows.filter((r) => r.blockers.length);
  const totalCod = rows.reduce((s, r) => s + Number(r.cod_amount ?? 0), 0);

  const doAccept = async () => {
    if (!sessionId || !slug) return;
    try {
      const res = await accept.mutateAsync({
        session_id: sessionId,
        idempotency_key: idemKey.current,
      });
      setResult({ accepted: res.accepted, failed: res.failed });
      // Muvaffaqiyatdan keyingina yangi kalit — keyingi qop uchun.
      idemKey.current = newIdempotencyKey();
      setRows([]);
      // Yangi sessiya ochamiz: eskisi `accepted` holatiga o'tdi.
      const s = await openSession.mutateAsync(slug);
      setSessionId(s.id);
    } catch (e) {
      message.error(errText(e, "Qabul qilib bo'lmadi"));
    }
  };

  const doReject = async () => {
    if (!sessionId || !rejectFor) return;
    try {
      await reject.mutateAsync({
        session_id: sessionId,
        parcel_id: rejectFor.parcel_id,
        reason: rejectReason,
        note: rejectNote || undefined,
      });
      setRows((prev) => prev.filter((r) => r.parcel_id !== rejectFor.parcel_id));
      message.success("Posilka rad etildi");
      setRejectFor(null);
      setRejectNote("");
    } catch (e) {
      message.error(errText(e, "Rad etib bo'lmadi"));
    }
  };

  const columns = [
    {
      title: "Posilka",
      dataIndex: "external_parcel_id",
      render: (v: string, r: MarketplaceScanOutcome) => (
        <div>
          <div className="font-mono text-xs">{v}</div>
          {r.parcel_count > 1 && (
            <Tag color="purple">
              quti {r.parcel_index}/{r.parcel_count}
            </Tag>
          )}
        </div>
      ),
    },
    /**
     * ⚠️ SOTUVCHI USTUNI YO'Q — ataylab.
     *
     * Marketplace bizga faqat ID yuborishi mumkin (`SLR-77`). Operator
     * bu ID kimligini bilmaydi va unga qarab hech narsa qilmaydi —
     * ekranda joy egallagan foydasiz shovqin bo'lardi. Sotuvchi bilan
     * bog'liq HAQIQIY signal («reestrda yo'q», «faol emas») «Holat»
     * ustunidagi ogohlantirishlarda chiqadi.
     *
     * `seller_id` BACKENDDA saqlanadi va har hodisada marketplace'ga
     * boradi — ular kimga qancha berishni shundan biladi.
     */
    {
      title: "Mijoz",
      dataIndex: "customer_name",
      render: (v: string, r: MarketplaceScanOutcome) => (
        <div>
          <div className="text-sm">{v}</div>
          <div className="text-xs text-gray-400">{r.phone}</div>
        </div>
      ),
    },
    {
      title: "Yetkazish",
      dataIndex: "where_deliver",
      render: (v: string, r: MarketplaceScanOutcome) => (
        <div>
          <Tag color={v === "address" ? "geekblue" : "default"}>
            {v === "address" ? "uygacha" : "markazgacha"}
          </Tag>
          <div className="text-xs text-gray-400">{r.district_name ?? ""}</div>
        </div>
      ),
    },
    {
      title: "Olinadigan",
      dataIndex: "cod_amount",
      align: "right" as const,
      render: (v: number, r: MarketplaceScanOutcome) => (
        <div>
          <div className="font-medium">{money(Number(v))} so'm</div>
          {r.prepaid && <Tag color="green">oldindan to'langan</Tag>}
        </div>
      ),
    },
    {
      title: "Holat",
      key: "state",
      render: (_: unknown, r: MarketplaceScanOutcome) => (
        <div className="space-y-1">
          {r.blockers.map((b) => (
            <Tag key={b} color="red" className="whitespace-normal">
              {b}
            </Tag>
          ))}
          {r.warnings.map((w) => (
            <Tag key={w} color="orange" className="whitespace-normal">
              {w}
            </Tag>
          ))}
          {!r.blockers.length && !r.warnings.length && (
            <Tag color="green">tayyor</Tag>
          )}
        </div>
      ),
    },
    {
      title: "",
      key: "actions",
      render: (_: unknown, r: MarketplaceScanOutcome) => (
        <Button
          size="small"
          danger
          icon={<Ban className="w-4 h-4" />}
          onClick={() => setRejectFor(r)}
        >
          Rad etish
        </Button>
      ),
    },
  ];

  if (available.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  if (!integrations.length) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Yoqilgan marketplace ulanishi yo'q — administrator «Integratsiyalar → Marketplace» da sozlashi kerak"
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            <ScanLine className="w-4 h-4" /> Marketplace qabuli
          </span>
        }
        extra={
          integrations.length > 1 && (
            <Segmented
              value={slug}
              onChange={(v) => setSlug(String(v))}
              options={integrations.map((r) => ({ label: r.name, value: r.slug }))}
            />
          )
        }
      >
        {pauseLeft > 0 && (
          <Alert
            type="error"
            showIcon
            className="mb-3"
            message={`Skanerlash to'xtatildi — ${pauseLeft} soniya`}
            description="Marketplace javob bermayapti. Skaneringiz soz — muammo tashqi tizimda. Sanoq tugagach o'zi tiklanadi, kodni qaytadan skanerlang."
          />
        )}
        <Input
          ref={inputRef}
          autoFocus
          size="large"
          allowClear
          value={token}
          disabled={!sessionId}
          prefix={<QrCode className="w-4 h-4" />}
          placeholder="QR kodni skanerlang yoki kodni kiriting va Enter bosing"
          onChange={(e) => setToken(e.target.value)}
          onPressEnter={() => doScan(token)}
        />
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Skaner klaviatura kabi ishlaydi — maydon fokusda tursa, har skan
          avtomatik qo'shiladi. Ro'yxat serverda saqlanadi: sahifa yangilansa
          ham yo'qolmaydi.
        </div>
      </Card>

      {incomplete.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<AlertTriangle className="w-4 h-4" />}
          message="Chala buyurtma bor — qabul qilinmaydi"
          description={
            <div className="text-sm">
              {incomplete.map((i) => (
                <div key={i.order_id}>
                  <span className="font-mono text-xs">{i.order_id}</span> —{" "}
                  {i.have}/{i.total} quti skanerlangan
                </div>
              ))}
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Yarim buyurtmani qabul qilish mijozga chala posilka yuborish
                demak. Yo'qolgan quti hali mashinada bo'lishi mumkin.
              </div>
            </div>
          }
        />
      )}

      {blocked.length > 0 && (
        <Alert
          type="error"
          showIcon
          message={`${blocked.length} ta posilkada to'siq bor`}
          description="Ular qabulda yiqiladi. To'siqni bartaraf eting yoki posilkani rad eting."
        />
      )}

      <Card>
        <div className="flex items-center gap-6 flex-wrap mb-3">
          <Statistic title="Skanerlangan" value={rows.length} />
          <Statistic title="Jami olinadigan" value={totalCod} suffix="so'm" />
          <div className="flex gap-2 ml-auto">
            <Popconfirm
              title="Oxirgi skanni qaytarish"
              okText="Qaytarish"
              cancelText="Bekor"
              disabled={!rows.length}
              onConfirm={async () => {
                if (!sessionId) return;
                try {
                  const res = await undoLast.mutateAsync(sessionId);
                  setRows((prev) =>
                    prev.filter((r) => r.external_parcel_id !== res.removed),
                  );
                  message.success(`${res.removed} olib tashlandi`);
                } catch (e) {
                  message.error(errText(e, "Qaytarib bo'lmadi"));
                } finally {
                  focusInput();
                }
              }}
            >
              <Button
                icon={<RotateCcw className="w-4 h-4" />}
                disabled={!rows.length}
                loading={undoLast.isPending}
              >
                Oxirgisini qaytarish
              </Button>
            </Popconfirm>

            <Tooltip
              title={
                incomplete.length
                  ? "Chala buyurtma bor — avval qolgan qutilarni skanerlang"
                  : undefined
              }
            >
              <Popconfirm
                title={`${rows.length} ta posilkani qabul qilish`}
                description="Buyurtmalar yaratiladi va marketplace'ga xabar ketadi."
                okText="Qabul qilish"
                cancelText="Bekor"
                disabled={!rows.length || incomplete.length > 0}
                onConfirm={doAccept}
              >
                <Button
                  type="primary"
                  size="large"
                  icon={<PackageCheck className="w-4 h-4" />}
                  disabled={!rows.length || incomplete.length > 0}
                  loading={accept.isPending}
                >
                  Qabul qilish
                </Button>
              </Popconfirm>
            </Tooltip>
          </div>
        </div>

        <Table<MarketplaceScanOutcome>
          size="small"
          rowKey="parcel_id"
          pagination={false}
          loading={session.isLoading}
          dataSource={rows}
          columns={columns}
          locale={{ emptyText: "Hali hech narsa skanerlanmagan" }}
        />
      </Card>

      {/* ── Rad etish ── */}
      <Modal
        open={!!rejectFor}
        onCancel={() => setRejectFor(null)}
        onOk={doReject}
        okText="Rad etish"
        cancelText="Bekor"
        okButtonProps={{ danger: true }}
        confirmLoading={reject.isPending}
        title={`Rad etish — ${rejectFor?.external_parcel_id ?? ""}`}
      >
        <div className="space-y-3">
          <Select
            className="w-full"
            value={rejectReason}
            onChange={(v) => setRejectReason(v)}
            options={MARKETPLACE_REJECT_REASONS.map((r) => ({
              value: r.value,
              label: r.label,
            }))}
          />
          <Input.TextArea
            rows={3}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Izoh (ixtiyoriy)"
            maxLength={500}
          />
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Rad etilgan posilka qabul qilinmaydi va marketplace'ga sabab bilan
            xabar beriladi.
          </div>
        </div>
      </Modal>

      {/* ── Natija ── */}
      <Modal
        open={!!result}
        onCancel={() => setResult(null)}
        onOk={() => {
          setResult(null);
          focusInput();
        }}
        okText="Yopish"
        cancelButtonProps={{ style: { display: "none" } }}
        title="Qabul natijasi"
        width={640}
      >
        <Result
          status={result?.failed.length ? "warning" : "success"}
          title={`${result?.accepted.length ?? 0} ta buyurtma yaratildi`}
          subTitle={
            result?.failed.length
              ? `${result.failed.length} ta posilka qabul qilinmadi`
              : "Marketplace'ga xabar yuborildi"
          }
        />
        {!!result?.accepted.length && (
          <div className="flex gap-2 flex-wrap mb-3">
            {result.accepted.map((a) => (
              <Tag key={a.external_parcel_id} color="green">
                #{a.order_number}
              </Tag>
            ))}
          </div>
        )}
        {!!result?.failed.length && (
          <Alert
            type="error"
            showIcon
            message="Qabul qilinmaganlar"
            description={
              <div className="text-sm space-y-1">
                {result.failed.map((f) => (
                  <div key={f.external_parcel_id}>
                    <span className="font-mono text-xs">
                      {f.external_parcel_id}
                    </span>{" "}
                    — {f.reason}
                  </div>
                ))}
              </div>
            }
          />
        )}
      </Modal>
    </div>
  );
};

export default MarketplaceIntakePage;
