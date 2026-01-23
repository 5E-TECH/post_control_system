import { memo, useEffect, useMemo, useState } from "react";
import { useProduct } from "../../../../shared/api/hooks/useProduct";
import { useDispatch, useSelector } from "react-redux";
import { setOrderItems } from "../../../../shared/lib/features/customer_and_market-id";
import type { RootState } from "../../../../app/store";
import { debounce } from "../../../../shared/helpers/DebounceFunc";
import { useTranslation } from "react-i18next";
import { DEFAULT_PRODUCT_IMAGE } from "../../../../shared/const";
import {
  Package,
  Plus,
  Trash2,
  Search,
  Minus,
  ShoppingBag,
} from "lucide-react";
import { Select, Empty } from "antd";

export interface IOrderItems {
  product_id: string | undefined;
  quantity: number | string;
  search?: string;
  product_name?: string;
  product_image?: string;
}

const OrderItems = () => {
  const user = useSelector((state: RootState) => state.roleSlice);
  const { t } = useTranslation("createOrder");
  const [formDataList, setFormDataList] = useState<IOrderItems[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [selectKey, setSelectKey] = useState(0); // Force re-render Select after selection

  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const marketId = market?.id;
  const { getProductsByMarket, getMyProducts } = useProduct();

  const myProductsQuery = getMyProducts(
    undefined,
    user.role === "market" || user.role === "operator"
  );

  const marketProductsQuery = getProductsByMarket(
    marketId as string,
    user.role !== "market" && user.role !== "operator"
  );

  const data =
    user.role === "market" || user.role === "operator"
      ? myProductsQuery.data
      : marketProductsQuery.data;

  const allProducts = data?.data?.products || [];

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchValue(value);
      }, 300),
    []
  );

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!searchValue) return allProducts;
    return allProducts.filter((product: any) =>
      product.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [allProducts, searchValue]);

  // Get already selected product IDs
  const selectedProductIds = useMemo(
    () => formDataList.map((item) => item.product_id).filter(Boolean),
    [formDataList]
  );

  const dispatch = useDispatch();

  // Dispatch changes to redux
  const dispatchChanges = (list: IOrderItems[]) => {
    dispatch(
      setOrderItems(
        list.map((item) => ({
          product_id: item.product_id,
          quantity: Number(item.quantity) || 0,
        }))
      )
    );
  };

  // Add product to list (or merge if already exists)
  const handleAddProduct = (productId: string) => {
    const product = allProducts.find((p: any) => p.id === productId);
    if (!product) return;

    // Check if product already exists in list
    const existingIndex = formDataList.findIndex(
      (item) => item.product_id === productId
    );

    if (existingIndex !== -1) {
      // Merge: increment quantity
      const updatedList = [...formDataList];
      updatedList[existingIndex] = {
        ...updatedList[existingIndex],
        quantity: Number(updatedList[existingIndex].quantity) + 1,
      };
      setFormDataList(updatedList);
      dispatchChanges(updatedList);
    } else {
      // Add new item
      const newItem: IOrderItems = {
        product_id: productId,
        quantity: 1,
        product_name: product.name,
        product_image: product.image_url,
      };
      const updatedList = [...formDataList, newItem];
      setFormDataList(updatedList);
      dispatchChanges(updatedList);
    }

    setSearchValue("");
    setIsSelectOpen(false);
    setSelectKey((prev) => prev + 1); // Reset Select component
  };

  // Update quantity
  const handleQuantityChange = (index: number, newQuantity: number) => {
    if (newQuantity < 1) newQuantity = 1;
    if (newQuantity > 99) newQuantity = 99;

    const updatedList = [...formDataList];
    updatedList[index] = { ...updatedList[index], quantity: newQuantity };
    setFormDataList(updatedList);
    dispatchChanges(updatedList);
  };

  // Remove item
  const removeItem = (index: number) => {
    const updatedList = formDataList.filter((_, i) => i !== index);
    setFormDataList(updatedList);
    dispatchChanges(updatedList);
  };

  // Load from redux on mount
  const orderItems = useSelector(
    (state: RootState) => state.setCustomerData.orderItems
  );

  useEffect(() => {
    if (orderItems && orderItems.length > 0) {
      // Enrich with product details
      const enrichedItems = orderItems.map((item: any) => {
        const product = allProducts.find((p: any) => p.id === item.product_id);
        return {
          ...item,
          product_name: product?.name || "",
          product_image: product?.image_url || "",
        };
      });
      setFormDataList(enrichedItems);
    }
  }, [orderItems, allProducts]);

  // Calculate totals
  const totalItems = formDataList.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  );

  return (
    <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-white">
                {t("orderItems.title")}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formDataList.length > 0
                  ? `${formDataList.length} xil mahsulot, ${totalItems} dona`
                  : "Mahsulot qo'shing"}
              </p>
            </div>
          </div>
          {formDataList.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                {totalItems} dona
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Product Search/Add */}
      <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/30">
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <Select
            showSearch
            key={`product-select-${selectKey}`}
            open={isSelectOpen}
            onDropdownVisibleChange={setIsSelectOpen}
            value={undefined}
            placeholder={t("orderItems.selectProduct")}
            className="w-full h-12 [&_.ant-select-selector]:pl-10! [&_.ant-select-selector]:rounded-xl! [&_.ant-select-selector]:border-gray-200! dark:[&_.ant-select-selector]:border-gray-600! dark:[&_.ant-select-selector]:bg-gray-800! [&_.ant-select-selection-placeholder]:text-gray-400!"
            onSearch={debouncedSearch}
            onChange={handleAddProduct}
            filterOption={false}
            notFoundContent={
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Mahsulot topilmadi"
              />
            }
            dropdownRender={(menu) => (
              <div className="dark:bg-[#2A263D]">{menu}</div>
            )}
          >
            {filteredProducts.map((product: any) => {
              const isSelected = selectedProductIds.includes(product.id);
              return (
                <Select.Option
                  key={product.id}
                  value={product.id}
                  disabled={false}
                >
                  <div className="flex items-center gap-3 py-1">
                    <img
                      src={product.image_url || DEFAULT_PRODUCT_IMAGE}
                      alt={product.name}
                      className="w-10 h-10 object-cover rounded-lg bg-gray-100 dark:bg-gray-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 dark:text-white truncate">
                        {product.name}
                      </p>
                      {isSelected && (
                        <p className="text-xs text-purple-600 dark:text-purple-400">
                          Allaqachon qo'shilgan (yana qo'shish mumkin)
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                    )}
                  </div>
                </Select.Option>
              );
            })}
          </Select>
        </div>
      </div>

      {/* Items List */}
      <div className="p-4 sm:p-5">
        {formDataList.length === 0 ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Hali mahsulot qo'shilmagan
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
              Yuqoridagi qidiruv orqali mahsulot qo'shing
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {formDataList.map((item, index) => (
              <div
                key={`${item.product_id}-${index}`}
                className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {/* Mobile Layout */}
                <div className="flex flex-col sm:hidden gap-3">
                  {/* Top row: Image + Name + Delete */}
                  <div className="flex items-start gap-3">
                    <img
                      src={item.product_image || DEFAULT_PRODUCT_IMAGE}
                      alt={item.product_name}
                      className="w-12 h-12 object-cover rounded-xl flex-shrink-0 bg-gray-200 dark:bg-gray-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 dark:text-white text-sm leading-tight" title={item.product_name}>
                        {item.product_name || "Noma'lum mahsulot"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t("orderItems.item")} #{index + 1}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 flex-shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Bottom row: Quantity Controls */}
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() =>
                        handleQuantityChange(index, Number(item.quantity) - 1)
                      }
                      disabled={Number(item.quantity) <= 1}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                        Number(item.quantity) <= 1
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
                      }`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        handleQuantityChange(index, val);
                      }}
                      className="w-14 h-9 text-center text-sm font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      min={1}
                      max={99}
                    />

                    <button
                      onClick={() =>
                        handleQuantityChange(index, Number(item.quantity) + 1)
                      }
                      disabled={Number(item.quantity) >= 99}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                        Number(item.quantity) >= 99
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                          : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 cursor-pointer"
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex items-center gap-3">
                  {/* Product Image */}
                  <img
                    src={item.product_image || DEFAULT_PRODUCT_IMAGE}
                    alt={item.product_name}
                    className="w-14 h-14 object-cover rounded-xl flex-shrink-0 bg-gray-200 dark:bg-gray-700"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
                    }}
                  />

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-white truncate">
                      {item.product_name || "Noma'lum mahsulot"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t("orderItems.item")} #{index + 1}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        handleQuantityChange(index, Number(item.quantity) - 1)
                      }
                      disabled={Number(item.quantity) <= 1}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        Number(item.quantity) <= 1
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
                      }`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        handleQuantityChange(index, val);
                      }}
                      className="w-12 h-8 text-center text-sm font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      min={1}
                      max={99}
                    />

                    <button
                      onClick={() =>
                        handleQuantityChange(index, Number(item.quantity) + 1)
                      }
                      disabled={Number(item.quantity) >= 99}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        Number(item.quantity) >= 99
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                          : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 cursor-pointer"
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => removeItem(index)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add More Button */}
        {formDataList.length > 0 && (
          <button
            onClick={() => setIsSelectOpen(true)}
            className="mt-4 w-full h-11 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:border-purple-300 dark:hover:border-purple-700 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t("orderItems.addAnotherItem")}
          </button>
        )}
      </div>
    </div>
  );
};

export default memo(OrderItems);
