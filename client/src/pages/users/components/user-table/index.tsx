import { memo } from "react";
import { EllipsisVertical, Eye, Trash } from "lucide-react";
import user from "../../../../shared/assets/users/table-user.svg";
import superImg from "../../../../shared/assets/users/super.svg";

const UserTable = () => {
  return (
    <div className="pt-[21px]">
      <table>
        <thead className="bg-[#F6F7FB]">
          <tr>
            <th className="p-[20px] flex items-center">
              <input type="checkbox" className="w-[18px] h-[18px] rounded-sm" />
            </th>
            <th className="w-[250px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                USER
                <div className="w-[2px] h-[14px] bg-[#2E263D1F]"></div>
              </div>
            </th>
            <th className="w-[270px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                PHONE
                <div className="w-[2px] h-[14px] bg-[#2E263D1F]"></div>
              </div>
            </th>
            <th className="w-[203px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                ROLE
                <div className="w-[2px] h-[14px] bg-[#2E263D1F]"></div>
              </div>
            </th>
            <th className="w-[203px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                LOCATION
                <div className="w-[2px] h-[14px] bg-[#2E263D1F]"></div>
              </div>
            </th>
            <th className="w-[203px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                STATUS
                <div className="w-[2px] h-[14px] bg-[#2E263D1F]"></div>
              </div>
            </th>
            <th className="w-[203px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                ACTION
                <div className="w-[2px] h-[14px] bg-[#2E263D1F]"></div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-[20px] flex items-center">
              {" "}
              <input type="checkbox" className="w-[18px] h-[18px] rounded-sm" />
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-4">
                <div>
                  <img src={user} alt="" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-[15px] text-[#2E263DE5]">
                    Jordan Stevenson
                  </span>
                  <span className="font-normal text-[13px] text-[#2E263DB2]">
                    jordan.stevenson
                  </span>
                </div>
              </div>
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <span className="font-normal text-[15px] text-[#2E263DB2]">
                +998990000000
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2 items-center">
                <div>
                  <img src={superImg} alt="" />
                </div>
                <span className="font-normal text-[15px] text-[#2E263DE5]">
                  Super
                </span>
              </div>
            </td>
            <td className="w-[203px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left">
              Office
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                Pending
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2.5 items-center text-[#2E263DB2] ">
                <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                <Eye className="w-[22px] h-[22px] ml-1 cursor-pointer hover:opacity-80" />
                <EllipsisVertical className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="p-[20px] flex items-center">
              {" "}
              <input type="checkbox" className="w-[18px] h-[18px] rounded-sm" />
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-4">
                <div>
                  <img src={user} alt="" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-[15px] text-[#2E263DE5]">
                    Jordan Stevenson
                  </span>
                  <span className="font-normal text-[13px] text-[#2E263DB2]">
                    jordan.stevenson
                  </span>
                </div>
              </div>
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <span className="font-normal text-[15px] text-[#2E263DB2]">
                +998990000000
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2 items-center">
                <div>
                  <img src={superImg} alt="" />
                </div>
                <span className="font-normal text-[15px] text-[#2E263DE5]">
                  Super
                </span>
              </div>
            </td>
            <td className="w-[203px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left">
              Office
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                Pending
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2.5 items-center text-[#2E263DB2]">
                <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                <Eye className="w-[22px] h-[22px] ml-1 cursor-pointer hover:opacity-80" />
                <EllipsisVertical className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="p-[20px] flex items-center">
              {" "}
              <input type="checkbox" className="w-[18px] h-[18px] rounded-sm" />
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-4">
                <div>
                  <img src={user} alt="" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-[15px] text-[#2E263DE5]">
                    Jordan Stevenson
                  </span>
                  <span className="font-normal text-[13px] text-[#2E263DB2]">
                    jordan.stevenson
                  </span>
                </div>
              </div>
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <span className="font-normal text-[15px] text-[#2E263DB2]">
                +998990000000
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2 items-center">
                <div>
                  <img src={superImg} alt="" />
                </div>
                <span className="font-normal text-[15px] text-[#2E263DE5]">
                  Super
                </span>
              </div>
            </td>
            <td className="w-[203px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left">
              Office
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                Pending
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2.5 items-center text-[#2E263DB2]">
                <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                <Eye className="w-[22px] h-[22px] ml-1 cursor-pointer hover:opacity-80" />
                <EllipsisVertical className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="p-[20px] flex items-center">
              {" "}
              <input type="checkbox" className="w-[18px] h-[18px] rounded-sm" />
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-4">
                <div>
                  <img src={user} alt="" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-[15px] text-[#2E263DE5]">
                    Jordan Stevenson
                  </span>
                  <span className="font-normal text-[13px] text-[#2E263DB2]">
                    jordan.stevenson
                  </span>
                </div>
              </div>
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <span className="font-normal text-[15px] text-[#2E263DB2]">
                +998990000000
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2 items-center">
                <div>
                  <img src={superImg} alt="" />
                </div>
                <span className="font-normal text-[15px] text-[#2E263DE5]">
                  Super
                </span>
              </div>
            </td>
            <td className="w-[203px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left">
              Office
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                Pending
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2.5 items-center text-[#2E263DB2]">
                <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                <Eye className="w-[22px] h-[22px] ml-1 cursor-pointer hover:opacity-80" />
                <EllipsisVertical className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="p-[20px] flex items-center">
              {" "}
              <input type="checkbox" className="w-[18px] h-[18px] rounded-sm" />
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-4">
                <div>
                  <img src={user} alt="" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-[15px] text-[#2E263DE5]">
                    Jordan Stevenson
                  </span>
                  <span className="font-normal text-[13px] text-[#2E263DB2]">
                    jordan.stevenson
                  </span>
                </div>
              </div>
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <span className="font-normal text-[15px] text-[#2E263DB2]">
                +998990000000
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2 items-center">
                <div>
                  <img src={superImg} alt="" />
                </div>
                <span className="font-normal text-[15px] text-[#2E263DE5]">
                  Super
                </span>
              </div>
            </td>
            <td className="w-[203px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left">
              Office
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                Pending
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2.5 items-center text-[#2E263DB2]">
                <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                <Eye className="w-[22px] h-[22px] ml-1 cursor-pointer hover:opacity-80" />
                <EllipsisVertical className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="p-[20px] flex items-center">
              {" "}
              <input type="checkbox" className="w-[18px] h-[18px] rounded-sm" />
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-4">
                <div>
                  <img src={user} alt="" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-[15px] text-[#2E263DE5]">
                    Jordan Stevenson
                  </span>
                  <span className="font-normal text-[13px] text-[#2E263DB2]">
                    jordan.stevenson
                  </span>
                </div>
              </div>
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <span className="font-normal text-[15px] text-[#2E263DB2]">
                +998990000000
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2 items-center">
                <div>
                  <img src={superImg} alt="" />
                </div>
                <span className="font-normal text-[15px] text-[#2E263DE5]">
                  Super
                </span>
              </div>
            </td>
            <td className="w-[203px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left">
              Office
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                Pending
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2.5 items-center text-[#2E263DB2]">
                <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                <Eye className="w-[22px] h-[22px] ml-1 cursor-pointer hover:opacity-80" />
                <EllipsisVertical className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="p-[20px] flex items-center">
              {" "}
              <input type="checkbox" className="w-[18px] h-[18px] rounded-sm" />
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-4">
                <div>
                  <img src={user} alt="" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-[15px] text-[#2E263DE5]">
                    Jordan Stevenson
                  </span>
                  <span className="font-normal text-[13px] text-[#2E263DB2]">
                    jordan.stevenson
                  </span>
                </div>
              </div>
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <span className="font-normal text-[15px] text-[#2E263DB2]">
                +998990000000
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2 items-center">
                <div>
                  <img src={superImg} alt="" />
                </div>
                <span className="font-normal text-[15px] text-[#2E263DE5]">
                  Super
                </span>
              </div>
            </td>
            <td className="w-[203px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left">
              Office
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                Pending
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2.5 items-center text-[#2E263DB2]">
                <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                <Eye className="w-[22px] h-[22px] ml-1 cursor-pointer hover:opacity-80" />
                <EllipsisVertical className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="p-[20px] flex items-center">
              {" "}
              <input type="checkbox" className="w-[18px] h-[18px] rounded-sm" />
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-4">
                <div>
                  <img src={user} alt="" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-[15px] text-[#2E263DE5]">
                    Jordan Stevenson
                  </span>
                  <span className="font-normal text-[13px] text-[#2E263DB2]">
                    jordan.stevenson
                  </span>
                </div>
              </div>
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <span className="font-normal text-[15px] text-[#2E263DB2]">
                +998990000000
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2 items-center">
                <div>
                  <img src={superImg} alt="" />
                </div>
                <span className="font-normal text-[15px] text-[#2E263DE5]">
                  Super
                </span>
              </div>
            </td>
            <td className="w-[203px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left">
              Office
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                Pending
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2.5 items-center text-[#2E263DB2]">
                <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                <Eye className="w-[22px] h-[22px] ml-1 cursor-pointer hover:opacity-80" />
                <EllipsisVertical className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
              </div>
            </td>
          </tr>
          <tr>
            <td className="p-[20px] flex items-center">
              {" "}
              <input type="checkbox" className="w-[18px] h-[18px] rounded-sm" />
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-4">
                <div>
                  <img src={user} alt="" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-[15px] text-[#2E263DE5]">
                    Jordan Stevenson
                  </span>
                  <span className="font-normal text-[13px] text-[#2E263DB2]">
                    jordan.stevenson
                  </span>
                </div>
              </div>
            </td>
            <td className="w-[250px] h-[56px] pl-[20px] text-left">
              <span className="font-normal text-[15px] text-[#2E263DB2]">
                +998990000000
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2 items-center">
                <div>
                  <img src={superImg} alt="" />
                </div>
                <span className="font-normal text-[15px] text-[#2E263DE5]">
                  Super
                </span>
              </div>
            </td>
            <td className="w-[203px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left">
              Office
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                Pending
              </span>
            </td>
            <td className="w-[203px] h-[56px] pl-[20px] text-left">
              <div className="flex gap-2.5 items-center text-[#2E263DB2]">
                <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                <Eye className="w-[22px] h-[22px] ml-1 cursor-pointer hover:opacity-80" />
                <EllipsisVertical className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default memo(UserTable);
