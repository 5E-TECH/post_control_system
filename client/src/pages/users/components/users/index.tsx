import { Trash } from "lucide-react";
import { memo, useEffect, useState, type FC } from "react";
import superImg from "../../../../shared/assets/users/super.svg";
import TableSkeleton from "../../../orders/components/ordersTabelSkeleton/ordersTableSkeleton";
import { useTranslation } from "react-i18next";
import { Pagination, Switch, type PaginationProps } from "antd";
import { useParamsHook } from "../../../../shared/hooks/useParams";
import { useDispatch } from "react-redux";
import { setUserFilter } from "../../../../shared/lib/features/user-filters";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import ConfirmPopup from "../../../../shared/components/confirmPopup";

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
  const navigate = useNavigate();

  const { handleSuccess, handleApiError } = useApiNotification();
  const { updateUser, removeUser } = useUser();
  const onChangeChecked = (checked: boolean, user: any) => {
    const id = user?.id;
    const role = user?.role;
    const status = checked ? "active" : "inactive";

    updateUser.mutate(
      { role, id, data: { status } },
      {
        onSuccess: () =>
          handleSuccess(`Foydalanuvchini holati muvaffaqiyatli yangilandi`),
        onError: (err) =>
          handleApiError(err, `Foydalanuvchini holatini yangilashda xatolik`),
      }
    );
  };

  const [popup, setPopup] = useState(false);
  const [deleteItem, setDeleteItem] = useState<any>(null);

  const confirmDelete = () => {
    if (!deleteItem?.id) return;
    removeUser.mutate(deleteItem.id, {
      onSuccess: () => {
        handleSuccess(`Foydalanuvchi muvaffaqiyatli o'chirildi`);
        setPopup(false);
      },
      onError: (err) =>
        handleApiError(err, "Foydalanuvchini o'chirishda xatolik"),
    });
  };

  return (
    <div className="pt-[21px]">
      <table className="w-full">
        <thead className="bg-[#9d70ff] text-[16px] text-white  dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
          <tr>
            <th className="p-[20px] flex items-center gap-6">
              #
              <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
            </th>

            <th className="w-[308px] pl-[60px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("NAME")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("PHONE")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("ROLE")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] pl-[20px] text-left">
              <div className="flex items-center justify-between pr-[21px]">
                {t("STATUS")}
                <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
              </div>
            </th>
            <th className="w-[308px] pl-[20px] text-left">
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
              <tr
                key={user?.id}
                onClick={() => navigate(`/user-profile/${user?.id}`)}
                className={`h-[56px] cursor-pointer hover:bg-[#f6f7fb9f] dark:hover:bg-[#3d3759] font-medium dark:text-[#d5d1eb] text-[#2E263DE5] text-[16px] ${
                  inx % 2 === 0
                    ? "bg-white dark:bg-[#2a243a]"
                    : "bg-[#aa85f818] dark:bg-[#342d4a]"
                }`}
              >
                <td
                  className="data-cell p-[20px] flex items-center"
                  data-cell="#"
                >
                  {inx + 1}
                </td>
                <td
                  className="data-cell w-[254px] h-[56px] pl-[60px] text-left max-[901px]:w-full"
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

                <td
                  className="data-cell w-[254px] h-[56px] pl-[20px] text-left max-[901px]:w-full"
                  data-cell="STATUS"
                >
                  <div className="flex items-center gap-3">
                    {/* Badge */}
                    <span
                      className={`font-normal w-[70px] h-[30px] flex items-center justify-center rounded-[100px] ${
                        user?.status === "active"
                          ? "text-green-600 bg-green-500/20"
                          : "text-[#F76659] bg-[#F7665929]"
                      }`}
                    >
                      {user?.status}
                    </span>
                    <Switch
                      className={`${
                        user?.status === "active"
                          ? "bg-green-600!"
                          : "bg-[#F76659]!"
                      }`}
                      checked={user?.status === "active"}
                      onChange={(checked, event) => {
                        event.stopPropagation();
                        onChangeChecked(checked, user);
                      }}
                    />
                  </div>
                </td>

                <td
                  className="data-cell w-[254px] h-[56px] pl-[19px] text-left max-[901px]:w-full"
                  data-cell="ACTIONS"
                >
                  <div className="flex gap-2.5 items-center text-[#2E263DB2] dark:text-[#B1ADC7]">
                    <Trash
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteItem(user);
                        setPopup(true);
                      }}
                      className="w-[22px] h-[22px] cursor-pointer hover:opacity-80"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      </table>
      <ConfirmPopup
        isShow={popup}
        title={`“${deleteItem?.name}” foydalanuvchini o‘chirishni tasdiqlaysizmi?`}
        description="Bu amalni ortga qaytarib bo‘lmaydi."
        confirmText="Ha, o‘chir"
        cancelText="Bekor qilish"
        onConfirm={confirmDelete}
        onCancel={() => setPopup(false)}
      />

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
