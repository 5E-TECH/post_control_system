import { Edit, EllipsisVertical, Trash } from "lucide-react";
import { memo, useEffect, type FC } from "react";
import superImg from "../../../../shared/assets/users/super.svg";
import TableSkeleton from "../../../orders/components/ordersTabelSkeleton/ordersTableSkeleton";
import { useTranslation } from "react-i18next";
import { Pagination, type PaginationProps } from "antd";
import { useParamsHook } from "../../../../shared/hooks/useParams";
import { useDispatch } from "react-redux";
import { setUserFilter } from "../../../../shared/lib/features/user-filters";

interface Props {
  data: any[];
  isLoading: boolean;
  total?: number;
}

const UsersTableComp: FC<Props> = ({ data, isLoading, total = 1 }) => {
  const { t } = useTranslation("users");

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam("page") || 1);
  const limit = Number(getParam("limit") || 10);

  const onChange: PaginationProps["onChange"] = (newPage, limit) => {
    if (newPage === 1) {
      removeParam("page");
    } else {
      setParam("page", newPage);
    }

    if (limit === 10) {
      removeParam("limit");
    } else {
      setParam("limit", limit);
    }
  };

  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(setUserFilter({ name: "page", value: Number(page) }));
    dispatch(setUserFilter({ name: "limit", value: Number(limit) }));
  }, [page, limit]);

  return (
    <div className="pt-[21px]">
      <table className="w-full">
        <thead className="bg-[#F6F7FB] dark:bg-[#3D3759]">
          <tr>
            <th className="p-[20px] flex items-center">#</th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("NAME")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("PHONE")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("ROLE")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("STATUS")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("ACTION")}
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
                <td
                  className="data-cell p-[20px] flex items-center"
                  data-cell="#"
                >
                  {inx + 1}
                </td>
                <td
                  className="data-cell w-[254px] h-[56px] pl-[20px] text-left max-[901px]:w-full"
                  data-cell="NAME"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-[15px] text-[#2E263DE5] dark:text-[#D5D1EB]">
                        {user?.name}
                      </span>
                    </div>
                  </div>
                </td>
                <td
                  className="data-cell w-[254px] h-[56px] pl-[20px] text-left max-[901px]:w-full"
                  data-cell="PHONE"
                >
                  <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#B1ADC7]">
                    {user?.phone_number}
                  </span>
                </td>
                <td
                  className="data-cell w-[254px] h-[56px] pl-[20px] text-left max-[901px]:w-full"
                  data-cell="ROLE"
                >
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
                  <td
                    className="data-cell w-[254px] h-[56px] pl-[20px] text-left max-[901px]:w-full"
                    data-cell="STATUS"
                  >
                    <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                      {user?.status}
                    </span>
                  </td>
                ) : (
                  <td
                    className="data-cell w-[254px] h-[56px] pl-[20px] text-left max-[901px]:w-full"
                    data-cell="STATUS"
                  >
                    <span className="text-[#FFB400] font-normal text-[13px] px-[12px] py-[3px] bg-[#FFB40029] rounded-[100px]">
                      {user?.status}
                    </span>
                  </td>
                )}
                <td
                  className="data-cell w-[254px] h-[56px] pl-[19px] text-left max-[901px]:w-full"
                  data-cell="ACTIONS"
                >
                  <div className="flex gap-2.5 items-center text-[#2E263DB2] dark:text-[#B1ADC7]">
                    <Trash className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
                    <Edit className="w-[22px] h-[22px] ml-1 cursor-pointer hover:opacity-80" />
                    <EllipsisVertical className="w-[22px] h-[22px] cursor-pointer hover:opacity-80" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
      <div className="flex justify-center my-4">
        <Pagination
          showSizeChanger
          current={page}
          total={total}
          pageSize={limit}
          onChange={onChange}
        />
      </div>
    </div>
  );
};

export default memo(UsersTableComp);
