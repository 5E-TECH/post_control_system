import { ChevronLeft, ChevronRight, EllipsisVertical } from "lucide-react";
import { memo, useState } from "react";
// import { useNavigate } from "react-router-dom";
import { OrderData } from "../../../../shared/static/order";
import Search from "../../components/search";
import phone from "../../../../shared/assets/order/detail.svg";

const statusColors: Record<string, string> = {
  new: "bg-blue-500",
  received: "bg-green-500",
  on_the_road: "bg-yellow-500",
  waiting: "bg-orange-500",
  sold: "bg-purple-500",
  cancelled: "bg-red-500",
  paid: "bg-cyan-500",
  partly_paid: "bg-pink-500",
  cancelled_sent: "bg-gray-500",
  closed: "bg-black",
};

const OrderView = () => {
  // const navigate = useNavigate();
  const [openMenuId, setOpenMenuId] = useState("");
  const [check, setchecked] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  return (
    <div
      onClick={() => setOpenMenuId("")}
      className="bg-white rounded-md m-5 dark:bg-[#312d4b]"
    >
      <Search />
      <div className="w-full">
        <table className="w-full">
          <thead className="bg-[#f6f7fb] h-[56px] text-[13px] text-[#2E263DE5] text-center dark:text-[#E7E3FCE5] dark:bg-[#3d3759]">
            <th>
              <div className="flex items-center gap-10 ml-10">
                <input onClick={() => setchecked((p) => !p)} type="checkbox" />
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
          </thead>
          <tbody>
            {OrderData?.map((item: any) => (
              <tr
                key={item.id}
                className="h-[56px] hover:bg-[#f6f7fb] dark:hover:bg-[#3d3759]"
                onClick={() => setSelectedOrder(item)}
              >
                <td className="pl-10">
                  <input checked={check ? true : false} type="checkbox" />
                </td>
                <td className="pl-10">{item.id}</td>
                <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCB2]">
                  {item.customer}
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                  {item.phone}
                </td>
                <td className="pl-10 text-[#2E263DE5] text-[15px] dark:text-[#E7E3FCB2]">
                  {item.address}
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                  {item.market}
                </td>
                <td className="pl-10">
                  <span
                    className={`py-2 px-3 rounded-2xl text-[13px] text-white dark:text-[#E7E3FCB2] ${
                      statusColors[item.status] || "bg-slate-400"
                    }`}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                  {item.price}
                </td>
                <td className="pl-10 text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
                  {item.stock}
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
            onClick={() => setSelectedOrder(null)} // qora joyni bosganda yopiladi
          >
            <div
              className="bg-white rounded-lg shadow-lg p-6 w-[500px] relative dark:bg-[#28243d]"
              onClick={(e) => e.stopPropagation()} // modal ichida bosganda yopilmasin
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
                        <th className="flex justify-between border-b pb-2">
                          <td>Product</td>
                          <td>Miqdori</td>
                        </th>
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

        <div className="flex justify-end items-center pr-[105px] pt-4 gap-6 pb-[16px]">
          <div className="flex items-center">
            <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
              Rows per page:
            </span>
            <select
              className="rounded px-2 py-1 text-[15px] outline-none"
              defaultValue="10"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>

          <div className="flex items-center font-normal text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            <span className="mr-1">1-5</span>
            <span className="mr-1">of</span>
            <span className="">13</span>
          </div>

          <div className="flex items-center gap-[23px]">
            <ChevronLeft className="w-5 h-5 cursor-pointer text-gray-600 dark:text-[#E7E3FCE5] hover:opacity-75" />
            <ChevronRight className="w-5 h-5 cursor-pointer text-gray-600 dark:text-[#E7E3FCE5] hover:opacity-75" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(OrderView);
