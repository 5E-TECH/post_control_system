import { useMemo } from "react";
import { Alert, Form, Input, InputNumber, Modal, Select, message } from "antd";
import {
  useMarketplaceConfig,
  type CreateMarketplacePayload,
} from "../../../../shared/api/hooks/useMarketplaceConfig";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";

interface MarketOption {
  id: string;
  name?: string;
  phone_number?: string;
}

const unwrapMarkets = (raw: unknown): MarketOption[] => {
  const candidates = [
    (raw as { data?: { data?: unknown } })?.data?.data,
    (raw as { data?: unknown })?.data,
    raw,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c as MarketOption[];
  return [];
};

/**
 * Slug — ommaviy URL'ning bir qismi (`/marketplace/{slug}/ledger`) va
 * KEYIN O'ZGARTIRIB BO'LMAYDI. Shuning uchun uni shu yerda, yaratishdan
 * oldin tekshiramiz: server ham tekshiradi, lekin foydalanuvchi xatoni
 * so'rov yubormasdan ko'rgani yaxshi.
 */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}$/;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (slug: string) => void;
}

export const MarketplaceCreateModal = ({ open, onClose, onCreated }: Props) => {
  const [form] = Form.useForm<CreateMarketplacePayload>();
  const { create } = useMarketplaceConfig();
  const { getMarkets } = useMarket();
  const { data: marketsRaw } = getMarkets(open);

  const markets = useMemo(() => unwrapMarkets(marketsRaw), [marketsRaw]);

  const submit = async () => {
    const values = await form.validateFields();
    try {
      await create.mutateAsync({
        ...values,
        slug: values.slug.trim().toLowerCase(),
      });
      message.success("Ulanish yaratildi — endi kalitlarni kiriting");
      form.resetFields();
      onCreated(values.slug.trim().toLowerCase());
    } catch (e) {
      // ⚠️ Backend xato kontrakti: `{message, error}` — ikkisi ham STRING.
      // `data.error.message` EMAS (o'sha xato 4 ta kassa faylida bo'lgan).
      const msg = (e as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      message.error(msg ?? "Yaratib bo'lmadi");
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Yaratish"
      cancelText="Bekor qilish"
      confirmLoading={create.isPending}
      title="Yangi marketplace ulanishi"
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        className="mb-4"
        message="Ulanish O'CHIQ holda yaratiladi"
        description="Kalitlar va tarif kiritilmaguncha yoqib bo'lmaydi — yarim sozlangan ulanish birinchi skanda yiqilardi."
      />

      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="name"
          label="Nomi"
          rules={[{ required: true, message: "Nomini kiriting" }]}
        >
          <Input placeholder="UzMarket" maxLength={120} />
        </Form.Item>

        <Form.Item
          name="slug"
          label="Slug (URL uchun)"
          extra="Keyin O'ZGARTIRIB BO'LMAYDI — ommaviy manzilda ishlatiladi."
          rules={[
            { required: true, message: "Slug kiriting" },
            {
              validator: (_, value: string) =>
                !value || SLUG_RE.test(String(value).trim().toLowerCase())
                  ? Promise.resolve()
                  : Promise.reject(
                      new Error(
                        "Faqat kichik harf, raqam va `-` (2–49 belgi), harf yoki raqam bilan boshlanadi",
                      ),
                    ),
            },
          ]}
        >
          <Input placeholder="uzmarket" maxLength={49} />
        </Form.Item>

        <Form.Item
          name="market_id"
          label="Biriktiriladigan market"
          extra="Bu marketning kassasi marketplace kassasi bilan teng yuradi."
          rules={[{ required: true, message: "Marketni tanlang" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Marketni tanlang"
            options={markets.map((m) => ({
              value: m.id,
              label: m.name ?? m.phone_number ?? m.id,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="api_base_url"
          label="Ularning API manzili"
          extra="HTTPS bo'lishi shart. Keyinroq ham kiritsa bo'ladi."
        >
          <Input placeholder="https://api.uzmarket.uz" maxLength={300} />
        </Form.Item>

        <div className="grid md:grid-cols-2 gap-x-4">
          <Form.Item
            name="tariff_center"
            label="Markazgacha tarif"
            rules={[{ required: true, message: "Tarifni kiriting" }]}
          >
            <InputNumber
              className="w-full"
              min={1}
              step={1000}
              addonAfter="so'm"
              placeholder="50000"
            />
          </Form.Item>

          <Form.Item
            name="tariff_home"
            label="Uygacha tarif"
            rules={[{ required: true, message: "Tarifni kiriting" }]}
          >
            <InputNumber
              className="w-full"
              min={1}
              step={1000}
              addonAfter="so'm"
              placeholder="70000"
            />
          </Form.Item>
        </div>
      </Form>
    </Modal>
  );
};
