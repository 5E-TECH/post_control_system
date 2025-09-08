import { memo } from "react";
import { Search, MoreVertical, ChevronLeft, ChevronRight } from "lucide-react";

const CustomerTable = () => {
  return (
    <div className="w-[75%]">
      <div className="shadow-lg bg-[#fff] dark:bg-[#312D4B] rounded-md">
        <div>
          <div className="flex justify-between items-center px-[20px] py-[30px]">
            <h3 className="font-medium text-[18px] dark:text-[#E7E3FCE5]">
              Orders placed
            </h3>
            <div className="flex border-[#2E263D38] dark:text-[#E7E3FC66] px-[16px] py-[12px] border-1 rounded-md dark:border-[#E7E3FC38]">
              <input
                type="text"
                name=""
                id=""
                placeholder="Search Order"
                className="font-normal text-[15px] outline-0 dark:text-white"
              />
              <Search className="text-[#2E263D66] dark:text-[#E7E3FC66]" />
            </div>
          </div>
          <div>
            <table className="w-full border-collapse">
              <thead className="dark:bg-[#3D3759] bg-[#F6F7FB]">
                <tr>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    <div className="flex items-center justify-between pr-[21px]">
                      ORDER
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    <div className="flex items-center justify-between pr-[21px]">
                      DATE
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    <div className="flex items-center justify-between pr-[21px]">
                      STATUS
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    <div className="flex items-center justify-between pr-[21px]">
                      SPENT
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                  <th className="h-[56px] font-medium text-[13px] text-left px-4">
                    <div className="flex items-center justify-between pr-[21px]">
                      ACTIONS
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="text-[14px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2]">
                <tr className="border-t border-[#E7E3FC1F] text-[15px] font-normal">
                  <td className="px-4 py-3 text-[#8C57FF]">#4910</td>
                  <td className="px-4 py-3">Aug 17, 2020</td>
                  <td className="px-4 py-3">
                    <span className="px-[12px] py-[2px] text-[#16B1FF] bg-[#16B1FF29] rounded-full text-[13px]">
                      Ready to Pickup
                    </span>
                  </td>

                  <td className="px-4 py-3">$256.39</td>
                  <td className="px-13 py-3">
                    <MoreVertical />
                  </td>
                </tr>
                <tr className="border-t border-[#2E263D1F] dark:border-[#E7E3FC1F] text-[15px] font-normal">
                  <td className="px-4 py-3 text-[#8C57FF]">#4910</td>
                  <td className="px-4 py-3">Aug 17, 2020</td>
                  <td className="px-4 py-3">
                    <span className="px-[12px] py-[2px] text-[#FFB400] bg-[#FFB40029] rounded-full text-[13px]">
                      Dispatched
                    </span>
                  </td>
                  <td className="px-4 py-3">$256.39</td>
                  <td className="px-13 py-3">
                    <MoreVertical />
                  </td>
                </tr>
                <tr className="border-t border-[#2E263D1F] dark:border-[#E7E3FC1F] text-[15px] font-normal">
                  <td className="px-4 py-3 text-[#8C57FF]">#4910</td>
                  <td className="px-4 py-3">Aug 17, 2020</td>
                  <td className="px-4 py-3">
                    <span className="px-[12px] py-[2px] text-[#56CA00] bg-[#56CA0029] rounded-full text-[13px]">
                      Delivered
                    </span>
                  </td>
                  <td className="px-4 py-3">$256.39</td>
                  <td className="px-13 py-3">
                    <MoreVertical />
                  </td>
                </tr>
                <tr className="border-t border-[#2E263D1F] dark:border-[#E7E3FC1F] text-[15px] font-normal">
                  <td className="px-4 py-3 text-[#8C57FF]">#4910</td>
                  <td className="px-4 py-3">Aug 17, 2020</td>
                  <td className="px-4 py-3">
                    <span className="px-[12px] py-[2px] text-[#8C57FF] bg-[#8C57FF29] rounded-full text-[13px]">
                      Out for delivery
                    </span>
                  </td>
                  <td className="px-4 py-3">$256.39</td>
                  <td className="px-13 py-3">
                    <MoreVertical />
                  </td>
                </tr>
                <tr className="border-t border-[#2E263D1F] dark:border-[#E7E3FC1F] text-[15px] font-normal">
                  <td className="px-4 py-3 text-[#8C57FF]">#4910</td>
                  <td className="px-4 py-3">Aug 17, 2020</td>
                  <td className="px-4 py-3">
                    <span className="px-[12px] py-[2px] text-[#16B1FF] bg-[#16B1FF29] rounded-full text-[13px]">
                      Ready to Pickup
                    </span>
                  </td>

                  <td className="px-4 py-3">$256.39</td>
                  <td className="px-13 py-3">
                    <MoreVertical />
                  </td>
                </tr>
                <tr className="border-t border-[#2E263D1F] dark:border-[#E7E3FC1F] text-[15px] font-normal">
                  <td className="px-4 py-3 text-[#8C57FF]">#4910</td>
                  <td className="px-4 py-3">Aug 17, 2020</td>
                  <td className="px-4 py-3">
                    <span className="px-[12px] py-[2px] text-[#56CA00] bg-[#56CA0029] rounded-full text-[13px]">
                      Delivered
                    </span>
                  </td>
                  <td className="px-4 py-3">$256.39</td>
                  <td className="px-13 py-3">
                    <MoreVertical />
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="flex justify-end items-center pr-[105px] pt-4 gap-6 pb-[16px]">
              <div className="flex items-center">
                <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
                  Rows per page:
                </span>
                <select
                  className="rounded px-2 py-1 text-[15px] outline-none"
                  defaultValue="10"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>

              <div className="flex items-center font-normal text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                <span className="mr-1">1-5</span>
                <span className="mr-1">of</span>
                <span className="">13</span>
              </div>

              <div className="flex items-center gap-[23px]">
                <ChevronLeft className="w-5 h-5 cursor-pointer text-gray-600 hover:text-black dark:text-[#E7E3FCE5]" />
                <ChevronRight className="w-5 h-5 cursor-pointer text-gray-600 hover:text-black dark:text-[#E7E3FCE5]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CustomerTable);
