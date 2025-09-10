import { Spin } from "antd";
import { Edit, Trash } from "lucide-react";
import { memo, useEffect, useState, type FC } from "react";

interface IProps {
  data:any
}

const ProductView:FC<IProps> = ({data}) => {
  const [loading, setLoading] = useState(true);

  console.log(data);
    

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
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
            {data?.data.map((item:any, inx:number) => (
              <tr
                key={item.id}
                className="border-b border-gray-300 dark:border-gray-600"
              >
                <td className="p-3">{inx + 1}</td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.image_url}
                      alt="Product"
                      className="w-10 h-10 object-contain"
                    />
                    <div>
                      <p className="font-medium">
                        {item.name}
                      </p>
                    </div>
                  </div>
                </td>

                <td className="p-3">{item.name}</td>


                <td className="p-3 flex items-center gap-3">
                  <button className="hover:text-[#8C57FF]">
                    <Edit />
                  </button>
                  <button className="hover:text-red-500">
                    <Trash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Spin>
    </div>
  );
};

export default memo(ProductView);
