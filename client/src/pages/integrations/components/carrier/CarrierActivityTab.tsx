import { useEffect, useState } from "react";
import { Alert, Empty, Table, Tag } from "antd";
import { Activity, History } from "lucide-react";
import {
  CARRIER_ACTIVITY_LIMIT,
  CARRIER_LIST_REFETCH_MS,
  useCarrierAccountActivity,
  type CarrierAccount,
  type CarrierActivityLog,
} from "../../../../shared/api/hooks/useCarrierAccounts";
import { ROLE_LABEL } from "../../../../shared/const/role-labels";
import { CarrierCard, CardTitle } from "./CarrierParts";
import {
  ACTIVITY_ACTIONS,
  NO_REQUEST_TEXT,
  activityDiff,
  dataCell,
  errText,
  formatDateTime,
  formatDateTimeSec,
  timeAgo,
} from "./carrierLib";

interface Props {
  account: CarrierAccount;
}

/**
 * «N daqiqa oldin» yangilanib tursin — ro'yxat ham shu oraliqda qayta
 * so'raladi (`CARRIER_LIST_REFETCH_MS`), `last_used_at` o'zi ham yangilanadi.
 */
const useNow = (intervalMs: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
};

/**
 * FAOLLIK — backend bergan ikki narsa: `last_used_at` va akkaunt tarixi
 * (tizim jurnali, `entity_type = 'CarrierAccount'`). Kompaniyaning
 * buyurtmalar bo'yicha amallari har buyurtma tarixida — bu yerda emas.
 */
export const CarrierActivityTab = ({ account }: Props) => {
  const history = useCarrierAccountActivity(account.id);
  const logs = history.data?.logs ?? [];
  const total = history.data?.total ?? 0;
  const last = account.last_used_at;
  const now = useNow(CARRIER_LIST_REFETCH_MS);

  return (
    <div className="flex flex-col gap-4">
      <CarrierCard title={<CardTitle icon={<Activity className="h-4 w-4" />}>Oxirgi so'rov</CardTitle>}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold">
              {last ? formatDateTimeSec(last) : NO_REQUEST_TEXT}
            </span>
            {last && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {timeAgo(last, now)}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kalit, IP va kuryer tekshiruvidan o'tgan oxirgi so'rov vaqti. Bazaga
            daqiqasiga ko'pi bilan bir marta yoziladi.
          </p>
        </div>
      </CarrierCard>

      <CarrierCard
        title={<CardTitle icon={<History className="h-4 w-4" />}>Akkaunt tarixi</CardTitle>}
        extra={
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Tizim jurnali · CarrierAccount
          </span>
        }
      >
        {history.isError ? (
          <Alert
            type="error"
            showIcon
            message="Tarixni yuklab bo'lmadi"
            description={errText(history.error, "Tizim jurnaliga so'rov bajarilmadi")}
          />
        ) : !history.isLoading && logs.length === 0 ? (
          // Jadval tashqarisida: ≤900px kartochka ko'rinishida bo'sh qator
          // yorliqsiz ustun bilan chiqmaydi.
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Tarix yo'q" />
        ) : (
          <div className="min-[901px]:overflow-x-auto">
            <Table<CarrierActivityLog>
              rowKey="id"
              size="small"
              loading={history.isLoading}
              dataSource={logs}
              pagination={false}
              // Yuklanayotganda «Tarix yo'q» ko'rinmasin (hali ma'lum emas).
              locale={{ emptyText: " " }}
              columns={[
                {
                  title: "Vaqt",
                  key: "time",
                  onCell: dataCell("Vaqt"),
                  render: (_: unknown, r) => (
                    <span className="whitespace-nowrap">{formatDateTime(r.created_at)}</span>
                  ),
                },
                {
                  title: "Amal",
                  key: "action",
                  onCell: dataCell("Amal"),
                  render: (_: unknown, r) => {
                    const cfg = ACTIVITY_ACTIONS[r.action];
                    return <Tag color={cfg?.color}>{cfg?.label ?? r.action}</Tag>;
                  },
                },
                {
                  title: "Tavsif",
                  key: "desc",
                  onCell: dataCell("Tavsif"),
                  render: (_: unknown, r) => {
                    const diff = activityDiff(r);
                    return (
                      <div>
                        <div>{r.description ?? "—"}</div>
                        {diff && (
                          <div className="mt-0.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                            {diff}
                          </div>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: "Kim",
                  key: "who",
                  onCell: dataCell("Kim"),
                  render: (_: unknown, r) => (
                    <div className="flex flex-col leading-5">
                      <span>{r.user_name || "—"}</span>
                      {r.user_role && (
                        <small className="text-xs text-gray-500 dark:text-gray-400">
                          {ROLE_LABEL[r.user_role] || r.user_role}
                        </small>
                      )}
                    </div>
                  ),
                },
              ]}
            />
            {total > logs.length && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Oxirgi {CARRIER_ACTIVITY_LIMIT} ta yozuv ko'rsatildi (jami {total}). To'liq
                tarix — Sozlamalar → Tizim jurnallari.
              </p>
            )}
          </div>
        )}
      </CarrierCard>

      <Alert
        type="info"
        showIcon
        message={`Kompaniyaning buyurtmalar bo'yicha amallari har bir buyurtma tarixida yoziladi — masalan «Carrier API (${account.name}): sold». Pul harakati — kuryer kassasi tarixida.`}
      />
    </div>
  );
};

export default CarrierActivityTab;
