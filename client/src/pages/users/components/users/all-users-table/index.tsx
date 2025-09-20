import { memo } from "react";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import UsersTableComp from "..";

const AllUsersTable = () => {
  const { getUser } = useUser();
  const { data } = getUser();
  const allUsers = Array.isArray(data?.data?.data) ? data?.data?.data : [];
  
  return <UsersTableComp data={allUsers} />;
};

export default memo(AllUsersTable);
