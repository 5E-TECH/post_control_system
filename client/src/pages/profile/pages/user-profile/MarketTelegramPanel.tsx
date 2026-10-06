import { memo, useState } from "react";
import { Modal, Spin, Tooltip } from "antd";
import {
  Users,
  Send,
  Monitor,
  AlertTriangle,
  Unlink,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";

/**
 * MARKET TELEGRAM PANELI (admin ko'radi).
 *
 * Ikki savolga javob beradi:
 *   1. Bu marketning nechta operatori bor va ular QANDAY ulangan?
 *   2. Qaysi Telegram guruhlari biriktirilgan va ular to'g'rimi?
 *
 * ── OPERATOR TURI ────────────────────────────────────────────────────
 *
 * «Telegram» — `telegram_id` yozilgan operator: u botga kirgan.
 * «Platforma» — faqat panelda yaratilgan, botga hali kirmagan.
 *
 * ⚠️ Bu «qayerda yaratilgan» emas, «Telegram ULANGANMI» degani:
 * panelda yaratilgan operator keyin botga kirsa, u «Telegram» bo'lib
 * ko'rinadi. Amalda muhimi aynan shu — u bot orqali buyurtma
 * yarata oladimi yoki yo'q.
 */

const TYPE_LABELS: Record<string, string> = {
  create: "Yangi buyurtma",
  cancel: "Bekor qilish",
};

const fmtDate = (ms?: number) =>
  !ms
    ? "—"
    : new Date(Number(ms)).toLocaleDateString("uz-UZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

interface Op {
  id: string;
  name: string;
  phone_number: string;
  status: string;
  has_telegram: boolean;
  created_at: number;
}

interface Group {
  id: string;
  group_type: string | null;
  group_id: string;
  is_private_chat: boolean;
  /**
   * Bekor qilish xabarlarini AMALDA shu qator oladimi.
   *
   * ⚠️ `group_type` ning o'zi yetarli emas: server `cancel` uchun
   * zaxiraga ega (telegram-group.util.ts), ya'ni turi BO'SH qator ham
   * faol kanal bo'lishi mumkin.
   */
  receives_cancel: boolean;
  /** Uxlab turibdi, lekin `cancel` guruhi uzilsa faollashadi. */
  is_dormant_fallback: boolean;
  created_at: number;
}

const StatCard = ({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 px-4 py-3">
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center ${tone}`}
    >
      {icon}
    </div>
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
        {label}
      </p>
      <p className="text-xl font-bold text-gray-800 dark:text-white leading-tight">
        {value}
      </p>
    </div>
  </div>
);

const MarketTelegramPanel = ({ marketId }: { marketId: string }) => {
  const { getMarketTelegram, disconnectMarketTelegram } = useUser();
  const { data, isLoading, isError, refetch } = getMarketTelegram(marketId);
  const { handleSuccess, handleApiError } = useApiNotification();
  const [toDisconnect, setToDisconnect] = useState<Group | null>(null);

  const ops = data?.data?.operators;
  const groups: Group[] = data?.data?.groups ?? [];

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl shadow-xl p-8 flex justify-center">
        <Spin />
      </div>
    );
  }

  /**
   * ⚠️ XATO JIMGINA YASHIRILMAYDI.
   *
   * Avval bu yerda `return null` turardi — so'rov 500/403 bergan yoki
   * tarmoq uzilgan holatda panel BUTUNLAY yo'qolardi va admin sababni
   * bilmasdi. Bo'sh sonlar ko'rsatish ham yomon: «operator yo'q» degan
   * xulosaga olib borardi. Shu bois aniq xato holati chiziladi.
   *
   * React Query v5: xato holatida `isLoading=false` va `data=undefined`
   * bo'ladi, shuning uchun `isError` ALOHIDA tekshiriladi — `!ops`
   * ning o'zi «ma'lumot yo'q» va «xato» ni ajratmaydi.
   */
  if (isError || !ops) {
    return (
      <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl shadow-xl p-5 sm:p-6 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 dark:text-white">
              Telegram va operatorlar ma'lumoti yuklanmadi
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Bu operator yo'q degani EMAS — so'rov bajarilmadi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl shadow-xl overflow-hidden mb-6">
      <div className="px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/10 to-blue-500/10 flex items-center justify-center">
          <Send className="w-5 h-5 text-sky-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white">
            Telegram va operatorlar
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Operatorlar qanday ulangani va biriktirilgan guruhlar
          </p>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* ── Sonlar ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<Users className="w-5 h-5 text-indigo-500" />}
            label="Jami operator"
            value={ops.total}
            tone="bg-indigo-500/10"
          />
          <StatCard
            icon={<Send className="w-5 h-5 text-sky-500" />}
            label="Telegram orqali"
            value={ops.telegram}
            tone="bg-sky-500/10"
          />
          <StatCard
            icon={<Monitor className="w-5 h-5 text-violet-500" />}
            label="Faqat platforma"
            value={ops.platform}
            tone="bg-violet-500/10"
          />
          <StatCard
            icon={<XCircle className="w-5 h-5 text-amber-500" />}
            label="Nofaol"
            value={ops.inactive}
            tone="bg-amber-500/10"
          />
        </div>

        {/* ── Operatorlar ro'yxati ─────────────────────────────── */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-2">
            Operatorlar
          </p>
          {ops.items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-3">
              Bu marketda hali operator yo'q.
            </p>
          ) : (
            <div className="space-y-2">
              {ops.items.map((o: Op) => (
                <div
                  key={o.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                      {o.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {o.phone_number}
                    </p>
                  </div>
                  {o.status !== "active" && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                      Nofaol
                    </span>
                  )}
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 ${
                      o.has_telegram
                        ? "bg-sky-500/10 text-sky-600"
                        : "bg-violet-500/10 text-violet-600"
                    }`}
                  >
                    {o.has_telegram ? (
                      <Send className="w-3.5 h-3.5" />
                    ) : (
                      <Monitor className="w-3.5 h-3.5" />
                    )}
                    {o.has_telegram ? "Telegram" : "Platforma"}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-20 text-right">
                    {fmtDate(o.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Ulangan guruhlar ─────────────────────────────────── */}
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium mb-2">
            Ulangan Telegram guruhlari
          </p>
          {groups.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-3">
              Hech qanday guruh ulanmagan.
            </p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <div
                  key={g.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${
                    g.is_private_chat
                      ? "border-red-300 dark:border-red-800 bg-red-500/5"
                      : "border-gray-100 dark:border-gray-800"
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {/*
                      ⚠️ Turi bo'sh qator «eski, ishlatilmaydi» bo'lib
                      KO'RINMASLIGI kerak — u marketning YAGONA bekor
                      qilish kanali bo'lishi mumkin (bazada 3 marketdan
                      2 tasi aynan shunday). Shu bois amaldagi holat
                      yoziladi, taxmin emas.
                    */}
                    <p className="text-sm font-medium text-gray-800 dark:text-white">
                      {g.group_type
                        ? TYPE_LABELS[g.group_type] || g.group_type
                        : g.receives_cancel
                          ? "Turi belgilanmagan — FAOL bekor qilish kanali"
                          : "Turi belgilanmagan (ishlatilmaydi)"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                      {g.group_id}
                    </p>
                  </div>

                  {/*
                    ⚠️ Telegramda guruh id'lari MANFIY, shaxsiy chat
                    id'lari MUSBAT. Musbat qiymat — guruh emas, bir
                    odamning shaxsiy chati: market xabarlari o'shanga
                    oqadi. Bu prod bazasida haqiqatan sodir bo'lgan.
                  */}
                  {g.is_private_chat && (
                    <Tooltip title="Bu guruh emas, shaxsiy chat. Market xabarlari bir odamning shaxsiy chatiga ketyapti — uzib, guruhga qayta ulang.">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 font-medium flex items-center gap-1.5 cursor-help">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Shaxsiy chat
                      </span>
                    </Tooltip>
                  )}

                  {/*
                    ⚠️ Uxlab yotgan zaxira. Admin `cancel` guruhini uzsa,
                    xabarlar TO'XTAMAYDI — avtomatik shu qatorga o'tadi.
                    Bu belgi bo'lmasa admin "tuzatdim" deb o'ylab,
                    oqim davom etardi.
                  */}
                  {g.is_dormant_fallback && (
                    <Tooltip title="Bu qator hozir uxlab turibdi. «Bekor qilish» guruhi uzilsa, xabarlar AVTOMATIK shu yerga oqa boshlaydi.">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5 cursor-help">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Zaxira (uyg'onadi)
                      </span>
                    </Tooltip>
                  )}

                  <span className="text-xs text-gray-400 dark:text-gray-500 w-20 text-right">
                    {fmtDate(g.created_at)}
                  </span>

                  <button
                    type="button"
                    onClick={() => setToDisconnect(g)}
                    disabled={disconnectMarketTelegram.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-600 bg-red-500/10 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    <Unlink className="w-4 h-4" />
                    Uzish
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/*
        ⚠️ TASDIQLASH SHART — bu amal QAYTARIB BO'LMAYDI (jadvalda
        soft-delete yo'q). Shuningdek `create` turidagi ulanish uzilsa
        buyurtmalar endi Telegramda tasdiq kutmaydi — admin buni
        bilishi kerak.
      */}
      <Modal
        open={Boolean(toDisconnect)}
        onCancel={() => setToDisconnect(null)}
        okText="Ha, uzilsin"
        cancelText="Bekor qilish"
        okButtonProps={{ danger: true }}
        confirmLoading={disconnectMarketTelegram.isPending}
        title="Telegram guruh ulanishini uzish"
        onOk={async () => {
          if (!toDisconnect) return;
          try {
            await disconnectMarketTelegram.mutateAsync({
              id: marketId,
              connectionId: toDisconnect.id,
            });
            setToDisconnect(null);
            await refetch();
            handleSuccess("Ulanish uzildi");
          } catch (err) {
            handleApiError(err, "Ulanishni uzib bo'lmadi");
          }
        }}
      >
        <p>
          <b>{toDisconnect?.group_id}</b> guruhi marketdan uziladi va bu{" "}
          <b>qaytarib bo'lmaydi</b>.
        </p>
        {toDisconnect?.group_type === "create" && (
          <>
            <p className="mt-2 text-amber-600 dark:text-amber-400">
              Bu «yangi buyurtma» guruhi. Uzilgandan keyin buyurtmalar
              Telegramda tasdiq kutmaydi — ular to'g'ridan-to'g'ri ro'yxatga
              tushadi.
            </p>
            {/*
              ⚠️ Hozir «tasdiq kutilmoqda» (CREATED) holatidagi buyurtmalar
              bo'lsa, guruhdagi ✅/❌ tugmalari ishlamay qoladi: ruxsat
              tekshiruvi qat'iy `group_type: CREATE` qidiradi
              (order-bot.service.ts:591-597), ulanish esa o'chgan bo'ladi.
              Bunday buyurtma default ro'yxatda ham ko'rinmaydi
              (order.service.ts:249-254) — ya'ni jimgina qotib qoladi.
            */}
            <p className="mt-2 text-red-600 dark:text-red-400">
              Diqqat: hozir «tasdiq kutilmoqda» holatidagi buyurtmalar bo'lsa,
              guruhdagi tugmalari ishlamay qoladi.
            </p>
          </>
        )}

        {/*
          ⚠️ ENG MUHIM OGOHLANTIRISH — uzish HAR DOIM oqimni to'xtatmaydi.

          Server `cancel` uchun zaxiraga ega (telegram-group.util.ts):
          typed `cancel` uzilsa, turi bo'sh eski qator FAOL bo'lib qoladi.
          Bu ogohlantirish bo'lmasa admin qizil «Shaxsiy chat» belgisiga
          amal qilib uzadi, "tuzatdim" deb o'ylaydi — holbuki mijoz
          ma'lumotlari boshqa chatga oqishda davom etadi.
        */}
        {toDisconnect?.receives_cancel &&
          groups.some((g) => g.is_dormant_fallback) && (
            <p className="mt-2 text-red-600 dark:text-red-400 font-medium">
              DIQQAT: xabarlar TO'XTAMAYDI. Uzilgandan keyin bekor qilish
              xabarlari eski «turi belgilanmagan» guruhga ketadi:{" "}
              {groups
                .filter((g) => g.is_dormant_fallback)
                .map((g) => g.group_id)
                .join(", ")}
              . Oqimni butunlay to'xtatish uchun uni ham uzing.
            </p>
          )}

        {toDisconnect?.receives_cancel &&
          !groups.some((g) => g.is_dormant_fallback) && (
            <p className="mt-2 text-red-600 dark:text-red-400 font-medium">
              Bu — marketning YAGONA bekor qilish kanali. Uzilsa, bekor
              qilingan buyurtmalar haqida Telegramda umuman xabar kelmaydi —
              xato ham chiqmaydi.
            </p>
          )}

        {/*
          ⚠️ Avval bu yerda «yangi token kerak bo'ladi» deb yozilgan edi —
          bu NOTO'G'RI. Uzish tokenga umuman tegmaydi, token esa oxirgi
          muvaffaqiyatli ulanishdan keyin allaqachon aylantirilgan va
          ishlatilmagan. Admin o'sha matnga ishonib «Yangilash» bosgan
          bo'lsa, marketdagi AMALDAGI tokenni bekor qilardi.
        */}
        <p className="mt-2">
          Qayta ulash uchun market kartasidagi joriy Telegram tokeni yetarli —
          uni qayta yaratish shart emas.
        </p>
      </Modal>
    </div>
  );
};

export default memo(MarketTelegramPanel);
