import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import {
  KeyRound,
  MapPin,
  PlugZap,
  RefreshCcwDot,
  ShieldCheck,
  Truck,
  Webhook,
} from "lucide-react";
import {
  useElchiConfig,
  type ElchiDistrictMapRow,
  type UpdateElchiConfigDto,
} from "../../../../shared/api/hooks/useElchiConfig";
import { useCourier } from "../../../../shared/api/hooks/useCourier";

interface CourierOption {
  id: string;
  name?: string;
  phone_number?: string;
  external_provider?: string | null;
}

const unwrapList = (raw: unknown): CourierOption[] => {
  const candidates = [
    (raw as { data?: { data?: unknown } })?.data?.data,
    (raw as { data?: unknown })?.data,
    raw,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c as CourierOption[];
  return [];
};

/**
 * Elchi sozlamalari — ulanish, virtual kuryer va PILOT DARVOZASI.
 *
 * Uch blok ataylab bitta ekranda: ular birgalikda "Elchi'ga buyurtma ketadimi"
 * degan savolga javob beradi. Alohida ekranlarga bo'linsa, operator qaysi
 * bo'lagi yetishmayotganini topolmaydi.
 */
export const ElchiSettingsTab = () => {
  const {
    config: configQuery,
    districts: districtsQuery,
    updateConfig,
    testConnection,
    bindCourier,
    syncDistricts,
    setDistrictGate,
  } = useElchiConfig();

  const { getCourier } = useCourier();
  const { data: couriersData } = getCourier(true);

  const [form] = Form.useForm<UpdateElchiConfigDto>();
  const [bindOpen, setBindOpen] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState<string | null>(
    null,
  );
  const [districtSearch, setDistrictSearch] = useState("");

  const config = configQuery.data;

  useEffect(() => {
    if (!config) return;
    form.setFieldsValue({
      is_active: config.is_active,
      webhook_enabled: config.webhook_enabled,
      reconcile_enabled: config.reconcile_enabled,
      api_base_url: config.api_base_url ?? undefined,
      elchi_market_id: config.elchi_market_id ?? undefined,
    });
  }, [config, form]);

  const allCouriers = unwrapList(couriersData);
  /**
   * Faqat bo'sh yoki allaqachon Elchi'ga tegishli kuryerlar.
   * LDG vakilini tanlash mumkin emas — bitta odam ikki provayderni
   * ifodalasa, pochta qayerga ketgani noaniq bo'lardi.
   */
  const availableCouriers = allCouriers.filter(
    (c) => !c.external_provider || c.external_provider === "elchi",
  );
  const linkedCourier = config?.elchi_courier_user_id
    ? allCouriers.find((c) => c.id === config.elchi_courier_user_id) ?? null
    : null;

  /**
   * `?? []` har renderda YANGI massiv yasaydi — pastdagi `useMemo` shu bois
   * hech qachon keshlanmaydi. Barqaror havola uchun o'zi ham memo qilinadi.
   */
  const districts = useMemo(
    () => districtsQuery.data ?? [],
    [districtsQuery.data],
  );
  const enabledCount = districts.filter((d) => d.is_enabled).length;
  const unmappedCount = districts.filter((d) => !d.elchi_district_id).length;

  const filteredDistricts = useMemo(() => {
    const q = districtSearch.trim().toLowerCase();
    if (!q) return districts;
    return districts.filter(
      (d) =>
        (d.district?.name ?? "").toLowerCase().includes(q) ||
        (d.sato_code ?? "").includes(q),
    );
  }, [districts, districtSearch]);

  const onFinish = async (values: UpdateElchiConfigDto) => {
    /**
     * Bo'sh maxfiy maydonlar YUBORILMAYDI. Bo'sh string yuborilsa backend uni
     * "tozalash" deb tushunib, ishlab turgan kalitni o'chirib yuborardi —
     * integratsiya jimgina yiqilardi.
     */
    const cleaned: UpdateElchiConfigDto = { ...values };
    if (!cleaned.api_key) delete cleaned.api_key;
    if (!cleaned.webhook_secret) delete cleaned.webhook_secret;
    if (!cleaned.webhook_secret_previous) delete cleaned.webhook_secret_previous;

    try {
      await updateConfig.mutateAsync(cleaned);
      message.success("Elchi sozlamalari saqlandi");
      form.resetFields([
        "api_key",
        "webhook_secret",
        "webhook_secret_previous",
      ]);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "Saqlashda xatolik");
    }
  };

  const handleTest = async () => {
    try {
      const res = await testConnection.mutateAsync();
      const ok = (res as { success?: boolean })?.success;
      const msg =
        (res as { message?: string })?.message ?? "Ulanish tekshirildi";
      if (ok === false) message.error(msg);
      else message.success(msg);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "Test so'rovida xatolik");
    }
  };

  const handleBind = async () => {
    if (!selectedCourierId) return;
    try {
      await bindCourier.mutateAsync(selectedCourierId);
      message.success("Elchi vakil-kuryeri biriktirildi");
      setBindOpen(false);
      setSelectedCourierId(null);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "Biriktirishda xatolik");
    }
  };

  const handleSync = async () => {
    try {
      const res = (await syncDistricts.mutateAsync()) as {
        matched?: number;
        unmatched?: unknown[];
      };
      const unmatched = Array.isArray(res?.unmatched)
        ? res.unmatched.length
        : 0;
      message.success(
        `Moslashtirildi: ${res?.matched ?? 0} ta. Moslanmagan: ${unmatched} ta.`,
      );
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "Moslashda xatolik");
    }
  };

  const handleGate = async (row: ElchiDistrictMapRow, next: boolean) => {
    try {
      await setDistrictGate.mutateAsync({
        districtId: row.district_id,
        is_enabled: next,
      });
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      message.error(e.response?.data?.message ?? "Darvozani o'zgartirib bo'lmadi");
    }
  };

  if (configQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Form form={form} layout="vertical" onFinish={onFinish}>
        {/* ═══════ ULANISH ═══════ */}
        <Card
          title={
            <span className="flex items-center gap-2">
              <PlugZap className="w-4 h-4" /> Ulanish
            </span>
          }
          extra={
            <Button
              icon={<PlugZap className="w-4 h-4" />}
              loading={testConnection.isPending}
              onClick={handleTest}
            >
              Ulanishni tekshirish
            </Button>
          }
        >
          <div className="grid md:grid-cols-2 gap-x-4">
            <Form.Item
              name="api_base_url"
              label="Elchi API manzili"
              rules={[{ required: true, message: "Manzil kiritilishi shart" }]}
            >
              <Input placeholder="https://api.elchi.uz" />
            </Form.Item>

            <Form.Item
              name="elchi_market_id"
              label={
                <Tooltip title="Elchi tomonidagi BeePost market akkaunti id'si. POST /partner/markets javobidan olinadi.">
                  <span className="cursor-help">Elchi market ID</span>
                </Tooltip>
              }
            >
              <Input placeholder="Elchi bergan market id" />
            </Form.Item>

            <Form.Item
              name="api_key"
              label={
                <span className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4" /> API kalit (X-Api-Key)
                  <Tag color={config?.api_key_set ? "green" : "red"}>
                    {config?.api_key_set ? "kiritilgan" : "yo'q"}
                  </Tag>
                </span>
              }
            >
              <Input.Password
                placeholder={
                  config?.api_key_set
                    ? "O'zgartirmasangiz bo'sh qoldiring"
                    : "Elchi bergan kalit"
                }
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              name="webhook_secret"
              label={
                <span className="flex items-center gap-2">
                  <Webhook className="w-4 h-4" /> Webhook sekreti
                  <Tag color={config?.webhook_secret_set ? "green" : "red"}>
                    {config?.webhook_secret_set ? "kiritilgan" : "yo'q"}
                  </Tag>
                </span>
              }
            >
              <Input.Password
                placeholder={
                  config?.webhook_secret_set
                    ? "O'zgartirmasangiz bo'sh qoldiring"
                    : "HMAC-SHA256 sekreti"
                }
                autoComplete="new-password"
              />
            </Form.Item>

            <Form.Item
              name="webhook_secret_previous"
              label={
                <Tooltip title="Kalit almashtirilganda eski sekret bilan imzolangan webhooklar ham qabul qilinsin — Elchi tomonidagi navbat bo'shaguncha.">
                  <span className="cursor-help flex items-center gap-2">
                    Oldingi sekret (rotatsiya oynasi)
                    <Tag
                      color={
                        config?.webhook_secret_previous_set ? "blue" : "default"
                      }
                    >
                      {config?.webhook_secret_previous_set
                        ? "faol"
                        : "ishlatilmayapti"}
                    </Tag>
                  </span>
                </Tooltip>
              }
            >
              <Input.Password
                placeholder="Ixtiyoriy"
                autoComplete="new-password"
              />
            </Form.Item>
          </div>

          <Divider className="!my-3" />

          <div className="grid md:grid-cols-3 gap-4">
            <Form.Item
              name="is_active"
              label="MASTER kalit"
              valuePropName="checked"
              tooltip="O'chirilsa Elchi'ga hech narsa jo'natilmaydi va kiruvchi webhook ham ishlanmaydi"
            >
              <Switch checkedChildren="Faol" unCheckedChildren="O'chiq" />
            </Form.Item>
            <Form.Item
              name="webhook_enabled"
              label="Kiruvchi webhook"
              valuePropName="checked"
            >
              <Switch checkedChildren="Yoqilgan" unCheckedChildren="O'chiq" />
            </Form.Item>
            <Form.Item
              name="reconcile_enabled"
              label="Solishtiruvchi (CRON)"
              valuePropName="checked"
              tooltip="Yo'qolgan webhookni tutadi — o'chirilsa buyurtma abadiy 'kutilmoqda'da qolishi mumkin"
            >
              <Switch checkedChildren="Yoqilgan" unCheckedChildren="O'chiq" />
            </Form.Item>
          </div>

          <Button
            type="primary"
            htmlType="submit"
            loading={updateConfig.isPending}
            icon={<ShieldCheck className="w-4 h-4" />}
          >
            Saqlash
          </Button>
        </Card>
      </Form>

      {/* ═══════ VIRTUAL KURYER ═══════ */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Truck className="w-4 h-4" /> Elchi vakil-kuryeri
          </span>
        }
        extra={
          <Button type="primary" onClick={() => setBindOpen(true)}>
            {linkedCourier ? "Almashtirish" : "Biriktirish"}
          </Button>
        }
      >
        {linkedCourier ? (
          <div className="flex items-center gap-3">
            <Tag color="purple">ELCHI</Tag>
            <span className="font-semibold">{linkedCourier.name}</span>
            <span className="text-gray-500">
              {linkedCourier.phone_number ?? "telefon yo'q"}
            </span>
          </div>
        ) : (
          <Alert
            type="warning"
            showIcon
            message="Vakil-kuryer biriktirilmagan"
            description="Operator pochtani Elchi'ga jo'natish uchun kuryer ro'yxatidan aynan shu kuryerni tanlaydi. Biriktirilmasa Elchi'ga hech narsa jo'natib bo'lmaydi."
          />
        )}
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          ⚠️ Kuryer tarifi Elchi tomonidagi BeePost market tarifi bilan{" "}
          <b>teng</b> bo'lishi shart. Aks holda PCS bir summani, Elchi boshqasini
          ushlab qoladi va ikki daftar ajraladi. Tenglikni "Umumiy holat" ekrani
          avtomatik tekshiradi.
        </p>
      </Card>

      {/* ═══════ DARVOZA ═══════ */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Pilot tumanlari — darvoza
            <Tag color={enabledCount > 0 ? "green" : "red"}>
              ruxsat berilgan: {enabledCount}
            </Tag>
            {unmappedCount > 0 && (
              <Tag color="orange">moslanmagan: {unmappedCount}</Tag>
            )}
          </span>
        }
        extra={
          <div className="flex gap-2">
            <Input.Search
              allowClear
              placeholder="Tuman yoki SOATO"
              value={districtSearch}
              onChange={(e) => setDistrictSearch(e.target.value)}
              style={{ width: 220 }}
            />
            <Button
              icon={<RefreshCcwDot className="w-4 h-4" />}
              loading={syncDistricts.isPending}
              onClick={handleSync}
            >
              SOATO bo'yicha moslash
            </Button>
          </div>
        }
      >
        <Alert
          className="mb-3"
          type="info"
          showIcon
          message="Darvoza qoidasi: hammasi yoki hech biri"
          description="Pochtada bitta ruxsatsiz tuman bo'lsa BUTUN pochta jo'natilmaydi. Moslash tugmasi darvozani OCHMAYDI — ruxsatni har bir tuman uchun o'zingiz yoqasiz."
        />

        <Table<ElchiDistrictMapRow>
          rowKey="id"
          size="small"
          loading={districtsQuery.isLoading}
          dataSource={filteredDistricts}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          columns={[
            {
              title: "Tuman",
              dataIndex: ["district", "name"],
              render: (_: unknown, r) => r.district?.name ?? r.district_id,
            },
            {
              title: "SOATO",
              dataIndex: "sato_code",
              width: 120,
              render: (v: string | null) => (
                <span className="font-mono text-xs">{v ?? "—"}</span>
              ),
            },
            {
              title: "Elchi tumani",
              dataIndex: "elchi_district_id",
              width: 160,
              render: (v: string | null, r) =>
                v ? (
                  <Tag color={r.matched_automatically ? "blue" : "purple"}>
                    {r.matched_automatically ? "avto" : "qo'lda"}
                  </Tag>
                ) : (
                  <Tag color="red">moslanmagan</Tag>
                ),
            },
            {
              title: "Darvoza",
              dataIndex: "is_enabled",
              width: 120,
              render: (v: boolean, r) => (
                <Tooltip
                  title={
                    r.elchi_district_id
                      ? undefined
                      : "Avval SOATO bo'yicha moslanishi kerak"
                  }
                >
                  <Switch
                    checked={v}
                    disabled={!r.elchi_district_id || setDistrictGate.isPending}
                    onChange={(next) => handleGate(r, next)}
                    checkedChildren="ruxsat"
                    unCheckedChildren="yopiq"
                  />
                </Tooltip>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={bindOpen}
        title="Elchi vakil-kuryerini biriktirish"
        onCancel={() => {
          setBindOpen(false);
          setSelectedCourierId(null);
        }}
        onOk={handleBind}
        okText="Biriktirish"
        okButtonProps={{
          disabled: !selectedCourierId,
          loading: bindCourier.isPending,
        }}
      >
        <p className="text-sm text-gray-500 mb-3">
          Bir vaqtda faqat <b>bitta</b> Elchi vakili bo'ladi — yangisini
          tanlasangiz eskisi bo'shaydi.
        </p>
        <Select
          className="w-full"
          showSearch
          optionFilterProp="label"
          placeholder="Kuryerni tanlang"
          value={selectedCourierId ?? undefined}
          onChange={(v) => setSelectedCourierId(v)}
          options={availableCouriers.map((c) => ({
            value: c.id,
            label: `${c.name ?? "Nomsiz"} — ${c.phone_number ?? "telefon yo'q"}${
              c.external_provider === "elchi" ? " (hozirgi)" : ""
            }`,
          }))}
        />
      </Modal>
    </div>
  );
};

export default ElchiSettingsTab;
