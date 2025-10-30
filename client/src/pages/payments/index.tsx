import { Eraser, Search } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import Select from '../users/components/select';
import Popup from '../../shared/ui/Popup';
import { X } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMarket } from '../../shared/api/hooks/useMarket/useMarket';
import { useCourier } from '../../shared/api/hooks/useCourier';
import { useCashBox } from '../../shared/api/hooks/useCashbox';
import CountUp from 'react-countup';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../app/store';
import { Button, Pagination, type PaginationProps } from 'antd';
import { useParamsHook } from '../../shared/hooks/useParams';
import HistoryPopup from './components/historyPopup';
import { debounce } from '../../shared/helpers/DebounceFunc';
import { useTranslation } from 'react-i18next';

export interface IPaymentFilter {
  operationType?: string | null;
  sourceType?: string | null;
  createdBy?: string | null;
  cashboxType?: string | null;
}

const initialState: IPaymentFilter = {
  operationType: null,
  sourceType: null,
  createdBy: null,
  cashboxType: null,
};

const Payments = () => {
  const { t } = useTranslation('payment');
  const user = useSelector((state: RootState) => state.roleSlice);
  const role = user.role;
  const id = user.id;
  const { pathname } = useLocation();
  useEffect(() => {
    if (role === 'courier' || role === 'market') {
      navigate(`cash-detail/${id}`);
    }
  }, [user, role, pathname]);

  const [showMarket, setShowMarket] = useState(false);
  const [showCurier, setShowCurier] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [select, setSelect] = useState<null | string>(null);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] =
    useState<IPaymentFilter>(initialState);

  const navigate = useNavigate();

  const { getMarkets } = useMarket();
  const { getCourier } = useCourier();
  const { getCashBoxInfo } = useCashBox();
  const searchParam = search
    ? { search: search } // ✅ faqat search bo‘lsa qo‘shiladi
    : {};

  // Pagination start
  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam('page') || 1);
  const limit = Number(getParam('limit') || 10);
  const { data: cashBoxData, refetch } = getCashBoxInfo(
    role === 'superadmin' || role === 'admin',
    {
      operationType: paymentFilter.operationType,
      sourceType: paymentFilter.sourceType,
      createdBy: paymentFilter.createdBy,
      cashboxType: paymentFilter.cashboxType,
      page,
      limit,
    },
  );
  const { data } = getMarkets(showMarket, { ...searchParam, limit: 0 });
  const { data: courierData } = getCourier(showCurier, { ...searchParam });
  const total = cashBoxData?.data?.pagination?.total || 0;
  const onChange: PaginationProps['onChange'] = (newPage, limit) => {
    if (newPage === 1) {
      removeParam('page');
    } else {
      setParam('page', newPage);
    }

    if (limit === 10) {
      removeParam('limit');
    } else {
      setParam('limit', limit);
    }
  };
  // Pagination end

  const handleNavigate = () => {
    navigate(`cash-detail/${select}`);
    setSelect(null);
    setShowMarket(false);
    setShowCurier(false);
  };

  const hendlerClose = () => {
    setShowCurier(false);
    setShowMarket(false);
    setSelect(null);
    setSearch('')
  };

  const debouncedSearch = useCallback(
    debounce((value: string) => {
      setSearch(value);
    }, 500),
    [],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  const operationType = ['income', 'expense'];
  const operationOptions = operationType.map((role: string) => ({
    value: role,
    label: t(`${role}`),
  }));

  const sourceType = [
    'courier_payment',
    'market_payment',
    'manual_expense',
    'manual_income',
    'correction',
    'salary',
    'sell',
    'cancel',
    'extra_cost',
    'bills',
  ];
  const sourceOptions = sourceType.map((status: string) => ({
    value: status,
    label: t(`sourceTypes.${status}`),
  }));

  const createdByOptions = cashBoxData?.data?.allCashboxHistories
    ?.map((item: any) => ({
      value: item?.createdByUser?.id,
      label: item?.createdByUser?.role,
    }))
    .filter(
      (option: any, index: any, self: any) =>
        index === self.findIndex((o: any) => o.value === option.value),
    );

  const cashboxType = ['market', 'courier', 'main'];
  const cashboxOptions = cashboxType.map((status: string) => ({
    value: status,
    label: t(`${status}`),
  }));

  useEffect(() => {
    if (role === 'admin' || role === 'superadmin') {
      refetch();
    }
  }, [pathname, paymentFilter]);

  if (pathname.startsWith('/payments/')) {
    return <Outlet />;
  }

  const handleHistoryPopup = (id: string) => {
    setSelect(id);
    setShowHistory(true);
  };

  const handleChange = (name: keyof IPaymentFilter, value: string) => {
    setPaymentFilter((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className=" dark:bg-[#312d48]">
      <div className="grid grid-cols-3 gap-14 max-[1050px]:grid-cols-2 max-[800px]:grid-cols-1 text-center text-2xl items-end mx-5 ">
        <div
          onClick={() => setShowMarket(true)}
          className="py-15 cursor-pointer rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white"
        >
          <h3>{t('berilishiKerak')}</h3>
          <strong className="block pt-3 text-4xl">
            <CountUp
              end={cashBoxData?.data?.marketCashboxTotal || 0}
              duration={1.5} // qancha sekundda sanashini belgilaydi
              separator=" " // mingliklarni bo‘lib beradi
              suffix=" UZS" // oxiriga UZS qo‘sha  const { t } = useTranslation("product");
            />
          </strong>
        </div>
        {/* berilishi kerak */}
        <Popup isShow={showMarket} onClose={hendlerClose}>
          <div className="bg-white dark:bg-[#28243d] rounded-xl shadow-lg w-[700px] h-[680px] px-5 py-5 relative flex flex-col max-md:w-[400px] max-md:h-[600px] transition-all duration-300">
            {/* Close button */}
            <button
              onClick={hendlerClose}
              className="absolute top-3 right-3 text-gray-500 hover:text-red-500 transition-colors"
            >
              <X size={22} />
            </button>

            {/* Title */}
            <h1 className="font-semibold text-lg text-[#2E263D] dark:text-white mt-2">
              {t('berilishiKerak')}
            </h1>

            {/* Search box */}
            <div className="flex items-center gap-2 border border-[#d4d4d8] dark:border-[#524B6C] rounded-md px-3 py-1.5 mt-4 bg-white dark:bg-[#312D4B] focus-within:ring-2 focus-within:ring-blue-500">
              <Search className="w-4 h-4 text-[#2E263D66] dark:text-[#E7E3FC66]" />
              <input
                defaultValue={search}
                onChange={handleSearchChange}
                type="text"
                placeholder={`${t('search')}...`}
                className="w-full bg-transparent text-sm outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
              />
            </div>

            {/* Table */}
            <div className="mt-4 rounded-md border border-[#e4e4e7] dark:border-[#2E263DB2] overflow-hidden flex-1 flex flex-col">
              <table className="w-full border-collapse">
                <thead className="bg-[#9d70ff] dark:bg-[#3d3759] text-white text-sm">
                  <tr>
                    <th className="h-[40px] text-left px-3 font-medium">#</th>
                    <th className="h-[40px] text-left px-3 font-medium">
                      {t('marketName')}
                    </th>
                    <th className="h-[40px] text-left px-3 font-medium">
                      {t('berilishiKerakSumma')}
                    </th>
                  </tr>
                </thead>
              </table>

              {/* scroll tbody */}
              <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-[#555]">
                <table className="w-full border-collapse text-[18px]">
                  <tbody className="divide-y divide-[#3010d11f] dark:divide-[#524B6C]">
                    {data?.data?.data?.map((item: any, inx: number) => (
                      <tr
                        key={item?.id}
                        onClick={() => setSelect(item?.id)}
                        className={`transition-all duration-170 hover:bg-[#f4f4f5] dark:hover:bg-[#3c3754] ${
                          item.id === select
                            ? 'bg-[#e2e8ff] dark:bg-[#504a7b]'
                            : 'bg-transparent'
                        } cursor-pointer`}
                      >
                        <td className="px-3 py-2 text-[#8C57FF] font-medium">
                          {inx + 1}
                        </td>
                        <td className="px-3 py-2 text-[#2E263DB2] dark:text-white">
                          {item?.name}
                        </td>
                        <td className="px-3 py-2 text-[#2E263DB2] dark:text-[#E7E3FCB2]">
                          {item?.cashbox?.balance?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Select button */}
            <div className="flex justify-end mt-4">
              <button
                disabled={!select}
                onClick={handleNavigate}
                className={`px-5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  select
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                    : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                }`}
              >
                {t('tanlash')}
              </button>
            </div>
          </div>
        </Popup>

        <div
          onClick={() =>
            navigate('main-cashbox', {
              state: {
                role: 'pochta',
              },
            })
          }
          className="h-[250px] mt-4 flex cursor-pointer flex-col justify-center rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white"
        >
          <h3>{t('kassadagiMiqdor')}</h3>
          <strong className="block pt-3 text-4xl">
            <CountUp
              end={cashBoxData?.data?.mainCashboxTotal || 0}
              duration={1.5} // qancha sekundda sanashini belgilaydi
              separator=" " // mingliklarni bo‘lib beradi
              suffix=" UZS" // oxiriga UZS qo‘shadi
            />
          </strong>
        </div>

        <div
          onClick={() => setShowCurier(true)}
          className="py-15 cursor-pointer rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white"
        >
          <h3>{t('olinishiKerak')}</h3>
          <strong className="block pt-3 text-4xl">
            <CountUp
              end={cashBoxData?.data?.courierCashboxTotal || 0}
              duration={1.5} // qancha sekundda sanashini belgilaydi
              separator=" " // mingliklarni bo‘lib beradi
              suffix=" UZS" // oxiriga UZS qo‘shadi
            />
          </strong>
        </div>
        {/* olinishiKerak */}
<Popup isShow={showCurier} onClose={hendlerClose}>
  <div className="bg-white dark:bg-[#28243d] rounded-xl shadow-xl w-[900px] h-[680px] px-6 py-6 relative flex flex-col max-md:w-[420px] max-md:h-[600px] transition-all duration-300">
    
    {/* Close button */}
    <button
      onClick={() => hendlerClose()}
      className="absolute top-3 right-3 text-gray-500 hover:text-red-500 transition-colors"
    >
      <X size={24} />
    </button>

    {/* Title */}
    <h1 className="font-semibold text-lg text-[#2E263D] dark:text-white mt-2">
      {t('olinishiKerak')}
    </h1>

    {/* Search box */}
    <div className="flex items-center gap-2 border border-[#d4d4d8] dark:border-[#524B6C] rounded-md px-3 py-1.5 mt-4 bg-white dark:bg-[#312D4B] focus-within:ring-2 focus-within:ring-blue-500 transition-all">
      <Search className="w-4 h-4 text-[#2E263D66] dark:text-[#E7E3FC66]" />
      <input
        defaultValue={search}
        onChange={handleSearchChange}
        type="text"
        placeholder={`${t('search')}...`}
        className="w-full bg-transparent text-sm outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
      />
    </div>

    {/* Table container */}
    <div className="mt-5 rounded-md border border-[#e4e4e7] dark:border-[#2E263DB2] overflow-hidden flex-1 flex flex-col">
      <table className="w-full border-collapse">
        <thead className="bg-gradient-to-r from-[#9d70ff] to-[#7b4dff] dark:from-[#3d3759] dark:to-[#4a4370] text-white text-sm">
          <tr>
            <th className="h-[44px] text-left px-3 font-medium">#</th>
            <th className="h-[44px] text-left px-3 font-medium">{t('courierName')}</th>
            <th className="h-[44px] text-left px-3 font-medium">{t('region')}</th>
            <th className="h-[44px] text-left px-3 font-medium">{t('olinishiKerakSumma')}</th>
          </tr>
        </thead>
      </table>

      {/* Scroll tbody */}
      <div className="max-h-[440px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-[#555]">
        <table className="w-full border-collapse text-[18px]">
          <tbody className="divide-y divide-[#2908751f] dark:divide-[#524B6C]">
            {courierData?.data?.map((item: any, inx: number) => (
              <tr
                key={item?.id}
                onClick={() => setSelect(item?.id)}
                className={`transition-all duration-150 hover:bg-[#f4f4f5] dark:hover:bg-[#3c3754] ${
                  item.id === select
                    ? 'bg-[#e2e8ff] dark:bg-[#504a7b]'
                    : 'bg-transparent'
                } cursor-pointer`}
              >
                <td className="px-3 py-2 text-[#8C57FF] font-medium">{inx + 1}</td>
                <td className="px-3 py-2 text-[#2E263DB2] dark:text-white">{item?.name}</td>
                <td className="px-3 py-2 text-[#2E263DB2] dark:text-[#E7E3FCB2]">{item?.region?.name}</td>
                <td className="px-3 py-2 text-[#2E263DB2] dark:text-[#E7E3FCB2] flex items-center gap-1">
                  {item?.cashbox?.balance?.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Select button */}
    <div className="flex justify-end mt-4">
      <button
        disabled={!select}
        onClick={handleNavigate}
        className={`px-5 py-1.5 text-sm font-medium rounded-md transition-all duration-200 ${
          select
            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
            : 'bg-gray-300 text-gray-600 cursor-not-allowed'
        }`}
      >
        {t('tanlash')}
      </button>
    </div>
  </div>
</Popup>

      </div>

      <div className="mt-12 mx-5">
        <h1 className="text-xl font-semibold mb-3">{t('filter')}</h1>
        <div className="grid grid-cols-5 gap-6 pt-[16px] max-[1000px]:grid-cols-3 max-[750px]:grid-cols-2 max-[450px]:grid-cols-1 capitalize">
          <Select
            value={paymentFilter.operationType}
            onChange={handleChange}
            options={operationOptions}
            text={t('operationType')}
            name="operationType"
          />
          <Select
            value={paymentFilter.sourceType}
            onChange={handleChange}
            options={sourceOptions}
            text={t('sourceType')}
            name="sourceType"
          />
          <Select
            value={paymentFilter.createdBy}
            onChange={handleChange}
            options={createdByOptions}
            text={t('createdBy')}
            name="createdBy"
          />
          <Select
            value={paymentFilter.cashboxType}
            onChange={handleChange}
            options={cashboxOptions}
            text={t('cashboxtype')}
            name="cashboxType"
          />
          <div className="flex min-[900px]:justify-end">
            <Button
              className="w-[150px]! max-[651px]:w-full! h-[45px]!"
              onClick={() => setPaymentFilter(initialState)}
            >
              <Eraser className="w-4 h-4 mr-2" />
              {t('tozalash')}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-12 mx-5">
        <div className="shadow-lg bg-[#fff] dark:bg-[#312D4B] rounded-md">
          <div>
            <div>
              <table className="w-full border-collapse">
                <thead className="dark:bg-[#3D3759] text-[13px] bg-[#F6F7FB] border-4 border-white dark:border-[#3D3759] uppercase">
                  <tr>
                    <th className="h-[56px] font-medium  text-left pl-4">
                      <div className="flex items-center justify-between">
                        #
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-left">
                      <div className="flex items-center justify-between pr-[21px]">
                        {t('createdBy')}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        {t('cashboxtype')}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-left px-4">
                      <div className="flex items-center justify-between pr-[21px]">
                        {t('operationType')}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px] pl-9">
                        {t('amount')}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                    <th className="h-[56px] font-medium text-[13px] text-left px-4">
                      <div className="flex items-center justify-between pr-[21px] pl-9">
                        {t('paymentDate')}
                        <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                      </div>
                    </th>
                  </tr>
                </thead>

                <tbody className="text-[14px] font-normal cursor-pointer  text-[#2E263DB2] dark:text-[#E7E3FCB2] capitalize">
                  {cashBoxData?.data?.allCashboxHistories?.map(
                    (item: any, inx: number) => (
                      <tr
                        onClick={() => handleHistoryPopup(item.id)}
                        key={item.id}
                        className="border-t hover:bg-[#e3ddf7] dark:hover:bg-[#42425c] border-[#E7E3FC1F] text-[15px] font-normal"
                      >
                        <td
                          className="data-cell pl-4 py-3 text-[#8C57FF]"
                          data-cell="#"
                        >
                          {inx + 1}
                        </td>
                        <td
                          className="data-cell py-3 flex flex-col"
                          data-cell="CREATED BY"
                        >
                          {item?.createdByUser?.name}
                          <span
                            className={`text-[13px] ${
                              item?.createdByUser?.role == 'superadmin'
                                ? 'text-green-500'
                                : 'text-blue-500'
                            }`}
                          >
                            {item?.createdByUser?.role}
                          </span>
                        </td>
                        <td
                          className="data-cell px-4 py-3"
                          data-cell="CASHBOX_TYPE"
                        >
                          <span
                            className={`
      px-[12px] py-[2px] rounded-full text-[13px]
      ${
        item?.payment_method === 'click_to_market'
          ? 'text-[#16B1FF] bg-[#16B1FF29]' // ko'k
          : item?.payment_method === 'cash'
          ? 'text-[#16C75F] bg-[#16C75F29]' // yashil
          : item?.payment_method === 'click'
          ? 'text-[#FFC107] bg-[#FFC10729]' // sariq
          : 'text-gray-500 bg-gray-200' // default rang
      }
    `}
                          >
                            {item?.payment_method === 'click_to_market' ||
                            item?.payment_method === 'cash' ||
                            item?.payment_method === 'click'
                              ? t(item?.payment_method)
                              : 'sotuv'}
                          </span>
                        </td>

                        <td
                          className="data-cell px-4 py-3"
                          data-cell="OPERATION_TYPE"
                        >
                          <span
                            className={`
                                  px-[12px] py-[2px] rounded-full text-[13px]
                                  ${
                                    item?.operation_type === 'income'
                                      ? 'text-[#16C75F] bg-[#16C75F29]' // yashil
                                      : item?.operation_type === 'expense'
                                      ? 'text-[#FF4D4F] bg-[#FF4D4F29]' // qizil
                                      : 'text-gray-500 bg-gray-200' // default rang
                                  }
                                `}
                          >
                            {t(item?.operation_type)}
                          </span>
                        </td>
                        <td
                          className={`data-cell px-13 py-3 text-[16px] ${
                            item?.operation_type === 'income'
                              ? 'text-[#16C75F]' // yashil
                              : item?.operation_type === 'expense'
                              ? 'text-[#FF4D4F]' // qizil
                              : 'text-gray-500' // default rang
                          }`}
                          data-cell="AMOUNT"
                        >
                          {item?.operation_type === 'income'
                            ? '+'
                            : item?.operation_type === 'expense'
                            ? '-'
                            : ''}
                          {Number(item?.amount || 0).toLocaleString('uz-UZ')}{' '}
                          UZS
                        </td>
                        <td
                          className="data-cell px-13 py-3"
                          data-cell="PAYMENT DATE"
                        >
                          {new Date(Number(item?.created_at)).toLocaleString(
                            'uz-UZ',
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <div className="flex justify-center py-2">
                <Pagination
                  showSizeChanger
                  current={page}
                  total={total}
                  pageSize={limit}
                  onChange={onChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {showHistory && (
        <HistoryPopup id={select} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
};

export default React.memo(Payments);
