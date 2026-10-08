import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Switch } from "antd";
import { AlertTriangle, Power, ShieldOff } from "lucide-react";
import { useCourierPenaltyAdmin } from "../../../shared/api/hooks/useCourierPenalty";
import { useApiNotification } from "../../../shared/hooks/useApiNotification";

/**
 * MODULNI BOSHQARISH — yoqish/o'chirish va kuryer istisnolari.
 *
 * ⚠️ YOQISH — PULGA TEGADIGAN AMAL, shuning uchun tasdiqlash oynasi
 * MAJBURIY va unda aynan nima bo'lishi yozilgan. Oddiy o'tkagich
 * bo'lsa, tasodifan bosilgan tugma o'nlab kuryerdan pul yecha boshlardi.
 *
 * ⚠️ O'CHIRISH ESKI YOZUVLARNI QAYTARMAYDI — bu ham oynada aytiladi.
 * Undirilgan shtrafni qaytarish kerak bo'lsa, har biri alohida, sabab
 * bilan bekor qilinadi (Daftar tabi). Ommaviy jim qaytarish dalilsiz
 * pul harakati bo'lardi.
 */
const SettingsTab = () => {
  const { t } = useTranslation("penalty");
  const { handleSuccess, handleApiError } = useApiNotification();
  const [search, setSearch] = useState("");

  const { getConfig, getCouriers, setActive, setExempt } =
    useCourierPenaltyAdmin();
  const { data: config, isLoading } = getConfig();
  const { data: couriers } = getCouriers();

  const toggle = (next: boolean) => {
    Modal.confirm({
      title: next ? t("settings.onTitle") : t("settings.offTitle"),
      content: (
        <div className="space-y-2 text-sm">
          <p>{next ? t("settings.onBody") : t("settings.offBody")}</p>
          <p className="font-medium text-amber-700 dark:text-amber-400">
            {next ? t("settings.onAnchor") : t("settings.offKeep")}
          </p>
        </div>
      ),
      okText: next ? t("settings.turnOn") : t("settings.turnOff"),
      okButtonProps: { danger: next },
      onOk: () =>
        setActive
          .mutateAsync(next)
          .then(() =>
            handleSuccess(next ? t("settings.turnedOn") : t("settings.turnedOff")),
          )
          .catch((e: unknown) => handleApiError(e, t("settings.failed"))),
    });
  };

  const filtered = (couriers ?? []).filter((c) =>
    `${c.name ?? ""} ${c.phone_number ?? ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  if (isLoading) return <div className="p-6 text-sm text-gray-500">…</div>;

  const active = !!config?.is_active;

  return (
    <div className="space-y-5">
      {/* ── Modul kaliti ── */}
      <div
        className={`rounded-xl border p-4 ${
          active
            ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
            : "border-gray-200 bg-white dark:border-gray-800 dark:bg-[#2A263D]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                active ? "bg-red-500/20" : "bg-gray-500/10"
              }`}
            >
              <Power
                className={`h-4 w-4 ${
                  active
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              />
            </div>
            <div>
              <div className="font-semibold text-gray-800 dark:text-white">
                {active ? t("settings.stateOn") : t("settings.stateOff")}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {active ? t("settings.stateOnHint") : t("settings.stateOffHint")}
              </div>
            </div>
          </div>

          <Switch
            checked={active}
            loading={setActive.isPending}
            onChange={toggle}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-2 dark:text-gray-400">
          <div>
            {t("settings.shadowSince")}:{" "}
            <b>
              {config?.shadow_since
                ? new Date(config.shadow_since).toLocaleDateString()
                : "—"}
            </b>
          </div>
          <div>
            {/*
              ⚠️ Grandfathering langari. Modul faqat shu paytdan KEYIN
              JO'NATILGAN buyurtmalarga tegadi — admin buni ko'rib tursin,
              aks holda «nega bu buyurtmaga shtraf yo'q» savoli chiqadi.
            */}
            {t("settings.activatedAt")}:{" "}
            <b>
              {config?.activated_at
                ? new Date(config.activated_at).toLocaleString()
                : "—"}
            </b>
          </div>
        </div>

        {active && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {t("settings.liveWarning")}
          </div>
        )}
      </div>

      {/* ── Kuryer istisnolari ── */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#2A263D]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-gray-400" />
            <span className="font-medium text-gray-800 dark:text-white">
              {t("settings.exemptions")}
            </span>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("settings.searchCourier")}
            className="h-9 w-full rounded-lg border border-gray-200 px-3 text-sm sm:w-56 dark:border-gray-700 dark:bg-[#231F35] dark:text-white"
          />
        </div>

        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
          {t("settings.exemptHint")}
        </div>

        <div className="max-h-[420px] divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-gray-800 dark:text-white">
                  {c.name || "—"}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {c.phone_number}
                </div>
              </div>
              <Switch
                size="small"
                checked={c.penalty_exempt}
                onChange={(v) =>
                  setExempt
                    .mutateAsync({ id: c.id, exempt: v })
                    .then(() => handleSuccess(t("settings.exemptSaved")))
                    .catch((e: unknown) =>
                      handleApiError(e, t("settings.failed")),
                    )
                }
              />
            </div>
          ))}
          {!filtered.length && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              {t("settings.noCouriers")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(SettingsTab);
