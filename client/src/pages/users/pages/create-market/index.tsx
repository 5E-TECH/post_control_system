import { memo } from "react";
import CreateUserForm from "../../components/create-user-form";

const CreateMarket = () => {
  return <CreateUserForm title="Market" />;
};

export default memo(CreateMarket);
