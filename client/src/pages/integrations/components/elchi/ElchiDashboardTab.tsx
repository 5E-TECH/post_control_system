import { Alert, Button, Card, Spin, Statistic, Tag, Tooltip, message } from "antd";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCcwDot,
  RefreshCw,
  ShieldAlert,
  Truck,
  Webhook,
  XCircle,
} from "lucide-react";
import { useElchiAdmin, type ElchiStats } from "../../../../shared/api/hooks/useElchiAdmin";
import { useElchiConfig, type ElchiReadiness } from "../../../../shared/api/hooks/useElchiConfig";

/** Checklist kalitlarining o'zbekcha nomlari. */
const CHECK_LABELS: Record<string, string> = {
  api_base_url: "API manzili kiritilgan",
  api_key: "API kalit kiritilgan",
  webhook_secret: "Webhook sekreti kiritilgan",
  elchi_market_id: "Elchi market akkaunti ochilgan",
  virtual_courier: "Vakil-kuryer biriktirilgan",
  districts: "Tumanlar moslangan va ruxsat berilgan",
  connection: "Ulanish ishlaydi",
  tariff: "Tarif ikki tomonda TENG",
};

const ChecklistItem = ({
  ok,
  label,
  hint,
}: {
  ok: boolean;
  label: string;
  hint?: string;
}) => (
  <div className="flex items-start gap-2 py-1.5">
    {ok ? (
      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
    )}
    <div className="min-w-0">
      <span
        className={
          ok
            ? "text-gray-700 dark:text-gray-200"
            : "text-red-600 dark:text-red-400 font-medium"
        }
      >
        {label}
      </span>
      {hint && (
        <span className="block text-xs text-gray-400 break-words">{hint}</span>
      )}
    </div>
  </div>
);

const money = (v: number) => `${Math.round(v).toLocaleString("uz-UZ")} so'm`;

/**
 * Elchi umumiy holati — tayyorlik checklisti + jonli raqamlar.
 *
 * Checklist tashqi so'rov qiladi (ping + tarif), shu bois avtomatik
 * yangilanmaydi — operator "Yangilash" bilan o'zi so'raydi.
 */
export const ElchiDashboardTab = () => {
  const { useHealth } = useElchiAdmin();
  const { reconcileAll } = useElchiConfig();
  const { data, isLoading, refetch, isRefetching } = useHealth();

  const health = (data as { data?: unknown })?.data ?? data;
  const readiness = (health as { readiness?: ElchiReadiness })?.readiness;
  const stats = (health as { stats?: ElchiStats })?.stats;

  const handleReconcile = async () => {
    try {
      const r = (await reconcileAll.mutateAsync()) as {
        checked?: number;
        applied?: number;
        unchanged?: number;
        errors?: number;
      };
      message.success(
        `Tenglashtirildi: ${r?.checked ?? 0} tekshirildi, ${
          r?.applied ?? 0
        } yangilandi, ${r?.errors ?? 0} xato`,
      );
      refetch();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "Tenglashtirishda xatolik");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin size="large" />
      </div>
    );
  }

  if (!readiness || !stats) {
    return <Alert type="error" showIcon message="Holat ma'lumotini olishda xatolik" />;
  }

  const lastWebhook = stats.webhooks.last_received_at
    ? new Date(stats.webhooks.last_received_at).toLocaleString("uz-UZ")
    : "—";

  return (
    <div className="space-y-4">
      <Alert
        type={readiness.ready ? "success" : "warning"}
        showIcon
        message={
          readiness.ready
            ? "Elchi integratsiyasi to'liq sozlangan"
            : "Sozlash to'liq emas — quyidagi checklistni tugating"
        }
        description={
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Tag color={stats.shipments.dispatched > 0 ? "green" : "default"}>
              Jo'natilgan: {stats.shipments.dispatched}
            </Tag>
            {stats.shipments.failed > 0 && (
              <Tag color="red">Xato: {stats.shipments.failed}</Tag>
            )}
            {stats.shipments.mismatch > 0 && (
              <Tag color="orange">
                Nomuvofiqlik: {stats.shipments.mismatch}
              </Tag>
            )}
          </div>
        }
        action={
          <div className="flex gap-2">
            <Tooltip title="Ochiq posilkalar holatini Elchi'dan tortib olib yangilaydi (yo'qolgan webhookni tutadi)">
              <Button
                icon={<RefreshCcwDot className="w-4 h-4" />}
                loading={reconcileAll.isPending}
                onClick={handleReconcile}
              >
                Elchi bilan tenglashtirish
              </Button>
            </Tooltip>
            <Button
              icon={<RefreshCw className="w-4 h-4" />}
              loading={isRefetching}
              onClick={() => refetch()}
            >
              Yangilash
            </Button>
          </div>
        }
      />

      <div className="grid md:grid-cols-2 gap-4">
        <Card
          title={
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Tayyorlik checklisti
            </span>
          }
        >
          {readiness.checks.map((c) => (
            <ChecklistItem
              key={c.key}
              ok={c.ok}
              label={CHECK_LABELS[c.key] ?? c.key}
              hint={c.detail}
            />
          ))}
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> Kunlik holat
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <Statistic
              title="Jami posilka"
              value={stats.shipments.total}
              prefix={<Truck className="w-4 h-4 inline" />}
            />
            <Statistic
              title="Elchi'ga yetgan"
              value={stats.shipments.dispatched}
              valueStyle={{ color: "#16a34a" }}
            />
            <Statistic
              title="Yetmagan (xato)"
              value={stats.shipments.failed}
              valueStyle={{
                color: stats.shipments.failed > 0 ? "#dc2626" : undefined,
              }}
            />
            <Statistic
              title="Nomuvofiqlik"
              value={stats.shipments.mismatch}
              valueStyle={{
                color: stats.shipments.mismatch > 0 ? "#ea580c" : undefined,
              }}
              prefix={
                stats.shipments.mismatch > 0 ? (
                  <AlertTriangle className="w-4 h-4 inline" />
                ) : undefined
              }
            />
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 flex items-center gap-1">
                <Webhook className="w-3.5 h-3.5" /> Oxirgi webhook:
              </span>
              <span className="font-mono text-xs">{lastWebhook}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Webhook: muvaffaqiyatli / xato:</span>
              <span>
                <b className="text-green-600">{stats.webhooks.success}</b>
                {" / "}
                <b
                  className={
                    stats.webhooks.failed > 0 ? "text-red-600" : undefined
                  }
                >
                  {stats.webhooks.failed}
                </b>
              </span>
            </div>
            {stats.webhooks.invalid_signature > 0 && (
              <div className="flex justify-between text-red-600">
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Imzosi noto'g'ri:
                </span>
                <b>{stats.webhooks.invalid_signature}</b>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card title="Pul (butun vaqt)">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Statistic
            title="Jo'natilgan COD"
            value={money(stats.money.cod_sent)}
          />
          <Statistic
            title="Elchi yig'gan (net)"
            value={money(stats.money.cod_collected)}
          />
          <Statistic
            title="Elchi to'lagan"
            value={money(stats.money.paid_by_elchi)}
          />
          <Statistic
            title="Elchi bizga qarz"
            value={money(stats.money.debt)}
            valueStyle={{
              color: stats.money.debt > 0 ? "#ea580c" : "#16a34a",
            }}
          />
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          ⚠️ "Elchi yig'gan" — Elchi <b>o'z tarifini ayirgandan keyingi</b>{" "}
          summa. Ya'ni jo'natilgan COD bilan farqi kutilgan narsa; xato — bu farq
          kelishilgan tarifga <b>mos kelmasa</b>. Batafsil solishtiruv
          "Hisob-kitob" bo'limida.
        </p>
      </Card>
    </div>
  );
};

export default ElchiDashboardTab;
