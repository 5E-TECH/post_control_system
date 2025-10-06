import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const Search = () => {
  const { t } = useTranslation("todayOrderList");
  
  return (
    <div className="flex justify-between w-full items-center p-10">
        <h2 className='text-[20px] font-medium text-[#2E263DE5] dark:text-[#E7E3FCE5]'>{t("title")}</h2>
      <form action="">
        <div className='border border-[#d1cfd4] rounded-md'>
            <input className='outline-none px-4 py-3' type="text" placeholder={t("placeholder.search")}/>
        </div>
      </form>
    </div>
  );
};

export default memo(Search);