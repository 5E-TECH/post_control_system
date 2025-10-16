import { memo } from "react";
import Details from "../../../components/orderDetails";
import ShippingAddress from "../../../components/shipping address";
import CustomerDetail from "../../../components/customer detail";
import { useParams } from "react-router-dom";
import { useOrder } from "../../../../../shared/api/hooks/useOrder";
import QRCode from "react-qr-code";
import { useTranslation } from "react-i18next";
import { useGlobalScanner } from "../../../../../shared/components/global-scanner";

const OrderDetails = () => {
  useGlobalScanner();
  const { t } = useTranslation("orderList");
  const { t:st } = useTranslation("status");
  const { id } = useParams();

  const { getOrderById } = useOrder();
  const { data } = getOrderById(id);
  const token = data?.data?.qr_code_token;

  // Agar data hali kelmagan bo‘lsa loader
  if (!data) return <div className="text-center p-10">Loading...</div>;
  return (
    <div className="p-6 bg-white dark:bg-[#28243D]">
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold">{t("detail.title")}</h2>
        <div>
          <p className="px-4 py-1 bg-blue-500 rounded-2xl text-white">
            {st(`${data?.data?.status}`)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-5">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow p-6 dark:bg-[#312D4B]">
            <Details
              items={data?.data?.items}
              to_be_paid={data?.data?.to_be_paid}
              paid_amount={data?.data?.paid_amount}
              total_price={data?.data?.total_price}
              marketId={data?.data?.market?.id}
              comment={data?.data?.comment}
              deleveryStatus={data?.data?.where_deliver}
              status={data?.data?.status}
            />
          </div>
          <div className="bg-white dark:bg-white p-4 inline-block w-[200px]">
            <QRCode
              size={160}
              value={token}
              bgColor="#ffffff" // har doim oq
              fgColor="#000000" // chiziqlar qora
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow p-6 dark:bg-[#312D4B]">
            <CustomerDetail customer={data?.data?.customer} />
          </div>

          <div className="bg-white rounded-xl shadow p-6 dark:bg-[#312D4B]">
            <ShippingAddress
              address={data?.data?.customer?.address}
              districtId={data?.data?.customer?.district_id}
              id={data?.data?.customer?.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(OrderDetails);
