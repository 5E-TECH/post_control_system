import { Edit, FilePlus, Send, Trash } from 'lucide-react';
import { memo, useState, useEffect } from 'react';
import ProductImg from '../../shared/assets/profile-image/Image.svg';
import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';

const Products = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

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
            onClick={() => navigate('/products-create')}
            className="w-[146px] h-[38px] bg-[#8C57FF] text-white rounded flex items-center justify-center gap-2"
          >
            <FilePlus size={18} />
            Add Product
          </button>
        </div>
      </div>

      <div className="mt-4 px-4 overflow-x-auto">
        <Spin spinning={loading} tip="Loading Products...">
          <table className="w-full min-w-[600px]">
            <thead className="h-[54px] bg-[#F6F7FB] dark:bg-[#3D3759] text-left">
              <tr>
                <th className="p-3">Products</th>
                <th className="p-3">Remaining</th>
                <th className="p-3">Total Earning</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-300 dark:border-gray-600"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={ProductImg}
                        alt="Product"
                        className="w-10 h-10 object-contain"
                      />
                      <div>
                        <p className="font-medium">
                          Clothing, Shoes, and jewellery
                        </p>
                        <p className="text-sm text-gray-500">
                          Fashion for a wide selection of clothing, shoes,
                          jewellery and watches.
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="p-3">4,689</td>

                  <td className="p-3">$45,627</td>

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
    </div>
  );
};

export default memo(Products);
