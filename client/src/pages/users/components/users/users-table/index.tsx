import { memo } from "react";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import UsersTableComp from "..";

const UsersTable = () => {
  const { getUser } = useUser();
  const { data } = getUser();
  return <UsersTableComp data={data} />;
};

export default memo(UsersTable);
