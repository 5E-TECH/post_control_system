import { ArrowRight, Check } from "lucide-react";
import { memo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { Button } from "antd";
import type { RootState } from "../../../../../app/store";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import CustomerInfo from "../../../components/customer-info";
import CustomerDetails from "../../../components/customer-details";
// import { setCustomerData } from "../../../../../shared/lib/features/customer_and_market-id";
import { useTranslation } from "react-i18next";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { buildAdminPath } from "../../../../../shared/const";

const CustomerInfoOrder = () => {
  const { t } = useTranslation("createOrder");
  const { pathname } = useLocation();

  if (pathname.startsWith(buildAdminPath("orders/confirm"))) {
    return <Outlet />;
  }

  const customerData = useSelector(
    (state: RootState) => state.setCustomerData.customerData
  );
  const user = useSelector(
    (state: RootState) => state.roleSlice
  ); 

  const marketdata = useSelector(
    (state: RootState) => state.authSlice.marketData
  ); 

  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const market_id = market?.id;
  const { createUser } = useUser("customer");
  const navigate = useNavigate();

  const { handleApiError, handleWarning } = useApiNotification();
  const handleClick = () => {
    if (
      !customerData?.name ||
      !customerData?.phone_number ||
      !customerData?.district_id
    ) {
      handleWarning(
        "Foydalanuvchi malumotlari to'liq emas",
        "Iltimos malumotlarni to'ldiring"
      );

      return;
    }

    const customer = {
      phone_number: customerData?.phone_number.split(" ").join(""),
      district_id: customerData?.district_id,
      name: customerData?.name,
      address: customerData.address,
      market_id,
      extra_number:customerData.extra_number
    };
    createUser.mutate(customer, {
      onSuccess: (res) => {
        localStorage.setItem("customer", JSON.stringify(res?.data?.data));
        navigate(buildAdminPath("orders/confirm"));
      },
      onError: (err: any) =>
        handleApiError(
          err,
          "Foydalanuvchi yaratishda xatolik yuz berdi"
        ),
    });
  };

  return (
    <div className="flex gap-6 px-6 pt-6 max-[1100px]:flex-col max-[1100px]:gap-10">
      <div className="w-fit h-fit pr-[81px]">
        <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#D4D0E9]">
          {t("process")}
        </h1>

        <div className="flex items-center gap-2 mt-4">
          <div className="flex w-fit rounded-full p-[4px] bg-[var(--color-bg-sy)]">
            <Check className="w-[10px] h-[10px] text-white" />
          </div>

          <span className="font-medium text-[25px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            01
          </span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5] capitalize">
              {user.role === "market" ? (
                marketdata.name
              ) : ( market?.name)}
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] whitespace-nowrap dark:text-[#AEAAC2]">
              {user.role === "market" ? (
                marketdata.phone_number
              ) : ( market?.phone_number)}
            </span>
          </div>
        </div>

        <div className="w-[3px] h-[40px] rounded-[20px] bg-[var(--color-bg-sy)] ml-[7px] mt-[8px]"></div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex w-[18px] h-[18px] rounded-full p-[3px] border-4 border-[var(--color-bg-sy)]"></div>

          <span className="font-medium text-[25px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            02
          </span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
              {t("step.two.title")}
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2] text-nowrap">
              {t("step.two.description")}
            </span>
          </div>
        </div>

        <div className="w-[3px] h-[40px] rounded-[20px] bg-[#E3DCFB] ml-[7px] mt-[8px] dark:bg-[#8C57FF29]"></div>

        <div className="flex items-center gap-2 mt-2">
          <div className="flex  w-[18px] h-[18px] rounded-full p-[3px] bg-white border-3 border-[#E3DCFB] dark:bg-[#312D4B] dark:border-[#382C5C]"></div>

          <span className="font-medium text-[25px] text-[#2E263DE5]">03</span>

          <div className="flex flex-col">
            <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
              {t("step.three.title")}
            </span>
            <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
              {t("step.three.description")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4.5 w-full">
        <CustomerInfo />
        <div className="flex gap-4 justify-end">
          <Button
            disabled={createUser.isPending}
            loading={createUser.isPending}
            onClick={handleClick}
            className="w-[110px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! hover:opacity-85! hover:outline-none! dark:border-none!"
          >
            {t("next")}
            <ArrowRight className="h-[13px] w-[13px]" />
          </Button>
        </div>
        <CustomerDetails />
      </div>
    </div>
  );
};

export default memo(CustomerInfoOrder);
