import { Button, Form, Input } from "antd";
import { ArrowRight } from "lucide-react";
import { memo, type FC } from "react";

interface Props {
  title: string;
}

const CreateUserForm: FC<Props> = ({ title }) => {
  return (
    <div className="w-[420px]">
      <h1 className="font-medium text-[24px] text-[#2E263DE5]">
        {title} yaratish
      </h1>
      <span className="font-normal text-[15px] text-[#2E263DB2]">
        {title} malumotlarini kiriting
      </span>
      <Form className="flex! flex-col! gap-4 pt-[20px]!">
        <Input className="h-[40px]" placeholder="Foydalanuvchi ismi" />
        <Input className="h-[40px]" placeholder="Telefon nomeri" />
        <Input className="h-[40px]" placeholder="Pin Code" type="number" />
        <Input className="h-[40px]" placeholder="Address" />
        <Input className="h-[40px]" placeholder="Landmark" />
        <Input className="h-[40px]" placeholder="City" />
        <div className="flex items-center justify-center">
          <Button type="primary" className="bg-[#8C57FF]! w-[115px]">
            <span>Yaratish</span>
            <ArrowRight className="w-[12px] h-[12px]" />
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default memo(CreateUserForm);
