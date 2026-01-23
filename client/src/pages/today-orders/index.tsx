import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import { useMarket } from "../../shared/api/hooks/useMarket/useMarket";
import { useOrder } from "../../shared/api/hooks/useOrder";
import { useExternalIntegration } from "../../shared/api/hooks/useExternalIntegration";
import { useTranslation } from "react-i18next";
import { debounce } from "../../shared/helpers/DebounceFunc";
import {
  Store,
  Phone,
  Package,
  Search,
  ChevronRight,
  ShoppingBag,
  Loader2,
  TrendingUp,
  QrCode,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Globe,
  Trash2,
  CheckSquare,
  Square,
  MapPin,
  Clock,
  Home,
  Building2,
  Settings,
  RefreshCw,
  Link2,
} from "lucide-react";
import { message } from "antd";

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

// Tashqi buyurtma interfeysi (universal - field mapping orqali)
interface ExternalOrder {
  id: string | number;
  qrCode: string;
  full_name?: string;
  phone?: string;
  additional_phone?: string;
  region?: number | string;
  district?: number | string;
  address?: string;
  comment?: string;
  items?: string | any[];
  total_price?: number;
  delivery_price?: number;
  status?: string;
  created_at?: string;
  total_count?: number;
  selected?: boolean;
}

// Integratsiya interfeysi
interface Integration {
  id: string;
  name: string;
  slug: string;
  api_url: string;
  is_active: boolean;
  market_id: string;
  market?: {
    id: string;
    name: string;
    default_tariff?: string;
  };
  total_synced_orders?: number;
}

// Tashqi buyurtmalar komponenti
const ExternalOrdersTab = () => {
  const navigate = useNavigate();
  const role = useSelector((state: RootState) => state.roleSlice.role);
  const isSuperadmin = role === "superadmin";
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<ExternalOrder[]>([]);
  const [scannerBuffer, setScannerBuffer] = useState("");
  const [integrationSearch, setIntegrationSearch] = useState("");

  // useOrder hookdan receiveExternalOrders mutationini olish
  const { receiveExternalOrders } = useOrder();

  // Integratsiyalarni olish (dinamik)
  const { getActiveIntegrations, testConnection } = useExternalIntegration();
  const { data: integrationsData, isLoading: integrationsLoading, refetch: refetchIntegrations } = getActiveIntegrations();

  // Integratsiyalar ro'yxatini olish
  const integrations = useMemo(() => {
    if (!integrationsData) return [];
    if (Array.isArray(integrationsData)) return integrationsData;
    if (Array.isArray(integrationsData.data)) return integrationsData.data;
    if (integrationsData.data && Array.isArray(integrationsData.data.data)) return integrationsData.data.data;
    return [];
  }, [integrationsData]);

  // Filterlangan integratsiyalar (search uchun)
  const filteredIntegrations = useMemo(() => {
    if (!integrationSearch.trim()) return integrations;
    const query = integrationSearch.toLowerCase().trim();
    return integrations.filter(
      (integration: Integration) =>
        integration.name.toLowerCase().includes(query) ||
        integration.market?.name?.toLowerCase().includes(query) ||
        integration.slug.toLowerCase().includes(query)
    );
  }, [integrations, integrationSearch]);

  // Ref orqali hozirgi orders ga murojaat qilish (stale closure muammosini hal qilish)
  const ordersRef = useRef<ExternalOrder[]>([]);
  ordersRef.current = orders;

  // LocalStorage dan tokenni olish (o'z serverimizning tokeni)
  const getAuthToken = () => {
    return localStorage.getItem("x-auth-token") || "";
  };

  // Tanlangan buyurtmalarni qabul qilish
  const handleAcceptOrders = () => {
    if (!selectedIntegration) {
      message.warning("Integratsiya tanlanmagan!");
      return;
    }

    const selectedOrders = orders.filter(o => o.selected);
    if (selectedOrders.length === 0) {
      message.warning("Hech qanday buyurtma tanlanmagan!");
      return;
    }

    // Universal format - field mapping backend da qo'llaniladi
    receiveExternalOrders.mutate(
      {
        integration_id: selectedIntegration.id,
        orders: selectedOrders,
      },
      {
        onSuccess: (data: any) => {
          message.success(`${data?.message || 'Buyurtmalar qabul qilindi!'}`);
          // Qabul qilingan buyurtmalarni ro'yxatdan olib tashlash
          setOrders(prev => prev.filter(o => !o.selected));
          // Integratsiyalarni yangilash (sync counter uchun)
          refetchIntegrations();
        },
        onError: (err: any) => {
          message.error(err?.response?.data?.message || "Buyurtmalarni qabul qilishda xatolik yuz berdi");
        },
      }
    );
  };

  // Scanner listener - klaviaturadan tez kiritilgan ma'lumotni ushlab oladi
  useEffect(() => {
    if (!isReady || !selectedIntegration) return;

    let buffer = "";
    let timeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Agar input elementida bo'lsa, ishlamasin
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") {
        return;
      }

      // Enter bosilganda va buffer bo'sh bo'lmasa - qidirish
      if (e.key === "Enter" && buffer.length > 0) {
        e.preventDefault();
        const scannedCode = buffer;
        buffer = "";
        setScannerBuffer("");

        // Avtomatik qidirish
        handleScannerSearch(scannedCode);
        return;
      }

      // Faqat raqam va harflarni qabul qilish
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        buffer += e.key;
        setScannerBuffer(buffer);

        // 100ms ichida keyingi tugma bosilmasa - bufferni tozalash
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          buffer = "";
          setScannerBuffer("");
        }, 100);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timeout);
    };
  }, [isReady, selectedIntegration]);

  // Integratsiyani tanlash - backend proxy orqali test login
  const handleSelectIntegration = async (integration: Integration) => {
    setSelectedIntegration(integration);
    setError(null);
    setOrders([]);
    setAuthLoading(true);

    try {
      // Test connection orqali ulanishni tekshirish
      testConnection.mutate(integration.id, {
        onSuccess: (data: any) => {
          const result = data?.data || data;
          if (result?.success) {
            setIsReady(true);
            message.success(`${integration.name} ga muvaffaqiyatli ulandi!`);
          } else {
            setError("Ulanishda xatolik: " + (result?.message || "API bilan ulanib bo'lmadi"));
          }
          setAuthLoading(false);
        },
        onError: (err: any) => {
          setError("Ulanishda xatolik: " + (err?.response?.data?.message || err.message || "Tarmoq xatosi"));
          setAuthLoading(false);
        },
      });
    } catch (err: any) {
      console.error("❌ Auth error:", err);
      setError("Ulanishda xatolik: " + (err.message || "Tarmoq xatosi"));
      setAuthLoading(false);
    }
  };

  // Orqaga qaytish
  const handleBack = () => {
    setSelectedIntegration(null);
    setIsReady(false);
    setError(null);
    setOrders([]);
  };

  // Buyurtmani tanlash/bekor qilish
  const toggleOrderSelection = (orderId: string | number) => {
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, selected: !order.selected } : order
    ));
  };

  // Barcha buyurtmalarni tanlash/bekor qilish
  const toggleAllOrders = () => {
    const allSelected = orders.every(o => o.selected);
    setOrders(prev => prev.map(order => ({ ...order, selected: !allSelected })));
  };

  // Bitta buyurtmani o'chirish
  const removeOrder = (orderId: string | number) => {
    setOrders(prev => prev.filter(order => order.id !== orderId));
  };

  // Scanner orqali avtomatik qidirish
  const handleScannerSearch = async (scannedCode: string) => {
    if (!selectedIntegration || !isReady || loading) return;

    // Allaqachon shu QR kod bilan buyurtma bormi tekshirish (ordersRef orqali hozirgi qiymatni olish)
    const existingOrder = ordersRef.current.find(o => o.qrCode === scannedCode);
    if (existingOrder) {
      message.warning({ content: `Bu buyurtma allaqachon ro'yxatda mavjud!`, key: "scanner" });
      return;
    }

    console.log("🔍 Scanner orqali qidirish:", scannedCode);
    message.loading({ content: `Qidirilmoqda: ${scannedCode}`, key: "scanner" });

    setLoading(true);
    setError(null);

    try {
      // Backend proxy orqali integratsiya API siga so'rov yuborish
      const proxyEndpoint = `/api/v1/external-proxy/${selectedIntegration.slug}`;
      const response = await fetch(`${API_BASE}${proxyEndpoint}/qrorder/find`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({ qr_code: scannedCode }),
      });

      const data = await response.json();

      if (response.ok && data.success !== false) {
        // API javobidan data ni olish
        const orderData = data.data || data;

        // Yangi buyurtmani ro'yxatga qo'shish (default tanlangan)
        const newOrder: ExternalOrder = {
          ...orderData,
          qrCode: scannedCode,
          selected: true,
        };

        setOrders(prev => [newOrder, ...prev]); // Yangi buyurtma eng yuqorida
        message.success({ content: "Buyurtma topildi va qo'shildi!", key: "scanner" });
      } else {
        message.error({ content: "Buyurtma topilmadi", key: "scanner" });
        setError(`Xatolik (${response.status}): ${data.message || data.error || "Buyurtma topilmadi"}`);
      }
    } catch (err: any) {
      message.error({ content: "Xatolik yuz berdi", key: "scanner" });
      setError("So'rov yuborishda xatolik: " + (err.message || "Noma'lum xatolik"));
    } finally {
      setLoading(false);
    }
  };

  // Integratsiyalar ro'yxati
  if (!selectedIntegration) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Globe className="w-10 h-10 text-emerald-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Integratsiyalar</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                QR kod orqali tashqi buyurtmalarni qidirish uchun integratsiyani tanlang
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Market qidirish..."
                value={integrationSearch}
                onChange={(e) => setIntegrationSearch(e.target.value)}
                className="w-full sm:w-56 pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2A263D] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>
            <button
              onClick={() => refetchIntegrations()}
              disabled={integrationsLoading}
              className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#352F4A] transition-all disabled:opacity-50 cursor-pointer flex-shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${integrationsLoading ? 'animate-spin' : ''}`} />
            </button>
            {isSuperadmin && (
              <button
                onClick={() => navigate('/integrations')}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-medium flex items-center gap-2 hover:shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer flex-shrink-0"
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Boshqarish</span>
              </button>
            )}
          </div>
        </div>

        {integrationsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          </div>
        ) : filteredIntegrations.length === 0 ? (
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-12 text-center border border-gray-100 dark:border-gray-700/50">
            <Link2 className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              {integrationSearch ? "Integratsiya topilmadi" : "Faol integratsiya yo'q"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {integrationSearch
                ? `"${integrationSearch}" bo'yicha hech qanday market topilmadi`
                : "Integratsiyalar sahifasidan yangi integratsiya qo'shing"}
            </p>
            {!integrationSearch && isSuperadmin && (
              <button
                onClick={() => navigate('/integrations')}
                className="h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-medium flex items-center gap-2 mx-auto hover:shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                Integratsiyalarni boshqarish
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredIntegrations.map((integration: Integration) => (
              <div
                key={integration.id}
                onClick={() => handleSelectIntegration(integration)}
                className="p-4 bg-white dark:bg-[#2A263D] rounded-xl border border-gray-200 dark:border-gray-700/50 cursor-pointer transition-all hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-700"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-2xl shadow-lg flex-shrink-0">
                    🔗
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white truncate">{integration.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      Market: {integration.market?.name || 'Noma\'lum'}
                    </p>
                    {integration.total_synced_orders && integration.total_synced_orders > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                        ✓ {integration.total_synced_orders} ta sinxronlangan
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Tanlangan integratsiya interfeysi
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleBack}
          className="h-10 px-4 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-[#352F4A] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Orqaga</span>
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-xl shadow-md flex-shrink-0">
            🔗
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white truncate">{selectedIntegration.name}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Market: {selectedIntegration.market?.name || 'Noma\'lum'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isReady && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle className="w-3.5 h-3.5" /> Ulangan
            </span>
          )}
          {selectedIntegration.total_synced_orders && selectedIntegration.total_synced_orders > 0 && (
            <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {selectedIntegration.total_synced_orders} ta sinxronlangan
            </span>
          )}
        </div>
      </div>

      {/* Auth loading */}
      {authLoading && (
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-8 text-center border border-gray-100 dark:border-gray-700/50">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mx-auto" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">Ulanmoqda...</p>
        </div>
      )}

      {/* Auth error - qayta urinish */}
      {!isReady && !authLoading && (
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-8 text-center border border-gray-100 dark:border-gray-700/50">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
          <p className="text-red-600 dark:text-red-400 font-medium mb-2">Ulanishda xatolik!</p>
          {error && <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>}
          <button
            onClick={() => handleSelectIntegration(selectedIntegration)}
            className="h-10 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {/* Scanner holati va QR kod qidirish */}
      {isReady && !authLoading && (
        <>
          {/* Scanner Status Card */}
          <div className={`rounded-2xl shadow-sm p-6 border-2 transition-all ${
            loading
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700'
              : 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-700'
          }`}>
            <div className="text-center">
              {loading ? (
                <>
                  <Loader2 className="w-12 h-12 animate-spin text-amber-500 mx-auto" />
                  <p className="mt-4 text-lg font-medium text-amber-700 dark:text-amber-400">
                    Qidirilmoqda...
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4 animate-pulse">
                    <QrCode className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-lg font-medium text-emerald-700 dark:text-emerald-400">
                    Scanner tayyor!
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    QR kodni skanerlang - avtomatik qidiriladi
                  </p>
                  {scannerBuffer && (
                    <div className="mt-4 p-3 bg-white dark:bg-[#2A263D] rounded-lg border border-gray-200 dark:border-gray-700 inline-block">
                      <p className="text-xs text-gray-400 mb-1">Skanerlanmoqda:</p>
                      <p className="text-lg font-mono font-bold text-gray-800 dark:text-white">{scannerBuffer}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="text-red-700 dark:text-red-400 text-sm">{error}</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Buyurtmalar ro'yxati */}
      {orders.length > 0 && (
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700/50">
          {/* Select all header */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-[#252139] flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
            <button
              onClick={toggleAllOrders}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
            >
              {orders.every(o => o.selected) ? (
                <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Square className="w-5 h-5" />
              )}
              <span className="hidden sm:inline">
                {orders.every(o => o.selected)
                  ? "Barchasini bekor qilish"
                  : "Barchasini tanlash"}
              </span>
            </button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {orders.filter(o => o.selected).length} ta tanlangan
              </span>
              <span className="text-gray-300 dark:text-gray-600">•</span>
              <span className="text-sm font-semibold text-gray-800 dark:text-white">
                {orders.reduce((sum, o) => sum + (o.total_price || 0) + (o.delivery_price || 0), 0).toLocaleString()} so'm
              </span>
            </div>
          </div>

          {/* Orders list - scrollable */}
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            {orders.map((order, index) => (
              <div
                key={order.id || order.qrCode || index}
                onClick={() => toggleOrderSelection(order.id)}
                className={`p-3 sm:p-4 rounded-xl transition-all border cursor-pointer ${
                  order.selected
                    ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50"
                    : "bg-gray-50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-700/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/10"
                }`}
              >
                {/* Top row: checkbox, index, badges and date */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Checkbox */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOrderSelection(order.id);
                      }}
                      className="flex-shrink-0"
                    >
                      {order.selected ? (
                        <CheckSquare className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400">
                      #{order.id || index + 1}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs sm:text-sm font-medium bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="hidden sm:inline">{order.status || 'Yangi'}</span>
                    </span>
                    {selectedIntegration?.market?.default_tariff === "address" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs sm:text-sm font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                        <Home className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Uyga</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-xs sm:text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">Markazga</span>
                      </span>
                    )}
                  </div>
                  <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {order.created_at || new Date().toLocaleDateString('uz-UZ')}
                  </span>
                </div>

                {/* Main row: customer info + price + actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 flex-1 min-w-0">
                    {/* Name */}
                    <span className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white truncate">
                      {order.full_name || 'Mijoz'}
                    </span>
                    {/* Phone */}
                    {order.phone && (
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                        {(() => {
                          const cleanPhone = order.phone.replace(/\D/g, '');
                          if (cleanPhone.length === 9) {
                            return `+998 ${cleanPhone.slice(0, 2)} ${cleanPhone.slice(2, 5)} ${cleanPhone.slice(5, 7)} ${cleanPhone.slice(7)}`;
                          }
                          if (cleanPhone.length === 12 && cleanPhone.startsWith('998')) {
                            return `+${cleanPhone.slice(0, 3)} ${cleanPhone.slice(3, 5)} ${cleanPhone.slice(5, 8)} ${cleanPhone.slice(8, 10)} ${cleanPhone.slice(10)}`;
                          }
                          return order.phone;
                        })()}
                      </span>
                    )}
                    {/* Location */}
                    {order.address && (
                      <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5 truncate">
                        <MapPin className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{order.address}</span>
                      </span>
                    )}
                  </div>
                  {/* Price and actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-700/30">
                    <p className="text-sm sm:text-base font-bold text-gray-800 dark:text-white whitespace-nowrap">
                      {((order.total_price || 0) + (order.delivery_price || 0)).toLocaleString()} so'm
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOrder(order.id);
                      }}
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                      title="O'chirish"
                    >
                      <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </div>
                </div>

                {/* Products row */}
                {order.items && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {typeof order.items === 'string' ? (
                      order.items.split(',').slice(0, 4).map((item: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300"
                        >
                          {item.trim()}
                        </span>
                      ))
                    ) : Array.isArray(order.items) ? (
                      order.items.slice(0, 4).map((item: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-white dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300"
                        >
                          {item.name || item.product_name || item.title} x{item.quantity || item.count || 1}
                        </span>
                      ))
                    ) : null}
                    {Array.isArray(order.items) && order.items.length > 4 && (
                      <span className="text-sm text-gray-500 py-1">+{order.items.length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Accept button - fixed at bottom */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-[#252139] flex-shrink-0">
            <button
              onClick={handleAcceptOrders}
              disabled={orders.filter(o => o.selected).length === 0 || receiveExternalOrders.isPending}
              className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 text-base font-medium transition-all ${
                orders.filter(o => o.selected).length === 0 || receiveExternalOrders.isPending
                  ? "opacity-50 cursor-not-allowed bg-gray-300 dark:bg-gray-700 text-gray-500"
                  : "bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:shadow-lg hover:shadow-emerald-500/25 cursor-pointer"
              }`}
            >
              {receiveExternalOrders.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              {receiveExternalOrders.isPending
                ? "Qabul qilinmoqda..."
                : `Qabul qilish (${orders.filter(o => o.selected).length} ta buyurtma)`}
            </button>
          </div>
        </div>
      )}

      {/* Bo'sh holat */}
      {orders.length === 0 && isReady && !loading && (
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-8 sm:p-12 text-center border border-gray-100 dark:border-gray-700/50">
          <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Skanerlangan buyurtmalar yo'q
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            QR kodni skanerlang - buyurtmalar avtomatik qo'shiladi
          </p>
        </div>
      )}
    </div>
  );
};

const TodayOrders = () => {
  const { t } = useTranslation("todayOrderList");
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState("");
  const [searchData, setSearch] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("markets");
  const base =
    import.meta.env.BASE_URL && import.meta.env.BASE_URL !== "/"
      ? import.meta.env.BASE_URL.replace(/\/$/, "")
      : "";

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearch(value || null);
      }, 500),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    debouncedSearch(value);
  };

  const { pathname } = useLocation();
  const role = useSelector((state: RootState) => state.roleSlice);

  useEffect(() => {
    if (role.role === "market") {
      navigate(`${role.id}`);
    }
  }, [pathname]);

  const handleProps = (id: string) => {
    navigate(`${id}`);
  };

  const enabled = role.role !== "market";

  const { getMarketsNewOrder } = useMarket();
  const { data, isLoading, refetch } = getMarketsNewOrder(
    enabled,
    searchData ? { search: searchData } : ""
  );

  useEffect(() => {
    if (enabled) {
      refetch();
    }
  }, [pathname]);

  const normalizedPathname =
    base && pathname.startsWith(base)
      ? pathname.slice(base.length) || "/"
      : pathname;

  if (normalizedPathname.startsWith("/order/markets/new-orders/")) {
    return <Outlet />;
  }

  const markets = data?.data || [];

  // Format phone number
  const formatPhone = (phone: string | undefined) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 12 && cleaned.startsWith("998")) {
      return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 10)} ${cleaned.slice(10, 12)}`;
    }
    return phone;
  };

  // Calculate totals
  const totalOrders = markets.reduce((sum: number, m: any) => sum + (Number(m.length) || 0), 0);
  const totalPrice = markets.reduce((sum: number, m: any) => sum + (Number(m.orderTotalPrice) || 0), 0);

  // Markets content (useMemo bilan - focus yo'qolmasligi uchun)
  const marketsContent = (
    <>
      {/* Search */}
      <div className="mb-6 flex justify-end">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchValue}
            onChange={handleSearchChange}
            className="w-full sm:w-72 h-11 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2A263D] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
            type="text"
            placeholder={t("placeholder.search")}
          />
        </div>
      </div>

      {/* Stats Cards */}
      {!isLoading && markets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Store className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Marketlar</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{markets.length} ta</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Package className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Jami buyurtmalar</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{totalOrders} ta</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-[#2A263D] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Umumiy summa</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{totalPrice.toLocaleString()} so'm</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
        </div>
      ) : markets.length === 0 ? (
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm p-12 text-center">
          {searchData ? (
            <>
              <Search className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                Natija topilmadi
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                "{searchValue}" bo'yicha hech qanday market topilmadi
              </p>
            </>
          ) : (
            <>
              <Package className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
                Yangi buyurtmalar yo'q
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Hozircha hech qanday market yangi buyurtmalarga ega emas
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-purple-500 to-indigo-600">
                  <th className="px-6 py-4 text-left text-sm font-medium text-white">#</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-white">{t("market")}</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-white">{t("phone")}</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-white">{t("totalPrice")}</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-white">Buyurtmalar</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-white"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {markets.map((item: any, inx: number) => (
                  <tr
                    key={item?.market?.id}
                    onClick={() => handleProps(item?.market?.id)}
                    className="hover:bg-purple-50 dark:hover:bg-purple-900/10 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {inx + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                          <Store className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <span className="text-sm font-semibold text-gray-800 dark:text-white">
                          {item?.market?.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {formatPhone(item?.market?.phone_number)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">
                        {item?.orderTotalPrice?.toLocaleString()} so'm
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <Package className="w-4 h-4" />
                        {item?.length} ta
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <ChevronRight className="w-5 h-5 text-gray-400 inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
            {markets.map((item: any) => (
              <div
                key={item?.market?.id}
                onClick={() => handleProps(item?.market?.id)}
                className="p-4 hover:bg-purple-50 dark:hover:bg-purple-900/10 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <Store className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-white">
                        {item?.market?.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {formatPhone(item?.market?.phone_number)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50">
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <Package className="w-3 h-3" />
                      {item?.length} ta
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-800 dark:text-white">
                    {item?.orderTotalPrice?.toLocaleString()} so'm
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div>
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                {t("title")}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-13">
                Yangi buyurtmalar mavjud marketlar ro'yxati
              </p>
            </div>
          </div>
        </div>

        {/* Custom Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {/* Markets Tab */}
          <button
            onClick={() => setActiveTab("markets")}
            className={`flex items-center justify-center gap-2 py-2.5 lg:py-3 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "markets"
                ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25"
                : "bg-white dark:bg-[#2A263D] text-gray-700 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-gray-200 dark:border-gray-700"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              activeTab === "markets"
                ? "bg-white/20"
                : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
            }`}>
              <Store className="w-4 h-4" />
            </div>
            <span className="text-sm hidden sm:inline">Marketlar</span>
            {markets.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                activeTab === "markets"
                  ? "bg-white/20 text-white"
                  : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
              }`}>
                {markets.length}
              </span>
            )}
          </button>

          {/* External Orders Tab */}
          <button
            onClick={() => setActiveTab("external")}
            className={`flex items-center justify-center gap-2 py-2.5 lg:py-3 rounded-xl font-medium transition-all cursor-pointer ${
              activeTab === "external"
                ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/25"
                : "bg-white dark:bg-[#2A263D] text-gray-700 dark:text-gray-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-gray-200 dark:border-gray-700"
            }`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              activeTab === "external"
                ? "bg-white/20"
                : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
            }`}>
              <QrCode className="w-4 h-4" />
            </div>
            <span className="text-sm hidden sm:inline">Tashqi buyurtmalar</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "markets" ? marketsContent : <ExternalOrdersTab />}
      </div>
    </div>
  );
};

export default memo(TodayOrders);
