import { useEffect, useState } from "react";
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
  message,
} from "antd";
import { AlertTriangle, Banknote, RefreshCcwDot, Scale } from "lucide-react";
import {
  MARKETPLACE_SETTLEMENT_METHODS,
  useMarketplacePanel,
  type MarketplaceSettlementMethod,
} from "../../../../shared/api/hooks/useMarketplacePanel";

const money = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString("ru-RU") : "—";

/** Backend xato kontrakti: `{message, error}` — ikkisi ham STRING. */
const errText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ?? fallback;

interface Props {
  slug?: string;
}

/**
 * MARKETPLACE HISOB-KITOBI — YAXLIT TO'LOV.
 *
 * ⚠️ SOTUVCHILAR BU YERDA KO'RSATILMAYDI.
 *
 * Biz marketplace'ning sotuvchilarini bilmaymiz va ular bizga faqat ID
 * yuborishi mumkin (`SLR-77`). Bunday qatorni adminga ko'rsatish foydasiz
 * shovqin: u ID kimligini bilmaydi va unga qarab hech qanday qaror qabul
 * qila olmaydi. Marketplace pulni oladi va o'z sotuvchilariga O'ZI
 * tarqatadi — kim qancha ishlab topgani ularga har posilka hodisasidagi
 * `seller_id` orqali allaqachon ma'lum.
 *
 * Adminga YAGONA son kerak: ularga qancha qarzdormiz.
 */
export const MarketplaceSettlementTab = ({ slug }: Props) => {
  const { suggest, pay } = useMarketplacePanel(slug);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] =
    useState<MarketplaceSettlementMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<{
    amount: number;
    balance_after: number;
  } | null>(null);

  const data = suggest.data;

  // Oyna ochilganda to'liq qarz bilan to'ldiramiz — odatiy holat.
  useEffect(() => {
    if (open && data) setAmount(data.total_payable);
  }, [open, data]);

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

  const payable = data?.total_payable ?? 0;
  const overpay = amount > payable;

  const submit = async () => {
    if (!slug) return;
    try {
      const res = await pay.mutateAsync({
        slug,
        amount,
        method,
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
                ⚠️ Bu ishni TO'XTATMAYDI — skan, sotuv va to'lov ishlayveradi.
                Lekin farq «kassa qimirladi-yu, marketplace'ga aytilmadi»
                degani bo'lishi mumkin. Sababini aniqlash kerak.
              </div>
            </div>
          }
        />
      )}

      <Card
        title={
          <span className="flex items-center gap-2">
            <Scale className="w-4 h-4" /> Hisob-kitob
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
              disabled={payable <= 0}
              onClick={() => setOpen(true)}
            >
              To'lov qilish
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-10 flex-wrap">
          <Statistic
            title="Marketplace'ga qarzimiz"
            value={payable}
            suffix="so'm"
          />
          <Statistic
            title="Market kassasi balansi"
            value={data?.invariant.cashbox_balance ?? 0}
            suffix="so'm"
          />
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          Qarz market kassasidan olinadi — sotuvda oshadi, to'laganda kamayadi.
          Marketplace pulni o'z sotuvchilariga <b>o'zi tarqatadi</b>: kim qancha
          ishlab topgani unga har posilka hodisasi bilan yuborilgan.
        </div>
      </Card>

      {/* ── To'lov oynasi ── */}
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={submit}
        okText={`${money(amount)} so'm to'lash`}
        cancelText="Bekor qilish"
        confirmLoading={pay.isPending}
        okButtonProps={{ disabled: amount <= 0 || overpay }}
        title="Marketplace bilan hisob-kitob"
      >
        <div className="space-y-3">
          <div>
            <div className="text-sm text-gray-500 mb-1">Summa</div>
            <InputNumber
              className="w-full"
              size="large"
              min={0}
              max={payable}
              step={1000}
              value={amount}
              addonAfter="so'm"
              onChange={(v) => setAmount(Math.max(0, Math.trunc(Number(v) || 0)))}
            />
            <div className="mt-1 text-xs text-gray-400">
              Joriy qarz: {money(payable)} so'm. Kamroq to'lasangiz qoldig'i
              keyingi hisob-kitobga o'tadi.
            </div>
          </div>

          {overpay && (
            <Alert
              type="error"
              showIcon
              message="Qarzdan ortiq summa — to'lov bloklangan"
              description={`Qarz ${money(payable)} so'm. Ortiqcha to'lov market kassasini manfiyga tushirib, keyingi hisob-kitobni chalkashtiradi.`}
            />
          )}

          <div className="grid md:grid-cols-2 gap-x-4">
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

          <div>
            <div className="text-sm text-gray-500 mb-1">Izoh</div>
            <Input.TextArea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="ixtiyoriy"
            />
          </div>
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
