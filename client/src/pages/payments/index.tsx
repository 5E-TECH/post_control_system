import { ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";
import React from "react";
import Select from "../users/components/select";

const Payments = () => {
  return (
    <div className="mt-10">
      <div className="grid grid-cols-3 gap-14 text-center text-2xl items-end mx-5 ">
        <div className="py-15 rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white">
          <h3>Berilishi kerak</h3>
          <strong className="block pt-3">10 000 000 UZS</strong>
        </div>

        <div className="h-[250px] flex flex-col justify-center rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white">
          <h3>Kassadagi miqdor</h3>
          <strong className="block pt-3">40 000 000 UZS</strong>
        </div>

        <div className="py-15 rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white">
          <h3>Olinishi kerak</h3>
          <strong className="block pt-3">70 000 000 UZS</strong>
        </div>
      </div>

      <div className="mt-12 mx-5">
        <h1 className="text-xl font-semibold mb-3">Filters</h1>
        <div className="grid grid-cols-4 gap-6 pt-[16px] max-[1000px]:grid-cols-2 max-[750px]:grid-cols-1">
          <Select text="Operation type" />
          <Select text="Source type" />
          <Select text="Created By" />
          <Select text="Cashbox type" />
        </div>
      </div>

      <div className="mt-12 mx-5">
        <div className="shadow-lg bg-[#fff] dark:bg-[#312D4B] rounded-md">
          <div>
            <div>
              <table className="w-full border-collapse">
                <thead className="dark:bg-[#3D3759] bg-[#F6F7FB] border-4 border-white dark:border-[#3D3759]">
                  <tr>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        # ID
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        Created By
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        Cashbox Type
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        Operation Type
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        Amount
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
    </div>
  );
};

export default React.memo(Payments);
