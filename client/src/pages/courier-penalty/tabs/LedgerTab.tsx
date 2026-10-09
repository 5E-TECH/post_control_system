import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pagination } from "antd";
import { Undo2 } from "lucide-react";
import {
  useCourierPenaltyAdmin,
  type PenaltyEntry,
} from "../../../shared/api/hooks/useCourierPenalty";
import { formatSum } from "../../../shared/lib/deadlineTone";
import { useApiNotification } from "../../../shared/hooks/useApiNotification";

/**
 * SHTRAF DAFTARI + BEKOR QILISH.
 *
 * ⚠️ BEKOR QILISH O'CHIRISH EMAS. Asl qator joyida qoladi, ustiga
 * teskari ishorali `waiver` qatori yoziladi — shuning uchun ro'yxatda
 * ikkala qator ham ko'rinadi. Bu ataylab: «kim, qachon, nega bekor
 * qildi» degan dalil ko'rinib turishi kerak.
 */
const LedgerTab = () => {
  const { t } = useTranslation("penalty");
  const { handleSuccess, handleApiError } = useApiNotification();
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState<string>("");
  const [target, setTarget] = useState<PenaltyEntry | null>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const { getEntries, getWaiverReasons, waive } = useCourierPenaltyAdmin();
  const { data, isLoading } = getEntries({
    page,
    limit: 25,
    ...(kind ? { kind } : {}),
  });
  const { data: reasons } = getWaiverReasons();

  const close = () => {
    setTarget(null);
    setReason("");
    setNote("");
  };

  const submit = () => {
    if (!target || !reason) return;
    waive.mutate(
      { id: target.id, reason, note: note.trim() || undefined },
      {
        onSuccess: () => {
          handleSuccess(t("ledger.waived"));
          close();
        },
        onError: (e: unknown) => handleApiError(e, t("ledger.waiveFailed")),
      },
    );
  };

  const kindChip = (k: PenaltyEntry["kind"]) => {
    const map = {
      penalty: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      bonus:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      waiver: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    } as const;
    return (
      <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${map[k]}`}>
        {t(`kind.${k}`)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {["", "penalty", "bonus", "waiver"].map((k) => (
          <button
            key={k || "all"}
            type="button"
            onClick={() => {
              setKind(k);
              setPage(1);
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              kind === k
                ? "bg-purple-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            {k ? t(`kind.${k}`) : t("ledger.all")}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-[#231F35] dark:text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left">{t("ledger.date")}</th>
              <th className="px-3 py-2 text-left">{t("order")}</th>
              <th className="px-3 py-2 text-left">{t("courier")}</th>
              <th className="px-3 py-2 text-left">{t("ledger.kind")}</th>
              <th className="px-3 py-2 text-left">{t("ledger.reason")}</th>
              <th className="px-3 py-2 text-right">{t("ledger.amount")}</th>
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
            {!isLoading && !data?.items?.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-400">
                  {t("ledger.empty")}
                </td>
              </tr>
            )}
            {data?.items?.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                  {new Date(e.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 py-2 font-medium text-gray-800 dark:text-white">
                  #{e.order_number ?? "—"}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                  {e.courier_name || "—"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {kindChip(e.kind)}
                    {/* Soya — pul tegilmagani ochiq ko'rinsin */}
                    {e.shadow && (
                      <span
                        className="text-[10px] font-medium text-gray-400"
                        title={t("ledger.shadowHint")}
                      >
                        {t("ledger.shadow")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                  {t(`reason.${e.reason}`, { defaultValue: e.reason })}
                  {e.note && (
                    <div className="text-[11px] text-gray-400">{e.note}</div>
                  )}
                </td>
                <td
                  className={`px-3 py-2 text-right font-semibold tabular-nums ${
                    e.amount > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  }`}
                >
                  {e.amount > 0 ? "+" : ""}
                  {formatSum(e.amount)}
                </td>
                <td className="px-3 py-2 text-right">
                  {/*
                    Bekor qilish faqat shtrafga. Bonusni bekor qilish
                    ma'nosiz, `waiver` ning o'zini esa server rad etadi.

                    ⚠️ ALLAQACHON BEKOR QILINGANDA TUGMA YO'Q. Belgi
                    SERVERDAN keladi: daftar sahifalanadi, ya'ni bekor
                    qilish qatori boshqa sahifada bo'lishi mumkin va uni
                    ekranda hisoblab bo'lmasdi — tugma bosilganda server
                    xato qaytarardi.
                  */}
                  {e.kind === "penalty" && e.waived && (
                    <span className="text-xs text-gray-400">
                      {t("ledger.alreadyWaived")}
                    </span>
                  )}
                  {e.kind === "penalty" && !e.waived && (
                    <button
                      type="button"
                      onClick={() => setTarget(e)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      <Undo2 className="h-3 w-3" />
                      {t("ledger.waive")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!!data?.total && data.total > data.limit && (
        <div className="flex justify-center">
          <Pagination
            current={page}
            total={data.total}
            pageSize={data.limit}
            showSizeChanger={false}
            onChange={setPage}
          />
        </div>
      )}

      <Modal
        open={!!target}
        onCancel={close}
        onOk={submit}
        okButtonProps={{ disabled: !reason, loading: waive.isPending }}
        okText={t("ledger.waive")}
        title={t("ledger.waiveTitle", { n: target?.order_number ?? "" })}
      >
        {/*
          ⚠️ SABAB MAJBURIY va YOPIQ RO'YXATDAN — qulflangan qaror.
          Erkin matn bo'lsa, oylar o'tib «nega bu shtraflar bekor
          qilingan» savoliga javob «kelishildi», «ok» kabi ma'nosiz
          qatorlar bo'lardi.
        */}
        <div className="space-y-3 pt-2">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {t("ledger.waiveAmount")}:{" "}
            <b className="tabular-nums">{formatSum(target?.amount ?? 0)}</b>{" "}
            {t("currency")}
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">
              {t("ledger.reason")} *
            </span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-[#2A263D] dark:text-white"
            >
              <option value="">—</option>
              {reasons?.map((r) => (
                <option key={r} value={r}>
                  {t(`reason.${r}`, { defaultValue: r })}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700 dark:text-gray-200">
              {t("ledger.note")}
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={256}
              placeholder={t("ledger.notePlaceholder")}
              className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-600 dark:bg-[#2A263D] dark:text-white"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
};

export default memo(LedgerTab);
