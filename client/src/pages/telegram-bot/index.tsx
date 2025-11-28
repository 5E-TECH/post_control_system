import { memo, useEffect, useState } from "react";
import OrderItems from "../orders/components/order-items";
import ProductInfo from "../orders/components/product-info";
import CustomerInfo from "../orders/components/customer-info";
import NotFound from "../../shared/ui/NotFound";

const TelegramBot = () => {
  const [isTelegram, setIsTelegram] = useState<boolean | null>(null);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;

    if (tg?.initData && tg?.initDataUnsafe?.user) {
      setIsTelegram(true);
      tg.ready();
    } else {
      setIsTelegram(false);
    }
  }, []);

  if (isTelegram === null) return null;

  if (!isTelegram) {
    return (
      <div className="text-center">
        <NotFound />
      </div>
    );
  }

  return (
    <div className="bg-white">
      <h2 className="text-center text-[25px] font-bold">Create Order</h2>
      <div className="flex flex-col gap-4.5 w-full">
        <CustomerInfo />
      </div>
      <div className="flex flex-col  w-full">
        <OrderItems />
        <ProductInfo />
      </div>
    </div>
  );
};

export default memo(TelegramBot);
