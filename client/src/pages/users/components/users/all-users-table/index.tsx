import { memo } from "react";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import UsersTableComp from "..";

const AllUsersTable = () => {
  const { getUser } = useUser();
  const { data: users } = getUser();

  return <UsersTableComp data={users} />;
};

export default memo(AllUsersTable);
