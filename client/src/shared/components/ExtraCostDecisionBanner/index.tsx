import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Bell, Camera, ChevronRight } from "lucide-react";
import type { RootState } from "../../../app/store";
import { useExtraCost } from "../../api/hooks/useExtraCost";

/**
 * KURYERGA QAROR HAQIDA XABAR — banner.
 *
 * ⚠️ NEGA BANNER, TELEGRAM EMAS. Tizimda kuryerga Telegram orqali xabar
 * yuborishning hech qanday yo'li YO'Q: `users.telegram_id` faqat MARKET va
 * OPERATOR rollari uchun to'ldiriladi (kod boshqa rollarni ochiq rad etadi),
 * WebSocket gateway esa amalda o'lik (server hech qachon emit qilmaydi,
 * frontendda `socket.io-client` o'rnatilmagan ham).
 *
 * Shu sababli kuryer qarorni bilishining YAGONA ishonchli yo'li — u kuniga
 * bir necha marta ochadigan ekranlarda ko'rinadigan belgi.
 *
 * Banner `seen_by_courier_at` bilan boshqariladi: kuryer so'rovlar sahifasini
 * ochsa, u yopiladi va qayta chiqmaydi.
 */
const ExtraCostDecisionBanner = () => {
  const navigate = useNavigate();
  const role = useSelector((s: RootState) => s.roleSlice.role);
  const { getCourierCounts } = useExtraCost();

  const { data } = getCourierCounts(role === "courier");
  const unseen = Number(data?.unseen ?? 0);
  const needProof = Number(data?.awaiting_proof ?? 0);

  if (role !== "courier" || (unseen <= 0 && needProof <= 0)) return null;

  /**
   * ⚠️ ISBOT TALABI BIRINCHI O'RINDA.
   *
   * Ko'rilmagan qaror — shunchaki xabar. Isbot biriktirmaslik esa PUL
   * YO'QOTISH: so'rov marketga umuman yuborilmaydi va 24 soatdan keyin
   * bekor bo'ladi. Shuning uchun ikkalasi bir vaqtda bo'lsa, bannerda
   * isbot haqidagi matn ko'rsatiladi.
   */
  const urgent = needProof > 0;

  return (
    <button
      type="button"
      onClick={() => navigate("/my-extra-cost")}
      className={`mb-4 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
        urgent
          ? "border-orange-300 bg-orange-50 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-900/20 dark:hover:bg-orange-900/30"
          : "border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            urgent ? "bg-orange-500/20" : "bg-amber-500/20"
          }`}
        >
          {urgent ? (
            <Camera className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          ) : (
            <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div>
          <div
            className={`text-sm font-medium ${
              urgent
                ? "text-orange-800 dark:text-orange-300"
                : "text-amber-800 dark:text-amber-300"
            }`}
          >
            {urgent
              ? `${needProof} ta xarajatga isbot biriktirish kerak`
              : `${unseen} ta qo'shimcha xarajat so'rovingiz bo'yicha qaror bor`}
          </div>
          <div
            className={`text-[11px] ${
              urgent
                ? "text-orange-700 dark:text-orange-400"
                : "text-amber-700 dark:text-amber-400"
            }`}
          >
            {urgent
              ? "Biriktirilmasa 24 soatdan keyin bekor bo'ladi"
              : "Ko'rish uchun bosing"}
          </div>
        </div>
      </div>
      <ChevronRight
        className={`h-4 w-4 shrink-0 ${
          urgent
            ? "text-orange-600 dark:text-orange-400"
            : "text-amber-600 dark:text-amber-400"
        }`}
      />
    </button>
  );
};

export default memo(ExtraCostDecisionBanner);
