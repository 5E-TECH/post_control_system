import { Alert, Button, Empty, Table, Tag } from "antd";
import { Cable, Plus } from "lucide-react";
import type { CarrierAccount } from "../../../../shared/api/hooks/useCarrierAccounts";
import { CarrierCard, CardTitle, Code, StatusTag, StepList } from "./CarrierParts";
import {
  NO_REQUEST_TEXT,
  accountState,
  dataCell,
  formatDate,
  formatTime,
  ipRules,
} from "./carrierLib";

interface Props {
  accounts: CarrierAccount[];
  onCreate: () => void;
  /** Kompaniya havolasi — akkauntni tanlaydi va uning sozlamalarini ochadi. */
  onOpen: (account: CarrierAccount) => void;
}

const CONNECT_STEPS = [
  <>
    <b>Yangi kuryer oching</b> — Foydalanuvchilar → Kuryer qo'shish. Tarif =
    kompaniyaning bir buyurtma uchun haqi; hudud bo'yicha haq kerak bo'lsa —
    super kuryer + hudud tariflari (begona tarifli pochtani bu kuryerga
    o'tkazish ham shunga bog'liq). Kuryer yangi bo'lsin: pochtasiz, kassasi 0
    va yaqinda (sessiya muddati ichida) akkauntiga hech kim kirmagan.
  </>,
  <>
    <b>Akkaunt yarating</b> va shu kuryerni tanlang. API kalit bir marta
    ko'rsatiladi — kompaniyaga xavfsiz kanal orqali bering.
  </>,
  <>
    <b>IP cheklovi</b> (ixtiyoriy) — kompaniya chiquvchi IP manzillarini
    bersa, kiriting.
  </>,
  <>
    <b>Sinov</b> — kompaniya <Code>GET /carrier/ping</Code> bilan kalitni
    tekshiradi; sinov pochtasini jo'nating: skan → sotildi → kassada kirim.
  </>,
  <>
    <b>Ish</b> — pochtalarni shu kuryerga oddiy kuryerga jo'natilgandek
    jo'nating; qaytarish pochtasini markaz qabul qiladi.
  </>,
  <>
    <b>Naqd</b> — kompaniya topshirganda kuryer kassasidan to'lov qabul
    qiling (smena ochiq bo'lishi shart).
  </>,
];

/**
 * AKKAUNTLAR — tashqi kompaniyalar ro'yxati.
 *
 * Bu bo'limda akkaunt tanlagich (Segmented) yo'q: jadvalning o'zi ro'yxat,
 * kompaniya havolasi akkauntni tanlaydi.
 */
export const CarrierAccountsTab = ({ accounts, onCreate, onOpen }: Props) => {
  const title = (
    <CardTitle
      icon={<Cable className="h-4 w-4" />}
      extra={accounts.length > 0 ? <Tag>{accounts.length} ta</Tag> : undefined}
    >
      Carrier akkauntlari
    </CardTitle>
  );

  if (accounts.length === 0) {
    return (
      <CarrierCard title={title}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Carrier akkauntlari hali yo'q"
        >
          <Button type="primary" icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
            Akkaunt yaratish
          </Button>
        </Empty>
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 className="mb-3 text-sm font-semibold">Ulanish tartibi</h3>
          <StepList items={CONNECT_STEPS} />
        </div>
      </CarrierCard>
    );
  }

  return (
    <CarrierCard
      title={title}
      extra={
        <Button type="primary" icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
          Yangi akkaunt
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Alert
          type="info"
          showIcon
          message="Tashqi kompaniya BeePost'da bitta kuryer bo'lib ishlaydi"
          description={
            <>
              Pochtalar unga oddiy kuryerga jo'natilgandek jo'natiladi. Kompaniya
              dasturchilari <Code>/api/v1/carrier/*</Code> ga{" "}
              <Code>X-Api-Key</Code> bilan murojaat qiladi: QR skan, natija
              (sotildi, qisman sotildi, bekor qilindi, orqaga qaytarish —
              rollback), bekor qilingan posilkalarni qaytarish va kassa. Sotuv
              puli shu kuryer kassasiga yoziladi — naqdni xodim oddiy kuryer
              kassasi orqali qabul qiladi.
            </>
          }
        />

        <div className="min-[901px]:overflow-x-auto">
          <Table<CarrierAccount>
            rowKey="id"
            size="small"
            dataSource={accounts}
            pagination={false}
            columns={[
              {
                title: "Kompaniya",
                key: "name",
                onCell: dataCell("Kompaniya"),
                render: (_: unknown, a) => (
                  <div className="flex flex-col items-start leading-5">
                    <Button
                      type="link"
                      className="!h-auto !p-0 !font-semibold"
                      onClick={() => onOpen(a)}
                    >
                      {a.name}
                    </Button>
                    <small className="text-xs text-gray-500 dark:text-gray-400">
                      yaratilgan {formatDate(a.created_at)}
                    </small>
                  </div>
                ),
              },
              {
                title: "Bog'langan kuryer",
                key: "courier",
                onCell: dataCell("Bog'langan kuryer"),
                render: (_: unknown, a) =>
                  a.courier ? (
                    <div className="flex flex-col leading-5">
                      <span>{a.courier.name}</span>
                      <small className="text-xs text-gray-500 dark:text-gray-400">
                        {a.courier.phone_number}
                      </small>
                    </div>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">—</span>
                  ),
              },
              {
                title: "Kalit",
                key: "key",
                onCell: dataCell("Kalit"),
                render: (_: unknown, a) => <Code>{a.api_key_masked}</Code>,
              },
              {
                title: "IP cheklovi",
                key: "ip",
                onCell: dataCell("IP cheklovi"),
                render: (_: unknown, a) => {
                  const count = ipRules(a).length;
                  return count ? (
                    `${count} ta qoida`
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">
                      cheklov yo'q
                    </span>
                  );
                },
              },
              {
                title: "Holat",
                key: "state",
                onCell: dataCell("Holat"),
                render: (_: unknown, a) => (
                  <div>
                    <StatusTag account={a} />
                    {accountState(a) === "courier_blocked" && (
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        so'rovlar 403 oladi
                      </div>
                    )}
                  </div>
                ),
              },
              {
                title: "Oxirgi so'rov",
                key: "last",
                onCell: dataCell("Oxirgi so'rov"),
                render: (_: unknown, a) =>
                  a.last_used_at ? (
                    <div className="flex flex-col leading-5">
                      <span>{formatDate(a.last_used_at)}</span>
                      <small className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(a.last_used_at)}
                      </small>
                    </div>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">
                      {NO_REQUEST_TEXT}
                    </span>
                  ),
              },
            ]}
          />
        </div>
      </div>
    </CarrierCard>
  );
};

export default CarrierAccountsTab;
