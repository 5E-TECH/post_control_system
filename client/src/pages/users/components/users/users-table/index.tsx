import { memo } from "react";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import UsersTableComp from "..";
import type { RootState } from "../../../../../app/store";
import { useSelector } from "react-redux";

const UsersTable = () => {
  const userFilter = useSelector((state: RootState) => state.setUserFilter);
  const { getUsersExceptMarket } = useUser();

  const { data, isLoading } = getUsersExceptMarket({
    search: userFilter.search as string,
    role: userFilter.role as string,
    status: userFilter.status as string,
    page: userFilter.page as number,
    limit: userFilter.limit as number,
  });

  const users = Array.isArray(data?.data?.data) ? data.data.data : [];

  const total = data?.data?.total || 0;

  return <UsersTableComp data={users} isLoading={isLoading} total={total} />;
};

export default memo(UsersTable);
