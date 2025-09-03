import { memo } from "react";
import CreateUserForm from "../../components/create-user-form";

const CreateCourier = () => {
  return <CreateUserForm title="Kuryer" />;
};

export default memo(CreateCourier);
