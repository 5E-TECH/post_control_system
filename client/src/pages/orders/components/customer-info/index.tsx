import { Select, Spin, Empty } from "antd";
import {
  memo,
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { setCustomerData } from "../../../../shared/lib/features/customer_and_market-id";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import type { RootState } from "../../../../app/store";
import { useTranslation } from "react-i18next";
import { debounce } from "../../../../shared/helpers/DebounceFunc";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import {
  User,
  Phone,
  MapPin,
  Home,
  Search,
  History,
  Package,
  Calendar,
  ChevronRight,
  X,
  UserCheck,
  Loader2,
} from "lucide-react";

export interface ICustomer {
  id?: string;
  phone_number: string;
  extra_number?: string;
  region_id?: string | null;
  district_id?: string | null;
  name: string;
  address?: string;
}

export const initialState: ICustomer = {
  phone_number: "+998 ",
  extra_number: "",
  region_id: null,
  district_id: null,
  name: "",
  address: "",
};

interface SuggestedCustomer {
  id: string;
  name: string;
  phone_number: string;
  address?: string;
  district_id?: string;
  district?: {
    id: string;
    name: string;
    region?: {
      id: string;
      name: string;
    };
  };
}

interface OrderHistoryItem {
  id: string;
  status: string;
  total_price: number;
  created_at: number;
  where_deliver: string;
  market_name: string;
  items: {
    product_name: string;
    quantity: number;
  }[];
}

const CustomerInfocomp = () => {
  const { t } = useTranslation("createOrder");
  const [formData, setFormData] = useState<ICustomer>(initialState);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [showHistory, setShowHistory] = useState(false);

  const { getRegions, getRegionsById } = useRegion();
  const { data: allRegions } = getRegions();
  const dispatch = useDispatch();
  const { role } = useSelector((state: RootState) => state.roleSlice);

  // Get market_id from localStorage
  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const market_id = market?.id;

  // Customer suggestion hook
  const { suggestCustomer, getCustomerOrderHistory } = useUser();
  const { data: suggestionsData, isLoading: suggestionsLoading } =
    suggestCustomer(phoneSearch, market_id);
  const suggestions: SuggestedCustomer[] = suggestionsData?.data || [];

  // Customer order history
  const { data: historyData, isLoading: historyLoading } =
    getCustomerOrderHistory(selectedCustomerId || "", market_id, !!selectedCustomerId && showHistory);
  const orderHistory: OrderHistoryItem[] = historyData?.data?.orders || [];

  const regions = allRegions?.data?.map((item: any) => ({
    value: item.id,
    label: item.name,
  }));

  const debouncedPhoneSearch = useCallback(
    debounce((value: string) => {
      const cleanPhone = value.replace(/\D/g, "");
      setPhoneSearch(cleanPhone);
      // Show suggestions when we have at least 9 digits (998 + 6 more)
      if (cleanPhone.length >= 9) {
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }, 300),
    []
  );

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updated = { ...formData, [name]: value };
    setFormData(updated);
    dispatch(setCustomerData(updated));
  };

  const handleSelectChange = useCallback(
    (name: keyof ICustomer, value: string | null) => {
      setFormData((prev) => {
        const updated = { ...prev, [name]: value };
        dispatch(setCustomerData(updated));
        return updated;
      });
    },
    [dispatch]
  );

  // Handle region change - also resets district
  const handleRegionChange = useCallback(
    (value: string | null) => {
      setFormData((prev) => {
        const updated = { ...prev, region_id: value, district_id: null };
        dispatch(setCustomerData(updated));
        return updated;
      });
    },
    [dispatch]
  );

  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.startsWith("998")) val = val.slice(3);
    let formatted = "+998 ";
    if (val.length > 0) {
      formatted += val
        .replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/, (_, a, b, c, d) =>
          [a, b, c, d].filter(Boolean).join(" ")
        )
        .trim();
    }

    const updated = { ...formData, phone_number: formatted };
    setFormData(updated);
    dispatch(setCustomerData(updated));

    // Trigger phone search for suggestions
    debouncedPhoneSearch(formatted);
    setSelectedCustomerId(null);
  };

  const handleExtraPhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (raw.startsWith("998")) raw = raw.slice(3);

    if (!raw) {
      const updated = { ...formData, extra_number: "" };
      setFormData(updated);
      dispatch(setCustomerData(updated));
      return;
    }

    let formatted = "+998 ";
    formatted += raw
      .replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/, (_, a, b, c, d) =>
        [a, b, c, d].filter(Boolean).join(" ")
      )
      .trim();

    const updated = { ...formData, extra_number: formatted };
    setFormData(updated);
    dispatch(setCustomerData(updated));
  };

  // Select a suggested customer
  const handleSelectCustomer = (customer: SuggestedCustomer) => {
    const updated: ICustomer = {
      id: customer.id,
      phone_number: customer.phone_number,
      name: customer.name,
      address: customer.address || "",
      district_id: customer.district_id || null,
      region_id: customer.district?.region?.id || null,
      extra_number: "",
    };
    setFormData(updated);
    dispatch(setCustomerData(updated));
    setSelectedCustomerId(customer.id);
    setShowSuggestions(false);
    setPhoneSearch("");
  };

  const customerData = useSelector(
    (state: RootState) => state.setCustomerData.customerData
  );

  useEffect(() => {
    if (customerData) {
      setFormData({
        ...initialState,
        ...customerData,
        extra_number: customerData.extra_number || "",
      });
      if (customerData.id) {
        setSelectedCustomerId(customerData.id);
      }
    } else {
      setFormData(initialState);
      setSelectedCustomerId(null);
    }
  }, [customerData]);

  const { data } = getRegionsById(
    formData?.region_id as string,
    !!formData?.region_id
  );

  const specificDistrictsByRegion = data?.data?.districts?.map(
    (district: any) => ({
      value: district?.id,
      label: district?.name,
    })
  );

  const formatFullName = (value: string) => {
    if (!value) return "";
    return value
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("uz-UZ", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatPrice = (price: number) => {
    return price?.toLocaleString("uz-UZ") + " so'm";
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      received:
        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
      "on the road":
        "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      sold: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      cancelled:
        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    };
    return (
      colors[status] ||
      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
    );
  };

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                {t("customerInfo")}
              </h2>
              {selectedCustomerId && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  Mavjud mijoz tanlangan
                </p>
              )}
            </div>
          </div>

          {selectedCustomerId && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all cursor-pointer"
            >
              <History className="w-4 h-4" />
              Buyurtmalar tarixi
              <ChevronRight
                className={`w-4 h-4 transition-transform ${showHistory ? "rotate-90" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Form Content */}
      <div className="p-5 space-y-5">
        {/* Phone Number with Suggestions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Main Phone */}
          <div className="relative">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              <Phone className="w-3.5 h-3.5" />
              {t("customerForm.phone")} *
            </label>
            <div className="relative">
              <input
                name="phone_number"
                value={formData.phone_number}
                onChange={handlePhoneChange}
                onFocus={() => phoneSearch.length >= 9 && setShowSuggestions(true)}
                placeholder="+998 90 123 45 67"
                className="w-full h-11 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
              {suggestionsLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                </div>
              )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#342d4a] rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 max-h-60 overflow-y-auto">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Search className="w-3 h-3" />
                    Topilgan mijozlar ({suggestions.length})
                  </span>
                  <button
                    onClick={() => setShowSuggestions(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                {suggestions.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer)}
                    className="w-full p-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left border-b border-gray-50 dark:border-gray-700/50 last:border-0 cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-800 dark:text-white text-sm">
                          {customer.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {customer.phone_number}
                        </p>
                      </div>
                      {customer.district && (
                        <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-lg">
                          {customer.district.name}
                        </span>
                      )}
                    </div>
                    {customer.address && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate">
                        {customer.address}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Extra Phone */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              <Phone className="w-3.5 h-3.5" />
              {t("Qoshimcha raqam")}
            </label>
            <input
              name="extra_number"
              value={formData.extra_number || ""}
              onChange={handleExtraPhoneChange}
              placeholder="+998 "
              className="w-full h-11 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Name */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              <User className="w-3.5 h-3.5" />
              {t("customerForm.name")} *
            </label>
            <input
              name="name"
              value={formData.name}
              onChange={(e) => {
                const rawValue = e.target.value;
                const updated = { ...formData, name: formatFullName(rawValue) };
                setFormData(updated);
                dispatch(setCustomerData(updated));
              }}
              placeholder={t("placeholder.name")}
              className="w-full h-11 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Region and District */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {t("customerForm.region")}
            </label>
            <Select
              value={formData.region_id}
              onChange={handleRegionChange}
              placeholder={t("placeholder.selectRegion")}
              className="w-full [&_.ant-select-selector]:h-11! [&_.ant-select-selector]:rounded-xl! [&_.ant-select-selector]:border-gray-200! [&_.ant-select-selector]:bg-gray-50! dark:[&_.ant-select-selector]:border-gray-600! dark:[&_.ant-select-selector]:bg-gray-800! [&_.ant-select-selection-item]:leading-[42px]! dark:[&_.ant-select-selection-item]:text-gray-200! dark:[&_.ant-select-selection-placeholder]:text-gray-500!"
              options={regions}
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              allowClear
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {t("customerForm.district")} *
            </label>
            <Select
              value={formData.district_id}
              onChange={(value) => handleSelectChange("district_id", value)}
              placeholder={t("placeholder.selectDistrict")}
              className="w-full [&_.ant-select-selector]:h-11! [&_.ant-select-selector]:rounded-xl! [&_.ant-select-selector]:border-gray-200! [&_.ant-select-selector]:bg-gray-50! dark:[&_.ant-select-selector]:border-gray-600! dark:[&_.ant-select-selector]:bg-gray-800! [&_.ant-select-selection-item]:leading-[42px]! dark:[&_.ant-select-selection-item]:text-gray-200! dark:[&_.ant-select-selection-placeholder]:text-gray-500!"
              options={formData?.region_id ? specificDistrictsByRegion : []}
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                String(option?.label ?? "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
              allowClear
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            <Home className="w-3.5 h-3.5" />
            {t("customerForm.address")}
          </label>
          <input
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder={t("placeholder.address")}
            className="w-full h-11 px-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Order History Panel */}
      {showHistory && selectedCustomerId && (
        <div className="border-t border-gray-100 dark:border-gray-700/50">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-purple-500" />
              <h3 className="font-semibold text-gray-800 dark:text-white">
                Buyurtmalar tarixi
              </h3>
              {historyData?.data?.total_orders > 0 && (
                <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                  {historyData.data.total_orders} ta
                </span>
              )}
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spin />
              </div>
            ) : orderHistory.length === 0 ? (
              <Empty
                description={
                  <span className="text-gray-500 dark:text-gray-400">
                    Bu mijozda hali buyurtma yo'q
                  </span>
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {orderHistory.map((order) => (
                  <div
                    key={order.id}
                    className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-lg font-medium ${getStatusColor(order.status)}`}
                        >
                          {order.status}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(order.created_at)}
                        </span>
                      </div>
                      <span className="font-semibold text-gray-800 dark:text-white">
                        {formatPrice(order.total_price)}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {order.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-gray-600 dark:text-gray-300 flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-gray-400" />
                            {item.product_name}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {item.quantity} dona
                          </span>
                        </div>
                      ))}
                    </div>

                    {role !== "market" && order.market_name && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Market: {order.market_name}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(CustomerInfocomp);
