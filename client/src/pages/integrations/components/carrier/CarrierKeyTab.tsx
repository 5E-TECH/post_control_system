import { useMemo, type ReactNode } from "react";
import { Alert, App, Button, Table, Tag } from "antd";
import { Code as CodeIcon, Copy, ExternalLink, KeyRound, RefreshCcwDot } from "lucide-react";
import type { CarrierAccount } from "../../../../shared/api/hooks/useCarrierAccounts";
import { CarrierCard, CardTitle, Code, StepList } from "./CarrierParts";
import { apiPath, carrierApiBase, dataCell, isCourierBlocked } from "./carrierLib";

interface Props {
  account: CarrierAccount;
  rotatePending: boolean;
  onRotate: (account: CarrierAccount) => void;
}

/** Serverdagi `assertCourierActiveForAccount` matni — aynan. */
const BLOCK_REASON =
  "Bog'langan kuryer faol emas (bloklangan, o'chirilgan yoki boshqa provayderga o'tkazilgan) — kalit berilmaydi";

const BLOCKED_ALERT_ID = "carrier-key-blocked-reason";

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  desc: string;
}

const ENDPOINTS: Endpoint[] = [
  { method: "POST", path: "/carrier/scan", desc: "QR skan → buyurtma ma'lumoti; posilka «kutilmoqda»ga o'tadi" },
  { method: "POST", path: "/carrier/orders/:id/status", desc: "sold · partly_sold · cancelled · rollback; Idempotency-Key majburiy" },
  { method: "GET", path: "/carrier/orders", desc: "Solishtirish uchun ro'yxat (sahifalab)" },
  { method: "GET", path: "/carrier/cashbox", desc: "Kuryer kassasi balansi va tarixi (ko'pi bilan 92 kun)" },
  { method: "POST", path: "/carrier/returns", desc: "Bekor qilingan posilkalarni qaytarish (1–50 ta)" },
  { method: "GET", path: "/carrier/ping", desc: "Kalitni tekshirish" },
];

/** Kompaniya dasturchisiga beriladigan ma'lumot — kalit sahifasining pastida. */
const DeveloperCard = () => {
  const { message } = App.useApp();
  const apiBase = useMemo(() => carrierApiBase(), []);
  const path = apiPath(apiBase);

  const copyBase = async () => {
    try {
      await navigator.clipboard.writeText(apiBase);
      message.success("Nusxalandi");
    } catch {
      message.error("Nusxalab bo'lmadi — manzilni qo'lda belgilang");
    }
  };

  const rows: { term: string; value: ReactNode }[] = [
    {
      term: "API manzili (base URL)",
      value: (
        <>
          <Code>{apiBase}</Code>
          <Button
            icon={<Copy className="h-4 w-4" />}
            aria-label="API manzilini nusxalash"
            onClick={copyBase}
          />
        </>
      ),
    },
    {
      term: "HTTP sarlavha (header)",
      value: (
        <>
          <Code>X-Api-Key: bpc_…</Code>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            har so'rovda; JWT ishlatilmaydi
          </span>
        </>
      ),
    },
    {
      term: "Hujjat (Swagger)",
      value: (
        <>
          <a
            href={`${apiBase}/carrier-docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
          >
            {path}/carrier-docs
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            login va parol — serverdagi CARRIER_DOCS_USER (sukut: carrier) /
            CARRIER_DOCS_PASSWORD; prod'da faqat CARRIER_DOCS_ENABLED va parol
            berilganda ochiladi
          </span>
        </>
      ),
    },
    {
      term: "OpenAPI (JSON)",
      value: (
        <>
          <Code>{path}/carrier-docs-json</Code>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Postman / kod generatori uchun
          </span>
        </>
      ),
    },
    {
      term: "Tekshirish",
      value: (
        <>
          <Code>GET /carrier/ping</Code>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            → 200 bo'lsa kalit ishlayapti
          </span>
        </>
      ),
    },
    {
      term: "Limit",
      value: (
        <>
          <span>
            sukut bo'yicha: akkaunt uchun daqiqasiga 120 so'rov · bitta IP'dan
            daqiqasiga 600 (kalit tekshiruvidan oldin) · oshsa 429 + Retry-After
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            CARRIER_THROTTLE_LIMIT / CARRIER_IP_THROTTLE_LIMIT bilan o'zgaradi
          </span>
        </>
      ),
    },
  ];

  return (
    <CarrierCard
      title={<CardTitle icon={<CodeIcon className="h-4 w-4" />}>Kompaniya dasturchisi uchun</CardTitle>}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Kontrakt Elchi bilan bir xil; farq —{" "}
          <b className="font-semibold text-gray-700 dark:text-gray-200">API manzili</b>,{" "}
          <b className="font-semibold text-gray-700 dark:text-gray-200">kalit</b> (
          <Code>elc_</Code> → <Code>bpc_</Code>) va{" "}
          <b className="font-semibold text-gray-700 dark:text-gray-200">BeePost profili</b>{" "}
          (CARRIER_API.md, Ilova A).
        </p>
        <dl>
          {rows.map((r) => (
            <div
              key={r.term}
              className="grid items-center gap-x-4 gap-y-1 border-b border-gray-100 py-2.5 last:border-b-0 md:grid-cols-[200px_minmax(0,1fr)] dark:border-gray-700/60"
            >
              <dt className="text-sm text-gray-600 dark:text-gray-300">{r.term}</dt>
              <dd className="flex min-w-0 flex-wrap items-center gap-2 text-sm">{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="min-[901px]:overflow-x-auto">
          <Table<Endpoint>
            rowKey="path"
            size="small"
            pagination={false}
            dataSource={ENDPOINTS}
            columns={[
              {
                title: "Metod",
                dataIndex: "method",
                onCell: dataCell("Metod"),
                render: (m: Endpoint["method"]) => (
                  <Tag color={m === "GET" ? "blue" : "purple"}>{m}</Tag>
                ),
              },
              {
                title: "Yo'l",
                dataIndex: "path",
                onCell: dataCell("Yo'l"),
                render: (p: string) => (
                  <span className="font-mono text-[13px] [overflow-wrap:anywhere]">{p}</span>
                ),
              },
              {
                title: "Nima qiladi",
                dataIndex: "desc",
                onCell: dataCell("Nima qiladi"),
              },
            ]}
          />
        </div>
      </div>
    </CarrierCard>
  );
};

/**
 * KALIT — joriy kalit (niqoblangan), yangilash va dasturchi uchun ma'lumot.
 *
 * Kalit hech qachon qayta ko'rsatilmaydi: bazada faqat SHA-256 xeshi va
 * oxirgi 4 belgi. Bloklangan kuryerga server yangi kalit bermaydi — tugma
 * o'chiq va sababi yonida.
 */
export const CarrierKeyTab = ({ account, rotatePending, onRotate }: Props) => {
  const blocked = isCourierBlocked(account);

  return (
    <div className="flex flex-col gap-4">
      {blocked && (
        <Alert
          id={BLOCKED_ALERT_ID}
          type="warning"
          showIcon
          message="Bog'langan kuryer bloklangan — kalitni yangilab ham, to'xtatilgandan keyin qayta yoqib ham bo'lmaydi"
          // Server guard'i avval akkaunt holatini tekshiradi, kuryerni keyin:
          // to'xtatilgan akkaunt kompaniyaga boshqa 403 xabarini beradi.
          description={`Server ikkalasini rad etadi: «${BLOCK_REASON}». ${
            account.is_active
              ? "Hozir kompaniyaning barcha so'rovlari 403 «Bog'langan kuryer faol emas — BeePost operatoriga murojaat qiling» oladi."
              : "Akkaunt to'xtatilgan — kompaniyaning barcha so'rovlari 403 «Carrier akkaunt faol emas» oladi."
          }`}
        />
      )}

      <CarrierCard
        title={<CardTitle icon={<KeyRound className="h-4 w-4" />}>API kalit</CardTitle>}
        extra={
          <Button
            danger
            icon={<RefreshCcwDot className="h-4 w-4" />}
            disabled={blocked}
            aria-describedby={blocked ? BLOCKED_ALERT_ID : undefined}
            loading={rotatePending}
            onClick={() => onRotate(account)}
          >
            Kalitni yangilash
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Alert
            type="info"
            showIcon
            message="Kalit hech qachon qayta ko'rsatilmaydi"
            description="Bazada faqat SHA-256 xeshi saqlanadi, ro'yxatda — oxirgi 4 belgi. Yo'qolgan kalitni tiklab bo'lmaydi, faqat yangilanadi: yangisi bir marta chiqadi va eski kalit o'sha zahoti ishlamay qoladi."
          />
          <p className="font-mono text-xs text-gray-500 dark:text-gray-400">
            Joriy: {account.api_key_masked}
          </p>
          {blocked ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
              <h3 className="mb-3 text-sm font-semibold">
                Kalit sizib chiqqan bo'lsa — shu tartibda
              </h3>
              <StepList
                items={[
                  <>
                    Sozlamalar → akkauntni <b>to'xtating</b> — kuryer holatidan
                    qat'i nazar ishlaydi.
                  </>,
                  <>
                    Foydalanuvchilar → kuryerni <b>blokdan chiqaring</b>. Akkaunt
                    to'xtatilgani uchun eski kalit baribir 403 oladi.
                  </>,
                  <>
                    Shu yerda <b>kalitni yangilang</b> — to'xtatilgan akkauntda
                    ham mumkin. Yangi kalitni kompaniyaga bering.
                  </>,
                  <>
                    Sozlamalar → akkauntni <b>qayta yoqing</b>.
                  </>,
                ]}
              />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Yoki akkauntni o'chiring — kalit butunlay ishlamay qoladi.
              </p>
            </div>
          ) : (
            <Alert
              type="warning"
              showIcon
              message={
                <>
                  Kuryer bloklansa, kalit darhol to'xtaydi — lekin kuryer
                  blokdan chiqarilsa, <b>eski</b> kalit ham yana ishlaydi
                </>
              }
              description="Kalit sizib chiqqan bo'lishi mumkin bo'lsa, bloklashning o'zi yetmaydi — kalitni yangilang. Kuryer allaqachon bloklangan bo'lsa, server yangi kalit bermaydi: avval akkauntni to'xtating, kuryerni blokdan chiqaring, kalitni yangilang va qayta yoqing. Yoki akkauntni o'chiring."
            />
          )}
        </div>
      </CarrierCard>

      <DeveloperCard />
    </div>
  );
};

export default CarrierKeyTab;
