import { memo } from "react";
import ChooseUser from "../../components/choose-user";
import CreateUserForm from "../../components/create-user-form";

const CreateUser = () => {
  return (
    <div className="flex">
      <div className="">
        <h1 className="font-medium text-[18px] text-[#000000] pl-[90px] pt-[40px]">
          Foydalanuvchi rolini tanlang
        </h1>
        <div className="flex flex-col pt-[78px] pb-[78px] pl-[22px] pr-[22px] gap-[40px]">
          <ChooseUser
            title="Admin & Ro’yxatchi"
            body="Expert tips & tools to improve your website or online store using blog."
          />
          <ChooseUser
            title="Kurier"
            body="Expert tips & tools to improve your website or online store using blog."
          />
          <ChooseUser
            title="Market"
            body="Expert tips & tools to improve your website or online store using blog."
          />
        </div>
      </div>
      <div className="pt-[155px] pl-[165px]">
        <CreateUserForm title="Admin" />
      </div>
    </div>
  );
};

export default memo(CreateUser);
