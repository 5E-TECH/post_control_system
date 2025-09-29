import { memo, type FC, useState, createContext, useMemo } from "react";
import avatar from "../../../../shared/assets/order/avatar.png";
import cart from "../../../../shared/assets/order/cart.svg";
import Popup from "../../../../shared/ui/Popup";
import { useOrder } from "../../../../shared/api/hooks/useOrder";
import { Input } from "antd";
import useNotification from "antd/es/notification/useNotification";

interface IProps {
  customer: {
    name: string;
    phone_number: string;
    id: string;
  } | null;
}

const Context = createContext({ name: "Default" });

const CustomerDetail: FC<IProps> = ({ customer }) => {
  if (!customer) return null;

  // popup state
  const [isShowPopup, setIsShowPopup] = useState(false);
  const { updateOrdersUserPhoneAndName } = useOrder();

  // editable fields
  const [name, setName] = useState(customer.name);
  const [phoneNumber, setPhoneNumber] = useState(customer.phone_number);

  // popup ochilganda current customer qiymatlarini inputga set qilamiz
  const handleOpenPopup = () => {
    setName(customer.name);
    setPhoneNumber(customer.phone_number);
    setIsShowPopup(true);
  };

  const [api, contextHolder] = useNotification();

  // saqlash
  const handleSave = () => {
    const updatedCustomer = {
      name,
      phone_number: phoneNumber,
    };

    updateOrdersUserPhoneAndName.mutate(
      {
        id: customer.id,
        data: updatedCustomer,
      },
      {
        onSuccess: () => {
          setIsShowPopup(false);
          api.success({
            message: "Muvaffaqiyatli!",
            description: "Order manzili muvaffaqiyatli yangilandi.",
            placement: "topRight",
          });
        },
        onError: () => {
          api.error({
            message: "Xatolik!",
            description: "Order yangilashda muammo yuzaga berdi.",
            placement: "topRight",
          });
        },
      }
    );

    console.log("Yuboriladigan ma'lumot:", updatedCustomer);

    setIsShowPopup(false);
  };

  const contextValue = useMemo(() => ({ name: "Ant Design" }), []);

  return (
    <Context.Provider value={contextValue}>
      {contextHolder}
      <div>
        <div className="m-5">
          <h2 className="dark:text-[#E7E3FC66]">Customer Detail</h2>
        </div>

        {/* Avatar + Name */}
        <div className="mx-5 flex items-center gap-3 mb-6">
          <div>
            <img src={avatar} alt="avatar" />
          </div>
          <div>
            <h2 className="text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
              {customer.name}
            </h2>
          </div>
        </div>

        {/* Orders */}
        <div className="mx-5 flex items-center gap-3 mb-6">
          <div>
            <img src={cart} alt="orders" />
          </div>
          <div>
            <h2 className="text-[15px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
              Orders
            </h2>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mx-5 mb-6 flex gap-3 flex-col text-[15px] text-[#E7E3FCB2] dark:text-[#E7E3FCE5]">
          <div className="flex justify-between items-center">
            <h2 className="font-medium text-[#2E263DE5] text-[18px] dark:text-[#E7E3FCE5]">
              Contact info
            </h2>
            <button
              onClick={handleOpenPopup}
              className="text-[15px] font-medium text-[#8C57FF] hover:underline cursor-pointer"
            >
              Edit
            </button>
          </div>
          <div>
            <h2 className="text-[#2E263DB2] dark:text-[#E7E3FCB2]">
              Phone Number: {customer.phone_number}
            </h2>
          </div>
        </div>

        {/* Popup */}
        <Popup isShow={isShowPopup} onClose={() => setIsShowPopup(false)}>
          <div className="bg-white dark:bg-[#28243d] w-[400px] rounded-2xl shadow-lg p-6">
            <h2 className="text-lg font-medium mb-4 dark:text-white">
              Edit Customer Info
            </h2>

            <div className="flex flex-col gap-5">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full mb-3 dark:bg-[#312D4B]! dark:outline-none! dark:text-white! dark:placeholder-gray-400!"
              />

              {/* Phone Number */}
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Phone number"
                className="w-full mb-3 dark:bg-[#312D4B]! dark:outline-none! dark:text-white! dark:placeholder-gray-400!"
              />
            </div>
            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setIsShowPopup(false)}
                className="px-4 py-2 rounded-md border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-[#3a324e]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-md bg-[#8C57FF] text-white hover:bg-[#7a4de6]"
              >
                Save
              </button>
            </div>
          </div>
        </Popup>
      </div>
    </Context.Provider>
  );
};

export default memo(CustomerDetail);
