import { memo, useEffect, useRef, useState } from "react";
import { Button } from "antd";
import CustomerInfo from "../../orders/components/customer-info";
import OrderItems from "../../orders/components/order-items";
import ProductInfo from "../../orders/components/product-info";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../../app/store";
import { useOrder } from "../../../shared/api/hooks/useOrder";
import {
  resetOrderItems,
  setCustomerData,
  setProductInfo,
} from "../../../shared/lib/features/customer_and_market-id";
import { useApiNotification } from "../../../shared/hooks/useApiNotification";

const getTelegramWebApp = (): any => {
  if (typeof window === "undefined") return null;
  return (window as any).Telegram?.WebApp ?? null;
};

const CreateOrderBot = () => {
  const { createOrderBot } = useOrder();
  const customerData = useSelector(
    (state: RootState) => state.setCustomerData.customerData
  );
  const orderItems = useSelector(
    (state: RootState) => state.setCustomerData.orderItems
  );
  const productInfo = useSelector(
    (state: RootState) => state.setCustomerData.productInfo
  );
  const dispatch = useDispatch();
  const { handleSuccess, handleApiError } = useApiNotification();
  const [success, setSuccess] = useState(false);
  const submitRef = useRef<() => void>(() => {});

  const tg = getTelegramWebApp();
  const isInsideTelegram = !!tg?.initData;

  const canSubmit =
    !!customerData?.name &&
    !!customerData?.phone_number &&
    !!customerData?.district_id &&
    !!productInfo?.total_price &&
    (orderItems || []).length > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      handleApiError(
        { message: "Ma'lumotlar to'liq emas" },
        "Iltimos barcha majburiy maydonlarni to'ldiring"
      );
      return;
    }

    const data = {
      name: customerData?.name,
      phone_number: customerData?.phone_number?.replace(/\s/g, ""),
      district_id: customerData?.district_id,
      extra_number: customerData?.extra_number?.replace(/\s/g, ""),
      address: customerData?.address,
      order_item_info: (orderItems || []).map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      })),
      total_price: productInfo?.total_price,
      where_deliver: productInfo?.where_deliver,
      comment: productInfo?.comment,
      operator: productInfo?.operator,
    };

    createOrderBot.mutate(data, {
      onSuccess: () => {
        handleSuccess("Buyurtma muvaffaqiyatli qo'shildi");
        dispatch(setCustomerData(null));
        dispatch(resetOrderItems());
        dispatch(setProductInfo(null));
        setSuccess(true);
      },
      onError: (err: any) => {
        handleApiError(err, "Buyurtma kiritishda xatolik yuz berdi");
      },
    });
  };

  // submitRef'ni har doim eng so'nggi handleSubmit'ga ulab turamiz —
  // shunda Telegram MainButton onClick eski state'ni o'qimaydi.
  submitRef.current = handleSubmit;

  // Telegram MainButton: ekran pastida doim ko'rinib turuvchi native tugma.
  useEffect(() => {
    if (!isInsideTelegram) return;

    const mainButton = tg.MainButton;
    if (!mainButton) return;

    const onClick = () => submitRef.current();
    mainButton.setText("Buyurtmani qo'shish");
    mainButton.onClick(onClick);
    mainButton.show();

    return () => {
      mainButton.offClick(onClick);
      mainButton.hide();
    };
  }, [isInsideTelegram, tg]);

  // MainButton holatini canSubmit/loading/success bilan sinxronlash.
  useEffect(() => {
    if (!isInsideTelegram) return;
    const mainButton = tg?.MainButton;
    if (!mainButton) return;

    if (success) {
      mainButton.setText("Buyurtma qo'shildi");
      mainButton.hideProgress?.();
      mainButton.disable();
      return;
    }

    if (createOrderBot.isPending) {
      mainButton.setText("Yuborilmoqda...");
      mainButton.showProgress?.(false);
      mainButton.disable();
      return;
    }

    mainButton.hideProgress?.();
    mainButton.setText("Buyurtmani qo'shish");
    if (canSubmit) {
      mainButton.enable();
    } else {
      mainButton.disable();
    }
  }, [canSubmit, createOrderBot.isPending, success, isInsideTelegram, tg]);

  // BackButton: Telegram'ning yuqori chap "←" tugmasi bosilganda WebApp yopiladi.
  useEffect(() => {
    if (!isInsideTelegram) return;
    const backButton = tg?.BackButton;
    if (!backButton) return;

    const onBack = () => {
      try {
        tg.close();
      } catch {
        /* ignore */
      }
    };
    backButton.onClick(onBack);
    backButton.show();

    return () => {
      backButton.offClick(onBack);
      backButton.hide();
    };
  }, [isInsideTelegram, tg]);

  return (
    <div className="bg-white">
      <div className="flex flex-col gap-4.5 w-full">
        <h2 className="text-center text-[25px] font-bold">Buyurtma qo'shish</h2>
        <CustomerInfo />
      </div>

      <div className="flex flex-col w-full">
        <OrderItems />
        <ProductInfo />
      </div>

      {/* Telegram tashqarisida (oddiy brauzer testi uchun) HTML tugmasi ko'rinadi.
          Telegram ichida MainButton ishlatiladi, bu tugma yashiriladi. */}
      {!isInsideTelegram && (
        <div className="p-5 text-center mb-5 w-full">
          <Button
            onClick={handleSubmit}
            loading={createOrderBot.isPending}
            disabled={createOrderBot.isPending}
            className="!w-full !h-[45px] !text-[16px] !font-bold !text-white !bg-[#9069fe]"
          >
            {success ? "Buyurtma qo'shildi" : "Buyurtmani qo'shish"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default memo(CreateOrderBot);
