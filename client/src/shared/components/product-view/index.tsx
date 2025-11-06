import { Pagination, Spin, type PaginationProps } from 'antd';
import { Trash } from 'lucide-react';
import { memo, useEffect, useState, type FC } from 'react';
import { useProduct } from '../../api/hooks/useProduct';
import ConfirmPopup from '../confirmPopup';
import { useApiNotification } from '../../hooks/useApiNotification';
import { useParamsHook } from '../../hooks/useParams';
import { useDispatch, useSelector } from 'react-redux';
import { setLimit, setPage } from '../../lib/features/paginationProductSlice';
import { useTranslation } from 'react-i18next';
import type { RootState } from '../../../app/store';

interface IProps {
  data: any;
  total?: number;
}

const ProductView: FC<IProps> = ({ data, total }) => {
  const { t } = useTranslation('product');
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { getParam, setParam, removeParam } = useParamsHook();
  const page = Number(getParam('page') || 1);
  const limit = Number(getParam('limit') || 10);

  const onChange: PaginationProps['onChange'] = (newPage, limit) => {
    if (newPage === 1) {
      dispatch(setPage(newPage));
      removeParam('page');
    } else {
      dispatch(setPage(newPage));
      setParam('page', newPage);
    }

    if (limit === 10) {
      dispatch(setLimit(limit));
      removeParam('limit');
    } else {
      dispatch(setLimit(limit));
      setParam('limit', limit);
    }
  };
  

  const user = useSelector((state: RootState) => state.roleSlice);

  const { deleteProduct } = useProduct();
  const { handleSuccess, handleApiError } = useApiNotification();
  const handleDelete = () => {
    deleteProduct.mutate(deleteItem?.id, {
      onSuccess: () => {
        handleSuccess("Mahsulot muvaffaqiyatli o'chirib tashlandi");
      },
      onError: (err: any) =>
        handleApiError(err, "mahsulotini o'chirishda xatolik yuz berdi"),
    });
    setPopup(false);
  };

  const handlePoup = (id: any, name: string) => {
    setPopup(true);
    setDeleteItem({ id, name });
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mt-4 px-4 ">
      <Spin spinning={loading} tip="Loading Products...">
        <table className="w-full">
          <thead className="bg-[#9d70ff] min-[900px]:h-[56px] text-[16px] text-white text-center dark:bg-[#3d3759] dark:text-[#E7E3FCE5]">
            <tr>
              <th className="w-[50px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  #
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left whitespace-nowrap">
                <div className="flex items-center justify-between pr-[21px]">
                  {t('productName')}
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              {user.role !== 'market' && (
                <th className="w-[1100px] h-[56px] font-medium text-[13px] pl-[20px] text-left whitespace-nowrap">
                  <div className="flex items-center justify-between pr-[21px]">
                    {t('popup.market')}
                    <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C] "></div>
                  </div>
                </th>
              )}

              <th className={`h-[56px] font-medium text-[13px] text-left whitespace-nowrap ${user.role === "market" ? "pl-270" : "pl-[20px]"} `}>
                <div className="flex items-center justify-between pr-[21px]">
                  {t('action')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.map((item: any, inx: number) => (
              <tr
                key={item?.id}
                className="border-b border-gray-300 dark:border-gray-600"
              >
                <td className="data-cell p-3 pl-5" data-cell="#">
                  {inx + 1}
                </td>
                <td className="data-cell p-3 pl-5" data-cell="PRODUCT NAME">
                  <div className="flex items-center gap-3">
                    <img
                      src={item?.image_url}
                      alt="Product"
                      className="w-10 h-10 object-contain"
                    />
                    <div>
                      <p className="font-medium">{item?.name}</p>
                    </div>
                  </div>
                </td>
                {user.role !== 'market' && (
                  <td className="data-cell p-3 pl-5" data-cell="MARKET">
                    {item?.user?.name}
                  </td>
                )}

                <td
                  className={`data-cell p-3 flex items-center pl-5 ${user.role === "market" ? "pl-270" : "pl-[20px]"} `}
                  data-cell="ACTION"
                >
                  <button
                    onClick={() => handlePoup(item.id, item.name)}
                    className="hover:text-red-500 cursor-pointer"
                  >
                    <Trash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ConfirmPopup
          isShow={popup}
          title={`“${deleteItem?.name}” mahsulotini o‘chirishni tasdiqlaysizmi?`}
          description="Bu amalni ortga qaytarib bo‘lmaydi."
          confirmText="Ha, o‘chir"
          cancelText="Bekor qilish"
          onConfirm={handleDelete}
          onCancel={() => setPopup(false)}
        />
        <div className="flex justify-center mt-3">
          <Pagination
            showSizeChanger
            current={page}
            total={total}
            pageSize={limit}
            onChange={onChange}
          />
        </div>
      </Spin>
    </div>
  );
};

export default memo(ProductView);
