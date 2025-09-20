import { Spin } from "antd";
import { Edit, Trash } from "lucide-react";
import {
  createContext,
  memo,
  useEffect,
  useMemo,
  useState,
  type FC,
} from "react";
import { useProduct } from "../../api/hooks/useProduct";
import useNotification from "antd/es/notification/useNotification";
import ConfirmPopup from "../confirmPopup";

interface IProps {
  data: any;
}

const Context = createContext({ name: "Default" });

const ProductView: FC<IProps> = ({ data }) => {
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { deleteProduct } = useProduct();
  const [api, contextHolder] = useNotification();

  const handleDelete = () => {
    deleteProduct.mutate(deleteItem?.id, {
      onSuccess: () => {
        api.success({
          message: "Muvaffaqiyatli!",
          description: "Mahsulot muvaffaqiyatli o'chirib tashlandi.",
          placement: "topRight",
        });
      },
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

  const contextValue = useMemo(() => ({ name: "Ant Design" }), []);

  return (
    <Context.Provider value={contextValue}>
      {contextHolder}
      <div className="mt-4 px-4 overflow-x-auto">
        <Spin spinning={loading} tip="Loading Products...">
          <table className="w-full min-w-[600px] cursor-pointer">
            <thead className="h-[54px] bg-[#F6F7FB] dark:bg-[#3D3759] text-left">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">Products</th>
                <th className="p-3">Market</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {data?.data?.items?.map((item: any, inx: number) => (
                <tr
                  key={item?.id}
                  className="border-b border-gray-300 dark:border-gray-600"
                >
                  <td className="p-3">{inx + 1}</td>
                  <td className="p-3">
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

                  <td className="p-3">{item?.user?.name}</td>

                  <td className="p-3 flex items-center gap-3">
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
    </Context.Provider>
  );
};

export default memo(ProductView);
