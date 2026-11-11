import { App, type ModalFuncProps } from "antd";
import { Trash2 } from "lucide-react";
import {
  useRemoveCarrierAccount,
  useRotateCarrierKey,
  useSetCarrierStatus,
  type CarrierAccount,
  type CarrierKeyResult,
} from "../../../../shared/api/hooks/useCarrierAccounts";
import { Bullets, Code } from "./CarrierParts";
import { errText } from "./carrierLib";

interface Options {
  /** Yangi kalit — faqat xotirada, bir martalik oynaga uzatiladi. */
  onKeyIssued: (result: CarrierKeyResult) => void;
  onDeleted: () => void;
}

/** `modal.confirm(...)` qaytaradigan boshqaruvchi. */
interface ConfirmInstance {
  update: (config: ModalFuncProps) => void;
}

/**
 * So'rov ketgach tasdiq oynasini «Bekor qilish» / Esc bilan yopib
 * bo'lmasin: aks holda admin «bekor qildim» deb o'ylaydi, server esa
 * baribir bajaradi (kalit almashadi — eski kalit o'ladi, akkaunt
 * o'chadi). `onOk` boshida chaqiriladi; antd OK tugmasini o'zi `loading`
 * qiladi, promise tugagach oyna yopiladi.
 */
const lockWhilePending = (instance: ConfirmInstance) =>
  instance.update({ cancelButtonProps: { disabled: true }, keyboard: false });

/**
 * Tasdiq oynasi amalni FAQAT BIR MARTA bajaradi.
 *
 * ⚠️ antd OK tugmasi (`ActionButton`) qulfini promise tugashi bilan ochadi,
 * oyna esa yana ~200 ms yopilish animatsiyasida turadi: `pointer-events:
 * none` sichqonchani to'sadi, klaviaturani emas — fokus OK'da qoladi va
 * odatdagi ikkinchi Enter amalni qayta yuborardi (ikkinchi rotate-key:
 * hozirgina ko'rsatilgan kalit o'ladi; o'chirishda 404 toast). Xatoda ham
 * oyna yopiladi (xato ushlanadi), shuning uchun qulf boshidayoq qo'yiladi.
 * jsdom'da animatsiya yo'q — `CarrierMotion.test.tsx` shuni tekshiradi.
 */
const once = (action: () => Promise<void>) => {
  let started = false;
  return async () => {
    if (started) return;
    started = true;
    await action();
  };
};

/**
 * Har tasdiq shu kalitlar BILAN ochiladi: antd `ConfirmDialog` konfiguratsiya
 * qiymatlarini `useMemo` bog'liqligi qiladi — `update` yangi kalit qo'shsa,
 * React «useMemo deps changed size» deb ogohlantiradi.
 */
const UNLOCKED: ModalFuncProps = {
  cancelButtonProps: { disabled: false },
  keyboard: true,
};

/**
 * Qaytarib bo'lmaydigan yoki kompaniyani to'xtatadigan amallar — har biri
 * TASDIQ oynasi orqali (kalitni yangilash, to'xtatish, qayta yoqish,
 * o'chirish). Sozlamalar va Kalit bo'limlari umumiy ishlatadi.
 *
 * ⚠️ `App.useApp()` — statik `Modal.confirm`/`message` emas: statik
 * chaqiruvlar `ConfigProvider` mavzusini olmaydi va qorong'i rejimda oq
 * chiqardi. Panel `<App component={false}>` ichida render qilinadi.
 *
 * ⚠️ Xato ushlanadi va toast'da server matni chiqadi: `onOk` dan rad
 * etilgan promise qaytsa, antd uni jimgina yutardi (MarketplaceSettingsTab
 * dagi saboq). Xatoda ham ro'yxat qayta so'raladi (hook `onSettled`).
 */
export const useCarrierActions = ({ onKeyIssued, onDeleted }: Options) => {
  const { modal, message } = App.useApp();
  const rotateKey = useRotateCarrierKey();
  const setStatus = useSetCarrierStatus();
  const remove = useRemoveCarrierAccount();

  const confirmRotate = (account: CarrierAccount) => {
    const instance: ConfirmInstance = modal.confirm({
      ...UNLOCKED,
      title: "Kalitni yangilaysizmi?",
      content: (
        <div className="space-y-2 text-sm">
          <p>
            {account.name} uchun yangi kalit yaratiladi va bir marta
            ko'rsatiladi.
          </p>
          <Bullets
            items={[
              <>
                Eski kalit ({account.api_key_masked}) <b>darhol</b> ishlamay
                qoladi — kompaniya yangisini qo'ymaguncha so'rovlari 401 «X-Api-Key
                yo'q yoki yaroqsiz» oladi.
              </>,
              "Kompaniya dasturchisi bilan vaqtni oldindan kelishib oling.",
            ]}
          />
        </div>
      ),
      okText: "Ha, yangilash",
      okButtonProps: { danger: true },
      cancelText: "Bekor qilish",
      onOk: once(async () => {
        lockWhilePending(instance);
        try {
          const result = await rotateKey.mutateAsync(account.id);
          // Kalit mutatsiya holatida qolmasin (`gcTime: 0` — keshdan ham o'chadi).
          rotateKey.reset();
          onKeyIssued(result);
        } catch (e) {
          message.error(
            errText(
              e,
              "Kalitni yangilab bo'lmadi — kalit serverda almashgan bo'lishi mumkin: ro'yxatdagi niqoblangan kalitni tekshiring",
            ),
          );
        }
      }),
    });
    return instance;
  };

  const confirmStatus = (account: CarrierAccount, next: boolean) => {
    const config: ModalFuncProps = next
      ? {
          title: `${account.name} akkauntini qayta yoqasizmi?`,
          content: (
            <div className="text-sm">
              <Bullets
                items={[
                  <>
                    <b>Eski</b> kalit ({account.api_key_masked}) yana ishlay
                    boshlaydi — yangi kalit chiqarilmaydi.
                  </>,
                  "Kalit sizib chiqqan bo'lishi mumkin bo'lsa, avval «Kalit» bo'limida yangilang.",
                ]}
              />
            </div>
          ),
          okText: "Ha, qayta yoqish",
        }
      : {
          title: `${account.name} akkauntini to'xtatasizmi?`,
          content: (
            <div className="text-sm">
              <Bullets
                items={[
                  <>
                    Kompaniyaning barcha <Code>/carrier/*</Code> so'rovlari 403
                    «Carrier akkaunt faol emas» oladi: skan, holat yuborish,
                    ro'yxat, kassa, qaytarish.
                  </>,
                  "Kalit, kuryer, pochtalar va kassa joyida qoladi. Kompaniya qo'lidagi posilkalar o'z holicha turadi.",
                  "Xodimlar bu kuryerga pochta jo'nata oladi — to'xtatilgan paytda jo'natmang: kompaniya ularni skanerlay olmaydi.",
                  "Naqdni kuryer kassasi orqali qabul qilish ishlashda davom etadi.",
                  "Istalgan vaqtda o'sha kalit bilan qayta yoqish mumkin.",
                ]}
              />
            </div>
          ),
          okText: "Ha, to'xtatish",
          okButtonProps: { danger: true },
        };

    const instance: ConfirmInstance = modal.confirm({
      ...UNLOCKED,
      ...config,
      cancelText: "Bekor qilish",
      onOk: once(async () => {
        lockWhilePending(instance);
        try {
          await setStatus.mutateAsync({ id: account.id, is_active: next });
          message.success(next ? "Akkaunt qayta yoqildi" : "Akkaunt to'xtatildi");
        } catch (e) {
          message.error(errText(e, "Holatni o'zgartirib bo'lmadi"));
        }
      }),
    });
    return instance;
  };

  const confirmDelete = (account: CarrierAccount) => {
    const instance: ConfirmInstance = modal.confirm({
      ...UNLOCKED,
      title: `${account.name} akkauntini butunlay o'chirasizmi?`,
      icon: (
        <span className="anticon">
          <Trash2 className="h-5 w-5 text-red-500" aria-hidden="true" />
        </span>
      ),
      content: (
        <div className="text-sm">
          <Bullets
            items={[
              "Kalit butunlay ishlamay qoladi, akkaunt ro'yxatdan yo'qoladi. Qaytarib bo'lmaydi.",
              `Kuryer «${
                account.courier?.name ?? "—"
              }» provayderdan bo'shatiladi va oddiy kuryerga qaytadi: shtrafdan ozodlik va avtomatik qo'shimcha xarajat qoidasi o'chadi.`,
              <>
                Pochtalar, buyurtmalar va kassa <b>o'zgarmaydi</b> — ularni
                odatdagi oqim bilan yoping: superadmin pochtani boshqa kuryerga
                o'tkazadi, kassani topshiring.
              </>,
              "Kuryer paroli tasodifiyligicha qoladi; kerak bo'lsa Foydalanuvchilar bo'limida yangi parol qo'yiladi.",
            ]}
          />
        </div>
      ),
      okText: "Ha, o'chirish",
      okButtonProps: { danger: true },
      cancelText: "Bekor qilish",
      onOk: once(async () => {
        lockWhilePending(instance);
        try {
          const res = await remove.mutateAsync(account.id);
          message.success(
            res?.courier_released === false
              ? "Akkaunt o'chirildi. Kuryer provayderi oldinroq o'zgartirilgan edi — unga tegilmadi"
              : "Akkaunt o'chirildi — kuryer provayderdan bo'shatildi",
          );
          onDeleted();
        } catch (e) {
          message.error(errText(e, "Akkauntni o'chirib bo'lmadi"));
        }
      }),
    });
    return instance;
  };

  return {
    confirmRotate,
    confirmStatus,
    confirmDelete,
    statusPending: setStatus.isPending,
    rotatePending: rotateKey.isPending,
  };
};
