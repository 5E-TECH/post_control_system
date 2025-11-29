import { memo, useState, useEffect } from "react";
import OrderItems from "../orders/components/order-items";
import ProductInfo from "../orders/components/product-info";
import CustomerInfo from "../orders/components/customer-info";
import { useLoginTelegran } from "./service/useTelelgram";

const TelegramBot = () => {
  const [network, setNetwork] = useState<string | null>("Loading...");
  const [tg, setTg] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(true);
  const [payload, setPayload] = useState<any>(null);
  const [responseData, setResponseData] = useState<any>(null);

  const { signinUser } = useLoginTelegran();

  useEffect(() => {
    // Telegram script ni yuklab olamiz
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-web-app.js";
    script.async = true;
    script.onload = () => {
      const telegram = (window as any).Telegram?.WebApp;
      if (telegram) {
        setTg(telegram);
        telegram.ready();
        telegram.expand();

        const data = { data: telegram.initData };
        setPayload(data);
        if (data) {
          signinUser.mutate(data, {
            onSuccess: () => setNetwork("Success"),
            onError: (err: any) => {
              setNetwork("Error");
              setError(err?.message || "Authentication failed");
            },
            onSettled: (result: any, error: any) => {
              const backendResponse =
                result || error?.response?.data || error?.response || error;

              setResponseData(backendResponse);
            },
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
      <h2 className="text-center text-[25px] font-bold">
        Create Order {network}
      </h2>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error: </strong> {error}
        </div>
      )}

      {payload && (
        <>
          <h2 className="mt-2 font-bold">Payload:</h2>
          <pre className="bg-white p-2 rounded text-[12px] overflow-x-auto">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </>
      )}

      {responseData && (
        <>
          <h2 className="mt-2 font-bold">Backend Response:</h2>
          <pre className="bg-white p-2 rounded text-[12px] overflow-x-auto">
            {JSON.stringify(responseData, null, 2)}
          </pre>
        </>
      )}
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
