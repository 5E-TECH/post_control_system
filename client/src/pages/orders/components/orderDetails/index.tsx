import { memo, useState, type FC } from "react";
import Popup from "../../../../shared/ui/Popup";
import { useProduct } from "../../../../shared/api/hooks/useProduct";
import { InputNumber, Select } from "antd";
import TextArea from "antd/es/input/TextArea";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { useParams } from "react-router-dom";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import type { RootState } from "../../../../app/store";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";

interface IProps {
  items: any[];
  to_be_paid: any;
  paid_amount: any;
  total_price: any;
  marketId: string;
  comment: string;
  deleveryStatus: string;
  status?: string;
}

const Details: FC<IProps> = ({
  items = [],
  total_price,
  to_be_paid,
  paid_amount,
  marketId,
  comment,
  deleveryStatus,
  status,
}) => {
  const { t } = useTranslation("orderList");
  const { id } = useParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [editItem, setEditItem] = useState("");
  const [addItem, setAddItem] = useState(false);
  const [newQty, setNewQty] = useState(1);
  const [totalPrice, setTotalPrice] = useState(total_price);
  const [updatedComment, setComment] = useState(comment);
  const [delevery, setDelivery] = useState(deleveryStatus);
  const [isProductsOpen, setIsProductsOpen] = useState(false);

  const { getProductsByMarket } = useProduct();
  const { data } = getProductsByMarket(marketId, isProductsOpen);
  console.log("data", data);

  const selectedProduct = data?.data?.products?.find((p: any) => p.id === selectedId);

  const [orderItems, setOrderItems] = useState(
    items.map((item) => ({
      id: item.id,
      product_id: item.product.id,
      quantity: item.quantity,
      image_url: item.product.image_url,
      name: item.product.name,
    }))
  );

  const { role } = useSelector((state: RootState) => state.roleSlice);

  const { updateOrders } = useOrder();
  const { handleSuccess, handleApiError } = useApiNotification();
  const handlesubmit = () => {
    const payload: any = {};

    if (delevery !== deleveryStatus) payload.where_deliver = delevery;
    if (totalPrice !== total_price) payload.total_price = totalPrice;
    if (updatedComment !== comment) payload.comment = updatedComment;

    const initialItems = items.map((i) => ({
      product_id: i.product.id,
      quantity: i.quantity,
    }));

    const currentItems = orderItems.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
    }));

    const isSame =
      JSON.stringify(initialItems) === JSON.stringify(currentItems);

    if (!isSame) payload.order_item_info = currentItems;

    if (Object.keys(payload).length === 0) {
      return;
    }

    updateOrders.mutate(
      { id, data: payload },
      {
        onSuccess: () => {
          setIsModalOpen(false);
          handleSuccess("Order muvaffaqiyatli yangilandi");
        },
        onError: (err: any) => {
          handleApiError(err, "Order yangilashda muammo yuzaga berdi");
        },
      }
    );
  };

  const { Option } = Select;

  const marketOptions = data?.data?.products?.map((item: any) => (
    <Option key={item.id} value={item.id}>
      {item.name}
    </Option>
  ));

  return (
    <div className="dark:bg-[#312D4B]">
      <div className="flex justify-between m-5">
        <h2 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
          {t("detail.orderDetails")}
        </h2>
        {status == "new" && role != "market" && role != "courier" && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-[#8C57FF] cursor-pointer"
          >
            {t("detail.edit")}
          </button>
        )}
      </div>

      {/* Header */}
      <div className="flex justify-between items-center gap-3 bg-[#F6F7FB] dark:bg-[#3d3759] px-3 py-2 max-md:flex-wrap">
        <h2 className="flex-1 font-medium text-[#2E263DE5] dark:text-[#E7E3FCE5] text-base max-sm:text-sm">
          {t("detail.product")}
        </h2>
        {/* <div className="w-[2px] h-[14px] bg-[#2E263D1F]  dark:bg-[#524B6C]"></div> */}

        <div className="hidden md:block h-[14px] border-l-2 border-[#2E263D1F] dark:border-[#E7E3FC1F]"></div>

        <h2 className="font-medium text-[#2E263DE5] dark:text-[#E7E3FCE5] text-base max-sm:text-sm">
          {t("detail.qty")}
        </h2>
      </div>

      {/* Items */}
      {items.map((item) => (
        <div
          key={item.id}
          className="mx-3 flex flex-row gap-4 items-center my-2 border-b-2 border-[#F6F7FB] dark:border-[#474360] pb-2 max-md:flex-wrap max-md:justify-between"
        >
          <div className="flex flex-row gap-3 flex-1 items-center max-sm:w-full">
            <div className="w-[34px] h-[34px] my-1 flex-shrink-0">
              <img
                src={`/uploads/${item.product.image_url}`}
                alt={item.product.name}
                className="object-contain w-full h-full"
              />
            </div>
            <div className="flex items-center">
              <h2 className="font-medium text-[16px] text-[#2E263DE5] dark:text-[#E7E3FCE5] truncate max-w-[140px] max-sm:text-[14px]">
                {item.product.name.slice(0, 10)}
              </h2>
            </div>
          </div>

          <div className="text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2] max-sm:text-[13px] max-md:mt-1">
            <h2>{item.quantity}</h2>
          </div>
        </div>
      ))}

      {/* Totals */}
      <div className="flex justify-end mr-5 my-5">
        <div className="flex flex-col items-end gap-2">
          {/* Umumiy summa */}
          <div className="flex gap-3">
            <h2 className="text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
              {t("detail.total")}:
            </h2>
            <h2 className="text-[15px] text-[#2E263DE5] font-black dark:text-[#E7E3FCE5]">
              {Number(total_price).toLocaleString("uz-UZ")} so'm
            </h2>
          </div>

          {role !== "courier" && (
            <>
              <div className="flex gap-3">
                <h2 className="text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                  {t("detail.to_be_paid")}:
                </h2>
                <h2 className="text-[15px] text-[#2E263DE5] font-black dark:text-[#E7E3FCE5]">
                  {Number(to_be_paid).toLocaleString("uz-UZ")} so'm
                </h2>
              </div>

              <div className="flex gap-3">
                <h2 className="text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                  {t("detail.paid_amount")}:
                </h2>
                <h2 className="text-[15px] text-[#2E263DE5] font-black dark:text-[#E7E3FCE5]">
                  {Number(paid_amount).toLocaleString("uz-UZ")} so'm
                </h2>
              </div>
            </>
          )}
        </div>
      </div>

      <Popup isShow={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="w-[720px] bg-white dark:bg-[#2f2a45] rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl">{t("detail.editOrder")}</h2>
          </div>
          <div>
            {orderItems.map((item) => (
              <div
                key={item.id}
                className="mx-5 flex flex-row gap-5 items-center my-1 border-b-2 border-[#F6F7FB] dark:border-[#474360]"
              >
                <div className="flex flex-row gap-5 flex-1">
                  <div className="w-[34px] h-[34px] my-2">
                    <img
                      src={`/uploads/${item.image_url}`}
                      alt={item.name}
                      className="object-contain w-full"
                    />
                  </div>
                  <div className="flex items-center">
                    <h2 className="font-medium text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                      {item.name}
                    </h2>
                  </div>
                </div>
                <div className="mr-[93px] text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                  {editItem === item.id ? (
                    <div className="flex items-center gap-2">
                      <InputNumber
                        min={1}
                        value={item.quantity}
                        onChange={(value) => {
                          setOrderItems((prev) =>
                            prev.map((el) =>
                              el.id === item.id
                                ? { ...el, quantity: value }
                                : el
                            )
                          );
                        }}
                      />
                      <button
                        className="bg-green-500 text-white px-2 rounded"
                        onClick={() => setEditItem("")} // 👈 Save bosilganda yopiladi
                      >
                        {t("detail.save")}
                      </button>
                    </div>
                  ) : (
                    <h2>{item.quantity}</h2>
                  )}
                </div>
                <div className="flex gap-5 items-center">
                  <button
                    className="cursor-pointer"
                    onClick={() => setEditItem(item.id)}
                  >
                    {t("detail.edit")}
                  </button>
                  <button
                    className="cursor-pointer"
                    onClick={() =>
                      setOrderItems((prev) =>
                        prev.filter((el) => el.id !== item.id)
                      )
                    }
                  >
                    {t("detail.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5">
            {addItem && (
              <div className="flex justify-between gap-5 items-center">
                <Select
                  value={selectedId}
                  onChange={(value) => setSelectedId(value)}
                  placeholder="Selected Product"
                  className="w-full"
                >
                  {marketOptions}
                </Select>

                <InputNumber
                  min={1}
                  value={newQty}
                  onChange={(value) => setNewQty(value ?? 1)}
                />

                <button
                  className="bg-[#854FFF] text-white px-3 py-1 rounded-md"
                  onClick={() => {
                    if (!selectedProduct) return;

                    setOrderItems((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(), // yoki backenddan keladigan vaqtincha id
                        product_id: selectedProduct.id,
                        quantity: newQty,
                        image_url: selectedProduct.image_url,
                        name: selectedProduct.name,
                      },
                    ]);

                    // reset qilamiz
                    setSelectedId("");
                    setNewQty(1);
                    setAddItem(false);
                  }}
                >
                  {t("detail.add1")}
                </button>
              </div>
            )}
          </div>
          <div className="mt-5">
            <div className="flex justify-between mb-5">
              <div>
                <Select
                  value={delevery}
                  onChange={(value) => setDelivery(value)}
                  style={{ width: "150px" }}
                >
                  <Select.Option value="center">Center</Select.Option>
                  <Select.Option value="address">Address</Select.Option>
                </Select>
              </div>
              <div className="flex justify-end items-center gap-5">
                <h2>{t("detail.totalPrice")}:</h2>
                <InputNumber
                  min={1}
                  defaultValue={totalPrice}
                  onChange={(value) => setTotalPrice(value)}
                  className="w-full mb-3 dark:bg-[#312D4B]! dark:text-white! dark:placeholder-gray-400!"
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
                  }
                  parser={(value) => value!.replace(/\s/g, "")}
                />
              </div>
            </div>
            <TextArea
              rows={4}
              value={updatedComment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Izoh kiriting..."
              className="w-full mb-3 dark:bg-[#312D4B]! dark:outline-none! dark:text-white! dark:placeholder-gray-400!"
            />{" "}
          </div>
          <div className="flex justify-end mt-5 gap-5">
            <button
              onClick={() => {
                setAddItem((p) => !p);
                setIsProductsOpen(true); // ⭐ SO‘ROV KETADI
              }}
              className="text-[#854FFF] py-1 px-1 rounded-md border border-[#854FFF] cursor-pointer"
            >
              {t("detail.add")}
            </button>
            <button
              onClick={() => handlesubmit()}
              className="text-[18px] bg-[#854FFF] text-white py-1 px-3 rounded-md cursor-pointer"
            >
              {t("detail.save")}
            </button>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default memo(Details);
