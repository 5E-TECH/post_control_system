import { useEffect, useMemo, useRef } from "react";
import { Alert, App, Form, Input, Modal, Select } from "antd";
import { Ban, User } from "lucide-react";
import {
  CARRIER_IP_ALLOWLIST_MAX,
  CARRIER_NAME_MAX_LENGTH,
  useCarrierCourierCandidates,
  useCreateCarrierAccount,
  type CarrierAccount,
  type CarrierKeyResult,
} from "../../../../shared/api/hooks/useCarrierAccounts";
import { IpAllowlistField } from "./IpAllowlistField";
import {
  DARK_COUNT_INPUT,
  courierOptions,
  errText,
  parseIpLines,
  unwrapCourierList,
} from "./carrierLib";

interface Props {
  open: boolean;
  accounts: CarrierAccount[];
  onClose: () => void;
  /** Ochiq kalit shu yerdan bir martalik oynaga ketadi. */
  onCreated: (result: CarrierKeyResult) => void;
}

interface FormValues {
  name: string;
  courier_id: string;
  ip_allowlist?: string;
}

const SELECT_EXTRA =
  "Faqat YANGI kuryer: faol, pochtasiz, kassasi 0, boshqa provayderga bog'lanmagan va yaqinda (sessiya muddati ichida) akkauntiga hech kim kirmagan.";

const DROPDOWN_FOOTER =
  "Pochtasi bor, boshqa provayderga bog'langan yoki yaqinda kirilgan kuryerni bu ro'yxat bilmaydi — server «Yaratish»da rad etadi. Bloklangan kuryerlar ro'yxatda yo'q.";

/**
 * YANGI CARRIER AKKAUNT.
 *
 * Kuryer tanlovi FAQAT frontend biladigan sabablarni o'chiradi (allaqachon
 * bog'langan, kassasi 0 emas). Qolganini (pochtasi bor, boshqa provayder,
 * yaqinda kirilgan) server tekshiradi — matni `message.error` da aynan
 * chiqadi, maydonlar oddiy holatda qoladi (BeePost naqshi).
 *
 * ⚠️ So'rov ketayotganda oynani yopib bo'lmaydi (X, Esc, «Bekor qilish»
 * o'chiq): akkaunt serverda yaratilib, kalit javobda kelganda panel
 * yopilgan/almashgan bo'lsa, kalit yo'qolardi.
 */
export const CarrierCreateModal = ({ open, accounts, onClose, onCreated }: Props) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const create = useCreateCarrierAccount();
  const pending = create.isPending;
  /**
   * Enter bilan ikki marta yuborishdan himoya — render kutmaydi (ref).
   *
   * ⚠️ Muvaffaqiyatdan keyin qulf OCHILMAYDI, oyna qayta ochilganda ochiladi:
   * yopilish animatsiyasida (~200 ms) fokus «Yaratish» da qoladi va ikkinchi
   * Enter yana POST yuborardi — server 409 «... kalitni yangilang» toast'i
   * kalit oynasi ustida chiqardi. `open` ni tekshirish yetmaydi: rc-dialog
   * yopilayotgan oyna ichini qayta render qilmaydi (`MemoChildren`), forma
   * eski `onFinish` ni chaqiradi.
   */
  const submitting = useRef(false);
  useEffect(() => {
    if (open) submitting.current = false;
  }, [open]);
  /** Har ochilishda yangidan; eski ro'yxat ko'rinib tursa ham yangilanayotgani ko'rinadi. */
  const { data: couriersData, isFetching: couriersLoading } =
    useCarrierCourierCandidates(open);

  /**
   * O'chiq variantning sababi ekran o'quvchiga ham: rc-select ro'yxat
   * elementiga `aria-*` ni o'tkazadi (aks holda faqat `label` o'qiladi).
   */
  const options = useMemo(
    () =>
      courierOptions(unwrapCourierList(couriersData), accounts).map((o) =>
        o.reason ? { ...o, "aria-label": `${o.label} — ${o.reason}` } : o,
      ),
    [couriersData, accounts],
  );

  const handleCancel = () => {
    if (pending) return;
    onClose();
  };

  const onFinish = async (values: FormValues) => {
    if (submitting.current) return;
    submitting.current = true;
    const ips = parseIpLines(values.ip_allowlist);
    try {
      const result = await create.mutateAsync({
        name: values.name.trim(),
        courier_id: values.courier_id,
        ...(ips.length ? { ip_allowlist: ips } : {}),
      });
      // Kalit mutatsiya holatida qolmasin (`gcTime: 0` — keshdan ham o'chadi).
      create.reset();
      onCreated(result);
    } catch (e) {
      submitting.current = false;
      message.error(errText(e, "Akkaunt yaratib bo'lmadi"));
    }
  };

  return (
    <Modal
      open={open}
      title="Yangi carrier akkaunt"
      okText="Yaratish"
      cancelText="Bekor qilish"
      onOk={() => form.submit()}
      onCancel={handleCancel}
      okButtonProps={{ loading: pending }}
      cancelButtonProps={{ disabled: pending }}
      closable={!pending}
      keyboard={!pending}
      maskClosable={false}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        className="!mb-4"
        message="Kuryer API'ga o'tadi va tizimga kira olmaydi"
        description="Tanlangan kuryerning paroli tasodifiy qilinadi: login, sessiya va parol o'rnatish rad etiladi. Kompaniya barcha amallarni faqat API kalit bilan bajaradi."
      />
      <Form<FormValues>
        form={form}
        name="carrierCreate"
        layout="vertical"
        onFinish={onFinish}
        requiredMark={false}
        // Oyna yopilganda (destroyOnHidden) qiymatlar ham tozalanadi.
        clearOnDestroy
      >
        <Form.Item
          name="name"
          label="Kompaniya nomi"
          rules={[{ required: true, whitespace: true, message: "Kompaniya nomini kiriting" }]}
        >
          {/* Uzunlik chegarasi — `maxLength` (server DTO bilan bir xil). */}
          <Input
            showCount
            maxLength={CARRIER_NAME_MAX_LENGTH}
            autoComplete="off"
            {...DARK_COUNT_INPUT}
          />
        </Form.Item>

        <Form.Item
          name="courier_id"
          label="Bog'lanadigan kuryer"
          extra={SELECT_EXTRA}
          rules={[{ required: true, message: "Kuryerni tanlang" }]}
        >
          <Select
            showSearch
            placeholder="Ism yoki telefon bo'yicha qidiring"
            optionFilterProp="label"
            loading={couriersLoading}
            options={options}
            notFoundContent="Faol kuryer topilmadi"
            optionRender={(opt) => {
              const reason = opt.data.reason as string | null;
              // O'chiq qator xira: `index.css` dagi `.dark .ant-select-item-option
              // {color:#fff !important}` antd'ning o'chiq rangini bosib ketadi —
              // bolaga o'z rangi beriladi (meros !important dan ustun).
              return (
                <span className="flex items-center gap-2">
                  {reason ? (
                    <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        reason
                          ? "block truncate text-black/25 dark:text-white/45"
                          : "block truncate"
                      }
                    >
                      {opt.data.label as string}
                    </span>
                    {reason && (
                      <span className="block text-xs leading-5 text-orange-700 dark:text-orange-300">
                        {reason}
                      </span>
                    )}
                  </span>
                </span>
              );
            }}
            popupRender={(menu) => (
              <>
                {menu}
                <div className="mt-1 border-t border-gray-100 px-3 pb-1 pt-1.5 text-xs leading-5 text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  {DROPDOWN_FOOTER}
                </div>
              </>
            )}
          />
        </Form.Item>

        <IpAllowlistField
          name="ip_allowlist"
          optional
          rows={3}
          placeholder="203.0.113.10"
          max={CARRIER_IP_ALLOWLIST_MAX}
        />
      </Form>
    </Modal>
  );
};

export default CarrierCreateModal;
