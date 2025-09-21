import { memo } from "react";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import UsersTableComp from "..";

const UsersTable = () => {
  const { getUser } = useUser();
  const { data, isLoading } = getUser();
  const users =
    data?.data?.data?.filter((user: any) => user?.role !== "market") || [];
  return <UsersTableComp data={users} isLoading={isLoading} />;
};

export default memo(UsersTable);
