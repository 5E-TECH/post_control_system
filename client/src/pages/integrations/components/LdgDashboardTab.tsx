import { Card, Button, Tag, Spin, message, Statistic, Alert, Tooltip } from "antd";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  PlugZap,
  Clock,
  Webhook,
  Truck,
  ShieldAlert,
  RefreshCcwDot,
} from "lucide-react";
import { useLdgAdmin } from "../../../shared/api/hooks/useLdgAdmin";

const ChecklistItem = ({
  ok,
  label,
  hint,
}: {
  ok: boolean;
  label: string;
  hint?: string;
}) => (
  <div className="flex items-center gap-2 py-1.5">
    {ok ? (
      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
    )}
    <span
      className={
        ok
          ? "text-gray-700 dark:text-gray-200"
          : "text-red-600 dark:text-red-400 font-medium"
      }
    >
      {label}
    </span>
    {hint && <span className="text-xs text-gray-400">— {hint}</span>}
  </div>
);

export const LdgDashboardTab = () => {
  const { getHealth, testConnection, reconcileAll } = useLdgAdmin();
  const { data: health, isLoading, refetch, isRefetching } = getHealth();

  const handleTest = async () => {
    try {
      const result = await testConnection.mutateAsync();
      if (result.success) {
        message.success(result.message);
      } else {
        message.error(`Ulanish muvaffaqiyatsiz: ${result.message}`);
      }
    } catch {
      message.error("Test so'rovida xatolik");
    }
  };

  const handleReconcile = async () => {
    try {
      const r = await reconcileAll.mutateAsync();
      message.success(
        `Tenglashtirildi: ${r.checked} tekshirildi, ${r.applied} yangilandi, ${r.unchanged} o'zgarmagan, ${r.errors} xato`,
      );
      refetch();
    } catch {
      message.error("Tenglashtirishda xatolik");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin size="large" />
      </div>
    );
  }

  if (!health) {
    return <Alert type="error" message="Holat ma'lumotini olishda xatolik" />;
  }

  const c = health.checklist;
  const lastWebhook = health.webhooks.last_received_at
    ? new Date(health.webhooks.last_received_at).toLocaleString("uz-UZ")
    : "—";

  return (
    <div className="space-y-4">
      {/* Tayyorlik banneri */}
      <Alert
        type={health.ready ? "success" : "warning"}
        showIcon
        message={
          health.ready
            ? "LDG integratsiyasi to'liq sozlangan"
            : "Sozlash to'liq emas — quyidagi checklistni tugating"
        }
        description={
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Tag color={c.is_active ? "green" : "default"}>
              {c.is_active ? "Faol" : "Faol emas"}
            </Tag>
            <Tag color={c.is_sandbox ? "orange" : "blue"}>
              {c.is_sandbox ? "Sandbox rejim" : "Production"}
            </Tag>
            {health.courier_name && (
              <Tag color="purple">Kuryer: {health.courier_name}</Tag>
            )}
          </div>
        }
        action={
          <div className="flex gap-2">
            <Button
              icon={<PlugZap className="w-4 h-4" />}
              type="primary"
              loading={testConnection.isPending}
              onClick={handleTest}
            >
              Test ulanish
            </Button>
            <Tooltip title="Barcha faol jo'natmalar statusini LDG'dan tortib olib yangilaydi (webhook o'tkazib yuborilgan bo'lsa ham)">
              <Button
                icon={<RefreshCcwDot className="w-4 h-4" />}
                loading={reconcileAll.isPending}
                onClick={handleReconcile}
              >
                LDG bilan tenglashtirish
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
        {/* Setup checklist */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Sozlash checklisti
            </span>
          }
        >
          <ChecklistItem ok={c.api_key_set} label="API kalit kiritilgan" />
          <ChecklistItem ok={c.tenant_domain_set} label="Tenant domain kiritilgan" />
          <ChecklistItem ok={c.webhook_secret_set} label="Webhook secret kiritilgan" />
          <ChecklistItem ok={c.courier_set} label="LDG vakil-kuryer biriktirilgan" />
          <ChecklistItem ok={c.sender_complete} label="Yuboruvchi (sender) to'liq" />
          <ChecklistItem
            ok={c.enabled_districts_count > 0}
            label="Yetkaziladigan tumanlar tanlangan"
            hint={`${c.enabled_districts_count} ta`}
          />
          <ChecklistItem
            ok={c.is_active}
            label="Integratsiya faol"
            hint={c.is_active ? undefined : "oxirida yoqing"}
          />
        </Card>

        {/* Server vaqti + oxirgi webhook */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" /> Holat
            </span>
          }
        >
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Server vaqti (UTC):</span>
              <span className="font-mono text-sm">{health.server_time}</span>
            </div>
            <div className="flex justify-between">
              <Tooltip title="Agar bu vaqt haqiqiy vaqtdan 5 daqiqadan ko'p farq qilsa, webhook imzo tekshiruvi 'timestamp eskirgan' xatosini beradi">
                <span className="text-gray-500 cursor-help">
                  Oxirgi webhook:
                </span>
              </Tooltip>
              <span className="font-mono text-sm">{lastWebhook}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Webhook signature xatolari:</span>
              <Tag color={health.webhooks.invalid_signature > 0 ? "red" : "green"}>
                {health.webhooks.invalid_signature}
              </Tag>
            </div>
          </div>
        </Card>
      </div>

      {/* Statistika */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <Statistic
            title={
              <span className="flex items-center gap-1.5">
                <Truck className="w-4 h-4" /> Jami jo'natma
              </span>
            }
            value={health.shipments.total}
          />
        </Card>
        <Card>
          <Statistic
            title="Yetkazilgan"
            value={health.shipments.delivered}
            valueStyle={{ color: "#16a34a" }}
          />
        </Card>
        <Card>
          <Statistic
            title="Yuborilmagan (pending)"
            value={health.shipments.pending}
            valueStyle={{
              color: health.shipments.pending > 0 ? "#d97706" : undefined,
            }}
          />
        </Card>
        <Card>
          <Statistic
            title="Xatoli jo'natma"
            value={health.shipments.with_error}
            valueStyle={{
              color: health.shipments.with_error > 0 ? "#dc2626" : undefined,
            }}
          />
        </Card>
        <Card
          className={
            health.shipments.mismatch > 0
              ? "!border-red-500 !border-2 !bg-red-50 dark:!bg-red-900/10"
              : ""
          }
        >
          <Statistic
            title={
              <span className="flex items-center gap-1.5 font-semibold">
                ⚠️ Mismatch
              </span>
            }
            value={health.shipments.mismatch}
            valueStyle={{
              color: health.shipments.mismatch > 0 ? "#dc2626" : undefined,
              fontWeight: health.shipments.mismatch > 0 ? "bold" : undefined,
            }}
          />
          {health.shipments.mismatch > 0 && (
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
              LDG ↔ status to'qnashishi — tekshirish kerak!
            </div>
          )}
        </Card>
      </div>

      <Card
        title={
          <span className="flex items-center gap-2">
            <Webhook className="w-4 h-4" /> Webhook statistikasi
          </span>
        }
      >
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Statistic title="Jami" value={health.webhooks.total} />
          <Statistic
            title="Success"
            value={health.webhooks.success}
            valueStyle={{ color: "#16a34a" }}
          />
          <Statistic
            title="Skipped"
            value={health.webhooks.skipped}
            valueStyle={{
              color: health.webhooks.skipped > 0 ? "#d97706" : undefined,
            }}
          />
          <Statistic
            title="Invalid signature"
            value={health.webhooks.invalid_signature}
            valueStyle={{
              color: health.webhooks.invalid_signature > 0 ? "#dc2626" : undefined,
            }}
          />
          <Statistic
            title="Failed"
            value={health.webhooks.failed}
            valueStyle={{
              color: health.webhooks.failed > 0 ? "#dc2626" : undefined,
            }}
          />
        </div>
      </Card>
    </div>
  );
};
