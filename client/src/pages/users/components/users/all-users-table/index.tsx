import { memo } from "react";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import UsersTableComp from "..";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";

const AllUsersTable = () => {
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
  const allUsers = Array.isArray(data?.data?.data) ? data?.data?.data : [];
  const total = data?.data?.total;
  return <UsersTableComp data={allUsers} isLoading={isLoading} total={total} />;
};

export default memo(AllUsersTable);
