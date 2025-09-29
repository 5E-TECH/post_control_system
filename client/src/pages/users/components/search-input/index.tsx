import { memo, useCallback, useState, type FC } from "react";
import { useDispatch } from "react-redux";
import { setUserFilter } from "../../../../shared/lib/features/user-filters";
import { debounce } from "../../../../shared/helpers/DebounceFunc";

interface Props {
  placeholder: string;
  className?: string;
}

const SearchInput: FC<Props> = ({ placeholder, className }) => {
  const [search, setSearch] = useState<string>("");
  const dispatch = useDispatch();
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      dispatch(setUserFilter({ name: "search", value }));
    }, 800),
    [dispatch]
  );

  return (
    <div className="">
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          debouncedSearch(e.target.value);
        }}
        placeholder={placeholder}
        className={`border border-[#2E263D66] placeholder:text-[#2E263D66] py-[8px] px-[16px] rounded-md outline-none cursor-pointer dark:border-[#E7E3FC38] dark:placeholder:text-[#E7E3FC38] ${className}`}
      />
    </div>
  );
};

export default memo(SearchInput);
