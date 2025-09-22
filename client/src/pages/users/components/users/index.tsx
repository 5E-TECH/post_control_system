import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Eye,
  Trash,
} from "lucide-react";
import { memo, type FC } from "react";
import superImg from "../../../../shared/assets/users/super.svg";
import TableSkeleton from "../../../orders/components/ordersTabelSkeleton/ordersTableSkeleton";

interface Props {
  data: any[];
  isLoading: boolean;
}

const UsersTableComp: FC<Props> = ({ data, isLoading }) => {
  return (
    <div className="pt-[21px]">
      <table>
        <thead className="bg-[#F6F7FB] dark:bg-[#3D3759]">
          <tr>
            <th className="p-[20px] flex items-center">#</th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                NAME
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                PHONE
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                ROLE
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                STATUS
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                ACTION
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
          </tr>
        </thead>
        {isLoading ? (
          <TableSkeleton rows={10} columns={5} />
        ) : (
          <tbody>
            {data?.map((user: any, inx: number) => (
              <tr key={user?.id}>
                <td className="p-[20px] flex items-center">{inx + 1}</td>
                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                        {user?.name}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#B1ADC7]">
                    {user?.phone_number}
                  </span>
                </td>
                <td className="w-[254px] h-[56px] pl-[20px] text-left">
                  <div className="flex gap-2.5 items-center">
                    <div>
                      <img src={superImg} alt="" />
                    </div>
                    <span className="font-normal text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                      {user?.role?.charAt(0).toUpperCase() +
                        user?.role?.slice(1)}
                    </span>
                  </div>
                </td>

                {user?.status === "active" ? (
                  <td className="w-[254px] h-[56px] pl-[20px] text-left">
                    <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                      {user?.status}
                    </span>
                  </td>
                ) : (
                  <td className="w-[254px] h-[56px] pl-[20px] text-left">
                    <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                      {user?.status}
                    </span>
                  </td>
                )}
                <td className="w-[254px] h-[56px] pl-[19px] text-left">
                  <div className="flex gap-2.5 items-center text-[#2E263DB2] dark:text-[#B1ADC7]">
                    <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                    <Eye className="w-[22px] h-[22px] ml-1 cursor-pointer hover:opacity-80" />
                    <EllipsisVertical className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        )}
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
          <ChevronLeft className="w-5 h-5 cursor-pointer text-gray-600 dark:text-[#E7E3FCE5] hover:opacity-75" />
          <ChevronRight className="w-5 h-5 cursor-pointer text-gray-600 dark:text-[#E7E3FCE5] hover:opacity-75" />
        </div>
      </div>
    </div>
  );
};

export default memo(UsersTableComp);
