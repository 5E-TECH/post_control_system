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
  AlertTriangle,
  RotateCcw,
  Zap,
  Activity,
  Clock,
  CheckCheck,
  Archive,
} from "lucide-react";
import { Modal, Form, Input, Select, Switch, message, Popconfirm, Tabs, Badge, Tooltip } from "antd";
import {
  useExternalIntegration,
  type CreateIntegrationDto,
  type UpdateIntegrationDto,
  type ExternalIntegration,
} from "../../shared/api/hooks/useExternalIntegration";
import { useIntegrationSync, type SyncJob } from "../../shared/api/hooks/useIntegrationSync";
import { useMarket } from "../../shared/api/hooks/useMarket/useMarket";

const IntegrationsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncIssuesModalOpen, setIsSyncIssuesModalOpen] = useState(false);
  const [isSyncMonitorOpen, setIsSyncMonitorOpen] = useState(false);
  const [syncMonitorTab, setSyncMonitorTab] = useState<string>("all");
  const [editingIntegration, setEditingIntegration] =
    useState<ExternalIntegration | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSyncJobs, setSelectedSyncJobs] = useState<string[]>([]);
  const [syncPage, setSyncPage] = useState(1);
  const [oldOrdersIntegrationFilter, setOldOrdersIntegrationFilter] = useState<string | undefined>(undefined);
  const [form] = Form.useForm();

  const {
    getIntegrations,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    testConnection,
  } = useExternalIntegration();

  const {
    getSyncStats,
    getFailedSyncs,
    getAllSyncs,
    getSuccessfulSyncs,
    getPendingSyncs,
    getUnsyncedCount,
    retrySync,
    bulkRetrySync,
    retryAllFailed,
    syncOldOrders,
  } = useIntegrationSync();

  const { getMarkets } = useMarket();

  // Sync statistikasi
  const { data: syncStatsData } = getSyncStats();
  const syncStats = syncStatsData?.data;
  const failedCount = syncStats?.permanently_failed || 0;

  // Failed sync joblar
  const { data: failedSyncsData, isLoading: isLoadingFailedSyncs } = getFailedSyncs(
    undefined,
    isSyncIssuesModalOpen || isSyncMonitorOpen
  );
  const failedSyncs: SyncJob[] = failedSyncsData?.data || [];

  // Barcha sync joblar (pagination bilan)
  const { data: allSyncsData, isLoading: isLoadingAllSyncs } = getAllSyncs(
    syncPage,
    20,
    syncMonitorTab === "all" ? undefined : syncMonitorTab as any,
    undefined,
    isSyncMonitorOpen
  );
  const allSyncs = allSyncsData?.data || { data: [], pagination: { total: 0, totalPages: 1 } };

  // Muvaffaqiyatli sync joblar
  const { data: successSyncsData, isLoading: isLoadingSuccessSyncs } = getSuccessfulSyncs(
    undefined,
    50,
    isSyncMonitorOpen && syncMonitorTab === "success"
  );
  const successSyncs: SyncJob[] = successSyncsData?.data || [];

  // Pending sync joblar
  const { data: pendingSyncsData, isLoading: isLoadingPendingSyncs } = getPendingSyncs(
    isSyncMonitorOpen && syncMonitorTab === "pending"
  );
  const pendingSyncs: SyncJob[] = pendingSyncsData?.data || [];

  // Sync qilinmagan eski buyurtmalar soni
  const { data: unsyncedCountData, isLoading: isLoadingUnsyncedCount } = getUnsyncedCount(
    oldOrdersIntegrationFilter,
    isSyncMonitorOpen && syncMonitorTab === "old_orders"
  );
  const unsyncedCount = unsyncedCountData?.data?.count || 0;

  const { data: integrationsData, isLoading } = getIntegrations();
  const { data: marketsData } = getMarkets(true, { limit: 0 });

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
        // Status sync config
        sync_enabled: integration.status_sync_config?.enabled ?? false,
        sync_endpoint: integration.status_sync_config?.endpoint || '/orders/{id}/status',
        sync_method: integration.status_sync_config?.method || 'PUT',
        sync_status_field: integration.status_sync_config?.status_field || 'status',
        sync_use_auth: integration.status_sync_config?.use_auth ?? true,
        sync_include_order_id: integration.status_sync_config?.include_order_id_in_body ?? false,
        sync_order_id_field: integration.status_sync_config?.order_id_field || 'order_id',
        // Status mapping
        status_sold: integration.status_mapping?.sold || 'completed',
        status_canceled: integration.status_mapping?.canceled || 'cancelled',
        status_paid: integration.status_mapping?.paid || 'paid',
        status_rollback: integration.status_mapping?.rollback || 'returned',
        status_waiting: integration.status_mapping?.waiting || 'pending',
      });
    } else {
      setEditingIntegration(null);
      form.resetFields();
      form.setFieldsValue({
        is_active: true,
        auth_type: 'api_key',
        sync_enabled: false,
        sync_endpoint: '/orders/{id}/status',
        sync_method: 'PUT',
        sync_status_field: 'status',
        sync_use_auth: true,
        sync_include_order_id: false,
        sync_order_id_field: 'order_id',
        status_sold: 'completed',
        status_canceled: 'cancelled',
        status_paid: 'paid',
        status_rollback: 'returned',
        status_waiting: 'pending',
      });
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
      // Status sync config
      const statusSyncConfig = {
        enabled: values.sync_enabled,
        endpoint: values.sync_endpoint,
        method: values.sync_method,
        status_field: values.sync_status_field,
        use_auth: values.sync_use_auth,
        include_order_id_in_body: values.sync_include_order_id,
        order_id_field: values.sync_order_id_field,
      };

      // Status mapping
      const statusMapping = {
        sold: values.status_sold,
        canceled: values.status_canceled,
        paid: values.status_paid,
        rollback: values.status_rollback,
        waiting: values.status_waiting,
      };

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
          status_sync_config: statusSyncConfig,
          status_mapping: statusMapping,
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
          status_sync_config: statusSyncConfig,
          status_mapping: statusMapping,
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

  // Bitta sync jobni qayta urinish
  const handleRetrySync = async (jobId: string) => {
    try {
      await retrySync.mutateAsync(jobId);
      message.success("Qayta sync qilish boshlandi");
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Xatolik yuz berdi");
    }
  };

  // Tanlangan sync joblarni qayta urinish
  const handleBulkRetrySync = async () => {
    if (selectedSyncJobs.length === 0) {
      message.warning("Hech narsa tanlanmagan");
      return;
    }
    try {
      await bulkRetrySync.mutateAsync(selectedSyncJobs);
      message.success(`${selectedSyncJobs.length} ta sync job qayta queue ga qo'shildi`);
      setSelectedSyncJobs([]);
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Xatolik yuz berdi");
    }
  };

  // Barcha failed sync joblarni qayta urinish
  const handleRetryAllFailed = async () => {
    try {
      const result = await retryAllFailed.mutateAsync(undefined);
      message.success(result?.message || "Barcha failed joblar qayta queue ga qo'shildi");
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Xatolik yuz berdi");
    }
  };

  // Eski buyurtmalarni sync qilish
  const handleSyncOldOrders = async () => {
    try {
      const result = await syncOldOrders.mutateAsync(oldOrdersIntegrationFilter);
      message.success(
        result?.message || `${result?.data?.queued || 0} ta eski buyurtma sync queue ga qo'shildi`
      );
    } catch (error: any) {
      message.error(error?.response?.data?.message || "Xatolik yuz berdi");
    }
  };

  // Sync job tanlash
  const toggleSyncJobSelection = (jobId: string) => {
    setSelectedSyncJobs((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId]
    );
  };

  // Barcha sync joblarni tanlash/olib tashlash
  const toggleAllSyncJobs = () => {
    if (selectedSyncJobs.length === failedSyncs.length) {
      setSelectedSyncJobs([]);
    } else {
      setSelectedSyncJobs(failedSyncs.map((job) => job.id));
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

          {/* Sync Monitor Button */}
          <Tooltip title="Sync monitoring - barcha sync jarayonlarini ko'rish">
            <button
              onClick={() => setIsSyncMonitorOpen(true)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all cursor-pointer ${
                failedCount > 0
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50"
                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
              }`}
            >
              <Activity className="w-5 h-5" />
              <span className="hidden sm:inline">Sync Monitor</span>
              {failedCount > 0 && (
                <Badge
                  count={failedCount}
                  size="small"
                  className="absolute -top-1 -right-1"
                />
              )}
            </button>
          </Tooltip>

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

      {/* Integration Modal */}
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
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          className="mt-4"
        >
          <Tabs
            defaultActiveKey="1"
            items={[
              {
                key: "1",
                label: "Asosiy",
                children: (
                  <>
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
                      <Input placeholder="https://api.example.com/orders" size="large" />
                    </Form.Item>

                    <Form.Item name="api_key" label="API kaliti (ixtiyoriy)">
                      <Input.Password placeholder="API token yoki kalit" size="large" />
                    </Form.Item>

                    <Form.Item name="auth_type" label="Autentifikatsiya turi">
                      <Select
                        size="large"
                        options={[
                          { value: "api_key", label: "API Kalit (oddiy)" },
                          { value: "login", label: "Login (username/password)" },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) => prev.auth_type !== curr.auth_type}
                    >
                      {({ getFieldValue }) =>
                        getFieldValue("auth_type") === "login" ? (
                          <>
                            <Form.Item
                              name="auth_url"
                              label="Login URL"
                              rules={[{ required: true, message: "Login URL kiritilishi shart" }]}
                            >
                              <Input placeholder="https://api.example.com/auth/token" size="large" />
                            </Form.Item>
                            <Form.Item
                              name="username"
                              label="Username"
                              rules={[{ required: true, message: "Username kiritilishi shart" }]}
                            >
                              <Input placeholder="Login username" size="large" />
                            </Form.Item>
                            <Form.Item
                              name="password"
                              label="Password"
                              rules={[{ required: true, message: "Password kiritilishi shart" }]}
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

                    <Form.Item name="is_active" label="Holati" valuePropName="checked">
                      <Switch checkedChildren="Faol" unCheckedChildren="Nofaol" />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: "2",
                label: (
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    Status Sync
                  </span>
                ),
                children: (
                  <>
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Status sinxronlash yoqilganda, buyurtma holati o'zgarganda (sotildi, bekor, qaytarildi)
                        tashqi tizimga avtomatik xabar yuboriladi.
                      </p>
                    </div>

                    <Form.Item name="sync_enabled" label="Status sinxronlash" valuePropName="checked">
                      <Switch checkedChildren="Yoqilgan" unCheckedChildren="O'chirilgan" />
                    </Form.Item>

                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) => prev.sync_enabled !== curr.sync_enabled}
                    >
                      {({ getFieldValue }) =>
                        getFieldValue("sync_enabled") ? (
                          <>
                            <Form.Item
                              name="sync_endpoint"
                              label="API Endpoint"
                              tooltip="{id} o'rniga buyurtma ID si qo'yiladi"
                            >
                              <Input placeholder="/orders/{id}/status" size="large" />
                            </Form.Item>

                            <div className="grid grid-cols-2 gap-4">
                              <Form.Item name="sync_method" label="HTTP Method">
                                <Select
                                  size="large"
                                  options={[
                                    { value: "PUT", label: "PUT" },
                                    { value: "PATCH", label: "PATCH" },
                                    { value: "POST", label: "POST" },
                                  ]}
                                />
                              </Form.Item>

                              <Form.Item name="sync_status_field" label="Status Field">
                                <Input placeholder="status" size="large" />
                              </Form.Item>
                            </div>

                            <Form.Item name="sync_use_auth" label="Authorization ishlatish" valuePropName="checked">
                              <Switch checkedChildren="Ha" unCheckedChildren="Yo'q" />
                            </Form.Item>

                            <Form.Item
                              name="sync_include_order_id"
                              label="Order ID ni body ga qo'shish"
                              valuePropName="checked"
                              tooltip="Tashqi API order_id ni body ichida kutsa yoqing"
                            >
                              <Switch checkedChildren="Ha" unCheckedChildren="Yo'q" />
                            </Form.Item>

                            <Form.Item
                              noStyle
                              shouldUpdate={(prev, curr) => prev.sync_include_order_id !== curr.sync_include_order_id}
                            >
                              {({ getFieldValue }) =>
                                getFieldValue("sync_include_order_id") ? (
                                  <Form.Item
                                    name="sync_order_id_field"
                                    label="Order ID field nomi"
                                    tooltip="Tashqi API kutadigan order ID field nomi"
                                  >
                                    <Input placeholder="order_id" size="large" />
                                  </Form.Item>
                                ) : null
                              }
                            </Form.Item>

                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <h4 className="font-medium text-gray-800 dark:text-white mb-3">
                                Status Mapping
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                                Bizning tizim statuslarini tashqi tizim statuslariga moslashtiring
                              </p>

                              <div className="grid grid-cols-2 gap-4">
                                <Form.Item name="status_sold" label="Sotildi →">
                                  <Input placeholder="completed" size="large" />
                                </Form.Item>
                                <Form.Item name="status_canceled" label="Bekor qilindi →">
                                  <Input placeholder="cancelled" size="large" />
                                </Form.Item>
                                <Form.Item name="status_paid" label="To'landi →">
                                  <Input placeholder="paid" size="large" />
                                </Form.Item>
                                <Form.Item name="status_rollback" label="Qaytarildi →">
                                  <Input placeholder="returned" size="large" />
                                </Form.Item>
                                <Form.Item name="status_waiting" label="Kutilmoqda →">
                                  <Input placeholder="pending" size="large" />
                                </Form.Item>
                              </div>
                            </div>
                          </>
                        ) : null
                      }
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />

          <div className="flex gap-3 pt-4 border-t mt-4">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={createIntegration.isPending || updateIntegration.isPending}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium shadow-lg shadow-blue-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {(createIntegration.isPending || updateIntegration.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {editingIntegration ? "Saqlash" : "Yaratish"}
            </button>
          </div>
        </Form>
      </Modal>

      {/* Sync Issues Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Sinxronlash muammolari</span>
          </div>
        }
        open={isSyncIssuesModalOpen}
        onCancel={() => {
          setIsSyncIssuesModalOpen(false);
          setSelectedSyncJobs([]);
        }}
        footer={null}
        width={700}
      >
        {isLoadingFailedSyncs ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : failedSyncs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
            <p className="text-gray-600 dark:text-gray-300">Hech qanday sync muammosi yo'q</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSyncJobs.length === failedSyncs.length}
                  onChange={toggleAllSyncJobs}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Barchasini tanlash ({failedSyncs.length})
                </span>
              </label>

              <div className="flex gap-2">
                {selectedSyncJobs.length > 0 && (
                  <button
                    onClick={handleBulkRetrySync}
                    disabled={bulkRetrySync.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {bulkRetrySync.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    Tanlanganlarni qayta sync ({selectedSyncJobs.length})
                  </button>
                )}

                <button
                  onClick={handleRetryAllFailed}
                  disabled={retryAllFailed.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm font-medium hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {retryAllFailed.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Barchasini qayta sync
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {failedSyncs.map((job) => (
                <div
                  key={job.id}
                  className={`p-3 rounded-lg border ${
                    selectedSyncJobs.includes(job.id)
                      ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20"
                      : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSyncJobs.includes(job.id)}
                      onChange={() => toggleSyncJobSelection(job.id)}
                      className="w-4 h-4 mt-1 rounded border-gray-300"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-800 dark:text-white">
                          #{job.external_order_id}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          {job.action}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                        <span>{job.integration?.name}</span>
                        <span>•</span>
                        <span>
                          {job.old_status} → {job.new_status}
                        </span>
                        <span>•</span>
                        <span>{job.attempts}/{job.max_attempts} urinish</span>
                      </div>

                      {job.last_error && (
                        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded truncate">
                          {job.last_error}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleRetrySync(job.id)}
                      disabled={retrySync.isPending}
                      className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {retrySync.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      {/* Sync Monitor Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <span>Sync Monitor</span>
          </div>
        }
        open={isSyncMonitorOpen}
        onCancel={() => {
          setIsSyncMonitorOpen(false);
          setSyncMonitorTab("all");
          setSyncPage(1);
        }}
        footer={null}
        width={900}
      >
        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-blue-600 dark:text-blue-400">Kutilmoqda</span>
            </div>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {syncStats?.pending || 0}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="w-4 h-4 text-yellow-500" />
              <span className="text-xs text-yellow-600 dark:text-yellow-400">Jarayonda</span>
            </div>
            <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
              {syncStats?.processing || 0}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <CheckCheck className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-600 dark:text-green-400">Muvaffaqiyatli</span>
            </div>
            <p className="text-xl font-bold text-green-700 dark:text-green-300">
              {syncStats?.success || 0}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-600 dark:text-red-400">Muvaffaqiyatsiz</span>
            </div>
            <p className="text-xl font-bold text-red-700 dark:text-red-300">
              {syncStats?.permanently_failed || 0}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          activeKey={syncMonitorTab}
          onChange={(key) => {
            setSyncMonitorTab(key);
            setSyncPage(1);
          }}
          items={[
            {
              key: "all",
              label: (
                <span className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4" />
                  Barchasi
                </span>
              ),
              children: (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {isLoadingAllSyncs ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  ) : allSyncs.data?.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Sync joblar topilmadi
                    </div>
                  ) : (
                    allSyncs.data?.map((job: SyncJob) => (
                      <SyncJobItem key={job.id} job={job} onRetry={handleRetrySync} />
                    ))
                  )}
                </div>
              ),
            },
            {
              key: "success",
              label: (
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Muvaffaqiyatli
                </span>
              ),
              children: (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {isLoadingSuccessSyncs ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  ) : successSyncs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Muvaffaqiyatli sync joblar topilmadi
                    </div>
                  ) : (
                    successSyncs.map((job) => (
                      <SyncJobItem key={job.id} job={job} onRetry={handleRetrySync} />
                    ))
                  )}
                </div>
              ),
            },
            {
              key: "failed",
              label: (
                <span className="flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Muvaffaqiyatsiz
                  {failedCount > 0 && (
                    <Badge count={failedCount} size="small" />
                  )}
                </span>
              ),
              children: (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {isLoadingFailedSyncs ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  ) : failedSyncs.length === 0 ? (
                    <div className="flex flex-col items-center py-8">
                      <CheckCircle className="w-10 h-10 text-green-500 mb-2" />
                      <p className="text-gray-500">Muvaffaqiyatsiz sync joblar yo'q</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={handleRetryAllFailed}
                          disabled={retryAllFailed.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm font-medium hover:bg-green-200 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {retryAllFailed.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          Barchasini qayta sync
                        </button>
                      </div>
                      {failedSyncs.map((job) => (
                        <SyncJobItem key={job.id} job={job} onRetry={handleRetrySync} showError />
                      ))}
                    </>
                  )}
                </div>
              ),
            },
            {
              key: "pending",
              label: (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Kutilmoqda
                </span>
              ),
              children: (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {isLoadingPendingSyncs ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    </div>
                  ) : pendingSyncs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Kutilayotgan sync joblar yo'q
                    </div>
                  ) : (
                    pendingSyncs.map((job) => (
                      <SyncJobItem key={job.id} job={job} onRetry={handleRetrySync} />
                    ))
                  )}
                </div>
              ),
            },
            {
              key: "old_orders",
              label: (
                <span className="flex items-center gap-1.5">
                  <Archive className="w-4 h-4 text-orange-500" />
                  Eski buyurtmalar
                  {unsyncedCount > 0 && (
                    <Badge count={unsyncedCount} size="small" />
                  )}
                </span>
              ),
              children: (
                <div className="space-y-4">
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-start gap-3">
                      <Archive className="w-5 h-5 text-orange-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-orange-800 dark:text-orange-300 mb-1">
                          Eski buyurtmalarni sinxronlash
                        </h4>
                        <p className="text-sm text-orange-600 dark:text-orange-400">
                          Allaqachon sotilgan yoki bekor qilingan, lekin tashqi saytga hali sync qilinmagan
                          buyurtmalarni topib, ularning holatini tashqi saytga yuborish.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Integration filter */}
                  <div className="flex items-center gap-3">
                    <Select
                      placeholder="Barcha integratsiyalar"
                      allowClear
                      size="large"
                      className="flex-1"
                      value={oldOrdersIntegrationFilter}
                      onChange={(value) => setOldOrdersIntegrationFilter(value)}
                      options={integrations.map((i) => ({
                        value: i.id,
                        label: i.name,
                      }))}
                    />
                  </div>

                  {/* Count va action */}
                  <div className="p-4 bg-white dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Sync qilinmagan buyurtmalar
                        </p>
                        {isLoadingUnsyncedCount ? (
                          <Loader2 className="w-5 h-5 animate-spin text-blue-500 mt-1" />
                        ) : (
                          <p className="text-2xl font-bold text-gray-800 dark:text-white">
                            {unsyncedCount} <span className="text-sm font-normal text-gray-500">ta</span>
                          </p>
                        )}
                      </div>

                      <Popconfirm
                        title="Eski buyurtmalarni sync qilish"
                        description={`${unsyncedCount} ta buyurtma sync queue ga qo'shiladi. Davom etsinmi?`}
                        onConfirm={handleSyncOldOrders}
                        okText="Ha, boshlash"
                        cancelText="Bekor qilish"
                        okButtonProps={{
                          loading: syncOldOrders.isPending,
                        }}
                      >
                        <button
                          disabled={unsyncedCount === 0 || syncOldOrders.isPending}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {syncOldOrders.isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-5 h-5" />
                          )}
                          Sync boshlash
                        </button>
                      </Popconfirm>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      Sync boshlangandan so'ng, buyurtmalar "Kutilmoqda" tabiga qo'shiladi va
                      navbat bilan tashqi saytga yuboriladi. Jarayonni "Kutilmoqda" va "Barchasi" tablarida kuzatishingiz mumkin.
                    </p>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

// Sync Job Item Component
const SyncJobItem = ({
  job,
  onRetry,
  showError = false,
}: {
  job: SyncJob;
  onRetry: (id: string) => void;
  showError?: boolean;
}) => {
  const statusColors: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const actionLabels: Record<string, string> = {
    sold: "Sotildi",
    canceled: "Bekor",
    paid: "To'landi",
    rollback: "Qaytarildi",
    waiting: "Kutilmoqda",
  };

  return (
    <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-800 dark:text-white">
              #{job.external_order_id}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${statusColors[job.status]}`}>
              {job.status === "success" ? "✓" : job.status}
            </span>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
              {actionLabels[job.action] || job.action}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{job.integration?.name}</span>
            <span>•</span>
            <span>→ {job.external_status}</span>
            {job.synced_at && (
              <>
                <span>•</span>
                <span>{new Date(Number(job.synced_at)).toLocaleString("uz-UZ")}</span>
              </>
            )}
            {job.status === "failed" && (
              <>
                <span>•</span>
                <span className="text-red-500">{job.attempts}/{job.max_attempts} urinish</span>
              </>
            )}
          </div>

          {showError && job.last_error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded line-clamp-2">
              {job.last_error}
            </p>
          )}
        </div>

        {job.status === "failed" && (
          <button
            onClick={() => onRetry(job.id)}
            className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default memo(IntegrationsPage);
