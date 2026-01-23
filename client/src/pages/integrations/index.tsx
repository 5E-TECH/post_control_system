import { memo, useState, useMemo } from "react";
import {
  Plus,
  Settings,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  RefreshCw,
  Globe,
  Store,
  Loader2,
  Link2,
  Unlink,
  Search,
} from "lucide-react";
import { Modal, Form, Input, Select, Switch, message, Popconfirm } from "antd";
import {
  useExternalIntegration,
  type CreateIntegrationDto,
  type UpdateIntegrationDto,
  type ExternalIntegration,
} from "../../shared/api/hooks/useExternalIntegration";
import { useMarket } from "../../shared/api/hooks/useMarket/useMarket";

const IntegrationsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] =
    useState<ExternalIntegration | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [form] = Form.useForm();

  const {
    getIntegrations,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    testConnection,
  } = useExternalIntegration();

  const { getMarkets } = useMarket();

  const { data: integrationsData, isLoading } = getIntegrations();
  const { data: marketsData } = getMarkets(true);

  const integrations: ExternalIntegration[] =
    integrationsData?.data || [];

  // Filterlangan integratsiyalar
  const filteredIntegrations = useMemo(() => {
    if (!searchQuery.trim()) return integrations;
    const query = searchQuery.toLowerCase().trim();
    return integrations.filter(
      (integration) =>
        integration.name.toLowerCase().includes(query) ||
        integration.market?.name?.toLowerCase().includes(query) ||
        integration.slug.toLowerCase().includes(query)
    );
  }, [integrations, searchQuery]);

  // Markets data strukturasini tekshirish
  const markets = Array.isArray(marketsData?.data)
    ? marketsData.data
    : Array.isArray(marketsData?.data?.data)
      ? marketsData.data.data
      : Array.isArray(marketsData)
        ? marketsData
        : [];

  // Modal ochish
  const openModal = (integration?: ExternalIntegration) => {
    if (integration) {
      setEditingIntegration(integration);
      form.setFieldsValue({
        name: integration.name,
        slug: integration.slug,
        api_url: integration.api_url,
        api_key: integration.api_key,
        auth_type: integration.auth_type || 'api_key',
        auth_url: integration.auth_url,
        username: integration.username,
        password: integration.password,
        market_id: integration.market_id,
        is_active: integration.is_active,
      });
    } else {
      setEditingIntegration(null);
      form.resetFields();
      form.setFieldsValue({ is_active: true, auth_type: 'api_key' });
    }
    setIsModalOpen(true);
  };

  // Modal yopish
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingIntegration(null);
    form.resetFields();
  };

  // Saqlash
  const handleSave = async (values: any) => {
    try {
      if (editingIntegration) {
        // Yangilash
        const updateData: UpdateIntegrationDto = {
          name: values.name,
          api_url: values.api_url,
          api_key: values.api_key || undefined,
          auth_type: values.auth_type,
          auth_url: values.auth_url || undefined,
          username: values.username || undefined,
          password: values.password || undefined,
          market_id: values.market_id,
          is_active: values.is_active,
        };

        // Slug faqat o'zgarganda yuboriladi
        if (values.slug !== editingIntegration.slug) {
          updateData.slug = values.slug;
        }

        await updateIntegration.mutateAsync({
          id: editingIntegration.id,
          data: updateData,
        });
        message.success("Integratsiya muvaffaqiyatli yangilandi");
      } else {
        // Yaratish
        const createData: CreateIntegrationDto = {
          name: values.name,
          slug: values.slug,
          api_url: values.api_url,
          api_key: values.api_key || undefined,
          auth_type: values.auth_type || 'api_key',
          auth_url: values.auth_url || undefined,
          username: values.username || undefined,
          password: values.password || undefined,
          market_id: values.market_id,
          is_active: values.is_active ?? true,
        };
        await createIntegration.mutateAsync(createData);
        message.success("Integratsiya muvaffaqiyatli yaratildi");
      }
      closeModal();
    } catch (error: any) {
      message.error(
        error?.response?.data?.message || "Xatolik yuz berdi"
      );
    }
  };

  // O'chirish
  const handleDelete = async (id: string) => {
    try {
      await deleteIntegration.mutateAsync(id);
      message.success("Integratsiya o'chirildi");
    } catch (error: any) {
      message.error(
        error?.response?.data?.message || "O'chirishda xatolik"
      );
    }
  };

  // Ulanishni tekshirish
  const handleTestConnection = async (id: string) => {
    try {
      const result = await testConnection.mutateAsync(id);
      if (result?.data?.success) {
        message.success(
          `Ulanish muvaffaqiyatli! ${result?.data?.data_count ? `(${result.data.data_count} ta buyurtma)` : ""}`
        );
      } else {
        message.warning(result?.data?.message || "Ulanishda muammo");
      }
    } catch (error: any) {
      message.error("Ulanishni tekshirishda xatolik");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E] p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
              Tashqi Integratsiyalar
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Tashqi saytlar bilan integratsiyalarni boshqarish
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Qidirish..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 sm:w-64 pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2A263D] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
            />
          </div>

          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Yangi integratsiya
          </button>
        </div>
      </div>

      {/* Integrations List */}
      {filteredIntegrations.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center">
          <Unlink className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {searchQuery ? "Integratsiya topilmadi" : "Integratsiyalar yo'q"}
          </h3>
          <p className="text-center text-gray-500 dark:text-gray-400">
            {searchQuery
              ? `"${searchQuery}" bo'yicha hech narsa topilmadi`
              : "Hozircha integratsiyalar yo'q. Yangi qo'shish uchun tugmani bosing."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIntegrations.map((integration) => (
            <div
              key={integration.id}
              className={`bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm border overflow-hidden transition-all hover:shadow-md ${
                integration.is_active
                  ? "border-gray-100 dark:border-gray-800"
                  : "border-red-200 dark:border-red-900/30 opacity-75"
              }`}
            >
              {/* Card Header */}
              <div
                className={`px-4 py-3 border-b ${
                  integration.is_active
                    ? "bg-gradient-to-r from-green-500 to-emerald-500"
                    : "bg-gradient-to-r from-gray-400 to-gray-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-white" />
                    <h3 className="font-bold text-white text-lg">
                      {integration.name}
                    </h3>
                  </div>
                  <span
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                      integration.is_active
                        ? "bg-white/20 text-white"
                        : "bg-white/20 text-white"
                    }`}
                  >
                    {integration.is_active ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Faol
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        Nofaol
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                {/* Market */}
                <div className="flex items-center gap-2 text-sm">
                  <Store className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-300">
                    {integration.market?.name || "Market tanlanmagan"}
                  </span>
                </div>

                {/* API URL */}
                <div className="flex items-center gap-2 text-sm">
                  <Link2 className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-500 dark:text-gray-400 truncate text-xs">
                    {integration.api_url}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Jami sinxronlangan:{" "}
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {integration.total_synced_orders}
                    </span>{" "}
                    ta
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    /{integration.slug}
                  </span>
                </div>
              </div>

              {/* Card Actions */}
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2">
                <button
                  onClick={() => handleTestConnection(integration.id)}
                  disabled={testConnection.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {testConnection.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Test
                </button>

                <button
                  onClick={() => openModal(integration)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors cursor-pointer"
                >
                  <Edit className="w-4 h-4" />
                  Tahrirlash
                </button>

                <Popconfirm
                  title="O'chirishni tasdiqlang"
                  description="Bu integratsiyani o'chirishni xohlaysizmi?"
                  onConfirm={() => handleDelete(integration.id)}
                  okText="Ha"
                  cancelText="Yo'q"
                  okButtonProps={{ danger: true }}
                >
                  <button className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Popconfirm>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            {editingIntegration ? (
              <Edit className="w-5 h-5 text-amber-500" />
            ) : (
              <Plus className="w-5 h-5 text-blue-500" />
            )}
            <span>
              {editingIntegration
                ? "Integratsiyani tahrirlash"
                : "Yangi integratsiya"}
            </span>
          </div>
        }
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          className="mt-4"
        >
          <Form.Item
            name="name"
            label="Integratsiya nomi"
            rules={[{ required: true, message: "Nom kiritilishi shart" }]}
          >
            <Input placeholder="Masalan: Adosh" size="large" />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Slug (URL uchun)"
            rules={[
              { required: true, message: "Slug kiritilishi shart" },
              {
                pattern: /^[a-z0-9-]+$/,
                message: "Faqat kichik harflar, raqamlar va tire (-)",
              },
            ]}
          >
            <Input
              placeholder="Masalan: adosh"
              size="large"
              disabled={!!editingIntegration}
            />
          </Form.Item>

          <Form.Item
            name="api_url"
            label="API URL"
            rules={[
              { required: true, message: "API URL kiritilishi shart" },
              { type: "url", message: "To'g'ri URL kiriting" },
            ]}
          >
            <Input
              placeholder="https://api.example.com/orders"
              size="large"
            />
          </Form.Item>

          <Form.Item name="api_key" label="API kaliti (ixtiyoriy)">
            <Input.Password
              placeholder="API token yoki kalit"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="auth_type"
            label="Autentifikatsiya turi"
            initialValue="api_key"
          >
            <Select
              size="large"
              options={[
                { value: 'api_key', label: 'API Kalit (oddiy)' },
                { value: 'login', label: 'Login (username/password)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.auth_type !== curr.auth_type}
          >
            {({ getFieldValue }) =>
              getFieldValue('auth_type') === 'login' ? (
                <>
                  <Form.Item
                    name="auth_url"
                    label="Login URL"
                    rules={[
                      { required: true, message: "Login URL kiritilishi shart" },
                    ]}
                  >
                    <Input
                      placeholder="https://api.example.com/auth/token"
                      size="large"
                    />
                  </Form.Item>

                  <Form.Item
                    name="username"
                    label="Username"
                    rules={[
                      { required: true, message: "Username kiritilishi shart" },
                    ]}
                  >
                    <Input placeholder="Login username" size="large" />
                  </Form.Item>

                  <Form.Item
                    name="password"
                    label="Password"
                    rules={[
                      { required: true, message: "Password kiritilishi shart" },
                    ]}
                  >
                    <Input.Password placeholder="Login password" size="large" />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>

          <Form.Item
            name="market_id"
            label="Biriktirilgan market"
            rules={[{ required: true, message: "Market tanlanishi shart" }]}
          >
            <Select
              placeholder="Market tanlang"
              size="large"
              showSearch
              optionFilterProp="children"
              options={(Array.isArray(markets) ? markets : []).map((market: any) => ({
                value: market.id,
                label: market.name,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="is_active"
            label="Holati"
            valuePropName="checked"
          >
            <Switch
              checkedChildren="Faol"
              unCheckedChildren="Nofaol"
            />
          </Form.Item>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={
                createIntegration.isPending || updateIntegration.isPending
              }
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {(createIntegration.isPending ||
                updateIntegration.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {editingIntegration ? "Saqlash" : "Yaratish"}
            </button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default memo(IntegrationsPage);
