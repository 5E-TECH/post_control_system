import { Trash2, Loader2, Phone, User } from "lucide-react";
import { memo, useEffect, useState, type FC } from "react";
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

  const onChange: PaginationProps["onChange"] = (newPage, newLimit) => {
    if (newPage === 1) {
      removeParam("page");
    } else {
      setParam("page", newPage);
    }

    if (newLimit === 10) {
      removeParam("limit");
    } else {
      setParam("limit", newLimit);
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

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return "";
    return phone
      .replace(/\D/g, "")
      .replace(/^(\d{3})(\d{2})(\d{3})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      superadmin:
        "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
      admin:
        "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
      registrator:
        "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
      market:
        "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
      courier:
        "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    };
    return (
      colors[role] ||
      "bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300"
    );
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <TableSkeleton rows={10} columns={5} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-10 sm:py-16 text-center px-4">
        <User className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 dark:text-gray-600 mb-3 sm:mb-4" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-1.5 sm:mb-2">
          Foydalanuvchilar topilmadi
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          Hozircha hech qanday foydalanuvchi yo'q
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full table-auto">
          <thead>
            <tr className="bg-gradient-to-r from-purple-500 to-indigo-600">
              <th className="px-4 py-3 text-left text-sm font-medium text-white w-14 whitespace-nowrap">
                #
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white whitespace-nowrap">
                {t("NAME")}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white whitespace-nowrap">
                {t("PHONE")}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white whitespace-nowrap">
                {t("ROLE")}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-white whitespace-nowrap">
                {t("STATUS")}
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-white w-32 whitespace-nowrap">
                {t("ACTION")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {data?.map((user: any, inx: number) => (
              <tr
                key={user?.id}
                onClick={() => navigate(`/user-profile/${user?.id}`)}
                className="hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {(page - 1) * limit + inx + 1}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-white truncate max-w-[180px]">
                      {user?.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {formatPhoneNumber(user?.phone_number)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(user?.role)}`}
                  >
                    {t(user?.role)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      user?.status === "active"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {t(user?.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  <div
                    className="inline-flex items-center gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      size="small"
                      className={`${
                        user?.status === "active"
                          ? "bg-green-500!"
                          : "bg-red-500!"
                      }`}
                      checked={user?.status === "active"}
                      onChange={(checked) => onChangeChecked(checked, user)}
                    />
                    <button
                      onClick={() => {
                        setDeleteItem(user);
                        setPopup(true);
                      }}
                      disabled={removeUser.isPending}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {removeUser.isPending && deleteItem?.id === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-700/50">
        {data?.map((user: any) => (
          <div
            key={user?.id}
            onClick={() => navigate(`/user-profile/${user?.id}`)}
            className="p-3 sm:p-4 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white truncate">
                      {user?.name}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 flex-shrink-0" />
                      {formatPhoneNumber(user?.phone_number)}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium flex-shrink-0 ${
                      user?.status === "active"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {t(user?.status)}
                  </span>
                </div>

                {/* Bottom Row */}
                <div className="flex items-center justify-between mt-2 sm:mt-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${getRoleBadgeColor(user?.role)}`}
                  >
                    {t(user?.role)}
                  </span>

                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      size="small"
                      className={`${
                        user?.status === "active"
                          ? "bg-green-500!"
                          : "bg-red-500!"
                      }`}
                      checked={user?.status === "active"}
                      onChange={(checked) => onChangeChecked(checked, user)}
                    />
                    <button
                      onClick={() => {
                        setDeleteItem(user);
                        setPopup(true);
                      }}
                      disabled={removeUser.isPending}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {removeUser.isPending && deleteItem?.id === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total && total > 0 && (
        <div className="px-3 sm:px-4 py-3 sm:py-4 border-t border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
            Jami: {total} ta
          </span>
          <Pagination
            showSizeChanger
            current={page}
            total={total}
            pageSize={limit}
            onChange={onChange}
            size="small"
            responsive
            showTotal={(total) => (
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                Jami: {total} ta
              </span>
            )}
          />
        </div>
      )}

      {/* Delete Confirmation Popup */}
      <ConfirmPopup
        isShow={popup}
        title={`"${deleteItem?.name}" foydalanuvchini o'chirishni tasdiqlaysizmi?`}
        description="Bu amalni ortga qaytarib bo'lmaydi."
        confirmText="Ha, o'chir"
        cancelText="Bekor qilish"
        onConfirm={confirmDelete}
        onCancel={() => setPopup(false)}
      />
    </div>
  );
};

export default memo(UsersTableComp);
