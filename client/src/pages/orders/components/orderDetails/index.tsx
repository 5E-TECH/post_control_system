import { memo, type FC } from "react";

interface IProps {
  items: any[];
  total_price: any;
}

const Details: FC<IProps> = ({ items = [], total_price }) => {
  // console.log(items);

  return (
    <div className="dark:bg-[#312D4B]">
      <div className="flex justify-between m-5">
        <h2 className="font-medium text-[18px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
          Order details
        </h2>
        <button className="text-[#8C57FF]">Edit</button>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center gap-5 bg-[#F6F7FB] dark:bg-[#3d3759]">
        <h2 className="flex-1 font-medium p-5 text-[#2E263DE5] dark:text-[#E7E3FCE5]">
          PRODUCT
        </h2>
        <div className="h-[14px] border-l-2 border-[#2E263D1F] dark:border-[#E7E3FC1F]"></div>
        <h2 className="ml-5 mr-10 font-medium text-[#2E263DE5] dark:text-[#E7E3FCE5]">
          QTY
        </h2>
        <div className="h-[14px] border-l-2 border-[#2E263D1F] pr-5 dark:border-[#E7E3FC1F]"></div>
      </div>

      {/* Items */}
      {items.map((item) => (
        <div
          key={item.id}
          className="mx-5 flex flex-row gap-5 items-center my-1 border-b-2 border-[#F6F7FB] dark:border-[#474360]"
        >
          <div className="flex flex-row gap-5 flex-1">
            <div className="w-[34px] h-[34px] my-2">
              <img
                src={`/uploads/${item.product.image_url}`} // server image path
                alt={item.product.name}
                className="object-contain w-full"
              />
            </div>
            <div>
              <h2 className="font-medium text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
                {item.product.name}
              </h2>
              <h3 className="text-[13px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
                {item.product.user_id}
              </h3>
            </div>
          </div>
          <div className="mr-[93px] text-[#2E263DB2] text-[15px] dark:text-[#E7E3FCB2]">
            <h2>{item.quantity}</h2>
          </div>
        </div>
      ))}

      {/* Totals */}
      <div className="flex justify-end mr-5 my-5">
        <div className="flex gap-[48px]">
          <div className="text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
            <h2>Total:</h2>
          </div>
          <div className="text-[15px] text-[#2E263DE5] font-black dark:text-[#E7E3FCE5]">
            <h2>{Number(total_price).toLocaleString("uz-UZ")} so‘m</h2>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(Details);
