import { Switch, Tag, Button, message, Tooltip, Modal } from "antd";
import {
  Webhook,
  RefreshCw,
  RotateCcw,
  PlayCircle,
  CircleStop,
  Loader2,
  Info,
  Activity,
  PlugZap,
} from "lucide-react";
import { useLdgAdmin } from "../../../shared/api/hooks/useLdgAdmin";

type FlagKey = "webhook_enabled" | "reconcile_enabled" | "auto_retry_enabled";

export const LdgControlTab = () => {
  const { getAutomations, setAutomation, getBulkStatus, startBulk, stopBulk } =
    useLdgAdmin();
  const { data: auto, isLoading } = getAutomations(true);
  const { data: bulk } = getBulkStatus(true, true);

  const toggle = async (key: FlagKey, value: boolean) => {
    try {
      const r = await setAutomation.mutateAsync({ key, value });
      message.success(r.message);
    } catch {
      message.error("O'zgartirishda xatolik");
    }
  };

  // Master kalit — LDG integratsiyasini butunlay yoqish/uzish.
  const setMaster = async (value: boolean) => {
    try {
      const r = await setAutomation.mutateAsync({ key: "is_active", value });
      message.success(r.message);
    } catch {
      message.error("O'zgartirishda xatolik");
    }
  };

  const handleMasterToggle = (value: boolean) => {
    if (value) {
      setMaster(true);
      return;
    }
    // O'chirish — sezilarli amal, tasdiq so'raymiz.
    Modal.confirm({
      title: "LDG integratsiyasini o'chirasizmi?",
      content:
        "O'chirilsa: yangi buyurtmalar LDG'ga jo'natilmaydi va LDG'dan kelgan status o'zgarishlari qo'llanmaydi (reconcile/auto-retry ham to'xtaydi). Xohlagan vaqt qayta yoqishingiz mumkin.",
      okText: "Ha, o'chirish",
      okButtonProps: { danger: true },
      cancelText: "Bekor qilish",
      onOk: () => setMaster(false),
    });
  };

  const handleStart = async () => {
    try {
      const r = await startBulk.mutateAsync();
      window.dispatchEvent(new Event("ldg-bulk-open"));
      r.started ? message.success(r.message) : message.info(r.message);
    } catch {
      message.error("Boshlashda xatolik");
    }
  };

  const handleStop = async () => {
    try {
      const r = await stopBulk.mutateAsync();
      message.warning(r.message);
    } catch {
      message.error("To'xtatishda xatolik");
    }
  };

  const StatusBadge = ({ on }: { on: boolean }) =>
    on ? (
      <Tag color="green">Aktiv</Tag>
    ) : (
      <Tag color="default">O'chirilgan</Tag>
    );

  const processes: {
    key: FlagKey;
    icon: React.ReactNode;
    title: string;
    desc: string;
    value: boolean;
  }[] = [
    {
      key: "webhook_enabled",
      icon: <Webhook className="w-5 h-5 text-violet-500" />,
      title: "Webhook qabul qilish",
      desc: "LDG'dan kelgan status o'zgarishlarini qabul qilib, buyurtmalarga qo'llaydi.",
      value: auto?.webhook_enabled ?? true,
    },
    {
      key: "reconcile_enabled",
      icon: <RefreshCw className="w-5 h-5 text-blue-500" />,
      title: "Reconcile (har 5 daqiqa)",
      desc: "Faol jo'natmalarni LDG bilan tenglashtiradi (webhook o'tkazib yuborilgan holatlar uchun zaxira).",
      value: auto?.reconcile_enabled ?? true,
    },
    {
      key: "auto_retry_enabled",
      icon: <RotateCcw className="w-5 h-5 text-amber-500" />,
      title: "Auto-retry (har 2 daqiqa)",
      desc: "Yuborilmagan (faol) buyurtmalarni avtomatik qayta jo'natadi.",
      value: auto?.auto_retry_enabled ?? true,
    },
  ];

  const bulkRunning = !!bulk?.running;
  const bulkPct =
    bulk && bulk.total > 0 ? Math.round((bulk.done / bulk.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Umumiy holat */}
      <div className="flex items-center gap-2 flex-wrap">
        <Activity className="w-5 h-5 text-violet-500" />
        <span className="font-semibold text-gray-800 dark:text-white">
          Fon jarayonlari boshqaruvi
        </span>
        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      </div>

      {/* MASTER kalit — integratsiyani butunlay yoqish/uzish */}
      <div
        className={`flex items-center gap-4 p-4 rounded-xl border-2 ${
          auto?.is_active
            ? "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
            : "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
        }`}
      >
        <div className="shrink-0">
          <PlugZap
            className={`w-6 h-6 ${
              auto?.is_active ? "text-green-600" : "text-red-500"
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800 dark:text-white">
              LDG integratsiyasi
            </span>
            <Tag color={auto?.is_active ? "green" : "red"}>
              {auto?.is_active ? "Faol" : "O'chiq"}
            </Tag>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            O'chirilsa buyurtmalar LDG'ga <b>jo'natilmaydi</b> va LDG'dan kelgan
            status o'zgarishlari <b>qo'llanmaydi</b>. LDG vakil-kuryerni bloklash
            ham jo'natishni to'xtatadi.
          </p>
        </div>
        <Switch
          checked={!!auto?.is_active}
          loading={setAutomation.isPending}
          onChange={handleMasterToggle}
        />
      </div>

      {/* Fon jarayonlari (toggle) */}
      <div className="space-y-3">
        {processes.map((p) => (
          <div
            key={p.key}
            className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40"
          >
            <div className="shrink-0">{p.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800 dark:text-white">
                  {p.title}
                </span>
                <StatusBadge on={p.value} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {p.desc}
              </p>
            </div>
            <Switch
              checked={p.value}
              loading={setAutomation.isPending}
              onChange={(v) => toggle(p.key, v)}
            />
          </div>
        ))}

        {/* Ommaviy jo'natish (bulk) — alohida boshqaruv */}
        <div className="flex items-center gap-4 p-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20">
          <div className="shrink-0">
            {bulkRunning ? (
              <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
            ) : (
              <PlayCircle className="w-5 h-5 text-violet-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-800 dark:text-white">
                Ommaviy qayta jo'natish
              </span>
              {bulkRunning ? (
                <Tag color="processing">
                  {bulk?.done}/{bulk?.total} ({bulkPct}%)
                </Tag>
              ) : (
                <Tag color="default">Bo'sh</Tag>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Barcha yuborilmagan faol buyurtmalarni LDG'ga jo'natadi. Server
              tomonida ishlaydi — sahifa yopilsa ham davom etadi.
              {auto ? ` Hozir kutilayotgan: ${auto.pending_active} ta.` : ""}
            </p>
          </div>
          {bulkRunning ? (
            <Button
              danger
              icon={<CircleStop className="w-4 h-4" />}
              loading={stopBulk.isPending}
              onClick={handleStop}
            >
              To'xtatish
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<RotateCcw className="w-4 h-4" />}
              loading={startBulk.isPending}
              onClick={handleStart}
            >
              Boshlash
            </Button>
          )}
        </div>
      </div>

      {/* Webhook obunalari — ma'lumot */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-gray-600 dark:text-gray-300">
          <p className="font-medium text-gray-800 dark:text-white mb-1">
            Webhook obunalari
          </p>
          <p>
            LDG webhook endpointi (obuna) <b>LDG platformasi</b> tomonida
            ro'yxatdan o'tkaziladi. Bu yerdan kelgan webhook'larni{" "}
            <b>"Webhook loglar"</b> tabida ko'rishingiz, eski/keraksizlarni
            o'chirishingiz va failed bo'lganlarini qayta ishlashingiz mumkin.
            Yuqoridagi <Tooltip title="Webhook qabul qilish">switch</Tooltip>{" "}
            orqali webhook qabulини butunlay to'xtatib turishingiz ham mumkin.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LdgControlTab;
