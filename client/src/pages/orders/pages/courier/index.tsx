import { memo } from "react";
import Select from "../../components/select/select";
import SearchInput from "../../../users/components/search-input";
import { NavLink, Outlet } from "react-router-dom";

const CourierOrders = () => {
  return (
    <div className="w-full bg-white py-5 dark:bg-[#312d4b]">
      <h1 className="font-medium text-[20px] text-[#2E263DE5] dark:text-[#D4D0E9] px-5">
        Bugungi buyurtmalar
      </h1>

      <div className="flex justify-between px-5 pt-5 pb-7 items-center">
        <div className="flex gap-5">
          <Select name="from" placeholder="From" className="w-[150px]"></Select>

          <Select name="to" placeholder="To" className="w-[180px]"></Select>
        </div>

        <div className="flex gap-6">
          <NavLink
            end
            to="/courier-orders/orders"
            className={({ isActive }) =>
              `text-md font-medium transition duration-200 ${
                isActive
                  ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
                  : "text-[#2E263DB2] hover:text-[#5A48FA] dark:text-[#CAD0E9]"
              } pb-1`
            }
          >
            Kutilayotgan buyurtmalar
          </NavLink>

          <NavLink
            to="/courier-orders/orders/all"
            className={({ isActive }) =>
              `text-md font-medium transition duration-200 ${
                isActive
                  ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
                  : "text-[#2E263DB2] hover:text-[#5A48FA] dark:text-[#CAD0E9]"
              } pb-1`
            }
          >
            Hamma buyurtmalar
          </NavLink>

          <NavLink
            to="/courier-orders/orders/cancelled"
            className={({ isActive }) =>
              `text-md font-medium transition duration-200 ${
                isActive
                  ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
                  : "text-[#2E263DB2] hover:text-[#5A48FA] dark:text-[#CAD0E9]"
              } pb-1`
            }
          >
            Bekor qilingan buyurtmalar
          </NavLink>
        </div>

        <div>
          <SearchInput placeholder="Buyurtmani qidirish..." />
        </div>
      </div>

      <Outlet />
    </div>
  );
};

export default memo(CourierOrders);
