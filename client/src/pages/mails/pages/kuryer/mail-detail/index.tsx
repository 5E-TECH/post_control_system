import { createContext, memo, useEffect, useMemo, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import SearchInput from "../../../../users/components/search-input";
import { Trash } from "lucide-react";
import { Button } from "antd";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import useNotification from "antd/es/notification/useNotification";

const Context = createContext({ name: "Default" });

const CourierMailDetail = () => {
  const { id } = useParams();
  const { state } = useLocation();
  const regionName = state?.regionName;

  const { getPostById, receivePost } = usePost();
  const { mutate: receivePostsByPostId } = receivePost();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [api, contextHolder] = useNotification();
  const navigate = useNavigate();
  const handleClick = () => {
    const post = {
      order_ids: selectedIds,
    };

    receivePostsByPostId(
      { id: id as string, data: post },
      {
        onSuccess: () => {
          api.success({
            message: "✅ Pochtalar muvaffaqiyatli qabul qilindi",
            placement: "topRight",
          });

          setTimeout(() => {
            navigate("/courier-mails");
          }, 1000);
        },
      }
    );
  };

  // Dynamic fetching based on status
  const [params] = useSearchParams();
  const status = params.get("status");

  let endpoint = "";
  let condition = false;

  if (status === "received") {
    endpoint = "";
    condition = true;
  } else if (["canceled", "canceled_received"].includes(status as string)) {
    endpoint = "rejected/";
    condition = true;
  } else {
    endpoint = "";
    condition = true;
  }

  const { data } = getPostById(id as string, endpoint, condition);
  const postData = data?.data;

  useEffect(() => {
    if (postData) {
      setSelectedIds(postData?.map((item: any) => item.id));
    }
  }, [postData]);

  const hideSend = state?.hideSend;

  const contextValue = useMemo(() => ({ name: "Ant Design" }), []);

  return (
    <Context.Provider value={contextValue}>
      {contextHolder}
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
                  {!hideSend ? (
                    <th className="p-[20px] flex items-center">
                      <input
                        type="checkbox"
                        className="w-[18px] h-[18px] rounded-sm"
                        checked={
                          !!postData && selectedIds.length === postData?.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(
                              postData?.map((item: any) => item.id)
                            );
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                      />
                    </th>
                  ) : null}
                  <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                    <div className="flex items-center justify-between pr-[21px]">
                      MIJOZ ISMI
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                  <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                    <div className="flex items-center justify-between pr-[21px]">
                      TELEFON RAQAMI
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                  <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                    <div className="flex items-center justify-between pr-[21px]">
                      TUMANI
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                  <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                    <div className="flex items-center justify-between pr-[21px]">
                      PUL MIQDORI
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                  <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                    <div className="flex items-center justify-between pr-[21px]">
                      DONA
                      <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                    </div>
                  </th>
                  {!hideSend ? (
                    <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                      <div className="flex items-center justify-between pr-[21px]">
                        HARAKATLAR
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {postData?.map((order: any) => (
                  <tr key={order?.id}>
                    {!hideSend ? (
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
                    ) : null}
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
                      {new Intl.NumberFormat("uz-UZ").format(
                        order?.total_price
                      )}
                    </td>
                    <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                      {order?.items?.length}
                    </td>

                    {!hideSend ? (
                      <td className="w-[254px] h-[56px] pl-[19px] text-left">
                        <div className="flex gap-2.5 items-center text-[#2E263DB2] dark:text-[#B1ADC7]">
                          <Trash className="w-[18px] h-[18px] cursor-pointer hover:opacity-80" />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!hideSend ? (
          <div className="flex justify-end">
            <Button
              onClick={handleClick}
              className="w-[160px]! h-[37px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! text-[15px]!"
            >
              Po'chtani jo'natish
            </Button>
          </div>
        ) : null}
      </div>
    </Context.Provider>
  );
};

export default memo(CourierMailDetail);
