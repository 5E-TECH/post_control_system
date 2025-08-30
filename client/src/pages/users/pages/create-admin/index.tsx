import { memo } from "react";
import ChooseUser from "../../components/choose-user";

const CreateAdmin = () => {
  return (
    <ChooseUser
      title="Market"
      body="Expert tips & tools to improve your website or online store using blog."
    />
  );
};

export default memo(CreateAdmin);
