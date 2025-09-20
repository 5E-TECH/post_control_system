import { ArrowRight, Check } from "lucide-react";
import { createContext, memo, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "antd";
import useNotification from "antd/es/notification/useNotification";
import type { RootState } from "../../../../../app/store";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import CustomerInfo, { initialState } from "../../../components/customer-info";
import CustomerDetails from "../../../components/customer-details";
import { setCustomerData } from "../../../../../shared/lib/features/customer_and_market-id";

const Context = createContext({ name: "Default" });

const CustomerInfoOrder = () => {
  const { pathname } = useLocation();

  if (pathname.startsWith("/orders/confirm")) {
    return <Outlet />;
  }

  const customerData = useSelector(
    (state: RootState) => state.setCustomerData.customerData
  );
  const market = JSON.parse(localStorage.getItem("market") ?? "null");
  const market_id = market?.id;
  const { createUser } = useUser("customer");
  const navigate = useNavigate();

  const [api, contextHolder] = useNotification();

  const handleClick = () => {
    if (
      !customerData?.name ||
      !customerData?.phone_number ||
      !customerData?.district_id ||
      !customerData.address
    ) {
      api.warning({
        message: "Foydalanuvchi malumotlari to'liq emas",
        description: "Iltimos malumotlarni to'ldiring",
        placement: "topRight",
      });
      return;
    }

    const customer = {
      phone_number: customerData?.phone_number,
      district_id: customerData?.district_id,
      name: customerData?.name,
      address: customerData.address,
      market_id,
    };
    createUser.mutate(customer, {
      onSuccess: (res) => {
        localStorage.setItem("customer", JSON.stringify(res?.data?.data));
        navigate("/orders/confirm");
      },
    });
  };

  const dispatch = useDispatch();
  const handleDiscard = () => {
    dispatch(setCustomerData(initialState));
  };
  const contextValue = useMemo(() => ({ name: "Ant Design" }), []);

  return (
    <Context.Provider value={contextValue}>
      {contextHolder}
      <div className="flex gap-6 px-6 pt-6">
        <div className="w-fit h-fit pr-[81px]">
          <h1 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#D4D0E9]">
            Process
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
                {market?.name}
              </span>
              <span className="font-normal text-[#2E263DB2] text-[13px] whitespace-nowrap dark:text-[#AEAAC2]">
                {market?.phone_number}
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
                Customer Info
              </span>
              <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2] text-nowrap">
                Setup information
              </span>
            </div>
          </div>

          <div className="w-[3px] h-[40px] rounded-[20px] bg-[#E3DCFB] ml-[7px] mt-[8px] dark:bg-[#8C57FF29]"></div>

          <div className="flex items-center gap-2 mt-2">
            <div className="flex  w-[18px] h-[18px] rounded-full p-[3px] bg-white border-3 border-[#E3DCFB] dark:bg-[#312D4B] dark:border-[#382C5C]"></div>

            <span className="font-medium text-[25px] text-[#2E263DE5]">03</span>

            <div className="flex flex-col">
              <span className="font-medium text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCE5]">
                Order details
              </span>
              <span className="font-normal text-[#2E263DB2] text-[13px] dark:text-[#AEAAC2]">
                Add order details
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4.5 w-full">
          <CustomerInfo />
          <div className="flex gap-4 justify-end">
            <Button
              onClick={handleDiscard}
              className="w-[91px]! h-[38px]! bg-[#F4F5FA]! border! border-[#8A8D93]! text-[#8A8D93]! hover:opacity-80! dark:bg-[#28243D]!"
            >
              Discard
            </Button>
            <Button
              onClick={handleClick}
              className="w-[91px]! h-[38px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! hover:opacity-85! hover:outline-none! dark:border-none!"
            >
              Next
              <ArrowRight className="h-[13px] w-[13px]" />
            </Button>
          </div>
          <CustomerDetails />
        </div>
      </div>
    </Context.Provider>
  );
};

export default memo(CustomerInfoOrder);
