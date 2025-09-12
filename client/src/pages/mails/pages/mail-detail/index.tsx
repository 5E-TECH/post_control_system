import { memo } from "react";
import { Trash } from "lucide-react";
import SearchInput from "../../../users/components/search-input";
import { usePost } from "../../../../shared/api/hooks/usePost";
import { useParams } from "react-router-dom";

const MailDetail = () => {
  const { id } = useParams();

  const { getPostById } = usePost();
  const { data } = getPostById(id as string);
  console.log(data)
  return (
    <div className="p-5 h-[800px]">
      <div className="flex flex-col justify-between shadow-lg rounded-md bg-[#ffffff] dark:bg-[#312D48]">
        <div className="flex justify-between px-5 pt-5">
          <h1 className="text-2xl mt-1">Andijon viloyati buyurtmalari</h1>
          <SearchInput placeholder="Qidiruv..." />
        </div>

        <div className="mt-5">
          <table>
            <thead className="bg-[#F6F7FB] dark:bg-[#3D3759]">
              <tr>
                <th className="p-[20px] flex items-center">
                  <input
                    type="checkbox"
                    className="w-[18px] h-[18px] rounded-sm"
                  />
                </th>
                <th className="w-[254px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    #
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[254px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    MIJOZ ISMI
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[258px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    TELEFON RAQAMI
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[258px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    TUMANI
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[258px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    PUL MIQDORI
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[258px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    DONA
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[258px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    HARAKATLAR
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.data?.map((order: any) => (
                <tr key={order?.id}>
                  <td className="p-[20px] flex items-center">
                    {" "}
                    <input
                      type="checkbox"
                      className="w-[18px] h-[18px] rounded-sm"
                    />
                  </td>
                  <td className="w-[254px] h-[56px] pl-[20px] text-left">
                    <span className="font-medium text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                      {order?.id}
                    </span>
                  </td>
                  <td className="w-[254px] h-[56px] pl-[20px] text-left">
                    <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#B1ADC7]">
                      {order?.customer?.name}
                    </span>
                  </td>
                  <td className="w-[254px] h-[56px] pl-[20px] text-left">
                    <span className="font-normal text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                      {order?.customer?.phone_number}
                    </span>
                  </td>
                  <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                    {order?.where_deliver}
                  </td>
                  <td className="w-[254px] h-[56px] pl-[20px] text-left">
                    <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                      {order?.total_price}
                    </span>
                  </td>
                  <td className="w-[254px] h-[56px] pl-[20px] text-left">
                    <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                      {order?.product_quantity}
                    </span>
                  </td>
                  <td className="w-[254px] h-[56px] pl-[19px] text-left">
                    <div className="flex gap-2.5 items-center text-[#2E263DB2] dark:text-[#B1ADC7]">
                      <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default memo(MailDetail);
