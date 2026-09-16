import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Modal,
  Result,
  Select,
  Spin,
  Statistic,
  Table,
  Tag,
  message,
} from "antd";
import {
  AlertTriangle,
  Banknote,
  RefreshCcwDot,
  Scale,
  Wallet,
} from "lucide-react";
import {
  MARKETPLACE_SETTLEMENT_METHODS,
  useMarketplacePanel,
  type MarketplaceSellerBalance,
  type MarketplaceSettlementMethod,
} from "../../../../shared/api/hooks/useMarketplacePanel";

const money = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString("ru-RU") : "—";

/** Backend xato kontrakti: `{message, error}` — ikkisi ham STRING. */
const errText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ?? fallback;

interface AllocRow {
  seller_id: string;
  /** Sotuvchining joriy qoldig'i — to'lov shundan oshmasligi kerak. */
  balance: number;
  entries: number;
  /** Admin tahrirlaydigan summa. */
  amount: number;
}

interface Props {
  slug?: string;
}

/**
 * MARKETPLACE HISOB-KITOBI.
 *
 * ⚠️ Taqsimot MAJBURIY. Biz marketplace'ga bitta summa o'tkazamiz, lekin
 * u o'z sotuvchilariga shu ro'yxat bo'yicha taqsimlaydi. Ro'yxatsiz
 * to'lov — marketplace uchun kimga qancha berishi noma'lum summa.
 */
export const MarketplaceSettlementTab = ({ slug }: Props) => {
  const { suggest, pay } = useMarketplacePanel(slug);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AllocRow[]>([]);
  const [method, setMethod] =
    useState<MarketplaceSettlementMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{ amount: number; balance_after: number } | null>(
    null,
  );

  const data = suggest.data;

  // Oyna ochilganda taklifni to'liq qoldiq bilan to'ldiramiz.
  useEffect(() => {
    if (!open || !data) return;
    setRows(
      data.sellers.map((s) => ({
        seller_id: s.seller_id,
        balance: s.amount,
        entries: s.entries,
        amount: s.amount,
      })),
    );
  }, [open, data]);

  /**
   * ⚠️ To'lov summasi taqsimotdan HOSIL BO'LADI, alohida kiritilmaydi.
   * Ikki maydon bo'lsa ular ajralib ketishi mumkin va server rad etardi —
   * yoki bundan ham yomoni, admin nomuvofiqlikni sezmay qolardi.
   */
  const total = useMemo(
    () => rows.reduce((n, r) => n + (Number(r.amount) || 0), 0),
    [rows],
  );

  const overpaid = rows.filter((r) => Number(r.amount) > r.balance);

  const setAmount = (sellerId: string, value: number | null) =>
    setRows((prev) =>
      prev.map((r) =>
        r.seller_id === sellerId
          ? { ...r, amount: Math.max(0, Math.trunc(Number(value) || 0)) }
          : r,
      ),
    );

  const submit = async () => {
    if (!slug) return;
    const allocation = rows
      .filter((r) => r.amount > 0)
      .map((r) => ({ seller_id: r.seller_id, amount: r.amount }));
    if (!allocation.length) {
      message.error("Kamida bitta sotuvchiga summa kiriting");
      return;
    }
    try {
      const res = await pay.mutateAsync({
        slug,
        amount: total,
        method,
        allocation,
        reference: reference || undefined,
        note: note || undefined,
      });
      setOpen(false);
      setReference("");
      setNote("");
      setDone({ amount: res.amount, balance_after: res.balance_after });
    } catch (e) {
      message.error(errText(e, "To'lovni amalga oshirib bo'lmadi"));
    }
  };

  if (!slug) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Ulanish tanlanmagan"
        />
      </Card>
    );
  }

  if (suggest.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data && !data.invariant.ok && (
        <Alert
          type="error"
          showIcon
          icon={<AlertTriangle className="w-4 h-4" />}
          message="INVARIANT BUZILGAN — to'lovdan oldin tekshiring"
          description={
            <div className="text-sm">
              <div>Kassa: {money(data.invariant.cashbox_balance)} so'm</div>
              <div>Daftar: {money(data.invariant.ledger_sum)} so'm</div>
              <div className="font-semibold">
                Farq: {money(data.invariant.diff)} so'm
              </div>
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Bu holatda to'lov qilish farqni yanada chalkashtiradi — avval
                sababini aniqlang.
              </div>
            </div>
          }
        />
      )}

      <Card
        title={
          <span className="flex items-center gap-2">
            <Scale className="w-4 h-4" /> Joriy qoldiq
          </span>
        }
        extra={
          <div className="flex gap-2">
            <Button
              icon={<RefreshCcwDot className="w-4 h-4" />}
              loading={suggest.isFetching}
              onClick={() => suggest.refetch()}
            >
              Yangilash
            </Button>
            <Button
              type="primary"
              icon={<Banknote className="w-4 h-4" />}
              disabled={!data?.sellers.length}
              onClick={() => setOpen(true)}
            >
              To'lov qilish
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-8 flex-wrap">
          <Statistic
            title="Marketplace'ga to'lanadigan"
            value={data?.total_payable ?? 0}
            suffix="so'm"
          />
          <Statistic
            title="Kassa balansi"
            value={data?.invariant.cashbox_balance ?? 0}
            suffix="so'm"
          />
          <Statistic title="Sotuvchilar" value={data?.sellers.length ?? 0} />
        </div>

        <Table<{ seller_id: string; amount: number; entries: number }>
          className="mt-4"
          size="small"
          rowKey="seller_id"
          pagination={false}
          dataSource={data?.sellers ?? []}
          locale={{ emptyText: "To'lanadigan qoldiq yo'q" }}
          columns={[
            {
              title: "Sotuvchi",
              dataIndex: "seller_id",
              render: (v: string) => (
                <span className="font-mono text-xs">{v}</span>
              ),
            },
            {
              title: "Yozuvlar",
              dataIndex: "entries",
              render: (v: number) => (
                <span className="text-xs text-gray-400">{v} ta</span>
              ),
            },
            {
              title: "Qoldiq",
              dataIndex: "amount",
              align: "right" as const,
              render: (v: number) => (
                <span className="font-medium">{money(v)} so'm</span>
              ),
            },
          ]}
        />
      </Card>

      {!!data?.negative_sellers.length && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Bizga qarzdor sotuvchilar
            </span>
          }
        >
          <Alert
            type="info"
            showIcon
            className="mb-3"
            message="Bu sotuvchilar to'lovga KIRMAYDI"
            description="Qoldig'i manfiy — oldindan to'langan buyurtmada yetkazish puli ularning hisobidan olingan. Marketplace buni o'z tomonida hisobga oladi."
          />
          <Table<MarketplaceSellerBalance>
            size="small"
            rowKey={(r) => String(r.seller_id)}
            pagination={false}
            dataSource={data.negative_sellers}
            columns={[
              {
                title: "Sotuvchi",
                dataIndex: "seller_id",
                render: (v: string | null) => (
                  <span className="font-mono text-xs">{v ?? "—"}</span>
                ),
              },
              {
                title: "Qoldiq",
                dataIndex: "balance",
                align: "right" as const,
                render: (v: number) => (
                  <Tag color="red">{money(Number(v))} so'm</Tag>
                ),
              },
            ]}
          />
        </Card>
      )}

      {/* ── To'lov oynasi ── */}
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText={`${money(total)} so'm to'lash`}
        cancelText="Bekor qilish"
        confirmLoading={pay.isPending}
        // ⚠️ Qoldiqdan ortiq to'lash TO'SILADI. Backend buni tekshirmaydi
        // (u faqat yig'indi == summa ekanini ko'radi), lekin sotuvchiga
        // ishlab topganidan ko'p berilsa uning daftari manfiyga tushadi va
        // farq keyingi hisob-kitobda jimgina «yo'qolgan pul» bo'lib chiqadi.
        okButtonProps={{ disabled: total <= 0 || overpaid.length > 0 }}
        title="Marketplace bilan hisob-kitob"
        width={720}
      >
        <Alert
          type="warning"
          showIcon
          className="mb-3"
          message="Taqsimot marketplace'ga yuboriladi"
          description="Ular sotuvchilarga aynan shu ro'yxat bo'yicha to'laydi. Summani kamaytirsangiz qolgan qoldiq keyingi to'lovga o'tadi."
        />

        <Table<AllocRow>
          size="small"
          rowKey="seller_id"
          pagination={false}
          dataSource={rows}
          columns={[
            {
              title: "Sotuvchi",
              dataIndex: "seller_id",
              render: (v: string) => (
                <span className="font-mono text-xs">{v}</span>
              ),
            },
            {
              title: "Qoldiq",
              dataIndex: "balance",
              align: "right" as const,
              render: (v: number) => (
                <span className="text-gray-500">{money(v)} so'm</span>
              ),
            },
            {
              title: "To'lanadi",
              dataIndex: "amount",
              align: "right" as const,
              render: (v: number, r: AllocRow) => (
                <InputNumber
                  size="small"
                  min={0}
                  max={r.balance}
                  step={1000}
                  value={v}
                  onChange={(next) => setAmount(r.seller_id, next)}
                />
              ),
            },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}>
                <span className="font-semibold">Jami</span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <span className="text-gray-500">
                  {money(rows.reduce((n, r) => n + r.balance, 0))} so'm
                </span>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right">
                <span className="font-semibold">{money(total)} so'm</span>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />

        {!!overpaid.length && (
          <Alert
            type="error"
            showIcon
            className="mt-3"
            message="Qoldiqdan ortiq summa — to'lov bloklangan"
            description={
              <div className="text-sm">
                {overpaid.map((r) => (
                  <div key={r.seller_id}>
                    <span className="font-mono text-xs">{r.seller_id}</span>:{" "}
                    {money(r.amount)} &gt; {money(r.balance)}
                  </div>
                ))}
              </div>
            }
          />
        )}

        <div className="grid md:grid-cols-2 gap-x-4 mt-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">Usul</div>
            <Select
              className="w-full"
              value={method}
              onChange={(v) => setMethod(v)}
              options={MARKETPLACE_SETTLEMENT_METHODS.map((m) => ({
                value: m.value,
                label: m.label,
              }))}
            />
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">
              O'tkazma raqami / chek
            </div>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={120}
              placeholder="ixtiyoriy"
            />
          </div>
        </div>

        <div className="mt-3">
          <div className="text-sm text-gray-500 mb-1">Izoh</div>
          <Input.TextArea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="ixtiyoriy"
          />
        </div>
      </Modal>

      {/* ── Natija ── */}
      <Modal
        open={!!done}
        onCancel={() => setDone(null)}
        onOk={() => setDone(null)}
        okText="Yopish"
        cancelButtonProps={{ style: { display: "none" } }}
        title="To'lov bajarildi"
      >
        <Result
          status="success"
          title={`${money(done?.amount ?? 0)} so'm to'landi`}
          subTitle={`Marketplace kassasidagi yangi qoldiq: ${money(
            done?.balance_after ?? 0,
          )} so'm`}
        />
      </Modal>
    </div>
  );
};
