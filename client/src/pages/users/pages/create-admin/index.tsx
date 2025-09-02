import { memo } from "react";
import CreateUserForm from "../../components/create-user-form";

const CreateAdmin = () => {
  return <CreateUserForm title="Admin" />;
};

export default memo(CreateAdmin);
