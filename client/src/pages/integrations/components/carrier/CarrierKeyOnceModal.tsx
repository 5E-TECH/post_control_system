import { useMemo } from "react";
import { Alert, App, Button, Divider, Input, Modal } from "antd";
import { Copy } from "lucide-react";
import type { CarrierKeyResult } from "../../../../shared/api/hooks/useCarrierAccounts";
import { Code, StepList } from "./CarrierParts";
import { apiPath, carrierApiBase } from "./carrierLib";

interface Props {
  /** `null` — oyna yopiq. Kalit faqat shu prop orqali, xotirada yashaydi. */
  issued: CarrierKeyResult | null;
  onClose: () => void;
  /**
   * Yopilish animatsiyasi tugagach — fokusni ota-komponent qaytaradi.
   * rc-dialog'ning o'z qaytarishi o'chiq (`focusTriggerAfterClose`): bu oyna
   * tasdiq/yaratish oynasi YOPILAYOTGANDA ochiladi va o'sha oynaning fokusdagi
   * tugmasini eslab qoladi — u DOM'dan chiqqach fokus <body> ga tushardi.
   */
  afterClose?: () => void;
}

/**
 * Kalit BIR MARTA ko'rsatiladigan oyna (MarketplaceSettingsTab dagi
 * SecretOnceModal naqshi).
 *
 * ⚠️ Kalit boshqa hech qayerda olinmaydi — bazada faqat xeshi. Shuning
 * uchun X ham, «Bekor qilish» ham, fon/Esc bilan yopish ham yo'q: admin
 * ataylab «Nusxaladim, yopish» ni bosadi. Yopilganda ota-komponent kalitni
 * holatdan o'chiradi, `destroyOnHidden` esa DOM'dagi nusxani yo'qotadi.
 */
export const CarrierKeyOnceModal = ({ issued, onClose, afterClose }: Props) => {
  const { message } = App.useApp();
  const apiBase = useMemo(() => carrierApiBase(), []);
  const key = issued?.api_key ?? "";
  const account = issued?.account;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(key);
      message.success("Nusxalandi");
    } catch {
      message.error("Nusxalab bo'lmadi — kalitni qo'lda belgilab nusxalang");
    }
  };

  return (
    <Modal
      open={Boolean(issued)}
      title="API kalit — faqat shu yerda"
      closable={false}
      maskClosable={false}
      keyboard={false}
      destroyOnHidden
      onCancel={onClose}
      focusTriggerAfterClose={false}
      afterClose={afterClose}
      footer={
        <Button type="primary" onClick={onClose}>
          Nusxaladim, yopish
        </Button>
      }
    >
      <Alert
        type="warning"
        showIcon
        className="!mb-3"
        message="Kalit qayta ko'rsatilmaydi — hozir nusxalab, kompaniyaga xavfsiz kanal orqali bering. Yo'qolsa, faqat yangilash mumkin."
      />
      <div className="flex items-start gap-2">
        <label className="sr-only" htmlFor="carrier-new-key">
          Yangi API kalit
        </label>
        {/*
          ⚠️ `autoSize` ATAYLAB YO'Q: rc-textarea o'lchash uchun
          `document.body` ga yashirin <textarea> qo'shadi va unga oxirgi
          qiymatni yozib QOLDIRADI — kalit oyna yopilgandan keyin ham DOM'da
          turardi (test bilan topilgan). 2 qator kalitga yetadi.
        */}
        <Input.TextArea
          id="carrier-new-key"
          value={key}
          readOnly
          rows={2}
          spellCheck={false}
          className="!font-mono !text-xs !leading-4 [word-break:break-all]"
        />
        <Button
          icon={<Copy className="h-4 w-4" />}
          aria-label="Kalitni nusxalash"
          onClick={copy}
        />
      </div>
      {account && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Akkaunt: {account.name} · kuryer: {account.courier?.name ?? "—"} ·
          ro'yxatda {account.api_key_masked} bo'lib ko'rinadi
        </p>
      )}
      <Divider className="!my-4" />
      <h3 className="mb-3 text-sm font-semibold">Kompaniya dasturchisiga yuboring</h3>
      <StepList
        items={[
          <>
            API manzili (base URL): <Code>{apiBase}</Code>
          </>,
          <>
            Har so'rovda HTTP sarlavha (header): <Code>X-Api-Key: &lt;kalit&gt;</Code>
          </>,
          <>
            Tekshirish: <Code>GET /carrier/ping</Code> → 200
          </>,
          <>
            Hujjat: <Code>{apiPath(apiBase)}/carrier-docs</Code> — login va parolni
            alohida bering
          </>,
        ]}
      />
    </Modal>
  );
};

export default CarrierKeyOnceModal;
