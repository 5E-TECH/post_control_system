import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Modal,
  Popconfirm,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import { CheckCheck, RefreshCcwDot, ShieldAlert } from "lucide-react";
import {
  useMarketplacePanel,
  type MarketplaceMismatchRow,
  type MarketplaceReconcileResult,
} from "../../../../shared/api/hooks/useMarketplacePanel";

const money = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString("ru-RU") : "—";

const when = (ts: number | null | undefined) =>
  ts ? new Date(Number(ts)).toLocaleString("ru-RU") : "—";

/** Backend xato kontrakti: `{message, error}` — ikkisi ham STRING. */
const errText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ?? fallback;

interface Props {
  slug?: string;
}

/**
 * SOLISHTIRUV PANELI.
 *
 * CRON har 15 daqiqada posilkalarni, kuniga bir marta daftarni tekshiradi.
 * Bu ekran uning natijasini ko'rsatadi va qo'lda ishga tushirish imkonini
 * beradi.
 *
 * ⚠️ «Hal qilindi» tugmasi HECH NARSANI TUZATMAYDI — u faqat belgini
 * olib tashlaydi. Sabab bartaraf etilmagan bo'lsa, keyingi solishtiruv
 * belgini qaytadan qo'yadi. Bu ataylab: avtomatik «tuzatish» xatoni
 * yashirib, yo'qolgan pulni abadiy ko'rinmas qilardi.
 */
export const MarketplaceReconcileTab = ({ slug }: Props) => {
  const { mismatches, clearMismatch, runReconcile } = useMarketplacePanel(slug);
  const [result, setResult] = useState<MarketplaceReconcileResult | null>(null);

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

  if (mismatches.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  const rows = mismatches.data ?? [];

  const columns = [
    {
      title: "Posilka",
      dataIndex: "external_parcel_id",
      render: (v: string, r: MarketplaceMismatchRow) => (
        <div>
          <div className="font-mono text-xs">{v}</div>
          <div className="font-mono text-xs text-gray-400">
            {r.external_order_id}
          </div>
        </div>
      ),
    },
    // ⚠️ Sotuvchi ustuni YO'Q: ular faqat ID yuborishi mumkin va u
    // admin uchun ma'nosiz. Muammoni posilka ID si bo'yicha hal qiladi.
    {
      title: "Bizda",
      dataIndex: "scan_state",
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "Ularda",
      dataIndex: "remote_status",
      render: (v: string | null) =>
        v ? <Tag color="blue">{v}</Tag> : <Tag color="red">javob yo'q</Tag>,
    },
    {
      title: "Summa",
      dataIndex: "cod_amount",
      align: "right" as const,
      render: (v: number) => `${money(Number(v))} so'm`,
    },
    {
      title: "Sabab",
      dataIndex: "mismatch_reason",
      render: (v: string | null, r: MarketplaceMismatchRow) => (
        <div>
          <div className="text-sm whitespace-normal">{v ?? "—"}</div>
          <div className="text-xs text-gray-400">{when(r.mismatch_at)}</div>
        </div>
      ),
    },
    {
      title: "",
      key: "actions",
      render: (_: unknown, r: MarketplaceMismatchRow) => (
        <Popconfirm
          title="Nomuvofiqlik hal qilindi"
          description="Belgi olib tashlanadi. Sabab bartaraf etilmagan bo'lsa, keyingi solishtiruv uni qaytadan qo'yadi."
          okText="Hal qilindi"
          cancelText="Bekor"
          onConfirm={async () => {
            try {
              await clearMismatch.mutateAsync(r.id);
              message.success("Belgi olib tashlandi");
            } catch (e) {
              message.error(errText(e, "Bajarib bo'lmadi"));
            }
          }}
        >
          <Button size="small" icon={<CheckCheck className="w-4 h-4" />}>
            Hal qilindi
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Nomuvofiqliklar
          </span>
        }
        extra={
          <Tooltip title="CRON har 15 daqiqada o'zi ishlaydi — bu tugma uni darhol chaqiradi">
            <Button
              icon={<RefreshCcwDot className="w-4 h-4" />}
              loading={runReconcile.isPending}
              onClick={async () => {
                try {
                  setResult(await runReconcile.mutateAsync(slug));
                } catch (e) {
                  message.error(errText(e, "Solishtiruv bajarilmadi"));
                }
              }}
            >
              Hozir solishtirish
            </Button>
          </Tooltip>
        }
      >
        {rows.length === 0 ? (
          <Alert
            type="success"
            showIcon
            message="Nomuvofiqlik yo'q"
            description="Ikkala tomondagi statuslar va ketma-ketlik mos."
          />
        ) : (
          <>
            <Alert
              type="warning"
              showIcon
              className="mb-3"
              message={`${rows.length} ta posilkada nomuvofiqlik`}
              description="Yo'qolgan hodisalar avtomatik qayta navbatga qo'yilgan. Agar belgi bir necha solishtiruvdan keyin ham qolsa — sabab boshqa, qo'lda tekshiring."
            />
            <Table<MarketplaceMismatchRow>
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={rows}
              columns={columns}
            />
          </>
        )}
      </Card>

      {/* ── Qo'lda solishtiruv natijasi ── */}
      <Modal
        open={!!result}
        onCancel={() => setResult(null)}
        onOk={() => setResult(null)}
        okText="Yopish"
        cancelButtonProps={{ style: { display: "none" } }}
        title="Solishtiruv natijasi"
        width={560}
      >
        <div className="flex items-center gap-8 flex-wrap mb-4">
          <Statistic
            title="Tekshirilgan"
            value={result?.parcels.checked ?? 0}
          />
          <Statistic
            title="Nomuvofiqlik"
            value={result?.parcels.mismatches ?? 0}
          />
          <Statistic
            title="Qayta navbatga"
            value={result?.parcels.requeued ?? 0}
          />
        </div>

        {result?.ledger.invariant.ok ? (
          <Alert
            type="success"
            showIcon
            message="Daftar kassa bilan teng"
            description={`${money(result.ledger.invariant.cashbox_balance)} so'm`}
          />
        ) : (
          <Alert
            type="error"
            showIcon
            message="ICHKI INVARIANT BUZILGAN"
            description={
              <div className="text-sm">
                <div>
                  Kassa: {money(result?.ledger.invariant.cashbox_balance)} so'm
                </div>
                <div>Daftar: {money(result?.ledger.invariant.ledger_sum)} so'm</div>
                <div className="font-semibold">
                  Farq: {money(result?.ledger.invariant.diff)} so'm
                </div>
              </div>
            }
          />
        )}

        {result?.ledger.remote_balance !== null &&
          result?.ledger.remote_balance !== undefined && (
            <Alert
              type={result.ledger.diff === 0 ? "success" : "warning"}
              showIcon
              className="mt-3"
              message={
                result.ledger.diff === 0
                  ? "Marketplace balansi ham teng"
                  : "Marketplace balansi farq qiladi"
              }
              description={
                <div className="text-sm">
                  <div>Ularda: {money(result.ledger.remote_balance)} so'm</div>
                  <div>Farq: {money(result.ledger.diff)} so'm</div>
                </div>
              }
            />
          )}

        {result?.ledger.remote_balance === null && (
          <Alert
            type="info"
            showIcon
            className="mt-3"
            message="Marketplace balansi olinmadi"
            description="Ularning tomoni javob bermadi — ichki invariant baribir tekshirildi."
          />
        )}
      </Modal>
    </div>
  );
};
