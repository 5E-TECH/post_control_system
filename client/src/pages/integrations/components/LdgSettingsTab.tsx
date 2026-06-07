import { useEffect, useState } from "react";
import {
  Form,
  Input,
  InputNumber,
  Switch,
  Button,
  Card,
  Select,
  Tag,
  Spin,
  message,
  Divider,
  Tooltip,
  Modal,
} from "antd";
import {
  ShieldCheck,
  Truck,
  Settings as SettingsIcon,
  Package,
  KeyRound,
  Webhook,
  UserPlus,
  CheckCircle2,
  MapPin,
} from "lucide-react";
import {
  useLdgConfig,
  type LdgConfigSafe,
  type UpdateLdgConfigDto,
} from "../../../shared/api/hooks/useLdgConfig";
import { useCourier } from "../../../shared/api/hooks/useCourier";
import { useRegion } from "../../../shared/api/hooks/useRegion/useRegion";
import { useDistrict } from "../../../shared/api/hooks/useDistrict";

/**
 * Backend `getSafe()` har xil shaklda javob qaytarishi mumkin —
 * ba'zan {data: ...} envelope, ba'zan to'g'ridan-to'g'ri obyekt.
 * Bu helper ikkalasini ham tushunadi.
 */
const unwrap = (raw: unknown): LdgConfigSafe | null => {
  if (!raw) return null;
  const r = raw as Record<string, unknown>;
  if (r && typeof r === "object" && "data" in r) {
    return (r.data as LdgConfigSafe) ?? null;
  }
  return r as unknown as LdgConfigSafe;
};

interface CourierOption {
  id: string;
  name: string;
  phone_number: string;
  external_provider?: string | null;
}

const unwrapList = (raw: unknown): CourierOption[] => {
  if (!raw) return [];
  const r = raw as Record<string, unknown>;
  const list =
    (r.data as CourierOption[] | undefined) ??
    (Array.isArray(raw) ? (raw as CourierOption[]) : []);
  return Array.isArray(list) ? list : [];
};

interface RegionOption {
  id: string;
  name: string;
  sato_code: string | null;
}

interface DistrictOption {
  id: string;
  name: string;
  sato_code: string | null;
  region_id: string;
  region?: { id: string; name: string };
}

const unwrapRegions = (raw: unknown): RegionOption[] => {
  if (!raw) return [];
  const r = raw as Record<string, unknown>;
  const list =
    (r.data as RegionOption[] | undefined) ??
    (Array.isArray(raw) ? (raw as RegionOption[]) : []);
  return Array.isArray(list) ? list : [];
};

const unwrapDistricts = (raw: unknown): DistrictOption[] => {
  if (!raw) return [];
  const r = raw as Record<string, unknown>;
  const list =
    (r.data as DistrictOption[] | undefined) ??
    (Array.isArray(raw) ? (raw as DistrictOption[]) : []);
  return Array.isArray(list) ? list : [];
};

export const LdgSettingsTab = () => {
  const { getConfig, updateConfig, bindCourier, createCourier } = useLdgConfig();
  const { data, isLoading, refetch } = getConfig();
  const { getCourier } = useCourier();
  const { data: couriersData } = getCourier(true);
  const { getRegions } = useRegion();
  const { data: regionsData } = getRegions(true);
  const { getDistricts } = useDistrict();
  const { data: districtsData } = getDistricts();
  const [form] = Form.useForm<UpdateLdgConfigDto>();
  const senderRegionSato = Form.useWatch("sender_region_sato", form);

  // Bind / Create modallar
  const [bindModalOpen, setBindModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
  const [createForm] = Form.useForm<{
    name: string;
    phone_number: string;
    tariff_home: number;
    tariff_center: number;
    region_id?: string;
  }>();

  useEffect(() => {
    const config = unwrap(data);
    if (!config) return;
    form.setFieldsValue({
      is_active: config.is_active,
      is_sandbox: config.is_sandbox,
      api_base_url: config.api_base_url,
      tenant_domain: config.tenant_domain ?? undefined,
      sender_name: config.sender_name ?? undefined,
      sender_phone: config.sender_phone ?? undefined,
      sender_region_sato: config.sender_region_sato ?? undefined,
      sender_district_sato: config.sender_district_sato ?? undefined,
      sender_address: config.sender_address ?? undefined,
      sender_branch_id: config.sender_branch_id ?? undefined,
      default_weight: config.default_weight,
      default_length: config.default_length,
      default_width: config.default_width,
      default_height: config.default_height,
      default_payer_type: config.default_payer_type as
        | "receiver"
        | "sender"
        | "third_party",
    });
  }, [data, form]);

  const config = unwrap(data);

  const onFinish = async (values: UpdateLdgConfigDto) => {
    // Sezgir maydonlar (api_key, webhook_secret) bo'sh bo'lsa yubormaymiz —
    // backend mavjud qiymatni saqlab qoladi
    const cleaned: UpdateLdgConfigDto = { ...values };
    if (!cleaned.api_key) delete cleaned.api_key;
    if (!cleaned.webhook_secret) delete cleaned.webhook_secret;
    if (!cleaned.webhook_secret_previous) delete cleaned.webhook_secret_previous;

    try {
      await updateConfig.mutateAsync(cleaned);
      message.success("LDG sozlamalari saqlandi");
      refetch();
      form.resetFields(["api_key", "webhook_secret", "webhook_secret_previous"]);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "Saqlashda xatolik");
    }
  };

  // Mavjud kuryerlardan LDG vakil bo'lmagan va boshqa external_provider'siz
  // bo'lganlarini ko'rsatamiz (asosan ichki kuryerlar)
  const allCouriers = unwrapList(couriersData);
  const availableCouriers = allCouriers.filter(
    (c) => !c.external_provider || c.external_provider === "ldg",
  );

  // Hozir biriktirilgan LDG kuryerni ID bo'yicha topamiz
  const linkedCourier = config?.ldg_courier_user_id
    ? allCouriers.find((c) => c.id === config.ldg_courier_user_id) ?? null
    : null;

  const regions = unwrapRegions(regionsData);
  const districts = unwrapDistricts(districtsData);

  // Sender uchun tanlangan viloyatga tegishli tumanlar
  const senderRegion = regions.find(
    (r) => r.sato_code != null && Number(r.sato_code) === senderRegionSato,
  );
  const senderRegionDistricts = senderRegion
    ? districts.filter((d) => d.region_id === senderRegion.id)
    : [];

  const handleBind = async () => {
    if (!selectedCourierId) {
      message.warning("Kuryer tanlang");
      return;
    }
    try {
      await bindCourier.mutateAsync({ user_id: selectedCourierId });
      message.success("Kuryer LDG vakil qilib biriktirildi");
      setBindModalOpen(false);
      setSelectedCourierId(null);
      refetch();
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "Biriktirish muvaffaqiyatsiz");
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await createCourier.mutateAsync(values);
      message.success("Yangi LDG vakil-kuryer yaratildi");
      setCreateModalOpen(false);
      createForm.resetFields();
      refetch();
    } catch (err) {
      const e = err as {
        response?: { data?: { message?: string } };
        errorFields?: unknown;
      };
      if (e.errorFields) return; // validation error — antd o'zi ko'rsatadi
      message.error(e.response?.data?.message ?? "Yaratishda xatolik");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6 text-blue-500" />
            <div>
              <div className="font-semibold text-base">LDG Cargo</div>
              <div className="text-sm text-gray-500">
                Tashqi yetkazib berish provayderi sifatida ulanish
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Tag color={config?.is_active ? "green" : "default"}>
              {config?.is_active ? "Faol" : "Faol emas"}
            </Tag>
            <Tag color={config?.is_sandbox ? "orange" : "blue"}>
              {config?.is_sandbox ? "Sandbox" : "Production"}
            </Tag>
            <Tag color={config?.api_key_set ? "green" : "red"}>
              <KeyRound className="inline w-3 h-3 mr-1" />
              API kalit {config?.api_key_set ? "✓" : "yo'q"}
            </Tag>
            <Tag color={config?.webhook_secret_set ? "green" : "red"}>
              <Webhook className="inline w-3 h-3 mr-1" />
              Webhook secret {config?.webhook_secret_set ? "✓" : "yo'q"}
            </Tag>
            <Tag color={config?.ldg_courier_user_id ? "green" : "red"}>
              {config?.ldg_courier_user_id ? (
                <>
                  <CheckCircle2 className="inline w-3 h-3 mr-1" />
                  {linkedCourier
                    ? `Kuryer: ${linkedCourier.name}`
                    : "Kuryer ulangan"}
                </>
              ) : (
                <>
                  <UserPlus className="inline w-3 h-3 mr-1" />
                  Kuryer yo'q
                </>
              )}
            </Tag>
          </div>
        </div>

        {/* LDG vakil-kuryer holati va boshqaruv — har doim ko'rinadi */}
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm">
            {config?.ldg_courier_user_id ? (
              <>
                <div className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Joriy LDG vakil-kuryer:{" "}
                  {linkedCourier ? (
                    <span className="text-blue-600 dark:text-blue-300">
                      {linkedCourier.name}{" "}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({linkedCourier.phone_number})
                      </span>
                    </span>
                  ) : (
                    <span className="text-orange-600 dark:text-orange-300">
                      ID: {config.ldg_courier_user_id} (user topilmadi —
                      o'chirilgan bo'lishi mumkin)
                    </span>
                  )}
                </div>
                <div className="text-gray-600 dark:text-gray-400 mt-1">
                  Boshqa kuryerga o'tkazish yoki yangi virtual yaratish uchun
                  pastdagi tugmalardan foydalaning.
                </div>
              </>
            ) : (
              <>
                <div className="font-medium">
                  Birinchi qadam: LDG vakil-kuryerni belgilang
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  LDG yetkazib berishlari kuryer-user orqali hisoblanadi.
                  Mavjud kuryerni biriktiring yoki yangi virtual user yarating.
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              icon={<UserPlus className="w-4 h-4" />}
              onClick={() => setBindModalOpen(true)}
            >
              {config?.ldg_courier_user_id
                ? "Boshqa kuryerga o'tkazish"
                : "Mavjud kuryerni biriktirish"}
            </Button>
            <Button
              type="primary"
              icon={<UserPlus className="w-4 h-4" />}
              onClick={() => setCreateModalOpen(true)}
            >
              Yangi virtual yaratish
            </Button>
          </div>
        </div>
      </Card>

      {/* Bind modal */}
      <Modal
        title="Mavjud kuryerni LDG vakil qilib biriktirish"
        open={bindModalOpen}
        onCancel={() => {
          setBindModalOpen(false);
          setSelectedCourierId(null);
        }}
        onOk={handleBind}
        okText="Biriktirish"
        cancelText="Bekor qilish"
        confirmLoading={bindCourier.isPending}
      >
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            Tanlangan kuryer'ga <b>external_provider = 'ldg'</b> bayrog'i
            qo'yiladi va LDG yetkazib berish hisob-kitoblari shu user
            cashbox'ida ishlanadi.
          </div>
          <Select
            className="w-full"
            placeholder="Kuryer tanlang..."
            showSearch
            optionFilterProp="label"
            value={selectedCourierId}
            onChange={(v) => setSelectedCourierId(v)}
            options={availableCouriers.map((c) => ({
              value: c.id,
              label: `${c.name} — ${c.phone_number}${
                c.external_provider === "ldg" ? " (joriy LDG vakil)" : ""
              }`,
            }))}
          />
        </div>
      </Modal>

      {/* Create modal */}
      <Modal
        title="Yangi virtual LDG kuryerni yaratish"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={handleCreate}
        okText="Yaratish"
        cancelText="Bekor qilish"
        confirmLoading={createCourier.isPending}
        width={520}
      >
        <Form form={createForm} layout="vertical" className="mt-4">
          <Form.Item
            label="Ism"
            name="name"
            rules={[{ required: true, message: "Ism kiriting" }]}
            initialValue="LDG Cargo"
          >
            <Input placeholder="LDG Cargo" />
          </Form.Item>
          <Form.Item
            label="Telefon raqami"
            name="phone_number"
            rules={[
              { required: true, message: "Telefon kiriting" },
              {
                pattern: /^\+998\d{9}$/,
                message: "+998XXXXXXXXX formatida bo'lishi kerak",
              },
            ]}
          >
            <Input placeholder="+998901234567" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              label="Markaz tarifi (so'm)"
              name="tariff_center"
              rules={[
                { required: true, message: "Tarif kiriting" },
                { type: "number", min: 0, message: "Manfiy bo'lmaydi" },
              ]}
              tooltip="LDG buyurtmani markazga olib kelganda olishi kerak bo'lgan summa"
            >
              <InputNumber className="w-full" min={0} placeholder="15000" />
            </Form.Item>
            <Form.Item
              label="Uy tarifi (so'm)"
              name="tariff_home"
              rules={[
                { required: true, message: "Tarif kiriting" },
                { type: "number", min: 0, message: "Manfiy bo'lmaydi" },
              ]}
              tooltip="LDG buyurtmani uyga yetkazib berganda olishi kerak bo'lgan summa"
            >
              <InputNumber className="w-full" min={0} placeholder="25000" />
            </Form.Item>
          </div>
          <Form.Item
            label="Region (ixtiyoriy)"
            name="region_id"
            tooltip="Hisobotlarda kuryer qaysi viloyatga tegishli ekanini ko'rsatish uchun"
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tanlanmasa — bo'sh qoladi"
              options={regions.map((r) => ({ value: r.id, label: r.name }))}
            />
          </Form.Item>
          <div className="text-xs text-gray-500 -mt-2">
            User'ga avtomatik <b>role=courier</b>, <b>status=active</b>,{" "}
            <b>external_provider=ldg</b> belgilanadi va kuryer kassasi yaratiladi.
          </div>
        </Form>
      </Modal>

      <Form form={form} layout="vertical" onFinish={onFinish}>
        {/* ULANISH */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Ulanish va xavfsizlik
            </span>
          }
          className="mb-4"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Form.Item label="Faol" name="is_active" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item
              label="Sandbox rejim"
              name="is_sandbox"
              valuePropName="checked"
              tooltip="Faqat live ishga tushirishdan oldin sandbox sinov muhitida sinang"
            >
              <Switch />
            </Form.Item>
            <Form.Item label="API base URL" name="api_base_url">
              <Input placeholder="https://api.fcargo.uz/api/client/v1" />
            </Form.Item>
            <Form.Item
              label="Tenant domain (X-Tenant-Domain)"
              name="tenant_domain"
              tooltip="LDG dashboard URL'idan oling — masalan: ldg.express. Faqat slug ('ldg') ishlamaydi, to'liq domen kerak."
            >
              <Input placeholder="ldg.express" />
            </Form.Item>
            <Form.Item
              label={
                <Tooltip title="Sezgir maydon. Saqlash uchun yangi kalit kiriting. Bo'sh qoldirilsa eski kalit saqlanadi.">
                  API kalit (X-API-Key) {config?.api_key_set ? "✓ sozlangan" : ""}
                </Tooltip>
              }
              name="api_key"
            >
              <Input.Password
                placeholder={config?.api_key_set ? "•••• o'zgartirish uchun yangisini kiriting" : "test_pk_..."}
                autoComplete="off"
              />
            </Form.Item>
            <Form.Item
              label={
                <Tooltip title="LDG webhook endpoint sozlanganda olingan secret. Bo'sh qoldirilsa eski qiymat saqlanadi.">
                  Webhook secret {config?.webhook_secret_set ? "✓ sozlangan" : ""}
                </Tooltip>
              }
              name="webhook_secret"
            >
              <Input.Password
                placeholder={config?.webhook_secret_set ? "••••" : "whsec_..."}
                autoComplete="off"
              />
            </Form.Item>
            <Form.Item
              label="Eski webhook secret (key rotation)"
              name="webhook_secret_previous"
              tooltip="Secret yangilanganda eski kalitlar bilan kelayotgan webhook'larni qabul qilish uchun"
            >
              <Input.Password
                placeholder={config?.webhook_secret_previous_set ? "••••" : "ixtiyoriy"}
                autoComplete="off"
              />
            </Form.Item>
          </div>
        </Card>

        {/* SENDER */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" /> Yuboruvchi (markaziy filial)
            </span>
          }
          className="mb-4"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <Form.Item label="Filial nomi" name="sender_name">
              <Input placeholder="Markaziy ofis" />
            </Form.Item>
            <Form.Item label="Telefon (+998XXXXXXXXX)" name="sender_phone">
              <Input placeholder="+998901234567" />
            </Form.Item>
            <Form.Item
              label={
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Viloyat
                </span>
              }
              name="sender_region_sato"
              tooltip="Tanlangan viloyatning SOATO kodi backend'ga yuboriladi"
            >
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                placeholder="Viloyat tanlang"
                onChange={() =>
                  form.setFieldValue("sender_district_sato", undefined)
                }
                options={regions
                  .filter((r) => r.sato_code)
                  .map((r) => ({
                    value: Number(r.sato_code),
                    label: r.name,
                  }))}
                notFoundContent="Viloyat topilmadi"
              />
            </Form.Item>
            <Form.Item
              label={
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> Tuman
                </span>
              }
              name="sender_district_sato"
              tooltip="Avval viloyatni tanlang. Tanlangan tumanning SOATO kodi yuboriladi"
            >
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                placeholder={
                  senderRegion
                    ? "Tuman tanlang"
                    : "Avval viloyatni tanlang"
                }
                disabled={!senderRegion}
                options={senderRegionDistricts
                  .filter((d) => d.sato_code)
                  .map((d) => ({
                    value: Number(d.sato_code),
                    label: d.name,
                  }))}
                notFoundContent={
                  senderRegion
                    ? "Bu viloyatda SOATO kodi bor tuman topilmadi"
                    : "Avval viloyatni tanlang"
                }
              />
            </Form.Item>
            <Form.Item label="Manzil" name="sender_address" className="md:col-span-2">
              <Input.TextArea rows={2} placeholder="Toshkent sh., Amir Temur ko'chasi 12" />
            </Form.Item>
            <Form.Item
              label="LDG Filial ID"
              name="sender_branch_id"
              className="md:col-span-2"
              tooltip={
                <div>
                  <p>
                    LDG'da xizmat hududlari sozlanmagan tenant'lar uchun majburiy.
                    Buyurtma yaratganda <code>sender.branch_id</code> va{" "}
                    <code>receiver.branch_id</code> sifatida yuboriladi.
                  </p>
                  <p>
                    ID'ni topish uchun: LDG dashboard → <b>Jo'natmalar</b> sahifasi
                    → brauzerda <kbd>F12</kbd> bosib DevTools'ni oching →{" "}
                    <b>Network</b> tab → "Filialga" dropdown'ini oching →
                    so'rov javobida filial ID'larini ko'rasiz.
                  </p>
                </div>
              }
            >
              <InputNumber
                className="w-full"
                min={1}
                placeholder="Masalan: 17 (Bosh ofis Toshkent)"
              />
            </Form.Item>
          </div>
        </Card>

        {/* DEFAULT PACKAGE */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <Package className="w-4 h-4" /> Standart paket o'lchovlari
            </span>
          }
          className="mb-4"
          extra={
            <span className="text-xs text-gray-500">
              LDG bilan kelishilgan yagona qiymatlar
            </span>
          }
        >
          <div className="grid md:grid-cols-4 gap-4">
            <Form.Item label="Vazn (kg)" name="default_weight">
              <InputNumber min={0.01} step={0.1} className="w-full" />
            </Form.Item>
            <Form.Item label="Uzunlik (cm)" name="default_length">
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item label="Eni (cm)" name="default_width">
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item label="Balandligi (cm)" name="default_height">
              <InputNumber min={1} className="w-full" />
            </Form.Item>
            <Form.Item label="To'lovchi turi" name="default_payer_type" className="md:col-span-2">
              <Select
                options={[
                  { value: "receiver", label: "Mijoz to'laydi (receiver)" },
                  { value: "sender", label: "Biz to'laymiz (sender)" },
                  { value: "third_party", label: "Uchinchi shaxs" },
                ]}
              />
            </Form.Item>
          </div>
        </Card>

        <Divider />

        <div className="flex justify-end gap-2">
          <Button onClick={() => refetch()}>Bekor qilish</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={updateConfig.isPending}
          >
            Saqlash
          </Button>
        </div>
      </Form>
    </div>
  );
};
