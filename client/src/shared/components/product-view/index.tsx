import { Spin } from "antd";
import { Edit, Trash } from "lucide-react";
import { memo, useEffect, useState, type FC } from "react";
import { useProduct } from "../../api/hooks/useProduct";
import ConfirmPopup from "../confirmPopup";
import { useApiNotification } from "../../hooks/useApiNotification";

interface IProps {
  data: any;
}

const ProductView: FC<IProps> = ({ data }) => {
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { deleteProduct } = useProduct();
  const { handleSuccess, handleApiError } = useApiNotification();
  const handleDelete = () => {
    deleteProduct.mutate(deleteItem?.id, {
      onSuccess: () => {
        handleSuccess("Mahsulot muvaffaqiyatli o'chirib tashlandi");
      },
      onError: (err: any) =>
        handleApiError(
          err,
          "mahsulotini o'chirishda xatolik yuz berdi,keyinroq urinib ko'ring"
        ),
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
    <div className="mt-4 px-4 overflow-x-auto">
      <Spin spinning={loading} tip="Loading Products...">
        <table className="w-full cursor-pointer">
          <thead className="h-[54px] bg-[#F6F7FB] dark:bg-[#3D3759] text-left">
            <tr>
              <th className="w-[50px] h-[56px] font-medium text-[13px] pl-[20px] text-left">
                <div className="flex items-center justify-between pr-[21px]">
                  #
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[308px] h-[56px] font-medium text-[13px] pl-[20px] text-left whitespace-nowrap">
                <div className="flex items-center justify-between pr-[21px]">
                  PRODUCT NAME
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
              <th className="w-[1100px] h-[56px] font-medium text-[13px] pl-[20px] text-left whitespace-nowrap">
                <div className="flex items-center justify-between pr-[21px]">
                  MARKET
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C] "></div>
                </div>
              </th>
              <th className="h-[56px] font-medium text-[13px] pl-[20px] text-left whitespace-nowrap">
                <div className="flex items-center justify-between pr-[21px]">
                  ACTION
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
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
                <td className="data-cell p-3" data-cell="#">
                  {inx + 1}
                </td>
                <td className="data-cell p-3" data-cell="PRODUCT NAME">
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

                <td className="data-cell p-3" data-cell="MARKET">
                  {item?.user?.name}
                </td>

                <td
                  className="data-cell p-3 flex items-center gap-3"
                  data-cell="ACTION"
                >
                  <button className="hover:text-[#8C57FF]">
                    <Edit />
                  </button>
                  <button
                    onClick={() => handlePoup(item.id, item.name)}
                    className="hover:text-red-500"
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
      </Spin>
    </div>
  );
};

export default memo(ProductView);
