import { FilePlus, Search, Send, X } from "lucide-react";
import { memo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Popup from "../../shared/ui/Popup";
import { useMarket } from "../../shared/api/hooks/useMarket/useMarket";
import ProductView from "../../shared/components/product-view";
import { useProduct } from "../../shared/api/hooks/useProduct";
// import ProductCreate from "./product-create";

const Products = () => {
  const [showMarket, setShowMarket] = useState(false);

  const navigate = useNavigate();

  const handleProps = (market: any) => {
    navigate("create", { state: { market } });
  };

  const { getProducts } = useProduct();

  const { data: productData } = getProducts();
  // console.log(productData);

  const { getMarkets } = useMarket();

  const { data } = getMarkets();
  // console.log(data?.data);

  // const { data } = getProduct();
  // console.log(data);

  const { pathname } = useLocation();

  if (pathname.startsWith("/products/create")) return <Outlet />;
  return (
    <div className="mt-6">
      <div className="flex flex-col md:flex-row gap-3 md:gap-0 md:items-center md:justify-between px-4">
        <input
          className="rounded-[7px] w-full md:w-[280px] h-[40px] border border-[#2E263D38] px-3"
          placeholder="Search"
          type="text"
        />

        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center gap-2 border w-[104px] h-[38px] border-[#8A8D93] rounded">
            <Send size={16} />
            Export
          </button>

          <button
            onClick={() => setShowMarket(true)}
            className="w-[146px] h-[38px] bg-[#8C57FF] text-white rounded flex items-center justify-center gap-2"
          >
            <FilePlus size={18} />
            Add Product
          </button>
          <Popup isShow={showMarket} onClose={() => setShowMarket(false)}>
            <div className="bg-white rounded-md w-[500px] h-[700px] px-6 dark:bg-[#28243d]">
              <button
                onClick={() => setShowMarket(false)}
                className="cursor-pointer bg-red-600 hover:bg-red-700 text-white p-2 rounded- ml-111 flex items-center justify-center shadow-md"
              >
                <X size={18} />
              </button>
              <h1 className="font-bold text-left">Choose Market</h1>
              <div className="flex items-center border border-[#2E263D38] dark:border-[#E7E3FC38] rounded-md px-[12px] py-[10px] mt-4 bg-white dark:bg-[#312D4B]">
                <input
                  type="text"
                  placeholder="Search order..."
                  className="w-full bg-transparent font-normal text-[15px] outline-none text-[#2E263D] dark:text-white placeholder:text-[#2E263D66] dark:placeholder:text-[#E7E3FC66]"
                />
                <Search className="w-5 h-5 text-[#2E263D66] dark:text-[#E7E3FC66]" />
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                <table className="w-full border-collapse border-4 border-[#f4f5fa] dark:border-[#2E263DB2] mt-4 scroll-y-auto cursor-pointer">
                  <thead className="dark:bg-[#3d3759] bg-[#F6F7FB]">
                    <tr>
                      <th className="h-[56px] font-medium text-[13px] text-left px-4">
                        <div className="flex items-center justify-between pr-[21px]">
                          # ID
                          <div className="w-[2px] h-[14px] bg-[#2E263D1F] dark:bg-[#524B6C]"></div>
                        </div>
                      </th>
                      <th className="h-[56px] font-medium text-[13px] text-left px-4">
                        <div className="flex items-center justify-between pr-[21px]">
                          MARKET NAME
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="text-[14px] font-normal text-[#2E263DB2] dark:text-[#E7E3FCB2] dark:bg-[#312d4b] divide-y divide-[#E7E3FC1F]">
                    {data?.data &&
                      Array.isArray(data.data) &&
                      data.data.map((item: any, inx: number) => (
                        <tr
                          key={item?.id}
                          className="border-b-2 border-[#f4f5fa] dark:border-[#E7E3FCB2] text-[15px] font-normal"
                          onClick={() => handleProps(item)}
                        >
                          <td className="text-[#8C57FF] pr-10 py-3">
                            {inx + 1}
                          </td>
                          <td className="pr-26 py-3">{item?.name}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="pl-89 py-2">
                <button className="px-3 py-1.5 text-[16px] bg-blue-500 dark:bg-blue-700 hover:bg-blue-600 text-white rounded-md cursor-pointer">
                  Selected
                </button>
              </div>
            </div>
          </Popup>
        </div>
      </div>
      <div>
        <ProductView data={productData} />
      </div>
    </div>
  );
};

export default memo(Products);
