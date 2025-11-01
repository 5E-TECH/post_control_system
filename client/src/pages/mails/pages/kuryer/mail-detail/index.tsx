import { memo, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import SearchInput from "../../../../users/components/search-input";
import { Button } from "antd";
import { usePost } from "../../../../../shared/api/hooks/usePost";
import { useApiNotification } from "../../../../../shared/hooks/useApiNotification";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";
import { useTranslation } from "react-i18next";

const CourierMailDetail = () => {
  const { t } = useTranslation("mails");

  const regionName = useSelector((state: RootState) => state.region);

  const { id } = useParams();

  // const { state } = useLocation();
  // const regionName = state.regionName;

  const { getPostById, receivePost } = usePost();
  const { mutate: receivePostsByPostId, isPending } = receivePost();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const navigate = useNavigate();
  const { handleSuccess, handleApiError } = useApiNotification();
  const handleClick = () => {
    const post = {
      order_ids: selectedIds,
    };

    receivePostsByPostId(
      { id: id as string, data: post },
      {
        onSuccess: () => {
          handleSuccess("Pochtalar muvaffaqiyatli qabul qilindi");
          navigate("/courier-mails");
        },
        onError: (err: any) =>
          handleApiError(err, "Pochtalarni qabul qilishda xatolik yuz berdi"),
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
  const postData = data?.data?.allOrdersByPostId;

  useEffect(() => {
    if (postData) {
      setSelectedIds(postData?.map((item: any) => item.id));
    }
  }, [postData]);

  const hideSend = regionName.hideSend;

  const toggleSelect = (id: string) => {
    setSelectedIds(
      (prev) =>
        prev.includes(id)
          ? prev.filter((item) => item !== id) // agar bor bo‘lsa — olib tashla
          : [...prev, id] // yo‘q bo‘lsa — qo‘sh
    );
  };

  return (
    <div className="flex flex-col gap-5 p-5 h-[800px]">
      <div className="flex flex-col justify-between shadow-lg rounded-md bg-[#ffffff] dark:bg-[#312D48]">
        <div className="flex justify-between px-5 pt-5 max-[650px]:flex-col">
          <h1 className="text-2xl mt-1 max-[650px]:mb-5 ">
            <span>{regionName.regionName}{" "}</span>
            {t("buyurtmalari")}
          </h1>
          <SearchInput placeholder={`${t("qidiruv")}...`} />
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
                          setSelectedIds(postData?.map((item: any) => item.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                    />
                  </th>
                ) : null}
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("mijozIsmi")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("telefonRaqami")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("tumani")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("pulMiqdori")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("delivery")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>

                <th className="w-[340px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t("time")}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {postData?.map((order: any) => (
                <tr
                  key={order?.id}
                  onClick={() => toggleSelect(order.id)}
                  className="select-none"
                >
                  {!hideSend ? (
                    <td className="p-[20px] flex items-center">
                      {" "}
                      <input
                        type="checkbox"
                        className="w-[18px] h-[18px] rounded-sm"
                        onClick={(e) => e.stopPropagation()} // table row click bilan to‘qnashmasin
                        checked={selectedIds.includes(order.id)}
                        onChange={() => toggleSelect(order.id)}
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
                    {new Intl.NumberFormat("uz-UZ").format(order?.total_price)}
                  </td>
                  <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                    {t(`${order?.where_deliver}`)}
                  </td>
                  <td className="w-[254px] h-[56px] font-normal text-[15px] text-[#2E263DE5] pl-[20px] text-left dark:text-[#D5D1EB]">
                    {new Date(Number(order?.created_at)).toLocaleDateString(
                      "uz-UZ"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!hideSend ? (
        <div className="flex justify-end">
          <Button
            disabled={isPending}
            loading={isPending}
            onClick={handleClick}
            className="w-[160px]! h-[37px]! bg-[var(--color-bg-sy)]! text-[#ffffff]! text-[15px]!"
          >
            Po'chtani qabul qilish
          </Button>
        </div>
      ) : null}
    </div>
  );
};

export default memo(CourierMailDetail);
