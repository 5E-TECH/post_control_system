import { Alert, Button, Card, Modal, Spin, Switch, Tag, Tooltip, message } from "antd";
import {
  Activity,
  Info,
  PowerOff,
  RefreshCcwDot,
  Webhook,
} from "lucide-react";
import { useElchiConfig } from "../../../../shared/api/hooks/useElchiConfig";
import { useElchiAdmin } from "../../../../shared/api/hooks/useElchiAdmin";

const when = (ts?: number | null) =>
  ts ? new Date(ts).toLocaleString("uz-UZ") : "—";

/**
 * Boshqaruv — kill-switch'lar va qo'lda ishga tushiriladigan jarayonlar.
 *
 * Ierarxiya muhim: MASTER o'chsa qolgan ikkisi ahamiyatsiz. Shu bois master
 * alohida, tepada va boshqa rangda turadi.
 */
export const ElchiControlTab = () => {
  const { config: configQuery, updateConfig, reconcileAll } = useElchiConfig();
  const { shutdown } = useElchiAdmin();

  const config = configQuery.data;

  const setFlag = async (
    key: "is_active" | "webhook_enabled" | "reconcile_enabled",
    value: boolean,
    label: string,
  ) => {
    try {
      await updateConfig.mutateAsync({ [key]: value });
      message.success(`${label}: ${value ? "yoqildi" : "o'chirildi"}`);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "O'zgartirishda xatolik");
    }
  };

  const handleMaster = (value: boolean) => {
    if (value) {
      setFlag("is_active", true, "Master kalit");
      return;
    }
    Modal.confirm({
      title: "Elchi integratsiyasini o'chirasizmi?",
      content:
        "O'chirilsa: yangi buyurtmalar Elchi'ga jo'natilmaydi va Elchi'dan kelgan holat o'zgarishlari qo'llanmaydi. Elchi'da HOZIR turgan posilkalar o'z holicha qoladi — ularning holati bizga yetib kelmaydi. Xohlagan vaqt qayta yoqasiz.",
      okText: "Ha, o'chirish",
      okButtonProps: { danger: true },
      cancelText: "Bekor qilish",
      onOk: () => setFlag("is_active", false, "Master kalit"),
    });
  };

  const handleReconcile = async () => {
    try {
      const r = (await reconcileAll.mutateAsync()) as {
        checked?: number;
        applied?: number;
        unchanged?: number;
        errors?: number;
      };
      message.success(
        `Tekshirildi: ${r?.checked ?? 0}, yangilandi: ${
          r?.applied ?? 0
        }, xato: ${r?.errors ?? 0}`,
      );
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "Tenglashtirishda xatolik");
    }
  };

  const handleShutdown = () => {
    Modal.confirm({
      title: "Integratsiyani butunlay to'xtatish",
      icon: <PowerOff className="w-5 h-5 text-red-500" />,
      content: (
        <div className="space-y-2 text-sm">
          <p>
            Uchala kalit ham o'chadi: jo'natish, webhook va solishtiruvchi.
          </p>
          <p>
            <b>Ma'lumot o'chirilmaydi</b> — sozlamalar, posilka bog'lanishlari
            va pul izi joyida qoladi. Qayta yoqsangiz hammasi ishlashda davom
            etadi.
          </p>
        </div>
      ),
      okText: "To'xtatish",
      okButtonProps: { danger: true },
      cancelText: "Bekor qilish",
      onOk: async () => {
        try {
          await shutdown.mutateAsync();
          message.success("Elchi integratsiyasi to'xtatildi");
        } catch (err) {
          const e = err as { response?: { data?: { message?: string } } };
          message.error(e.response?.data?.message ?? "To'xtatishda xatolik");
        }
      },
    });
  };

  if (configQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ═══════ MASTER ═══════ */}
      <Card
        className={
          config?.is_active
            ? "border-green-200 dark:border-green-800"
            : "border-red-200 dark:border-red-800"
        }
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" /> MASTER kalit
              <Tag color={config?.is_active ? "green" : "red"}>
                {config?.is_active ? "FAOL" : "O'CHIQ"}
              </Tag>
            </h3>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              O'chirilsa Elchi'ga hech narsa jo'natilmaydi va kiruvchi webhook
              ham ishlanmaydi. Bu — quyidagi ikki kalitdan <b>ustun</b>: master
              o'chiq bo'lsa ular yoqilgan bo'lsa ham ta'sir qilmaydi.
            </p>
          </div>
          <Switch
            checked={!!config?.is_active}
            loading={updateConfig.isPending}
            onChange={handleMaster}
            checkedChildren="Faol"
            unCheckedChildren="O'chiq"
          />
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <Webhook className="w-4 h-4" /> Kiruvchi webhook
              </h4>
              <p className="text-sm text-gray-500 mt-1">
                Elchi'dan kelgan holat o'zgarishlarini qabul qilish. O'chirilsa
                hodisalar jurnalga yoziladi, lekin <b>qo'llanmaydi</b>.
              </p>
            </div>
            <Switch
              checked={!!config?.webhook_enabled}
              loading={updateConfig.isPending}
              onChange={(v) => setFlag("webhook_enabled", v, "Webhook")}
            />
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold flex items-center gap-2">
                <RefreshCcwDot className="w-4 h-4" /> Solishtiruvchi (CRON)
              </h4>
              <p className="text-sm text-gray-500 mt-1">
                Har 15 daqiqada ochiq posilkalarni Elchi'dan so'raydi.
                <b> Yo'qolgan webhookni aynan shu tutadi</b> — o'chirilsa
                buyurtma abadiy "kutilmoqda"da qolishi mumkin.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Oxirgi solishtiruv: {when(config?.last_reconcile_at)}
              </p>
            </div>
            <Switch
              checked={!!config?.reconcile_enabled}
              loading={updateConfig.isPending}
              onChange={(v) => setFlag("reconcile_enabled", v, "Solishtiruvchi")}
            />
          </div>
        </Card>
      </div>

      <Card title="Qo'lda ishga tushirish">
        <div className="flex gap-2 flex-wrap">
          <Tooltip title="CRON'ni kutmasdan hoziroq barcha ochiq posilkalarni tenglashtiradi">
            <Button
              icon={<RefreshCcwDot className="w-4 h-4" />}
              loading={reconcileAll.isPending}
              onClick={handleReconcile}
            >
              Hoziroq tenglashtirish
            </Button>
          </Tooltip>
        </div>
        <p className="mt-3 text-xs text-gray-500 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Tenglashtirish `cod_collected` ni <b>yubormaydi</b> — Elchi'ning
          so'rov javobidagi summa boshqa miqdorni bildiradi (to'lanishi kerak
          bo'lgan, yig'ilgan emas). Yig'ilgan pul faqat webhookdan keladi.
        </p>
      </Card>

      <Alert
        type="error"
        showIcon
        message="Integratsiyani butunlay to'xtatish"
        description="Uchala kalitni bir vaqtda o'chiradi. Ma'lumot o'chirilmaydi — sozlama, posilka bog'lanishi va pul izi saqlanadi."
        action={
          <Button
            danger
            icon={<PowerOff className="w-4 h-4" />}
            loading={shutdown.isPending}
            onClick={handleShutdown}
          >
            To'xtatish
          </Button>
        }
      />
    </div>
  );
};

export default ElchiControlTab;
