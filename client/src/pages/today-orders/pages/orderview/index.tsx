import { EllipsisVertical } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Search from '../../components/search';
import phone from '../../../../shared/assets/order/detail.svg';
import { useLocation } from 'react-router-dom';
import { useOrder } from '../../../../shared/api/hooks/useOrder';
import { usePost } from '../../../../shared/api/hooks/usePost';


const OrderView = () => {
  const navigate = useNavigate();
  const [openMenuId, setOpenMenuId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  console.log(selectedIds);

  const location = useLocation();
  const market = location.state?.market;

  const { getOrderByMarket } = useOrder();
  const { createPost } = usePost();
  const { data, refetch } = getOrderByMarket(market);
  console.log( 'market1',data);
  

  useEffect(() => {
    if (data?.data?.data) {
      setSelectedIds(data.data?.data?.map((item: any) => item.id));
    }
  }, [data]);

  const handleAccapted = () => {
    const newOrder = {
      order_ids: selectedIds,
    };

    createPost.mutate(newOrder, {
      onSuccess: () => {
        setSelectedIds([]);
        refetch();
        navigate('/order/markets/new-orders');
      },
    });
  };

  return (
    <div
      onClick={() => setOpenMenuId('')}
      className="bg-white rounded-md m-5 dark:bg-[#312d4b]"
    >
      <Search />
      <div className="w-full">
        <table className="w-full">
          <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center dark:text-[#E7E3FCE5] dark:bg-[#3d3759]">
            <tr>
              <th>
                <div className="flex items-center gap-10 ml-10">
                  <input
                    type="checkbox"
                    checked={
                      !!data?.data?.data && selectedIds.length === data.data?.data?.length
                    } // ✅ doim boolean
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(data?.data?.data?.map((item: any) => item.id)); // 🔄 hamma id yig‘iladi
                      } else {
                        setSelectedIds([]); // 🔄 bo‘shatib yuboriladi
                      }
                    }}
                  />
                  {/* <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div> */}
                </div>
              </th>
              <th>
                <div className="flex items-center gap-10">
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  <span>#</span>
                </div>
              </th>
              <th>
                <div className="flex items-center gap-10">
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  <span>CUSTOMER</span>
                </div>
              </th>
              <th>
                <div className="flex items-center gap-10">
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  <span>PHONE</span>
                </div>
              </th>
              <th>
                <div className="flex items-center gap-10">
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  <span>ADDRESS</span>
                </div>
              </th>
              <th>
                <div className="flex items-center gap-10">
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  <span>MARKET</span>
                </div>
              </th>
              <th>
                <div className="flex items-center gap-10">
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  <span>STATUS</span>
                </div>
              </th>
              <th>
                <div className="flex items-center gap-10">
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  <span>PRICE</span>
                </div>
              </th>
              <th>
                <div className="flex items-center gap-10">
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  <span>STOCK</span>
                </div>
              </th>
              <th>
                <div className="flex items-center gap-10">
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                  <span>ACTION</span>
                  <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="cursor-pointer">
            {data?.data?.data?.map((item: any, inx: number) => (
              <tr
                key={item?.id}
                className="h-[56px] hover:bg-[#f6f7fb] dark:hover:bg-[#3d3759]"
                onClick={() => setSelectedOrder(item)}
              >
                <td className="pl-10">
                  <input
                    type="checkbox"
                    onClick={(e) => e.stopPropagation()}
                    checked={item?.id ? selectedIds.includes(item.id) : false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds([...selectedIds, item.id]);
                      } else {
                        setSelectedIds(
                          selectedIds.filter((id) => id !== item.id),
                        );
                      }
                    }}
                  />
                </td>
                <td className="pl-10">{inx + 1}</td>
                <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCB2]">
                  {item?.customer?.name}
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                  {item?.customer?.phone_number}
                </td>
                <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCB2]">
                  {item?.customer?.address?.split(' ').slice(0, 2).join(' ')}
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                  kelsa yozamn
                </td>
                <td className="pl-10">
                  <span
                    className={`py-2 px-3 rounded-2xl text-[13px] text-white dark:text-[#E7E3FCB2]  bg-blue-500`}
                  >
                    {item?.status?.toUpperCase()}
                  </span>
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                  {item?.total_price} UZS
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                  {item?.items?.length}
                </td>
                <td className="relative pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === item.id ? null : item.id);
                    }}
                  >
                    <EllipsisVertical />
                  </button>

                  {openMenuId === item.id && (
                    <div className="absolute right-0 mt-2 w-28 bg-white border shadow-md rounded-md z-10">
                      <button className="block w-full text-left px-4 py-2 hover:bg-gray-100">
                        Edit
                      </button>
                      <button className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-500">
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {selectedOrder && (
          <div
            className="fixed inset-0 bg-[#f4f5fa79] bg-opacity-80 flex items-center justify-center z-50 dark:bg-[#28243d3b]"
            onClick={() => setSelectedOrder(null)}
          >
            <div
              className="bg-white rounded-lg shadow-lg p-6 w-[500px] relative dark:bg-[#28243d]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-3 right-3 text-gray-600 hover:text-black"
                onClick={() => setSelectedOrder(null)}
              >
                ✕
              </button>
              <div>
                <div className="flex gap-4 items-center justify-between pr-4 border-b pb-2">
                  <div className="flex gap-4 items-center">
                    <h2>Buyurtma</h2>
                    <div className="bg-[var(--color-bg-sy)] py-0.5 px-1.5 rounded-md">
                      new
                    </div>
                  </div>
                  <div>
                    <h2>Sep 10, 2025, 13:20</h2>
                  </div>
                </div>
                <div>
                  <div className="pt-2">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="flex justify-between border-b pb-2">
                            <td>Product</td>
                            <td>Miqdori</td>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: 3 }).map((_, inx: number) => (
                          <tr
                            key={inx}
                            className="flex justify-between items-center pr-4 border-b mb-2"
                          >
                            <td>
                              <div className="flex items-center gap-3">
                                <div>
                                  <img src={phone} alt="" />
                                </div>
                                <div>
                                  <h2 className="text-[15px]">iphone 15</h2>
                                  <p className="text-[13px]">Samsung zo'r</p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="">1</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex justify-end mr-4">
                      <h2>Tota: 5_000_000 USD</h2>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between pr-7 mt-5">
                  <div>
                    <h2 className="text-[18px]">Customer detail</h2>
                    <h2 className="text-[15px]">phone: +998913607434</h2>
                    <h2 className="text-[15px]">address: Namangan, Chortoq</h2>
                  </div>
                  <div>
                    <h2 className="text-[18px]">Shipping Status</h2>
                    <h2 className="text-[15px]">On the Road</h2>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end mr-10 mt-5">
          <button
            type="submit"
            disabled={
              !selectedIds ||
              (Array.isArray(selectedIds) && selectedIds.length === 0)
            }
            onClick={handleAccapted}
            className={`px-2 py-1 ${
              !selectedIds ||
              (Array.isArray(selectedIds) && selectedIds.length === 0)
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'
            } font-sans bg-[#8c57ff] rounded-md mb-5 text-white`}
          >
            Qabul qilish
          </button>
        </div>
      </div>
    </div>
  );
};

export default memo(OrderView);
