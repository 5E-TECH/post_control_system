import { memo } from "react";
import chip from "../../../../shared/assets/payments/chip.svg";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCashBox } from "../../../../shared/api/hooks/cashbox";

const CashDetail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const market = location.state?.market;
  console.log("11111111111111111",market.selectMarket);

  const {getCashBoxById} = useCashBox()
  const {data} = getCashBoxById(market.selectMarket)

  console.log(data?.data?.cashbox?.balance);
  
  


  return (
    <div className="px-5 mt-5 flex gap-24">
      <div>
        <div className="w-[500px] h-[250px] px-6 py-6 text-2xl flex flex-col rounded-[20px] bg-gradient-to-r from-[#041464] to-[#94058E] text-white">
          <h1 className="font-medium text-[16px]">Kassa miqdor</h1>
          <div className="mt-4">
            <img src={chip} alt="" />
          </div>
          <div>
            <strong className="block pt-6 font-bold text-[32px]">
              {data?.data?.cashbox?.balance} UZS
            </strong>
            <p className="pt-8 text-[16px] font-medium">Bahodir Nabijanov</p>
          </div>
        </div>

        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex bg-[#dcd4fc] hover:bg-[#cabefc] text-gray-800 dark:bg-[#3d3759] dark:hover:bg-[#39315c] dark:text-white px-4 py-2 gap-2 rounded-lg mt-6 cursor-pointer"
          >
            <ArrowLeft className="w-4" />
            Go Back
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-8 mt-3">
          <div className="flex flex-col">
            <label htmlFor="">From</label>
            <input
              type="date"
              className="border border-gray-500 px-2 py-2 rounded-md mt-2"
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="">To</label>
            <input
              type="date"
              className="border border-gray-500 px-2 py-2 rounded-md mt-2"
            />
          </div>
        </div>
        <div className="flex gap-5 mt-10">
          <div className="bg-[#0688221A] px-6 py-5">
            <strong className="text-[#068822] dark:text-green-500 text-[20px]">
              + {data?.data?.income} UZS
            </strong>
          </div>
          <div className="bg-[#B80D0D1A] px-6 py-5">
            <strong className="text-[#B80D0D] dark:text-red-500 text-[20px]">
              - {data?.data?.outcome} UZS
            </strong>
          </div>
        </div>

        <div className="h-[520px] mt-5 px-8 py-4 bg-[#ede8ff] dark:bg-[#3D3759] shadow-md rounded-lg overflow-y-auto">
          <div className="flex gap-20 mb-3">
            <div>
              <h3 className="text-[20px] font-medium">Bahodir Nabijanov</h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>16.01.2020</p>
                <p>16:20</p>
              </div>
            </div>
            <div>
              <strong className="text-[#068822] dark:text-green-500 text-[22px]">
                +6 500 000 UZS
              </strong>
            </div>
          </div>

          <div className="flex gap-20 mb-3">
            <div>
              <h3 className="text-[20px] font-medium">Bahodir Nabijanov</h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>16.01.2020</p>
                <p>16:20</p>
              </div>
            </div>
            <div>
              <strong className="text-[#B80D0D] dark:text-red-500 text-[22px]">
                -6 500 UZS
              </strong>
            </div>
          </div>

          <div className="flex gap-20 mb-3">
            <div>
              <h3 className="text-[20px] font-medium">Bahodir Nabijanov</h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>16.01.2020</p>
                <p>16:20</p>
              </div>
            </div>
            <div>
              <strong className="text-[#068822] dark:text-green-500 text-[22px]">
                +6 500 000 UZS
              </strong>
            </div>
          </div>

          <div className="flex gap-20 mb-3">
            <div>
              <h3 className="text-[20px] font-medium">Bahodir Nabijanov</h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>16.01.2020</p>
                <p>16:20</p>
              </div>
            </div>
            <div>
              <strong className="text-[#068822] dark:text-green-500 text-[22px]">
                +6 500 000 UZS
              </strong>
            </div>
          </div>

          <div className="flex gap-20 mb-3">
            <div>
              <h3 className="text-[20px] font-medium">Bahodir Nabijanov</h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>16.01.2020</p>
                <p>16:20</p>
              </div>
            </div>
            <div>
              <strong className="text-[#B80D0D] dark:text-red-500 text-[22px]">
                -6 500 UZS
              </strong>
            </div>
          </div>

          <div className="flex gap-20 mb-3">
            <div>
              <h3 className="text-[20px] font-medium">Bahodir Nabijanov</h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>16.01.2020</p>
                <p>16:20</p>
              </div>
            </div>
            <div>
              <strong className="text-[#B80D0D] dark:text-red-500 text-[22px]">
                -6 500 UZS
              </strong>
            </div>
          </div>

          <div className="flex gap-20 mb-3">
            <div>
              <h3 className="text-[20px] font-medium">Bahodir Nabijanov</h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>16.01.2020</p>
                <p>16:20</p>
              </div>
            </div>
            <div>
              <strong className="text-[#B80D0D] dark:text-red-500 text-[22px]">
                -6 500 UZS
              </strong>
            </div>
          </div>

          <div className="flex gap-20 mb-3">
            <div>
              <h3 className="text-[20px] font-medium">Bahodir Nabijanov</h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>16.01.2020</p>
                <p>16:20</p>
              </div>
            </div>
            <div>
              <strong className="text-[#068822] dark:text-green-500 text-[22px]">
                +6 500 000 UZS
              </strong>
            </div>
          </div>

          <div className="flex gap-20 mb-3">
            <div>
              <h3 className="text-[20px] font-medium">Bahodir Nabijanov</h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>16.01.2020</p>
                <p>16:20</p>
              </div>
            </div>
            <div>
              <strong className="text-[#068822] dark:text-green-500 text-[22px]">
                +6 500 000 UZS
              </strong>
            </div>
          </div>

          <div className="flex gap-20 mb-3">
            <div>
              <h3 className="text-[20px] font-medium">Bahodir Nabijanov</h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>16.01.2020</p>
                <p>16:20</p>
              </div>
            </div>
            <div>
              <strong className="text-[#068822] dark:text-green-500 text-[22px]">
                +6 500 000 UZS
              </strong>
            </div>
          </div>

          <div className="flex gap-20 mb-3">
            <div>
              <h3 className="text-[20px] font-medium">Bahodir Nabijanov</h3>
              <div className="flex gap-3 text-[#787878] text-[14px] dark:text-gray-400">
                <p>16.01.2020</p>
                <p>16:20</p>
              </div>
            </div>
            <div>
              <strong className="text-[#068822] dark:text-green-500 text-[22px]">
                +6 500 000 UZS
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(CashDetail);
