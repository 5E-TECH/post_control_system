import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  PlugZap,
  Plus,
  RefreshCcwDot,
  Scale,
  Users,
  XCircle,
} from "lucide-react";
import {
  MARKETPLACE_CHECKLIST_LABELS,
  useMarketplaceConfig,
  type MarketplaceChecklist,
  type MarketplaceTariffRow,
} from "../../../../shared/api/hooks/useMarketplaceConfig";
import { MarketplaceCreateModal } from "./MarketplaceCreateModal";
import { MarketplaceStatusMapCard } from "./MarketplaceStatusMapCard";

const money = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString("ru-RU") : "—";

const when = (ts: number | null | undefined) =>
  ts ? new Date(Number(ts)).toLocaleString("ru-RU") : "hech qachon";

/** Backend xato kontrakti: `{message, error}` — ikkisi ham STRING. */
const errText = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ?? fallback;

/**
 * Sekret bir marta ko'rsatiladigan oyna.
 *
 * ⚠️ Bu qiymat BOSHQA HECH QAYERDA olinmaydi — bazada shifrlangan, ro'yxatda
 * faqat maska. Oyna yopilgach yo'qoladi, shuning uchun nusxalash tugmasi
 * va ogohlantirish shart.
 */
const SecretOnceModal = ({
  secret,
  warning,
  onClose,
}: {
  secret: string | null;
  warning: string;
  onClose: () => void;
}) => (
  <Modal
    open={!!secret}
    onCancel={onClose}
    onOk={onClose}
    okText="Nusxaladim, yopish"
    cancelButtonProps={{ style: { display: "none" } }}
    closable={false}
    maskClosable={false}
    title="Yangi sekret — faqat shu yerda"
  >
    <Alert type="warning" showIcon className="mb-3" message={warning} />
    <div className="flex gap-2">
      <Input.TextArea
        value={secret ?? ""}
        readOnly
        autoSize
        className="font-mono text-xs"
      />
      <Button
        icon={<Copy className="w-4 h-4" />}
        onClick={() => {
          navigator.clipboard?.writeText(secret ?? "");
          message.success("Nusxalandi");
        }}
      />
    </div>
  </Modal>
);

/**
 * Har bir sozlash bandi QAYERDAN tuzatilishi.
 *
 * ⚠️ Busiz ro'yxat faqat «nima yetishmayapti» deydi, «qayerga borish
 * kerak»ni esa admin o'zi topishi kerak edi. Ayniqsa `encryption` bandi
 * chalg'itardi: u UI'dan umuman sozlanmaydi — bu serverdagi `.env`.
 */
const CHECKLIST_HINTS: Record<keyof MarketplaceChecklist, string> = {
  api_base_url: "«Ulanish sozlamalari» kartasi → API manzili",
  api_key: "«Kalitlar va sekretlar» kartasi → Ularning API kaliti",
  signing_secret:
    "«Kalitlar va sekretlar» kartasi → Imzo sekreti → «Kalit yaratish» (faqat superadmin)",
  inbound_api_key:
    "«Kalitlar va sekretlar» kartasi → Kiruvchi kalit → «Kalit yaratish» (faqat superadmin)",
  tariff: "Shu sahifaning pastidagi «Tarif» kartasi",
  market: "Ulanish yaratilganda tanlanadi — keyin o'zgartirilmaydi",
  encryption:
    "UI'dan sozlanmaydi. Serverdagi .env faylida SECRET_ENC_KEY (kamida 16 belgi) + server restart.",
};

const ChecklistRow = ({
  ok,
  label,
  hint,
}: {
  ok: boolean;
  label: string;
  hint?: string;
}) => (
  <Tooltip title={ok ? undefined : hint}>
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
      )}
      <span className={ok ? "text-gray-500" : "font-medium"}>{label}</span>
    </div>
  </Tooltip>
);

interface Props {
  /** Tanlangan ulanish — tanlov `MarketplaceRoot` da, barcha tablar uchun bitta. */
  slug?: string;
  onCreated: (slug: string) => void;
}

export const MarketplaceSettingsTab = ({ slug, onCreated }: Props) => {
  /**
   * ⚠️ Sekret aylantirish endpointlari FAQAT superadmin uchun
   * (`@AcceptRoles(Roles.SUPERADMIN)`). Tugma har adminga ko'rinsa,
   * u bosib 403 oladi va nima uchun ekanini tushunmaydi — ayni paytda
   * integratsiya to'xtab qolgandek tuyuladi.
   */
  const role =
    useSelector((st: RootState) => st.roleSlice.role) ||
    localStorage.getItem("role") ||
    "";
  const canRotate = role === "superadmin";

  const [createOpen, setCreateOpen] = useState(false);
  const [oneTime, setOneTime] = useState<{
    secret: string;
    warning: string;
  } | null>(null);

  const {
    detail,
    tariffHistory,
    update,
    setActive,
    testConnection,
    testSignature,
    syncSellers,
    setTariff,
    rotateSigning,
    clearPreviousSigning,
    rotateInbound,
  } = useMarketplaceConfig(slug);

  const [connForm] = Form.useForm();
  /**
   * ⚠️ SEKRET UCHUN ALOHIDA FORMA.
   *
   * Avval `api_key` ulanish formasining ichida, «Ulanish sozlamalari»
   * (hamyon ikonkasi) kartasida turardi. Admin esa kalit qidirganda
   * tabiiy ravishda «Kalitlar» (kalit ikonkasi) kartasiga borardi — u
   * yerda esa birorta kiritish maydoni yo'q edi, faqat tugmalar. Natijada
   * «UI'da sekret kiritadigan joy umuman yo'q» degan xulosa chiqardi.
   *
   * Endi maydon o'z kartasida, o'z saqlash tugmasi bilan. Ulanish
   * formasiga tegmaydi: nom/manzil o'zgartirib saqlaganda sekret
   * so'rovga umuman qo'shilmaydi.
   */
  const [secretForm] = Form.useForm();
  const [tariffForm] = Form.useForm();
  const cfg = detail.data;

  useEffect(() => {
    if (!cfg) return;
    connForm.setFieldsValue({
      name: cfg.name,
      api_base_url: cfg.api_base_url ?? undefined,
      request_timeout_ms: cfg.request_timeout_ms,
      settlement_period_days: cfg.settlement_period_days,
    });
  }, [cfg, connForm]);

  /**
   * Sekret maydoni BOSHQA ULANISHGA o'tilgandagina tozalanadi.
   *
   * ⚠️ Bog'liqlik `cfg` EMAS, `slug`. `cfg` ga bog'lansa, admin kalitni
   * yozayotganda har qanday `detail` yangilanishi (Saqlash, master
   * toggle, «Yangilash» tugmasi) yozilgan kalitni JIMGINA o'chirib
   * yuborardi — ekranda esa yashil «Saqlandi» turardi.
   *
   * Sekret hech qachon oldindan to'ldirilmaydi: server uni qaytarmaydi.
   */
  useEffect(() => {
    secretForm.setFieldsValue({ api_key: undefined });
  }, [slug, secretForm]);

  if (!slug) {
    return (
      <>
        <Card>
          <Empty
            description="Marketplace ulanishi hali yaratilmagan"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setCreateOpen(true)}
            >
              Ulanish yaratish
            </Button>
          </Empty>
        </Card>
        <MarketplaceCreateModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(s) => {
            setCreateOpen(false);
            onCreated(s);
          }}
        />
      </>
    );
  }

  const missing = cfg
    ? (Object.keys(cfg.checklist) as Array<keyof MarketplaceChecklist>).filter(
        (k) => !cfg.checklist[k],
      )
    : [];

  /**
   * ⚠️ `validateFields()` ATAYLAB `try` ICHIDA. Tashqarida qolsa, forma
   * noto'g'ri to'ldirilganda rad etilgan promise ushlanmasdan ketardi va
   * ekranda hech narsa ko'rinmasdi.
   */
  const saveConnection = async () => {
    try {
      const values = await connForm.validateFields();
      // ⚠️ Sekret bu formada YO'Q — u `saveApiKey` orqali alohida yuboriladi.
      await update.mutateAsync({ slug: slug as string, data: values });
      message.success("Saqlandi");
    } catch (e) {
      if ((e as { errorFields?: unknown[] })?.errorFields) return; // forma validatsiyasi
      message.error(errText(e, "Saqlab bo'lmadi"));
    }
  };

  /**
   * HAMKORNING API KALITINI SAQLASH.
   *
   * ⚠️ Bo'sh maydon YUBORILMAYDI. Aks holda «o'zgartirmadim» degani
   * «kalitni o'chir» ga aylanib, mavjud kalit jimgina yo'qolardi —
   * ulanish esa YOQIQ qolgani uchun nosozlik faqat birinchi haqiqiy
   * so'rovda bilinardi.
   */
  const saveApiKey = async () => {
    const values = await secretForm.getFieldsValue();
    const key = String(values.api_key ?? "").trim();
    if (!key) {
      message.warning("Kalit kiritilmadi");
      return;
    }
    try {
      await update.mutateAsync({ slug: slug as string, data: { api_key: key } });
      secretForm.setFieldsValue({ api_key: undefined });
      message.success("API kaliti saqlandi");
    } catch (e) {
      message.error(errText(e, "Kalitni saqlab bo'lmadi"));
    }
  };

  /**
   * ⚠️ IKKI XIL XATO, IKKI XIL ISHLOV.
   *
   *   · «ulanmadi» — servis `{ok:false, kind, message}` qaytaradi, HTTP 200.
   *     Bu PARTLAMAYDI, shuning uchun natijaning o'zi tekshiriladi.
   *   · HTTP xatosi (404/500/tarmoq) — `mutateAsync` THROW qiladi.
   *     Avval bu ushlanmasdi: tugma bosilar, hech narsa chiqmas edi va
   *     admin «tugma ishlamayapti» deb o'ylardi.
   */
  const doTest = async () => {
    let res: Awaited<ReturnType<typeof testConnection.mutateAsync>>;
    try {
      res = await testConnection.mutateAsync(slug as string);
    } catch (e) {
      message.error(errText(e, "Ulanishni tekshirib bo'lmadi"));
      return;
    }
    if (res.ok) {
      message.success(
        `Ulanish bor — ${res.latency_ms ?? "?"} ms${
          res.version ? `, versiya ${res.version}` : ""
        }`,
      );
    } else {
      message.error(`Ulanmadi (${res.kind ?? "noma'lum"}): ${res.message ?? ""}`);
    }
  };

  /**
   * ⚠️ «Ulanish» (ping) IMZONI SINAMAYDI — kontrakt bo'yicha ping
   * ataylab imzolanmaydi. Imzo sekreti noto'g'ri bo'lsa xato faqat
   * birinchi HAQIQIY sotuvdan keyin chiqardi va pul hodisasi
   * navbatda qotib qolardi.
   */
  const doSignatureTest = async () => {
    let res: Awaited<ReturnType<typeof testSignature.mutateAsync>>;
    try {
      res = await testSignature.mutateAsync(slug as string);
    } catch (e) {
      message.error(errText(e, "Imzo sinovini bajarib bo'lmadi"));
      return;
    }
    if (res.ok) {
      message.success(
        `Imzo qabul qilindi${res.applied === false ? " (hodisa qo'llanmadi — bu normal)" : ''}`,
      );
    } else {
      message.error(
        `Imzo sinovi yiqildi (${res.kind ?? '?'}): ${res.message ?? ''}`,
      );
    }
  };

  /**
   * ⚠️ Nega tugma: avtomatik sinxron kechasi 04:00 da ishlaydi. Bugun
   * sozlangan integratsiyada ertaga tonggacha har skanda «Sotuvchi
   * reestrda yo'q» ogohlantirishi chiqib turardi — sotuvchi ularda bor,
   * bizda hali yo'q edi.
   */
  const doSyncSellers = async () => {
    try {
      const res = await syncSellers.mutateAsync(slug as string);
      message.success(`${res.synced} ta sotuvchi sinxronlandi`);
    } catch (e) {
      message.error(errText(e, "Sotuvchilarni sinxronlab bo'lmadi"));
    }
  };

  /**
   * ── KALIT AYLANTIRISH ──────────────────────────────────────────────
   *
   * ⚠️ NEGA ALOHIDA FUNKSIYA, INLINE `onConfirm` EMAS.
   *
   * Avval bu uchala amal Popconfirm ichida inline `async` funksiya edi va
   * `try/catch` yo'q edi. antd Popconfirm `onConfirm` dan qaytgan RAD
   * ETILGAN promise'ni jimgina yutadi — ya'ni 403 (admin rolida), 404
   * yoki 500 bo'lsa ekranda MUTLAQO hech narsa ko'rinmasdi.
   *
   * Eng xavfli tomoni: `rotateInbound` serverda kalitni ALMASHTIRIB
   * bo'lgan, javob esa yo'lda yiqilgan bo'lishi ham mumkin. U holda
   * hamkorning eski kaliti ishlamay qoladi, admin esa buni bilmaydi.
   * Shuning uchun xato matni endi aniq ogohlantirish bilan chiqadi.
   */
  const doRotateSigning = async () => {
    try {
      const res = await rotateSigning.mutateAsync(slug as string);
      setOneTime({
        secret: res.signing_secret as string,
        warning: res.warning,
      });
    } catch (e) {
      message.error(errText(e, "Imzo sekretini aylantirib bo'lmadi"));
    }
  };

  const doClearPrevious = async () => {
    try {
      await clearPreviousSigning.mutateAsync(slug as string);
      message.success("Eski sekret tozalandi");
    } catch (e) {
      message.error(errText(e, "Eski sekretni tozalab bo'lmadi"));
    }
  };

  const doRotateInbound = async () => {
    try {
      const res = await rotateInbound.mutateAsync(slug as string);
      setOneTime({
        secret: res.inbound_api_key as string,
        warning: res.warning,
      });
    } catch (e) {
      message.error(
        `${errText(e, "Kiruvchi kalitni aylantirib bo'lmadi")} — kalit serverda ` +
          "almashgan bo'lishi mumkin, «Yangilash» bilan holatni tekshiring.",
      );
    }
  };

  const toggleActive = async (next: boolean) => {
    try {
      await setActive.mutateAsync({ slug: slug as string, is_active: next });
      message.success(next ? "Yoqildi" : "O'chirildi");
    } catch (e) {
      message.error(errText(e, "Bajarib bo'lmadi"));
    }
  };

  const applyTariff = async () => {
    const values = await tariffForm.validateFields();
    try {
      const res = await setTariff.mutateAsync({
        slug: slug as string,
        ...values,
      });
      message.success(`Tarif v${res?.version ?? "?"} qo'llandi`);
      tariffForm.resetFields();
    } catch (e) {
      message.error(errText(e, "Tarifni o'zgartirib bo'lmadi"));
    }
  };

  const tariffColumns = [
    {
      title: "Versiya",
      dataIndex: "version",
      render: (v: number, r: MarketplaceTariffRow) => (
        <span className="font-mono text-xs">
          v{v} {r.effective_to === null && <Tag color="green">joriy</Tag>}
        </span>
      ),
    },
    {
      title: "Markaz",
      dataIndex: "tariff_center",
      render: (v: number) => `${money(v)} so'm`,
    },
    {
      title: "Uy",
      dataIndex: "tariff_home",
      render: (v: number) => `${money(v)} so'm`,
    },
    {
      title: "Amal qilgan",
      dataIndex: "effective_from",
      render: (v: number, r: MarketplaceTariffRow) => (
        <span className="text-xs text-gray-500">
          {when(v)} → {r.effective_to ? when(r.effective_to) : "hozirgacha"}
        </span>
      ),
    },
    {
      title: "Izoh",
      dataIndex: "note",
      render: (v: string | null) => (
        <span className="text-xs text-gray-400">{v ?? "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateOpen(true)}
        >
          Yangi ulanish
        </Button>
        <Button
          icon={<RefreshCcwDot className="w-4 h-4" />}
          loading={detail.isFetching}
          onClick={() => detail.refetch()}
        >
          Yangilash
        </Button>
      </div>

      {/*
        ⚠️ UCH HOLAT, IKKITA EMAS.

        Avval shart `detail.isLoading || !cfg` edi. React Query v5 da xatodan
        keyin `isLoading` false, `data` esa undefined bo'ladi — ya'ni `!cfg`
        tufayli shart BARIBIR true qolib, spinner MANGU aylanardi. Sekret
        kiritish maydoni ham, «Kalitlar» kartasi ham shu shartning `else`
        shoxida bo'lgani uchun ular ekranda umuman paydo bo'lmasdi va hech
        qanday xato xabari ham chiqmasdi.
      */}
      {detail.isError ? (
        <Alert
          type="error"
          showIcon
          message="Ulanish ma'lumotini olib bo'lmadi"
          description={
            <div className="space-y-2">
              <div>{errText(detail.error, "Server javob bermadi.")}</div>
              <div className="text-xs text-gray-500">
                Sozlash formasi shu sabab ko'rinmayapti. Tez-tez uchraydigan
                sabab: serverda `SECRET_ENC_KEY` o'rnatilmagan yoki almashgan —
                u holda sekretlar deshifrlanmaydi va so'rov 500 qaytaradi.
              </div>
              <Button
                size="small"
                icon={<RefreshCcwDot className="w-4 h-4" />}
                loading={detail.isFetching}
                onClick={() => detail.refetch()}
              >
                Qayta urinish
              </Button>
            </div>
          }
        />
      ) : detail.isLoading || !cfg ? (
        <div className="flex justify-center py-16">
          <Spin />
        </div>
      ) : (
        <>
          {/* ── Tayyorlik + master kalit ── */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <PlugZap className="w-4 h-4" /> Holat
              </span>
            }
            extra={
              <Tooltip
                title={
                  cfg.ready
                    ? "Master kalit — o'chirilsa skan ham, hodisa navbati ham to'xtaydi"
                    : `Sozlash tugallanmagan: ${missing
                        .map((k) => MARKETPLACE_CHECKLIST_LABELS[k])
                        .join(", ")}`
                }
              >
                <span className="flex items-center gap-2">
                  <Switch
                    checked={cfg.is_active}
                    loading={setActive.isPending}
                    disabled={!cfg.ready && !cfg.is_active}
                    onChange={toggleActive}
                  />
                  <span className="text-sm">
                    {cfg.is_active ? "Yoqilgan" : "O'chirilgan"}
                  </span>
                </span>
              </Tooltip>
            }
          >
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                {(
                  Object.keys(cfg.checklist) as Array<keyof MarketplaceChecklist>
                ).map((k) => (
                  <ChecklistRow
                    key={k}
                    ok={cfg.checklist[k]}
                    label={MARKETPLACE_CHECKLIST_LABELS[k]}
                    hint={CHECKLIST_HINTS[k]}
                  />
                ))}
              </div>

              <div className="text-sm space-y-1">
                {/*
                  ⚠️ BIRIKTIRILGAN MARKET — eng muhim bog'lanish: marketplace
                  puli AYNAN shu marketning kassasida yuradi (sotuvda oshadi,
                  to'laganda kamayadi).
                */}
                <div className="text-gray-500">
                  Market:{" "}
                  {cfg.market ? (
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      {cfg.market.name}
                    </span>
                  ) : (
                    <Tag color="red">biriktirilmagan</Tag>
                  )}
                </div>
                {cfg.market?.cashbox_balance != null && (
                  <div className="text-gray-500">
                    Kassasi:{" "}
                    <span className="font-medium">
                      {money(cfg.market.cashbox_balance)} so'm
                    </span>
                  </div>
                )}
                <div className="text-gray-500">
                  Slug: <span className="font-mono text-xs">{cfg.slug}</span>
                </div>
                <div className="text-gray-500">
                  Rejim:{" "}
                  {cfg.is_sandbox ? (
                    <Tag color="orange">sinov</Tag>
                  ) : (
                    <Tag color="blue">jangovar</Tag>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  Oxirgi ping: {when(cfg.last_ping_at)}
                </div>
                <div className="text-xs text-gray-400">
                  Oxirgi solishtiruv: {when(cfg.last_reconcile_at)}
                </div>
                <div className="text-xs text-gray-400">
                  Oxirgi hisob-kitob: {when(cfg.last_settlement_at)}
                </div>
              </div>

              <div>
                {cfg.tariff ? (
                  <div className="text-sm space-y-1">
                    <div className="font-semibold">
                      Joriy tarif (v{cfg.tariff.version})
                    </div>
                    <div>Markazgacha: {money(cfg.tariff.tariff_center)} so'm</div>
                    <div>Uygacha: {money(cfg.tariff.tariff_home)} so'm</div>
                  </div>
                ) : (
                  <Alert type="error" showIcon message="Tarif kiritilmagan" />
                )}
              </div>
            </div>

            {!cfg.ready && (
              <Alert
                type="warning"
                showIcon
                className="mt-3"
                message="Ulanishni yoqib bo'lmaydi"
                description={`Yetishmayotgani: ${missing
                  .map((k) => MARKETPLACE_CHECKLIST_LABELS[k])
                  .join(", ")}. Yarim sozlangan ulanish birinchi skanda yiqiladi.`}
              />
            )}
          </Card>

          {/* ── Daftar invarianti ── */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <Scale className="w-4 h-4" /> Kassa va daftar
              </span>
            }
          >
            {cfg.invariant.ok ? (
              <Alert
                type="success"
                showIcon
                message="Daftar kassa bilan teng"
                description={`${money(cfg.invariant.cashbox_balance)} so'm — har-sotuvchi yozuvlari yig'indisi kassa balansiga mos.`}
              />
            ) : (
              <Alert
                type="error"
                showIcon
                icon={<AlertTriangle className="w-4 h-4" />}
                message="INVARIANT BUZILGAN — avtomatik tuzatilmaydi"
                description={
                  <div className="text-sm">
                    <div>Kassa: {money(cfg.invariant.cashbox_balance)} so'm</div>
                    <div>Daftar: {money(cfg.invariant.ledger_sum)} so'm</div>
                    <div className="font-semibold">
                      Farq: {money(cfg.invariant.diff)} so'm
                    </div>
                    <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Qaysi tomoni to'g'ri ekanini faqat odam aniqlay oladi.
                      Avtomatik "tuzatish" xatoni yashirib, yo'qolgan pulni
                      abadiy ko'rinmas qilardi.
                    </div>
                  </div>
                }
              />
            )}
          </Card>

          {/* ── Ulanish ── */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <Link2 className="w-4 h-4" /> Ulanish sozlamalari
              </span>
            }
            extra={
              <div className="flex gap-2">
                <Button
                  icon={<PlugZap className="w-4 h-4" />}
                  loading={testConnection.isPending}
                  onClick={doTest}
                >
                  Ulanish
                </Button>
                {/*
                  ⚠️ ALOHIDA tugma: «Ulanish» (ping) imzoni SINAMAYDI —
                  kontrakt §4.1 bo'yicha ping ataylab imzolanmaydi.
                  Imzo xato bo'lsa buni faqat birinchi sotuvda bilardik.
                */}
                <Button
                  icon={<KeyRound className="w-4 h-4" />}
                  loading={testSignature.isPending}
                  onClick={doSignatureTest}
                >
                  Imzo
                </Button>
                {/*
                  ⚠️ Sotuvchi reestri kechasi 04:00 da sinxronlanadi —
                  bu tugmasiz yangi ulanishda ertaga tonggacha har skanda
                  «Sotuvchi reestrda yo'q» ogohlantirishi chiqardi.
                */}
                <Tooltip title="Ularning sotuvchi reestrini hoziroq ko'chirib oladi. Busiz reestr kechasi 04:00 da yangilanadi va yangi ulanishda skanlarda «Sotuvchi reestrda yo'q» ogohlantirishi chiqadi.">
                  <Button
                    icon={<Users className="w-4 h-4" />}
                    loading={syncSellers.isPending}
                    onClick={doSyncSellers}
                  >
                    Sotuvchilar
                  </Button>
                </Tooltip>
              </div>
            }
          >
            <Form form={connForm} layout="vertical" requiredMark={false}>
              <div className="grid md:grid-cols-2 gap-x-4">
                <Form.Item name="name" label="Nomi">
                  <Input maxLength={120} />
                </Form.Item>

                <Form.Item
                  name="api_base_url"
                  label="API manzili"
                  extra="HTTPS bo'lishi shart; ichki manzillar rad etiladi."
                >
                  <Input placeholder="https://api.uzmarket.uz" maxLength={300} />
                </Form.Item>

                {/*
                  ⚠️ `api_key` BU YERDAN OLIB TASHLANDI — u endi pastdagi
                  «Kalitlar va sekretlar» kartasida, boshqa uch sekret bilan
                  yonma-yon. Sabab: admin kalitni kalit ikonkasidagi kartadan
                  qidiradi, hamyon ikonkasidagidan emas.
                */}

                <Form.Item name="request_timeout_ms" label="So'rov timeouti (ms)">
                  <InputNumber className="w-full" min={1000} max={60000} step={500} />
                </Form.Item>

                <Form.Item
                  name="settlement_period_days"
                  label="Hisob-kitob davri (kun)"
                >
                  <InputNumber className="w-full" min={1} max={90} />
                </Form.Item>
              </div>

              <Button
                type="primary"
                loading={update.isPending}
                onClick={saveConnection}
              >
                Saqlash
              </Button>
            </Form>
          </Card>

          {/* ── Sekretlar ── */}
          <Card
            title={
              <span className="flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> Kalitlar va sekretlar
              </span>
            }
          >
            <Alert
              type="info"
              showIcon
              className="mb-3"
              message="Kalitlar hech qachon ko'rsatilmaydi"
              description="Server faqat oxirgi 4 belgini qaytaradi. Aylantirilganda yangi qiymat bir marta chiqadi — o'sha zahoti marketplace'ga uzating."
            />

            {/*
              ── HAMKORNING KALITI ────────────────────────────────────────
              Uchta sekretdan YAGONA qo'lda kiritiladigani. Qolgan ikkitasi
              (imzo sekreti, kiruvchi kalit) serverda generatsiya qilinadi —
              shuning uchun ular uchun input yo'q, faqat tugma. Bu farq
              pastdagi izohda ochiq aytilgan, aks holda admin qolgan ikki
              maydonni izlab vaqt yo'qotadi.
            */}
            <Form form={secretForm} layout="vertical" requiredMark={false}>
              <div className="grid md:grid-cols-2 gap-x-4 items-end">
                <Form.Item
                  name="api_key"
                  label="Ularning API kaliti (ular → biz beramiz)"
                  extra={
                    cfg.secrets.api_key.set
                      ? `Kiritilgan (${cfg.secrets.api_key.hint}). Yangisini kiritsangiz almashadi.`
                      : "Hali kiritilmagan. Bu kalitni marketplace sizga beradi."
                  }
                  className="mb-3"
                >
                  <Input.Password
                    placeholder="o'zgartirmasangiz bo'sh qoldiring"
                    maxLength={300}
                    autoComplete="new-password"
                    onPressEnter={saveApiKey}
                  />
                </Form.Item>

                <Form.Item className="mb-3">
                  <Button
                    type="primary"
                    loading={update.isPending}
                    onClick={saveApiKey}
                  >
                    Kalitni saqlash
                  </Button>
                </Form.Item>
              </div>
            </Form>

            <div className="border-t border-gray-200 dark:border-gray-700 my-3" />

            <Alert
              type="info"
              showIcon={false}
              className="mb-3"
              message={
                <span className="text-xs">
                  Quyidagi ikki kalit <b>qo'lda kiritilmaydi</b> — ularni server
                  o'zi yaratadi. Shuning uchun bu yerda kiritish maydoni emas,
                  «Kalit yaratish» tugmasi turibdi.
                </span>
              }
            />

            {!canRotate && (
              <Alert
                type="warning"
                showIcon
                className="mb-3"
                message="Kalit aylantirish faqat SUPERADMIN uchun"
                description="Noto'g'ri paytda aylantirilgan kalit integratsiyani to'xtatib qo'yadi, shuning uchun bu amal cheklangan."
              />
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="font-medium">Imzo sekreti (biz → ular)</div>
                <div className="text-xs text-gray-400">
                  {cfg.secrets.signing_secret.set
                    ? `Joriy: ${cfg.secrets.signing_secret.hint}`
                    : "Kiritilmagan"}
                </div>
                <div className="text-xs text-gray-400">
                  {cfg.secrets.signing_secret_previous.set
                    ? `Eski (hali ishlaydi): ${cfg.secrets.signing_secret_previous.hint}`
                    : "Eski sekret yo'q"}
                </div>
                <div className="flex gap-2">
                  <Popconfirm
                    title="Imzo sekretini aylantirish"
                    description="Eskisi ham vaqtincha ishlaydi — uzilish bo'lmaydi."
                    okText="Aylantirish"
                    cancelText="Bekor"
                    onConfirm={doRotateSigning}
                  >
                    <Button size="small" loading={rotateSigning.isPending} disabled={!canRotate}>
                      {cfg.secrets.signing_secret.set
                        ? "Aylantirish"
                        : "Kalit yaratish"}
                    </Button>
                  </Popconfirm>

                  {cfg.secrets.signing_secret_previous.set && (
                    <Popconfirm
                      title="Eski sekretni tozalash"
                      description="Marketplace yangisiga o'tganiga ishonch hosil qiling — aks holda so'rovlarimiz rad etiladi."
                      okText="Tozalash"
                      cancelText="Bekor"
                      onConfirm={doClearPrevious}
                    >
                      <Button size="small" danger disabled={!canRotate}>
                        Eskisini tozalash
                      </Button>
                    </Popconfirm>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-medium">Kiruvchi kalit (ular → biz)</div>
                <div className="text-xs text-gray-400">
                  {cfg.secrets.inbound_api_key.set
                    ? `Joriy: ${cfg.secrets.inbound_api_key.hint}`
                    : "Kiritilmagan"}
                </div>
                <div className="text-xs text-gray-400">
                  Faqat o'qish endpointlari uchun — ular bizga hech narsa yoza
                  olmaydi.
                </div>
                <Popconfirm
                  title="Kiruvchi kalitni aylantirish"
                  description="Eskisi DARHOL ishlamay qoladi — marketplace so'rovlari yangisi kiritilguncha rad etiladi."
                  okText="Aylantirish"
                  cancelText="Bekor"
                  onConfirm={doRotateInbound}
                >
                  <Button size="small" loading={rotateInbound.isPending} disabled={!canRotate}>
                    {cfg.secrets.inbound_api_key.set
                      ? "Aylantirish"
                      : "Kalit yaratish"}
                  </Button>
                </Popconfirm>
              </div>
            </div>
          </Card>

          {/* ── Status lug'ati ── */}
          <MarketplaceStatusMapCard slug={slug} />

          {/* ── Tarif ── */}
          <Card title="Tarif">
            <Alert
              type="info"
              showIcon
              className="mb-3"
              message="Yangi tarif yo'ldagi posilkalarga ta'sir qilmaydi"
              description="Har posilkaning tarifi qabul paytida muzlatiladi. Aks holda tarif o'zgarishi allaqachon hisoblangan pulni qayta yozib, ikki tomonning daftari ajralib ketardi."
            />

            <Form form={tariffForm} layout="vertical" requiredMark={false}>
              <div className="grid md:grid-cols-3 gap-x-4">
                <Form.Item
                  name="tariff_center"
                  label="Markazgacha"
                  rules={[{ required: true, message: "Kiriting" }]}
                >
                  <InputNumber className="w-full" min={1} step={1000} addonAfter="so'm" />
                </Form.Item>
                <Form.Item
                  name="tariff_home"
                  label="Uygacha"
                  rules={[{ required: true, message: "Kiriting" }]}
                >
                  <InputNumber className="w-full" min={1} step={1000} addonAfter="so'm" />
                </Form.Item>
                <Form.Item name="note" label="Izoh">
                  <Input placeholder="kelishuv sanasi / sabab" maxLength={300} />
                </Form.Item>
              </div>
              <Button
                type="primary"
                loading={setTariff.isPending}
                onClick={applyTariff}
              >
                Yangi versiya qo'llash
              </Button>
            </Form>

            <Typography.Paragraph className="mt-3 mb-2 text-sm text-gray-500">
              Tarif tarixi
            </Typography.Paragraph>
            <Table<MarketplaceTariffRow>
              size="small"
              rowKey="id"
              pagination={false}
              loading={tariffHistory.isLoading}
              dataSource={tariffHistory.data ?? []}
              columns={tariffColumns}
            />
          </Card>
        </>
      )}

      <MarketplaceCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(s) => {
          setCreateOpen(false);
          onCreated(s);
        }}
      />

      <SecretOnceModal
        secret={oneTime?.secret ?? null}
        warning={oneTime?.warning ?? ""}
        onClose={() => setOneTime(null)}
      />
    </div>
  );
};
