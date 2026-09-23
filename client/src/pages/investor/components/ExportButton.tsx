import { memo, useState } from "react";
import { Download } from "lucide-react";
import { saveAs } from "file-saver";
import { message } from "antd";
import { useTranslation } from "react-i18next";
import { useInvestor } from "../../../shared/api/hooks/useInvestor";
import { blobErrorMessage } from "../../../shared/helpers/download-file";

interface Props {
  scope?: "business" | "personal";
  from?: string;
  to?: string;
}

// Aggregat Excel eksport tugmasi (server render qiladi, blob yuklab olinadi).
const ExportButton = ({ scope = "business", from, to }: Props) => {
  const { t } = useTranslation(["investor"]);
  const { exportBusiness, exportMyInvestment } = useInvestor();
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const params = { startDate: from, endDate: to };
      const res =
        scope === "personal"
          ? await exportMyInvestment(params)
          : await exportBusiness(params);
      /**
       * ⚠️ `if (!res?.data)` YETARLI EMAS — `new Blob()` (0 bayt) TRUTHY.
       * Tekshiruvsiz brauzer 0 KB `.xlsx` saqlaydi va Excel «fayl
       * buzilgan» deydi: foydalanuvchi uchun «yuklandi, lekin ochilmaydi».
       */
      const body = res?.data as Blob | undefined;
      if (!(body instanceof Blob) || body.size === 0) {
        throw new Error("Server bo'sh fayl qaytardi");
      }

      const blob = new Blob([body], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const prefix = scope === "personal" ? "my-investment" : "investor";
      saveAs(blob, `${prefix}-${from || "umumiy"}.xlsx`);
    } catch (e: unknown) {
      /**
       * ⚠️ `responseType: "blob"` da XATO javobi ham Blob bo'ladi, ya'ni
       * `e.response.data.message` HAR DOIM undefined edi va foydalanuvchi
       * har qanday nosozlikda faqat umumiy «Eksport xatosi» ni ko'rardi.
       * Helper blob'ni matnga o'girib, server xabarini ajratadi.
       */
      message.error(await blobErrorMessage(e, t("exportError", "Eksport xatosi")));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors"
    >
      <Download className="w-4 h-4" />
      {loading ? t("exporting", "Yuklanmoqda...") : t("export", "Excel")}
    </button>
  );
};

export default memo(ExportButton);
