import { memo, useCallback, useEffect, useState, type FC } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setUserFilter } from "../../../../shared/lib/features/user-filters";
import { debounce } from "../../../../shared/helpers/DebounceFunc";
import type { RootState } from "../../../../app/store";

interface Props {
  placeholder: string;
  className?: string;
}

const SearchInput: FC<Props> = ({ placeholder, className }) => {
  const dispatch = useDispatch();
  const reduxSearch = useSelector(
    (state: RootState) => state.setFilter.search || ""
  );
  const [localSearch, setLocalSearch] = useState(reduxSearch);

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      dispatch(setUserFilter({ name: "search", value }));
      sessionStorage.setItem("courier_search", value); // 🔹 saqlab qo‘yish
    }, 400),
    [dispatch]
  );

  useEffect(() => {
    const saved = sessionStorage.getItem("courier_search");
    if (saved) {
      setLocalSearch(saved);
      dispatch(setUserFilter({ name: "search", value: saved }));
    }
  }, [dispatch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    debouncedSearch(value);
  };

  return (
    <div>
      <input
        type="text"
        value={localSearch}
        onChange={handleSearchChange}
        placeholder={placeholder}
        className={`border border-[#2E263D66] placeholder:text-[#2E263D66] py-[8px] px-[16px] rounded-md outline-none cursor-pointer dark:border-[#E7E3FC38] dark:placeholder:text-[#E7E3FC38] ${className}`}
      />
    </div>
  );
};

export default memo(SearchInput);
