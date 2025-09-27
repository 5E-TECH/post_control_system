import { memo } from "react";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import UsersTableComp from "..";
import type { RootState } from "../../../../../app/store";
import { useSelector } from "react-redux";

const UsersTable = () => {
  const userFilter = useSelector((state: RootState) => state.setUserFilter);
  const { getUser } = useUser();

  const { data, isLoading } = getUser({
    search: userFilter.search as string,
    role: userFilter.role as string,
    status: userFilter.status as string,
    page: userFilter.page as number,
    limit:
      (userFilter.limit as number) >= 10 ? (userFilter.limit as number) : 0,
  });

  const users =
    data?.data?.data?.filter((user: any) => user?.role !== "market") || [];
  const total = users?.length;

  return <UsersTableComp data={users} isLoading={isLoading} total={total} />;
};

export default memo(UsersTable);
