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
    role: "market",
    status: userFilter.status as string,
    page: userFilter.page as number,
    limit: userFilter.limit as number,
  });

  const markets = Array.isArray(data?.data?.data) ? data.data.data : [];
  const total = data?.data?.total || 0;

  return <UserTableComp data={markets} isLoading={isLoading} total={total} />;
};

export default memo(MarketsTable);
