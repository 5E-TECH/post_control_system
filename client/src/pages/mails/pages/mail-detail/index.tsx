import { memo, useEffect, useState } from "react";
import { Trash } from "lucide-react";
import SearchInput from "../../../users/components/search-input";
import { usePost } from "../../../../shared/api/hooks/usePost";
import { useLocation, useParams } from "react-router-dom";
import { Button } from "antd";

const MailDetail = () => {
  const { id } = useParams();
  const { state } = useLocation();
  const regionName = state?.regionName;
  const { getPostById } = usePost();
  const { data } = getPostById(id as string);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (data?.data) {
      setSelectedIds(data.data.map((item: any) => item.id));
    }
  }, [data]);

  const handleClick = () => {
    
  };

  return (
    <div className="flex flex-col gap-5 p-5 h-[800px]">
      <div className="flex flex-col justify-between shadow-lg rounded-md bg-[#ffffff] dark:bg-[#312D48]">
        <div className="flex justify-between px-5 pt-5">
          <h1 className="text-2xl mt-1">
            <span>{regionName}</span> buyurtmalari
          </h1>
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
                    checked={
                      !!data?.data && selectedIds.length === data.data.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(data?.data.map((item: any) => item.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                  />
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
                      checked={
                        order?.id ? selectedIds.includes(order.id) : false
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds([...selectedIds, order.id]);
                        } else {
                          setSelectedIds(
                            selectedIds.filter((id) => id !== order.id)
                          );
                        }
                      }}
                    />
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
                    {order?.customer?.district?.name}
                  </td>
                  <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                    {new Intl.NumberFormat("uz-UZ").format(order?.total_price)}
                  </td>
                  <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                    {order?.items?.length}
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

      <div className="flex justify-end">
        <Button
          onClick={handleClick}
          className="w-[160px]! h-[37px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! text-[15px]! border-none!"
        >
          Po'chtani jo'natish
        </Button>
      </div>
    </div>
  );
};

export default memo(MailDetail);
