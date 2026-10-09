import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "antd";
import { Pencil, Plus, Power } from "lucide-react";
import {
  useCourierPenaltyAdmin,
  type PenaltyRule,
} from "../../../shared/api/hooks/useCourierPenalty";
import { formatSum } from "../../../shared/lib/deadlineTone";
import { useApiNotification } from "../../../shared/hooks/useApiNotification";

type Draft = {
  id?: string;
  scope_type: PenaltyRule["scope_type"];
  scope_id: string | null;
  event: PenaltyRule["event"];
  threshold_days: number;
  calc: PenaltyRule["calc"];
  /** EKRANDA DOIM MUSBAT — ishora yuborishdan oldin qo'yiladi. */
  amount: number;
  max_amount: number | null;
};

const EMPTY: Draft = {
  scope_type: "global",
  scope_id: null,
  event: "late_mark",
  threshold_days: 4,
  calc: "per_day",
  amount: 2000,
  max_amount: null,
};

/**
 * QOIDALAR — barcha kombinatsiyalar shu jadvalda.
 *
 * ⚠️ ISHORA EKRANGA CHIQMAYDI. Bazada `amount` ishorali (shtraf manfiy,
 * bonus musbat), lekin admindan manfiy son kiritishni so'rash xatoga
 * ochiq taklif bo'lardi: «−2000» o'rniga «2000» yozilsa, shtraf deb
 * o'ylangan qoida BONUS bo'lib ishlardi va buni faqat kuryer kassasida
 * pul ko'paygach payqashardi. Shuning uchun ekranda doim musbat son
 * so'raladi, ishorani `event` ga qarab KOD qo'yadi. Server tomoni ham
 * tekshiradi (`assertRule`) — ikki devor.
 */
const RulesTab = () => {
  const { t } = useTranslation("penalty");
  const { handleSuccess, handleApiError } = useApiNotification();
  const [draft, setDraft] = useState<Draft | null>(null);

  const { getRules, getCouriers, createRule, updateRule, deactivateRule } =
    useCourierPenaltyAdmin();
  const { data: rules, isLoading } = getRules();
  const { data: couriers } = getCouriers();

  const signed = (d: Draft) => {
    const abs = Math.abs(Number(d.amount) || 0);
    // Bonus musbat, shtraf va zarar manfiy.
    return d.event === "early_mark" ? abs : -abs;
  };

  const submit = () => {
    if (!draft) return;
    const body = {
      scope_type: draft.scope_type,
      scope_id: draft.scope_type === "global" ? null : draft.scope_id,
      event: draft.event,
      threshold_days: Number(draft.threshold_days) || 0,
      calc: draft.calc,
      amount: signed(draft),
      max_amount:
        draft.max_amount == null || draft.max_amount === 0
          ? null
          : Math.abs(Number(draft.max_amount)),
    };
    const done = {
      onSuccess: () => {
        handleSuccess(t("rules.saved"));
        setDraft(null);
      },
      onError: (e: unknown) => handleApiError(e, t("rules.saveFailed")),
    };
    if (draft.id) updateRule.mutate({ id: draft.id, ...body }, done);
    else createRule.mutate(body, done);
  };

  const edit = (r: PenaltyRule) =>
    setDraft({
      id: r.id,
      scope_type: r.scope_type,
      scope_id: r.scope_id,
      event: r.event,
      threshold_days: r.threshold_days,
      calc: r.calc,
      // Ishorani yechib, ekranga musbat ko'rsatamiz.
      amount: Math.abs(r.amount),
      max_amount: r.max_amount,
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500 px-3 py-2 text-sm font-medium text-white hover:bg-purple-600"
        >
          <Plus className="h-4 w-4" />
          {t("rules.add")}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-[#231F35] dark:text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left">{t("rules.scope")}</th>
              <th className="px-3 py-2 text-left">{t("rules.event")}</th>
              <th className="px-3 py-2 text-right">{t("rules.threshold")}</th>
              <th className="px-3 py-2 text-left">{t("rules.calc")}</th>
              <th className="px-3 py-2 text-right">{t("rules.amount")}</th>
              <th className="px-3 py-2 text-right">{t("rules.max")}</th>
              <th className="px-3 py-2 text-right">{t("ledger.action")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-[#2A263D]">
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  …
                </td>
              </tr>
            )}
            {rules?.map((r) => (
              <tr key={r.id} className={r.is_active ? "" : "opacity-50"}>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                  {t(`scope.${r.scope_type}`)}
                  {r.scope_name && (
                    <span className="ml-1 text-xs text-gray-400">
                      · {r.scope_name}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                  {t(`event.${r.event}`)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.threshold_days}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                  {t(`calc.${r.calc}`)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-semibold tabular-nums ${
                    r.amount < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {formatSum(Math.abs(r.amount))}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                  {r.max_amount == null ? t("rules.capTariff") : formatSum(r.max_amount)}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => edit(r)}
                      className="rounded-lg border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                      title={t("rules.edit")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {r.is_active && (
                      <button
                        type="button"
                        onClick={() =>
                          Modal.confirm({
                            title: t("rules.offTitle"),
                            content: t("rules.offHint"),
                            okText: t("rules.off"),
                            okButtonProps: { danger: true },
                            onOk: () =>
                              deactivateRule.mutateAsync(r.id).then(() => {
                                handleSuccess(t("rules.turnedOff"));
                              }),
                          })
                        }
                        className="rounded-lg border border-red-300 p-1.5 text-red-500 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                        title={t("rules.off")}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!draft}
        onCancel={() => setDraft(null)}
        onOk={submit}
        okText={t("rules.save")}
        okButtonProps={{
          loading: createRule.isPending || updateRule.isPending,
          disabled:
            !!draft && draft.scope_type !== "global" && !draft.scope_id,
        }}
        title={draft?.id ? t("rules.edit") : t("rules.add")}
      >
        {draft && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-gray-700 dark:text-gray-200">
                  {t("rules.event")}
                </span>
                <select
                  value={draft.event}
                  onChange={(e) =>
                    setDraft({ ...draft, event: e.target.value as Draft["event"] })
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-[#2A263D] dark:text-white"
                >
                  {(["late_mark", "early_mark", "damage"] as const).map((e) => (
                    <option key={e} value={e}>
                      {t(`event.${e}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-gray-700 dark:text-gray-200">
                  {t("rules.scope")}
                </span>
                <select
                  value={draft.scope_type}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      scope_type: e.target.value as Draft["scope_type"],
                      scope_id: null,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-[#2A263D] dark:text-white"
                >
                  {(["global", "courier"] as const).map((s) => (
                    <option key={s} value={s}>
                      {t(`scope.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {draft.scope_type === "courier" && (
              <label className="block text-sm">
                <span className="mb-1 block text-gray-700 dark:text-gray-200">
                  {t("courier")} *
                </span>
                <select
                  value={draft.scope_id ?? ""}
                  onChange={(e) =>
                    setDraft({ ...draft, scope_id: e.target.value || null })
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-[#2A263D] dark:text-white"
                >
                  <option value="">—</option>
                  {couriers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.phone_number}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-gray-700 dark:text-gray-200">
                  {draft.event === "early_mark"
                    ? t("rules.bonusTier")
                    : t("rules.threshold")}
                </span>
                <input
                  type="number"
                  min={0}
                  value={draft.threshold_days}
                  onChange={(e) =>
                    setDraft({ ...draft, threshold_days: Number(e.target.value) })
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-[#2A263D] dark:text-white"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-gray-700 dark:text-gray-200">
                  {t("rules.calc")}
                </span>
                <select
                  value={draft.calc}
                  onChange={(e) =>
                    setDraft({ ...draft, calc: e.target.value as Draft["calc"] })
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-[#2A263D] dark:text-white"
                >
                  {(["per_day", "once"] as const).map((c) => (
                    <option key={c} value={c}>
                      {t(`calc.${c}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-gray-700 dark:text-gray-200">
                  {t("rules.amount")} ({t("currency")})
                </span>
                <input
                  type="number"
                  min={1}
                  value={draft.amount}
                  onChange={(e) =>
                    setDraft({ ...draft, amount: Number(e.target.value) })
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-[#2A263D] dark:text-white"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-gray-700 dark:text-gray-200">
                  {t("rules.max")}
                </span>
                <input
                  type="number"
                  min={0}
                  value={draft.max_amount ?? ""}
                  placeholder={t("rules.capTariff")}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      max_amount: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-[#2A263D] dark:text-white"
                />
              </label>
            </div>

            {/*
              Ekranda manfiy son so'ralmaydi — ishorani `event` belgilaydi.
              Admin nima bo'lishini oldindan ko'rib tursin.
            */}
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/50 dark:text-gray-300">
              {draft.event === "early_mark"
                ? t("rules.previewBonus", { amount: formatSum(Math.abs(draft.amount)) })
                : t("rules.previewPenalty", {
                    amount: formatSum(Math.abs(draft.amount)),
                    unit: t(`calc.${draft.calc}`),
                  })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default memo(RulesTab);
