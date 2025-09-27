import { memo } from "react";
import UserTableComp from "..";
import { useUser } from "../../../../../shared/api/hooks/useRegister";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../../app/store";

const MarketsTable = () => {
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
  const markets =
    data?.data?.data?.filter((market: any) => market?.role === "market") || [];
  const total = markets?.length;
  return <UserTableComp data={markets} isLoading={isLoading} total={total} />;
};

export default memo(MarketsTable);
