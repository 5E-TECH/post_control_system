import { FilePlus, Search, X } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Popup from '../../shared/ui/Popup';
import { useMarket } from '../../shared/api/hooks/useMarket/useMarket';
import ProductView from '../../shared/components/product-view';
import { useProduct } from '../../shared/api/hooks/useProduct';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../app/store';
import { debounce } from '../../shared/helpers/DebounceFunc';
import Select from '../orders/components/select/select';
import { useProfile } from '../../shared/api/hooks/useProfile';
import { togglePermission } from '../../shared/lib/features/add-order-permission';
import { useTranslation } from 'react-i18next';

const Products = () => {
  const { t } = useTranslation('product');
  const [showMarket, setShowMarket] = useState(false);
  const [select, setSelect] = useState<string | null>('');
  const [searchProduct, setSearchProduct] = useState<any>(null);
  const [searchPopup, setSearchPopup] = useState<any>(null);
  const [searchByMarket, setSearchByMarket] = useState<any>(undefined);
  const dispatch = useDispatch();

  const { id, role } = useSelector((state: RootState) => state.roleSlice);
  const { page, limit } = useSelector(
    (state: RootState) => state.paginationSlice,
  );
  const permission = useSelector(
    (state: RootState) => state.togglePermission.value,
  );
  const { refetch } = useProfile().getUser(role === 'market');

  const handleCheck = async () => {
    const res = await refetch();
    const addOrder = res.data.data.add_order;
    if (!addOrder && res.data.data.role === 'market') {
      dispatch(togglePermission(true));
      return;
    }
    navigate(`create/${select}`);
  };

  useEffect(() => {
    if (role === 'market') {
      setSelect(id);
    }
  }, [role, id]);

  const navigate = useNavigate();

  const debouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchProduct(value);
      }, 800),
    [],
  );

  const popupDebouncedSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearchPopup(value);
      }, 800),
    [],
  );

  const handleNavigate = () => {
    navigate(`create/${select}`);
    setSelect('');
    setShowMarket(false);
  };

  const { getProducts, getMyProducts } = useProduct();
  const { data: productData } =
    role === 'market'
      ? getMyProducts({ search: searchProduct, page, limit })
      : getProducts({
          search: searchProduct,
          marketId: searchByMarket,
          page,
          limit,
        });

  const { getMarkets } = useMarket();

  const { data } = getMarkets(role !== 'market', {
    search: searchPopup,
    limit: 0,
  });

  const { pathname } = useLocation();

  const marketOptions = data?.data?.data?.map((item: any) => (
    <option key={item.id} value={item.id} className='dark:bg-[#312d48]'>
      {item.name}
    </option>
  ));

  if (pathname.startsWith('/products/create')) return <Outlet />;

  return !permission ? (
    <div className="mt-6 w-full dark:bg-[#312d48]">
      <h2 className="text-2xl font-medium ml-4 mb-5">{t('title')}</h2>

      {/* Filter va Add product qismi */}

      <div className="flex flex-col px-4">
        <div className="flex justify-between max-[1100px]:flex-col max-[1100px]:gap-4">
          <div className="">
            <Select
              name="market"
              value={searchByMarket}
              onChange={(e) => {
                setSearchByMarket(e.target.value);
              }}
              placeholder={t('placeholder.selectMarket')}
              className="min-[1100px]:w-[250px] max-[1100px]:w-[250px] max-[800px]:w-full"
            >
              {marketOptions}
            </Select>
          </div>
          <div className="flex gap-5 min-[800px]:items-center max-[800px]:flex-col">
            <div className="relative w-full min-[1100px]:w-[280px] max-[1100px]:w-[280px] max-[800px]:w-full">
              <input
                onChange={(e) => debouncedSearch(e.target.value)}
                className="dark:border dark:border-[#eeeeee38] rounded-[7px] w-full h-[40px] border border-[#2E263D38] px-3 pr-10"
                placeholder={`${t('placeholder.search')}...`}
                type="text"
              />
              <Search className="absolute right-3 top-2.5 w-5 h-5 text-gray-400" />
            </div>
            <button
              onClick={() => {
                if (role === 'market') {
                  handleCheck();
                  // handleNavigate()
                } else {
                  setShowMarket(true);
                }
              }}
              className="px-4 py-2 cursor-pointer bg-[#8C57FF] text-white rounded flex items-center justify-center gap-2"
            >
              <FilePlus size={18} />
              {t('addProduct')}
            </button>
          </div>
        </div>

        {/* Popup */}
        <Popup isShow={showMarket} onClose={() => setShowMarket(false)}>
          <div className="bg-white rounded-md w-[500px] h-[700px] px-6 dark:bg-[#28243d] relative">
            {/* Close button */}
            <button
              onClick={() => setShowMarket(false)}
              className="cursor-pointer text-red-500 p-2 absolute right-4 top-2 flex items-center justify-center"
            >
              <X size={30} />
            </button>

            {/* Title */}
            <h1 className="font-bold text-left pt-8 text-[#2E263D] dark:text-white">
              {t('placeholder.selectMarket')}
            </h1>

            {/* Search input */}
            <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
              <input
                type="text"
                placeholder={`${t('placeholder.search')}...`}
                onChange={(e) => popupDebouncedSearch(e.target.value)}
                className="w-full bg-transparent font-normal text-[15px] outline-none 
        text-[#2E263D] dark:text-white 
        placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
              />
              <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
            </div>

            {/* Table with scroll */}
            <div className="mt-4 rounded-md  border border-[#f4f5fa] dark:border-[#2E263DB2] overflow-hidden">
              {/* Header (qotib turadigan qism) */}
              <div className="bg-[#F6F7FB] dark:bg-[#3d3759] grid grid-cols-[70px_1fr] text-left">
                <div className="h-[65px] flex items-center px-4 font-semibold text-[16px] text-[#2E263D] dark:text-white">
                  №
                </div>
                <div className="h-[65px] flex items-center px-4 font-semibold text-[16px] text-[#2E263D] dark:text-white">
                  {t('popup.market')}
                </div>
              </div>

              {/* Scroll bo‘ladigan qism */}
              <div className="max-h-[420px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200 dark:scrollbar-thumb-[#555] dark:scrollbar-track-[#2E263D]">
                <table className="w-full border-collapse cursor-pointer">
                  <tbody className="text-[16px] font-medium text-[#2E263D] dark:text-[#E7E3FC] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F]">
                    {data?.data?.data &&
                      Array.isArray(data?.data?.data) &&
                      data?.data?.data.map((item: any, index: number) => {
                        const isSelected = item.id === select;
                        return (
                          <tr
                            key={item?.id}
                            onClick={() =>
                              setSelect(isSelected ? null : item.id)
                            }
                            className={`grid grid-cols-[70px_1fr] border-b-2 border-[#f4f5fa] dark:border-[#E7E3FC1F] 
                  hover:bg-blue-100 dark:hover:bg-[#3d3759] transition-colors
                  ${isSelected ? 'bg-blue-200 dark:bg-[#524B6C]' : ''}`}
                          >
                            <td className="py-3 px-4 flex items-center">
                              {index + 1}
                            </td>
                            <td className="py-3 px-4 font-semibold flex items-center">
                              {item?.name}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer with button */}
            <div className="absolute bottom-4 right-4">
              <button
                onClick={() => handleNavigate()}
                disabled={!select}
                className={`px-3 py-1.5 text-[16px] rounded-md 
          ${
            select
              ? 'bg-blue-500 dark:bg-blue-700 hover:bg-blue-600 cursor-pointer text-white'
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
          }`}
              >
                {t('popup.tanlash')}
              </button>
            </div>
          </div>
        </Popup>
      </div>

      <div>
        <ProductView
          data={productData?.data?.data || productData?.data?.items}
          total={productData?.data?.total}
        />
      </div>
    </div>
  ) : (
    <div className="flex justify-center items-center h-[65vh]">
      <div className="text-red-500 text-lg font-semibold mt-5 text-[25px]">
        {'noPermission'}
      </div>
    </div>
  );
};

export default memo(Products);
