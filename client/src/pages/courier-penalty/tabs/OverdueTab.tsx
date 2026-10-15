import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Phone,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { useCourierPenaltyAdmin } from "../../../shared/api/hooks/useCourierPenalty";
import type { OverdueCourier } from "../../../shared/api/hooks/useCourierPenalty";
import { formatSum } from "../../../shared/lib/deadlineTone";
import { formatDate, lateTone, lateToneClass } from "../lib/penaltyFormat";
import StatTile from "../components/StatTile";
import { TabEmpty, TabError, TabLoading } from "../components/TabState";

/**
 * KECHIKKANLAR — MODULNING ENG MUHIM EKRANI.
 *
 * ⚠️ Shtraf faqat kuryer tugmani BOSGANDA yoziladi, asosiy muammo esa
 * UMUMAN BOSMASLIK: hech qachon bosmagan kuryer hech narsa to'lamaydi.
 * Ya'ni bu ro'yxat qulaylik emas — usiz modul eng intizomli kuryerni
 * jazolab, eng beparvosini tegmay qo'yardi.
 *
 * ⚠️ FILTR HAR DOIM CHIZILADI. Ilgari ro'yxat bo'sh chiqsa butun yuqori
 * panel, jumladan `minDays` tanlovi ham yo'qolardi — ya'ni «30 kun» ni
 * tanlab bo'sh natija olgan admin filtrni ORQAGA QAYTARA OLMAY, sahifani
 * qayta yuklashga majbur bo'lardi.
 */

type SortKey = "penalty" | "late" | "name";

const OverdueTab = () => {
  const { t } = useTranslation("penalty");
  const [minDays, setMinDays] = useState(1);
  const [sort, setSort] = useState<SortKey>("penalty");
  const [open, setOpen] = useState<string | null>(null);

  const { getOverdue } = useCourierPenaltyAdmin();
  const { data, isLoading, isError, refetch } = getOverdue({ minDays });

  const couriers = useMemo(() => {
    const list = [...(data?.couriers ?? [])];
    if (sort === "penalty") list.sort((a, b) => b.penalty_now - a.penalty_now);
    if (sort === "late")
      list.sort((a, b) => b.oldest_late_days - a.oldest_late_days);
    if (sort === "name")
      list.sort((a, b) => (a.courier_name || "").localeCompare(b.courier_name || ""));
    return list;
  }, [data, sort]);

  /**
   * ⚠️ Bitta kuryer qolsa o'zi ochiladi. Aks holda ekranda bitta ingichka
   * qator turib, qolgan joy bo'm-bo'sh qolardi va admin «ma'lumot yo'q»
   * deb o'ylardi — aslida bitta bosish kerak edi.
   */
  const effectiveOpen =
    open ?? (couriers.length === 1 ? couriers[0].courier_id : null);

  const testMode = data ? !data.module.active : false;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        {t("overdue.minDays")}
        <select
          value={minDays}
          onChange={(e) => setMinDays(Number(e.target.value))}
          className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm dark:border-gray-700 dark:bg-[#2A263D] dark:text-gray-200"
        >
          {[0, 1, 3, 7, 14, 30].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        {t("overdue.sort")}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm dark:border-gray-700 dark:bg-[#2A263D] dark:text-gray-200"
        >
          <option value="penalty">{t("overdue.sortPenalty")}</option>
          <option value="late">{t("overdue.sortLate")}</option>
          <option value="name">{t("overdue.sortName")}</option>
        </select>
      </label>
    </div>
  );

  if (isError) return <TabError onRetry={() => refetch()} />;
  if (isLoading || !data) return <TabLoading />;

  return (
    <div className="space-y-4">
      {/* Uchta son — pul kattaroq, chunki ekranga shu savol bilan kelinadi */}
      {/*
        ⚠️ PUL KATAGI IKKI USTUN EGALLAYDI. Uchta teng katak bo'lganda
        «1» va «10» degan qisqa sonlar ikkita keng, deyarli bo'sh
        to'rtburchakni egallab, eng muhim son ular bilan teng og'irlikda
        turardi.
      */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label={t("overdue.couriers")}
          value={data.summary.couriers}
          tone="neutral"
        />
        <StatTile
          label={t("overdue.orders")}
          value={data.summary.orders}
          tone="neutral"
        />
        <div className="col-span-2">
          <StatTile
            label={t("overdue.penaltyNow")}
            value={formatSum(data.summary.penalty_now)}
            unit={t("currency")}
            tone={data.summary.penalty_now > 0 ? "danger" : "muted"}
            emphasis
            hint={testMode ? t("overdue.testHint") : undefined}
            badge={
              testMode ? (
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">
                  {t("status.test")}
                </span>
              ) : undefined
            }
          />
        </div>
      </div>

      {toolbar}

      {!couriers.length ? (
        <TabEmpty
          icon={<ShieldCheck className="h-8 w-8" />}
          title={t("overdue.empty")}
          hint={minDays > 0 ? t("overdue.emptyFilterHint", { days: minDays }) : undefined}
          tone="good"
        />
      ) : (
        couriers.map((c) => (
          <CourierCard
            key={c.courier_id}
            courier={c}
            expanded={effectiveOpen === c.courier_id}
            onToggle={() =>
              setOpen(effectiveOpen === c.courier_id ? "" : c.courier_id)
            }
          />
        ))
      )}
    </div>
  );
};

const CourierCard = ({
  courier: c,
  expanded,
  onToggle,
}: {
  courier: OverdueCourier;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const { t } = useTranslation("penalty");
  const immuneCount = c.orders.filter((o) => o.immune).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#2A263D]">
      {/*
        ⚠️ TOR EKRANDA USTMA-UST. Bitta qatorda ism va to'rtta nishon
        390px ga sig'masdi: ism `min-w-0` tufayli nolga qisilib, kartada
        «Qo'ng'iroq · 10 ta · 13 kun · 188 000» qolardi — ya'ni KIMNING
        qarzi ekani ko'rinmasdi. Shuning uchun mobil ustun, keng ekranda
        qator.
      */}
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold text-gray-800 dark:text-white">
              {c.courier_name || "—"}
            </div>
            {immuneCount > 0 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t("overdue.immuneCount", { count: immuneCount })}
              </div>
            )}
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2 pl-7 sm:shrink-0 sm:justify-end sm:pl-0">
          {/*
            ⚠️ Telefon tugmasi tugmaning TASHQARISIDA. Ilgari u ochish
            tugmasi ichida edi va bosilganda karta ham ochilib ketardi;
            telefonga bosish esa aynan «hozir qo'ng'iroq qilaman» harakati.
          */}
          {c.courier_phone && (
            <a
              href={`tel:${c.courier_phone}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
            >
              <Phone className="h-3.5 w-3.5" />
              <span className="hidden tabular-nums sm:inline">{c.courier_phone}</span>
              <span className="sm:hidden">{t("overdue.call")}</span>
            </a>
          )}
          <span className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 tabular-nums dark:bg-gray-800 dark:text-gray-300">
            {c.overdue_count} {t("overdue.pcs")}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium tabular-nums ${lateToneClass[lateTone(c.oldest_late_days)]}`}
          >
            <AlertTriangle className="h-3 w-3" />
            {c.oldest_late_days} {t("overdue.days")}
          </span>
          <span
            className={`rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums ${
              c.penalty_now > 0
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {formatSum(c.penalty_now)}
          </span>
        </div>
      </div>

      {/*
        ⚠️ TOR EKRANDA JADVAL EMAS, KARTALAR. Olti ustunli jadval 640px
        dan tor joyga sig'masdi: gorizontal siljish bilan ham qatorlar
        cho'zilib ketib, telefonda ro'yxat umuman o'qilmas edi. Ayni
        ma'lumot mobil uchun kartaga aylantiriladi — siljish shart emas.
      */}
      {expanded && (
        <div className="divide-y divide-gray-100 border-t border-gray-100 sm:hidden dark:divide-gray-800 dark:border-gray-800">
          {c.orders.map((o) => (
            <div key={o.id} className={`px-4 py-3 ${o.immune ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-800 tabular-nums dark:text-white">
                    #{o.order_number ?? "—"}
                  </div>
                  <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {o.market_name || "—"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {o.immune ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {t("overdue.immune")}
                    </span>
                  ) : (
                    <div className="font-semibold tabular-nums text-gray-900 dark:text-white">
                      {formatSum(o.penalty_now)} {t("currency")}
                    </div>
                  )}
                  {o.capped && !o.immune && (
                    <div className="mt-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                      {t("overdue.capped")}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="tabular-nums">
                  {t("overdue.dispatched")}: {formatDate(o.dispatched_at)}
                </span>
                <span className="tabular-nums">
                  {t("overdue.deadline")}: {formatDate(o.deadline_at)}
                </span>
                <span
                  className={`rounded-md px-1.5 py-0.5 font-semibold tabular-nums ${lateToneClass[lateTone(o.late_days)]}`}
                >
                  {o.late_days} {t("overdue.days")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && (
        <div className="hidden overflow-x-auto border-t border-gray-100 sm:block dark:border-gray-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-[#231F35] dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">{t("order")}</th>
                <th className="px-4 py-2 text-left">{t("market")}</th>
                <th className="px-4 py-2 text-left">{t("overdue.dispatched")}</th>
                <th className="px-4 py-2 text-left">{t("overdue.deadline")}</th>
                <th className="px-4 py-2 text-center">{t("overdue.lateDays")}</th>
                <th className="px-4 py-2 text-right">{t("overdue.penalty")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {c.orders.map((o) => (
                <tr
                  key={o.id}
                  className={o.immune ? "opacity-60" : undefined}
                >
                  <td className="px-4 py-2.5 font-medium text-gray-800 tabular-nums dark:text-white">
                    #{o.order_number ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                    {o.market_name || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 tabular-nums dark:text-gray-300">
                    {formatDate(o.dispatched_at)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 tabular-nums dark:text-gray-300">
                    {formatDate(o.deadline_at)}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`inline-block min-w-[2.5rem] rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${lateToneClass[lateTone(o.late_days)]}`}
                    >
                      {o.late_days}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {o.immune ? (
                      /*
                        ⚠️ Modul langaridan OLDIN jo'natilgan — shtrafga
                        tushmaydi. Buni ko'rsatmasak admin «nega bunga
                        shtraf yo'q» deb hayron bo'lardi.
                      */
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-400"
                        title={t("overdue.immuneHint")}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {t("overdue.immune")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-end gap-1.5">
                        {/*
                          ⚠️ Chegara faqat URILGANDA ko'rsatiladi. Ilgari
                          har qatorda bir xil «50 000» turardi — o'nta
                          qatorda takrorlangan son ma'lumot emas, shovqin.
                        */}
                        {o.capped && (
                          <span
                            title={t("overdue.cappedHint", {
                              cap: formatSum(o.base_tariff),
                            })}
                            className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                          >
                            <Siren className="h-3 w-3" />
                            {t("overdue.capped")}
                          </span>
                        )}
                        <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                          {formatSum(o.penalty_now)} {t("currency")}
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default memo(OverdueTab);
