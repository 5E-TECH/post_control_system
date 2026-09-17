import { useEffect, useState } from "react";
import { Alert, Button, Card, Input, Spin, Table, Tag, message } from "antd";
import { Languages, RotateCcw } from "lucide-react";
import {
  useMarketplaceConfig,
  type MarketplaceStatusRow,
} from "../../../../shared/api/hooks/useMarketplaceConfig";

/** Backend xato kontrakti: `{message, error}` — ikkisi ham STRING. */
const errText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ?? fallback;

/**
 * Har kanonik status nimani anglatishi — operator uchun izoh.
 * Hamkor qaysi qiymatni qo'yishni shu tavsifga qarab tanlaydi.
 */
const MEANING: Record<string, string> = {
  CREATED: "Ular buyurtma yaratdi (bizga hali kelmagan)",
  READY_FOR_PICKUP: "Bizga topshirishga tayyor",
  ACCEPTED_BY_BEEPOST: "Biz qabul qildik (skanerlab olindi)",
  REJECTED_BY_BEEPOST: "Biz qabul qilmadik (buzilgan, bizniki emas...)",
  IN_TRANSIT: "Yo'lda — omborda yoki reysda",
  OUT_FOR_DELIVERY: "Kuryerda, mijozga ketyapti",
  DELIVERED: "Yetkazildi, pul olindi",
  PARTLY_DELIVERED: "Qisman yetkazildi (bir qismi qaytdi)",
  CANCELLED: "Bekor qilindi",
  RETURNING: "Qaytib kelmoqda",
  RETURNED: "Qaytarib berildi",
  VOIDED: "Ular bekor qilgan (biz qabul qilmaymiz)",
};

interface Props {
  slug?: string;
}

/**
 * HAMKORNING STATUS LUG'ATI — qo'lda sozlanadi.
 *
 * ⚠️ NEGA QO'LDA. Ularning tizimi allaqachon mavjud bo'lishi va butunlay
 * boshqa qiymatlar ishlatishi mumkin: raqam (`7`), so'z (`dostavleno`),
 * kod (`ST-07`). Koddan taxmin qilish — jimgina noto'g'ri status yuborish
 * yoki ular BEKOR QILGAN posilkani qabul qilib qo'yish demak.
 *
 * Xarita ikki yo'nalishda ishlaydi: chiquvchi hodisada ularning qiymati
 * ketadi, kiruvchi javob esa bizning kanonik nomga qaytariladi.
 */
export const MarketplaceStatusMapCard = ({ slug }: Props) => {
  const { statusMap, setStatusMap } = useMarketplaceConfig(slug);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const view = statusMap.data;

  useEffect(() => {
    if (!view) return;
    const next: Record<string, string> = {};
    for (const r of view.rows) next[r.canonical] = r.partner ?? "";
    setDraft(next);
  }, [view]);

  if (!slug) return null;
  if (statusMap.isLoading) {
    return (
      <Card title="Status lug'ati">
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      </Card>
    );
  }

  const dirty =
    !!view &&
    view.rows.some((r) => (draft[r.canonical] ?? "") !== (r.partner ?? ""));

  const save = async () => {
    try {
      const res = await setStatusMap.mutateAsync({
        slug,
        // Bo'sh qiymatlar serverda tashlanadi — «sozlanmagan» degani.
        status_map: draft,
      });
      message.success(`${res.configured} ta status sozlandi`);
    } catch (e) {
      message.error(errText(e, "Saqlab bo'lmadi"));
    }
  };

  const columns = [
    {
      title: "Bizning status",
      dataIndex: "canonical",
      render: (v: string) => (
        <div>
          <div className="font-mono text-xs">{v}</div>
          <div className="text-xs text-gray-400">{MEANING[v] ?? ""}</div>
        </div>
      ),
    },
    {
      title: "Ularning qiymati",
      dataIndex: "partner",
      width: 220,
      render: (_: unknown, r: MarketplaceStatusRow) => (
        <Input
          size="small"
          value={draft[r.canonical] ?? ""}
          placeholder="sozlanmagan"
          maxLength={64}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, [r.canonical]: e.target.value }))
          }
        />
      ),
    },
    {
      title: "Yuboriladi",
      dataIndex: "effective",
      width: 180,
      render: (_: unknown, r: MarketplaceStatusRow) => {
        const val = (draft[r.canonical] ?? "").trim() || r.canonical;
        const isDefault = !(draft[r.canonical] ?? "").trim();
        return (
          <Tag color={isDefault ? "default" : "blue"} className="font-mono">
            {val}
          </Tag>
        );
      },
    },
  ];

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <Languages className="w-4 h-4" /> Status lug'ati
        </span>
      }
      extra={
        <div className="flex gap-2">
          <Button
            size="small"
            icon={<RotateCcw className="w-4 h-4" />}
            disabled={!dirty}
            onClick={() => {
              const next: Record<string, string> = {};
              for (const r of view?.rows ?? []) next[r.canonical] = r.partner ?? "";
              setDraft(next);
            }}
          >
            Bekor qilish
          </Button>
          <Button
            type="primary"
            size="small"
            loading={setStatusMap.isPending}
            disabled={!dirty}
            onClick={save}
          >
            Saqlash
          </Button>
        </div>
      }
    >
      <Alert
        type="info"
        showIcon
        className="mb-3"
        message="Hamkorning statuslari qanday bo'lsa — shunday yozing"
        description="Raqam (7), so'z (dostavleno) yoki kod (ST-07) bo'lishi mumkin. Bo'sh qoldirilsa bizning nomimiz o'zgarishsiz yuboriladi. Bu xarita ikki tomonga ishlaydi: ularga yuborishda ham, ularning javobini o'qishda ham."
      />

      {!!view?.conflicts.length && (
        <Alert
          type="warning"
          showIcon
          className="mb-3"
          message="Bir qiymat bir nechta statusga berilgan"
          description={
            <div className="text-sm">
              {view.conflicts.map((c) => (
                <div key={c.value}>
                  <span className="font-mono">{c.value}</span> ←{" "}
                  {c.statuses.join(", ")}
                </div>
              ))}
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Ularning javobini o'qiganda qaysi biri ekanini aniqlab
                bo'lmaydi — bizga yuboriladigan tomoni baribir to'g'ri ishlaydi.
              </div>
            </div>
          }
        />
      )}

      <Table<MarketplaceStatusRow>
        size="small"
        rowKey="canonical"
        pagination={false}
        dataSource={view?.rows ?? []}
        columns={columns}
      />
    </Card>
  );
};
