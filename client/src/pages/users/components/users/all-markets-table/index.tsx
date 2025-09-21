import { memo } from "react";
import UserTableComp from "..";
import { useUser } from "../../../../../shared/api/hooks/useRegister";

const MarketsTable = () => {
  const { getUser } = useUser();
  const { data, isLoading } = getUser();
  const markets =
    data?.data?.data?.filter((market: any) => market?.role === "market") || [];
  return <UserTableComp data={markets} isLoading={isLoading} />;
};

export default memo(MarketsTable);
