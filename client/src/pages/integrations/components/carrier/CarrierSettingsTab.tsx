import { Alert, Button, Switch, Tag, Tooltip } from "antd";
import { Network, Pencil, PlugZap, Trash2, Truck, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  CARRIER_IP_ALLOWLIST_MAX,
  type CarrierAccount,
} from "../../../../shared/api/hooks/useCarrierAccounts";
import { CarrierCard, CardTitle, CheckRow, Code, CourierRow, Note } from "./CarrierParts";
import {
  NO_REQUEST_TEXT,
  formatDateTime,
  formatDateTimeSec,
  ipKind,
  ipRules,
  isCourierBlocked,
} from "./carrierLib";

interface Props {
  account: CarrierAccount;
  statusPending: boolean;
  onToggle: (account: CarrierAccount, next: boolean) => void;
  onEdit: (account: CarrierAccount) => void;
  onDelete: (account: CarrierAccount) => void;
}

const BLOCKED_REASON_ID = "carrier-reactivate-blocked";

/**
 * SOZLAMALAR — holat (kill switch), bog'langan kuryer, IP cheklovi va
 * o'chirish. Har o'zgarish tasdiq oynasi orqali (`useCarrierActions`).
 */
export const CarrierSettingsTab = ({
  account,
  statusPending,
  onToggle,
  onEdit,
  onDelete,
}: Props) => {
  const navigate = useNavigate();
  const on = account.is_active;
  const blocked = isCourierBlocked(account);
  const rules = ipRules(account);
  /**
   * Bloklangan kuryerli to'xtatilgan akkauntni server qayta yoqmaydi
   * («Bog'langan kuryer faol emas ... kalit berilmaydi»). To'xtatish esa
   * kuryer holatidan qat'i nazar ishlaydi.
   */
  const reactivateBlocked = !on && blocked;

  return (
    <div className="flex flex-col gap-4">
      {/* ═══════ HOLAT ═══════ */}
      <CarrierCard
        title={<CardTitle icon={<PlugZap className="h-4 w-4" />}>Holat</CardTitle>}
        extra={
          <span className="flex items-center gap-2">
            {/*
              O'chiq <button> sichqoncha hodisalarini olmaydi — Tooltip
              ishga tushishi uchun `span` ichida (antd hujjatidagi naqsh).
              Klaviatura va ekran o'quvchi uchun sabab pastdagi matnda
              (`aria-describedby`).
            */}
            <Tooltip
              title={
                reactivateBlocked
                  ? "Bog'langan kuryer bloklangan — avval Foydalanuvchilar bo'limida blokdan chiqaring"
                  : undefined
              }
            >
              <span
                className={
                  reactivateBlocked
                    ? "inline-flex cursor-not-allowed [&>.ant-switch]:pointer-events-none"
                    : "inline-flex"
                }
              >
                <Switch
                  checked={on}
                  aria-label="Akkaunt holati"
                  aria-describedby={reactivateBlocked ? BLOCKED_REASON_ID : undefined}
                  disabled={reactivateBlocked}
                  loading={statusPending}
                  onChange={(next) => onToggle(account, next)}
                />
              </span>
            </Tooltip>
            <span className="text-sm">{on ? "Yoqilgan" : "To'xtatilgan"}</span>
          </span>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <CheckRow ok={on} label={on ? "Akkaunt yoqilgan" : "Akkaunt to'xtatilgan"} />
            <CheckRow
              ok={!blocked}
              label={blocked ? "Kuryer bloklangan" : "Kuryer bloklanmagan"}
            />
            <CheckRow ok label={`Kalit berilgan (${account.api_key_masked})`} />
            <CheckRow
              ok
              label={
                rules.length
                  ? `IP cheklovi: ${rules.length} ta qoida`
                  : "IP cheklovi yo'q (ixtiyoriy)"
              }
            />
          </div>
          <div className="flex flex-col gap-1 text-sm text-gray-500 dark:text-gray-400">
            <span>
              Kompaniya:{" "}
              <b className="font-medium text-gray-700 dark:text-gray-200">{account.name}</b>
            </span>
            <span>
              Yaratilgan:{" "}
              <b className="font-medium text-gray-700 dark:text-gray-200">
                {formatDateTime(account.created_at)}
              </b>
            </span>
            <span>
              Yangilangan:{" "}
              <b className="font-medium text-gray-700 dark:text-gray-200">
                {formatDateTime(account.updated_at)}
              </b>
            </span>
            <span>
              Oxirgi so'rov:{" "}
              <b className="font-medium text-gray-700 dark:text-gray-200">
                {account.last_used_at
                  ? formatDateTimeSec(account.last_used_at)
                  : NO_REQUEST_TEXT}
              </b>
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            To'xtatilsa, kompaniyaning barcha <Code>/carrier/*</Code> so'rovlari{" "}
            <b className="font-semibold text-gray-700 dark:text-gray-200">
              403 «Carrier akkaunt faol emas»
            </b>{" "}
            oladi. Kalit, kuryer va kassa joyida qoladi — qayta yoqsangiz o'sha
            kalit ishlaydi.
          </p>
        </div>
        {reactivateBlocked && (
          <p id={BLOCKED_REASON_ID} className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Qayta yoqib bo'lmaydi: bog'langan kuryer bloklangan. Avval
            Foydalanuvchilar bo'limida kuryerni blokdan chiqaring.
          </p>
        )}
      </CarrierCard>

      {/* ═══════ BOG'LANGAN KURYER ═══════ */}
      <CarrierCard
        title={<CardTitle icon={<Truck className="h-4 w-4" />}>Bog'langan kuryer</CardTitle>}
        extra={
          <Button
            icon={<Wallet className="h-4 w-4" />}
            onClick={() => navigate(`/payments/cash-detail/${account.courier_user_id}`)}
          >
            Kuryer kassasi
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <CourierRow account={account} />
          <Alert
            type="info"
            showIcon
            message="Bu kuryer akkauntiga kirib bo'lmaydi"
            description="Bog'lashda paroli tasodifiy qilindi: login, sessiyani yangilash va parol o'rnatish rad etiladi — barcha amallar faqat API kalit orqali. Kuryerni almashtirib bo'lmaydi: boshqa kuryer kerak bo'lsa, yangi akkaunt oching."
          />
          <Note>
            Sotuvda kassaga <b className="font-semibold">narx − kompaniya tarifi</b>{" "}
            yoziladi; kechikish shtrafi bu kuryerga yozilmaydi. Naqdni kompaniya
            topshirganda To'lovlar → kuryer kassasi orqali qabul qiling (smena
            ochiq bo'lishi shart). Balans manfiy bo'lsa — BeePost kompaniyaga
            qarzdor.
          </Note>
        </div>
      </CarrierCard>

      {/* ═══════ IP CHEKLOVI ═══════ */}
      <CarrierCard
        title={
          <CardTitle
            icon={<Network className="h-4 w-4" />}
            extra={
              <Tag>
                {rules.length} / {CARRIER_IP_ALLOWLIST_MAX}
              </Tag>
            }
          >
            IP cheklovi
          </CardTitle>
        }
        extra={
          <Button icon={<Pencil className="h-4 w-4" />} onClick={() => onEdit(account)}>
            O'zgartirish
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {rules.length ? (
            <ul className="flex flex-col" aria-label="Ruxsat etilgan manzillar">
              {rules.map((rule) => {
                const kind = ipKind(rule);
                return (
                  <li
                    key={rule}
                    className="flex items-center justify-between gap-3 border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-700/60"
                  >
                    <span className="font-mono text-sm break-all">{rule}</span>
                    <Tag color={kind === "IPv6" ? "blue" : undefined} className="!me-0">
                      {kind}
                    </Tag>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Alert
              type="info"
              showIcon
              message="Cheklov yo'q — kalit istalgan manzildan ishlaydi"
            />
          )}
          <Note>
            Ro'yxatdan tashqari manzildan kelgan so'rov{" "}
            <b className="font-semibold">403 «IP ruxsat etilmagan: …»</b> oladi va
            xabarda aniqlangan IP ko'rsatiladi — kompaniya shu IP'ni sizga beradi.
            IP'ni server ulanishdan (nginx yozgan manzildan) aniqlaydi; kompaniya
            yuborgan X-Forwarded-For hisobga olinmaydi. 403 xabarida 127.0.0.1
            ko'rinsa — server (nginx) sozlamasini tekshiring. Bo'sh ro'yxat —
            cheklov yo'q.
          </Note>
        </div>
      </CarrierCard>

      {/* ═══════ O'CHIRISH ═══════ */}
      <Alert
        type="error"
        showIcon
        // Telefon kengligida tugma matn ostiga tushadi (matn siqilib qolmaydi)
        // va o'ng chetda qoladi.
        className="flex-wrap gap-y-3 [&_.ant-alert-action]:!ms-auto [&_.ant-alert-content]:!basis-40"
        message="Akkauntni butunlay o'chirish"
        description="Kalit ishlamay qoladi va kuryer provayderdan bo'shatiladi. Pochta, buyurtma va kassa o'zgarmaydi."
        action={
          <Button danger icon={<Trash2 className="h-4 w-4" />} onClick={() => onDelete(account)}>
            O'chirish
          </Button>
        }
      />
    </div>
  );
};

export default CarrierSettingsTab;
