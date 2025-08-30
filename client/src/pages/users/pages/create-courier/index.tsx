import { memo } from "react";
import ChooseUser from "../../components/choose-user";

const CreateCourier = () => {
  return (
    <ChooseUser
      title="Kurier"
      body="Expert tips & tools to improve your website or online store using blog."
    />
  );
};

export default memo(CreateCourier);
