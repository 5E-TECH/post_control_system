import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Statistic,
  Table,
  Tooltip,
  message,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Banknote, Plus, Trash2, Wallet } from "lucide-react";
import {
  useElchiAdmin,
  type ElchiSettlement,
} from "../../../../shared/api/hooks/useElchiAdmin";

const { RangePicker } = DatePicker;

const money = (v: number) => `${Math.round(v).toLocaleString("uz-UZ")} so'm`;

/**
 * Hisob-kitob — "Elchi bizga qancha qarz" savoliga javob.
 *
 * ⚠️ Bu ekran KASSA EMAS. Bu yerdagi to'lov yozuvlari balansni o'zgartirmaydi;
 * ular faqat solishtirish daftari. Kassa harakati (agar kerak bo'lsa) odatdagi
 * kassa oqimi orqali kiritiladi — aks holda bitta pul ikki marta hisoblanardi.
 */
export const ElchiSettlementTab = () => {
  const { useSettlement, addPayment, deletePayment } = useElchiAdmin();

  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day").startOf("day"),
    dayjs().endOf("day"),
  ]);
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm<{
    amount: number;
    paid_at: Dayjs;
    note?: string;
  }>();

  const params = useMemo(
    () => ({ from: range[0].valueOf(), to: range[1].valueOf() }),
    [range],
  );
  const { data, isLoading, refetch } = useSettlement(params);

  const settlement = data as ElchiSettlement | undefined;

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await addPayment.mutateAsync({
        amount: Number(values.amount),
        paid_at: values.paid_at ? values.paid_at.valueOf() : undefined,
        note: values.note?.trim() || undefined,
      });
      message.success("To'lov qayd etildi");
      setAddOpen(false);
      form.resetFields();
      refetch();
    } catch (err) {
      const e = err as {
        errorFields?: unknown;
        response?: { data?: { message?: string } };
      };
      // Forma validatsiyasi — xabar allaqachon maydon ostida ko'rinadi.
      if (e.errorFields) return;
      message.error(e.response?.data?.message ?? "Saqlashda xatolik");
    }
  };

  const handleDelete = (id: string, amount: number) => {
    Modal.confirm({
      title: "To'lov yozuvini o'chirish",
      content: `${money(amount)} — bu yozuv o'chiriladi va "Elchi bizga qarz" summasi shuncha ORTADI.`,
      okText: "O'chirish",
      okButtonProps: { danger: true },
      cancelText: "Bekor qilish",
      onOk: async () => {
        try {
          await deletePayment.mutateAsync(id);
          message.success("Yozuv o'chirildi");
          refetch();
        } catch (err) {
          const e = err as { response?: { data?: { message?: string } } };
          message.error(e.response?.data?.message ?? "O'chirishda xatolik");
        }
      },
    });
  };

  const period = settlement?.period;
  const overall = settlement?.overall;

  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        message="Bu ekran kassa emas"
        description="Bu yerdagi to'lov yozuvlari kassa balansiga TEGMAYDI — ular faqat 'Elchi qancha yig'di / qancha to'ladi' farqini ko'rsatadi. Kassa harakati alohida, odatdagi kassa oqimi orqali kiritiladi."
      />

      {/* ═══════ BUTUN VAQT — QARZ ═══════ */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Butun vaqt bo'yicha qoldiq
          </span>
        }
        extra={
          <Button
            type="primary"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              form.setFieldsValue({ paid_at: dayjs() });
              setAddOpen(true);
            }}
          >
            Elchi'dan olingan to'lov
          </Button>
        }
        loading={isLoading}
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Statistic
            title="Jo'natilgan COD"
            value={money(overall?.cod_sent ?? 0)}
          />
          <Statistic
            title="Elchi yig'gan (net)"
            value={money(overall?.cod_collected ?? 0)}
          />
          <Statistic
            title="Elchi to'lagan"
            value={money(overall?.paid_by_elchi ?? 0)}
          />
          <Statistic
            title="Elchi bizga qarz"
            value={money(overall?.debt ?? 0)}
            valueStyle={{
              color: (overall?.debt ?? 0) > 0 ? "#ea580c" : "#16a34a",
            }}
          />
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Qarz <b>davr bo'yicha kesilmaydi</b> — u to'planib boradigan qoldiq.
          Oldingi oyda yig'ilib bu oyda to'langan pul aks holda "ortiqcha to'lov"
          bo'lib ko'rinardi.
        </p>
      </Card>

      {/* ═══════ DAVR HARAKATI ═══════ */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Banknote className="w-4 h-4" /> Davr harakati
          </span>
        }
        extra={
          <RangePicker
            value={range}
            allowClear={false}
            onChange={(v) => {
              if (v && v[0] && v[1]) setRange([v[0], v[1]]);
            }}
          />
        }
        loading={isLoading}
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Statistic
            title={`Jo'natildi (${period?.dispatched_count ?? 0} ta)`}
            value={money(period?.cod_sent ?? 0)}
          />
          <Statistic
            title={`Yig'ildi (${period?.collected_count ?? 0} ta)`}
            value={money(period?.cod_collected ?? 0)}
          />
          <Statistic
            title="Elchi to'ladi"
            value={money(period?.paid_by_elchi ?? 0)}
          />
          <Statistic
            title={
              <Tooltip title="Elchi ushlab qolgan summa — AYNI yig'ilgan posilkalar bo'yicha (jo'natilgan − qaytarilgan). Kutilgan qiymat = Elchi tarifi × yetkazilgan soni.">
                <span className="cursor-help">Elchi ushlagan</span>
              </Tooltip>
            }
            value={money(period?.elchi_fee ?? 0)}
          />
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          ⚠️ "Jo'natildi" posilka yaratilgan sana bo'yicha, "yig'ildi" esa holat
          o'zgargan sana bo'yicha sanaladi — pul buyurtma yaratilganda emas,
          yetkazilganda yig'iladi. Shu bois ikki raqam bir davrda teng
          bo'lmasligi normal. Shu sababli "Elchi ushlagan" ularning farqi EMAS —
          u aynan yig'ilgan posilkalar bo'yicha alohida hisoblanadi.
        </p>
      </Card>

      {/* ═══════ TO'LOVLAR ═══════ */}
      <Card title="Elchi'dan olingan to'lovlar" loading={isLoading}>
        <Table
          rowKey="id"
          size="small"
          dataSource={settlement?.payments ?? []}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          columns={[
            {
              title: "To'lov sanasi",
              dataIndex: "paid_at",
              width: 170,
              render: (v: number) => new Date(v).toLocaleString("uz-UZ"),
            },
            {
              title: "Summa",
              dataIndex: "amount",
              width: 160,
              render: (v: number) => (
                <b className="text-green-600">{money(v)}</b>
              ),
            },
            {
              title: "Izoh",
              dataIndex: "note",
              render: (v: string | null) => v ?? "—",
            },
            {
              title: "Kiritilgan",
              dataIndex: "created_at",
              width: 170,
              render: (v: number) => (
                <span className="text-xs text-gray-400">
                  {new Date(v).toLocaleString("uz-UZ")}
                </span>
              ),
            },
            {
              title: "",
              width: 60,
              render: (
                _: unknown,
                r: { id: string; amount: number },
              ) => (
                <Button
                  size="small"
                  danger
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => handleDelete(r.id, r.amount)}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={addOpen}
        title="Elchi'dan olingan to'lovni qayd etish"
        okText="Saqlash"
        cancelText="Bekor qilish"
        onCancel={() => {
          setAddOpen(false);
          form.resetFields();
        }}
        onOk={handleAdd}
        okButtonProps={{ loading: addPayment.isPending }}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="amount"
            label="Summa (so'm)"
            rules={[
              { required: true, message: "Summa kiritilishi shart" },
              {
                type: "number",
                min: 1,
                message: "Summa musbat bo'lishi kerak",
              },
            ]}
          >
            <InputNumber<number>
              className="w-full"
              min={1}
              step={1000}
              // Minglik ajratgich — katta summani ko'z bilan tekshirish uchun.
              formatter={(v) => `${v ?? ""}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}
              parser={(v) => Number(`${v ?? ""}`.replace(/\s/g, ""))}
            />
          </Form.Item>

          <Form.Item
            name="paid_at"
            label="To'lov sanasi"
            tooltip="Pul HAQIQATAN kelgan sana — kiritilgan sana emas. Kelajak sana qabul qilinmaydi."
            rules={[{ required: true, message: "Sana tanlanishi shart" }]}
          >
            <DatePicker
              className="w-full"
              showTime
              disabledDate={(d) => d && d.valueOf() > Date.now()}
            />
          </Form.Item>

          <Form.Item name="note" label="Izoh">
            <Input.TextArea
              rows={2}
              placeholder="O'tkazma raqami, kim topshirdi..."
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ElchiSettlementTab;
