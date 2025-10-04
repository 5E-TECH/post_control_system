// src/pages/orders/pages/superadmin/order-details/scan/ScanAndOrder.tsx
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import type { RootState } from "../../../../../../app/store";
import { BASE_URL } from "../../../../../../shared/const";

export default function ScanAndOrder() {
  const { token } = useParams();
  const authToken = useSelector((state: RootState) => state.authSlice.token);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!token) {
      setError("QR token topilmadi");
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      setLoading(true);
      setError("");
      setOrder(null);

      try {
        const res = await fetch(`${BASE_URL}order/qr-code/${token}`, {
          method: "GET",
          headers: {
            Authorization: authToken ? `Bearer ${authToken}` : "",
          },
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          let message = "Xatolik: server javob bermadi";

          if (json?.message) message = json.message;
          else if (typeof json?.error === "string") message = json.error;
          else if (typeof json?.error?.message === "string")
            message = json.error.message;

          throw new Error(message);
        }

        const data = await res.json();
        setOrder(data);
      } catch (err: any) {
        setError(err.message || "Xatolik yuz berdi");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [token, authToken]);

  if (loading) return <div>Yuklanmoqda...</div>;
  if (error) return <div style={{ color: "red" }}>Error: {error}</div>;

  return (
    <div>
      <h1>Order #{order?.data?.id}</h1>
      <p>Customer: {order?.data?.customer}</p>
      <p>Phone: {order?.data?.phone}</p>
      <p>Region: {order?.data?.region}</p>
      <p>District: {order?.data?.district}</p>
      <p>Market: {order?.data?.market}</p>
      <p>Status: {order?.data?.status}</p>
      <p>Price: {order?.data?.price}</p>
      <p>Created At: {order?.data?.createdAt}</p>
    </div>
  );
}
