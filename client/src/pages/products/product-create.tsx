import React, { type FC } from "react";
import AddProduct from "./components";
import { useLocation } from "react-router-dom";
import ProductView from "../../shared/components/product-view";
import { useProduct } from "../../shared/api/hooks/useProduct";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
// import { useLocation } from 'react-router-dom';

// interface Iprops {
//   market:any
// }

const ProductsCreate: FC = () => {
  const location = useLocation();
  const market = location.state?.market; // state'dan olamiz

  

  const { role } = useSelector((state: RootState) => state.roleSlice);

  const { getMyProducts, getProductsByMarket } = useProduct();
  const { data } =
    role === "market" ? getMyProducts() : getProductsByMarket(market.id);

  return (
    <section>
      <div className="bg-[#f4f5fa] dark:bg-[#28243d] w-full">
        <div className="mx-[24px]">
          <div className=" flex w-full justify-between">
            <h2 className="text-[24px] font-medium">
              Add a new product for market {market.name}
            </h2>
          </div>
        </div>
        <div className="m-[24px]">
          <AddProduct />
          <ProductView data={data} />
        </div>
      </div>
      <div></div>
    </section>
  );
};

export default React.memo(ProductsCreate);
