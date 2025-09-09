import { memo } from "react";
import {TodayOrder} from "../../shared/static/order"
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Search from "./components/search";

const TodayOrders = () => {
    const navigate = useNavigate()
    const {pathname} = useLocation()
    
    if(pathname.startsWith("/today-order/")){
      return <Outlet/>
    }
  return (
    <section className=" flex justify-center bg-white flex-col m-5 rounded-md">
      <Search/>
      <div className="w-full ">
        <table className="w-full">
          <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center">
            <th>
              <div className="flex items-center gap-10 ml-10 mr-5">
                <span>#</span>
              </div>
            </th>
            <th className="pr-[120px]">
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>MARKET</span>
              </div>
            </th>
            <th className="pr-[120px]">
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>PHONE</span>
              </div>
            </th>
            <th className="pr-[100px]">
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>TOTAL PRICE</span>
              </div>
            </th>
            <th>
              <div className="flex items-center gap-10">
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                <span>STOCK</span>
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
          </thead>
          <tbody className="[&>tr]:odd:bg-white [&>tr]:even:bg-[#f6f7fb6c] [&>tr:hover]:bg-[#f6f7fb]">
            {TodayOrder?.map((item: any) => (
              <tr
                key={item.id}
                className="h-[56px] hover:bg-[#f6f7fb]"
                onClick={()=> navigate("order-view")}
              >
                <td className="pl-10">{item.id}</td>
                <td className="pl-10 text-[#2E263DE5] text-[15px]">
                  {item.market}
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px]">
                  {item.phone}
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px]">
                  {item.totalPrice}
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px]">
                  {item.stock}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default memo(TodayOrders);
