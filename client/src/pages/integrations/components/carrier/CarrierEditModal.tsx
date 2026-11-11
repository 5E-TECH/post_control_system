import { useEffect, useLayoutEffect, useRef } from "react";
import { Alert, App, Form, Input, Modal, type FormInstance } from "antd";
import {
  CARRIER_IP_ALLOWLIST_MAX,
  CARRIER_NAME_MAX_LENGTH,
  useUpdateCarrierAccount,
  type CarrierAccount,
} from "../../../../shared/api/hooks/useCarrierAccounts";
import { CourierRow } from "./CarrierParts";
import { IpAllowlistField } from "./IpAllowlistField";
import { DARK_COUNT_INPUT, editPatch, errText, ipRules } from "./carrierLib";

interface Props {
  open: boolean;
  /**
   * Tahrirlanayotgan akkaunt — oyna ochilgandagi ko'rinish. Ota-komponent
   * uni `afterClose` gacha saqlaydi: yopilish animatsiyasida sarlavha va
   * forma bo'shab qolmaydi.
   */
  account: CarrierAccount | null;
  onClose: () => void;
  afterClose: () => void;
}

interface FormValues {
  name: string;
  ip_allowlist?: string;
}

const formValuesOf = (account: CarrierAccount): FormValues => ({
  name: account.name,
  ip_allowlist: ipRules(account).join("\n"),
});

/**
 * Forma ICHIDA mount bo'lganda akkaunt qiymatlarini qayta yozadi.
 *
 * ⚠️ `main.tsx` — `<StrictMode>`: dev'da React yangi mount bo'lgan daraxt
 * effektlarini "o'chirib-yoqib" ko'radi. Form'ning `clearOnDestroy` tozalashi
 * shu soxta o'chirishda store'ni `{}` qiladi, `initialValues` esa faqat
 * birinchi render'da qo'llanadi — maydonlar bo'sh qolardi. Bu komponent
 * o'sha daraxtda bo'lgani uchun uning layout effekti tozalashdan KEYIN qayta
 * ishlaydi (va bo'yashdan oldin — eski qiymat miltillamaydi).
 */
const ApplyAccountValues = ({
  form,
  values,
}: {
  form: FormInstance<FormValues>;
  values: FormValues;
}) => {
  useLayoutEffect(() => {
    form.setFieldsValue(values);
    // Faqat mount'da: keyingi render'lar foydalanuvchi yozganini o'chirmasin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

/**
 * TAHRIRLASH — faqat nom va IP ro'yxati (`PATCH /carrier-accounts/:id`).
 * Kuryer va kalit bu yerda o'zgarmaydi: kuryer almashsa — yangi akkaunt,
 * kalit uchun — «Kalit» bo'limi.
 *
 * Faqat o'zgargan maydon yuboriladi (`editPatch`); hech narsa o'zgarmasa
 * so'rovsiz yopiladi. Forma har ochilishda yangidan mount bo'ladi
 * (`destroyOnHidden`) va `clearOnDestroy` eski qiymatlarni tozalaydi —
 * keyingi akkaunt o'z qiymatlari bilan ochiladi (`ApplyAccountValues`
 * StrictMode'da ham).
 */
export const CarrierEditModal = ({ open, account, onClose, afterClose }: Props) => {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const update = useUpdateCarrierAccount();
  const pending = update.isPending;
  /**
   * Enter bilan ikki marta yuborishdan himoya — render kutmaydi (ref).
   * Saqlangach qulf oyna qayta ochilguncha turadi: yopilish animatsiyasida
   * fokus «Saqlash» da qoladi (batafsil — `CarrierCreateModal`).
   */
  const submitting = useRef(false);
  useEffect(() => {
    if (open) submitting.current = false;
  }, [open]);

  const close = () => {
    if (pending) return;
    onClose();
  };

  const onFinish = async (values: FormValues) => {
    if (!account || submitting.current) return;
    const dto = editPatch(account, values);
    if (!dto) {
      onClose();
      return;
    }
    submitting.current = true;
    try {
      await update.mutateAsync({ id: account.id, dto });
      message.success("Carrier akkaunt yangilandi");
      onClose();
    } catch (e) {
      submitting.current = false;
      message.error(errText(e, "Saqlab bo'lmadi"));
    }
  };

  return (
    <Modal
      open={open}
      title={`Akkauntni tahrirlash — ${account?.name ?? ""}`}
      okText="Saqlash"
      cancelText="Bekor qilish"
      onOk={() => form.submit()}
      onCancel={close}
      afterClose={afterClose}
      okButtonProps={{ loading: pending }}
      cancelButtonProps={{ disabled: pending }}
      closable={!pending}
      keyboard={!pending}
      maskClosable={false}
      destroyOnHidden
    >
      {account && (
        <Form<FormValues>
          form={form}
          name="carrierEdit"
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          clearOnDestroy
          initialValues={formValuesOf(account)}
        >
          <ApplyAccountValues form={form} values={formValuesOf(account)} />
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
            label="Bog'langan kuryer"
            extra="Kuryer va kalit bu yerda o'zgarmaydi. Boshqa kuryer kerak bo'lsa — yangi akkaunt oching."
          >
            <CourierRow account={account} />
          </Form.Item>

          <IpAllowlistField
            name="ip_allowlist"
            rows={5}
            max={CARRIER_IP_ALLOWLIST_MAX}
            clearHint
          />

          <Alert
            type="warning"
            showIcon
            message="Saqlash bilan darhol kuchga kiradi: ro'yxatda yo'q manzildan kelgan so'rov 403 oladi."
          />
        </Form>
      )}
    </Modal>
  );
};

export default CarrierEditModal;
