import React, { useRef } from "react";
import AddProduct, { type AddProductRef } from "./components";

const Products = () => {
  const addProductRef = useRef<AddProductRef>(null);

  const handleDiscard = () => {
    addProductRef.current?.onClear(); // 🔑 shu yerda tozalaymiz
  };

  return (
    <section>
      <div className="bg-[#f4f5fa] dark:bg-[#28243d] w-full">
        <div className="mx-[24px]">
          <div className=" flex w-full justify-between">
            <h2 className="text-[24px] font-medium">Add a new product for market ***</h2>
            <div className="flex gap-[16px]">
              <button
                onClick={handleDiscard}
                className="border px-[18px] py-[8px] rounded-md border-[#8A8D93] text-[#8A8D93] font-medium"
              >
                Discard
              </button>
              <button className="px-[18px] py-[8px] rounded-md bg-[#8c57ff] text-white font-medium">
                Publish Product
              </button>
            </div>
          </div>
        </div>
        <div className="m-[24px]">
          <AddProduct ref={addProductRef} />
        </div>
      </div>
    </section>
  );
};

export default React.memo(Products);
