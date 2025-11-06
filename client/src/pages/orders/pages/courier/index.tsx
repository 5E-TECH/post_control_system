import { memo } from 'react';
import Select from '../../components/select/select';
import SearchInput from '../../../users/components/search-input';
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Clock, XCircle } from 'lucide-react';

const CourierOrders = () => {
  const { t } = useTranslation('orderList');

  return (
    <div className="w-full bg-white py-5 dark:bg-[#312d4b]">
      <h1 className="font-medium text-[20px] text-[#2E263DE5] dark:text-[#D4D0E9] px-5">
        {t('title')}
      </h1>

      <div className="flex justify-between px-5 pt-5 pb-7 max-[650px]:pb-0  items-center max-[650px]:flex-col">
        <div className="min-[650px]:hidden transition-all mb-5 w-full">
          <SearchInput
            className="w-full"
            placeholder={t('placeholder.searchOrder')}
          />
        </div>
        <div className="flex gap-5 max-[650px]:w-[100%] max-[650px]:mb-5">
          <Select
            name="from"
            placeholder={t('placeholder.startDate')}
            className="w-[180px]"
          ></Select>

          <Select
            name="to"
            placeholder={t('placeholder.endDate')}
            className="w-[180px]"
          ></Select>
        </div>

<div
  className="
    flex gap-6 max-md:mb-5
    max-[440px]:flex-col
    max-[440px]:gap-3
    max-[440px]:w-full
  "
>
  {/* 1️⃣ KUTILAYOTGAN BUYURTMALAR */}
  <NavLink
    end
    to="/courier-orders/orders"
    className={({ isActive }) =>
      `
      text-md font-medium transition duration-200 pb-1
      ${
        isActive
          ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
          : "text-[#2E263DB2] hover:text-[#5A48FA] dark:text-[#CAD0E9]"
      }

      /* telefon uchun */
      max-[440px]:flex
      max-[440px]:items-center
      max-[440px]:justify-center
      max-[440px]:gap-2
      max-[440px]:rounded-lg
      max-[440px]:py-2
      max-[440px]:px-3
      max-[440px]:w-full
      ${
        isActive
          ? "max-[440px]:bg-yellow-500  max-[440px]:border-b-5 max-[440px]:border-b-yellow-700"
          : "max-[440px]:bg-yellow-400"
      }
      max-[440px]:text-white
      max-[440px]:shadow-sm
      `
    }
  >
    <Clock className="max-[440px]:w-5 max-[440px]:h-5 hidden max-[440px]:inline" />
    {t("kutilayotganBuyurtmalar")}
  </NavLink>

  {/* 2️⃣ HAMMA BUYURTMALAR */}
  <NavLink
    to="/courier-orders/orders/all"
    className={({ isActive }) =>
      `
      text-md font-medium transition duration-200 pb-1
      ${
        isActive
          ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
          : "text-[#2E263DB2] hover:text-[#5A48FA] dark:text-[#CAD0E9]"
      }

      /* telefon uchun */
      max-[440px]:flex
      max-[440px]:items-center
      max-[440px]:justify-center
      max-[440px]:gap-2
      max-[440px]:rounded-lg
      max-[440px]:py-2
      max-[440px]:px-3
      max-[440px]:w-full
      ${
        isActive
          ? "max-[440px]:bg-[#4a3adf]  max-[440px]:border-b-5 max-[440px]:border-b-[#170c72]"
          : "max-[440px]:bg-[#5A48FA]"
      }
      max-[440px]:text-white
      max-[440px]:shadow-sm
      `
    }
  >
    <ClipboardList className="max-[440px]:w-5 max-[440px]:h-5 hidden max-[440px]:inline" />
    {t("hammaBuyurtmalar")}
  </NavLink>

  {/* 3️⃣ BEKOR QILINGAN BUYURTMALAR */}
  <NavLink
    to="/courier-orders/orders/cancelled"
    className={({ isActive }) =>
      `
      text-md font-medium transition duration-200 pb-1
      ${
        isActive
          ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
          : "text-[#2E263DB2] hover:text-[#5A48FA] dark:text-[#CAD0E9]"
      }

      /* telefon uchun */
      max-[440px]:flex
      max-[440px]:items-center
      max-[440px]:justify-center
      max-[440px]:gap-2
      max-[440px]:rounded-lg
      max-[440px]:py-2
      max-[440px]:px-3
      max-[440px]:w-full
      ${
        isActive
          ? "max-[440px]:bg-red-600  max-[440px]:border-b-5 max-[440px]:border-b-red-800"
          : "max-[440px]:bg-red-600"
      }
      max-[440px]:text-white
      max-[440px]:shadow-sm
      `
    }
  >
    <XCircle className="max-[440px]:w-5 max-[440px]:h-5 hidden max-[440px]:inline" />
    {t("bekorBuyurtmalar")}
  </NavLink>
</div>



        <div className="max-[650px]:hidden transition-all">
          <SearchInput placeholder={t('placeholder.searchOrder')} />
        </div>
      </div>

      <Outlet />
    </div>
  );
};

export default memo(CourierOrders);
