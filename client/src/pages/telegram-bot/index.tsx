import { memo, useState, useEffect } from "react";
import OrderItems from "../orders/components/order-items";
import ProductInfo from "../orders/components/product-info";
import CustomerInfo from "../orders/components/customer-info";
import { useLoginTelegran } from "./service/useTelelgram";

const TelegramBot = () => {
  const [network, setNetwork] = useState<string | null>("Loading...");
  const [tg, setTg] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { signinUser } = useLoginTelegran();

  useEffect(() => {
    // Telegram script ni yuklab olamiz
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    script.onload = () => {
      const telegram = (window as any).Telegram?.WebApp;
      if (telegram) {
        setTg(telegram);
        telegram.ready();
        telegram.expand();
        
        const initData = telegram.initData;
        if (initData) {
          signinUser.mutate(initData, {
            onSuccess: () => setNetwork("Success"),
            onError: () => setNetwork("Error")
          });
        } else {
          setNetwork("No initData");
        }
      }
      setIsLoading(false);
    };
    
    script.onerror = () => {
      setIsLoading(false);
      setNetwork("Script load error");
    };

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [signinUser]);

  if (isLoading) {
    return <div className="bg-white p-4">Loading Telegram WebApp...</div>;
  }

  if (!tg) {
    return (
      <div className="bg-white p-4">
        <h2>Telegram WebApp not available</h2>
        <p>Please open this page in Telegram app</p>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <h2 className="text-center text-[25px] font-bold">Create Order {network}</h2>
      <div className="flex flex-col gap-4.5 w-full">
        <CustomerInfo />
      </div>
      <div className="flex flex-col w-full">
        <OrderItems />
        <ProductInfo />
      </div>
    </div>
  );
};

export default memo(TelegramBot);