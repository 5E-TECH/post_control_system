import { memo } from "react";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import UsersTableComp from "..";

const UsersTable = () => {
  const { getUser } = useUser();
  const { data } = getUser();
  const users =
    data?.data?.data?.filter((user: any) => user?.role !== "market") || [];
  return <UsersTableComp data={users} />;
};

export default memo(UsersTable);
