import { Button, Form, Input, type FormProps } from "antd";
import { ArrowRight } from "lucide-react";
import { memo, type FC } from "react";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useNavigate } from "react-router-dom";

interface Props {
  title: string;
}

type FieldType = {
  first_name: string;
  last_name: string;
  phone_number: string;
  password: string;
  salary: number;
  payment_day?: number;
};

const CreateUserForm: FC<Props> = ({ title }) => {
  const { createUser } = useUser(`admin`);
  const navigate = useNavigate();
  const onFinish: FormProps<FieldType>["onFinish"] = (values) => {
    if (title === "Admin") {
      const newAdmin = {
        ...values,
        salary: Number(values.salary),
        payment_day: Number(values.payment_day),
      };
      createUser.mutate(newAdmin, {
        onSuccess: () => navigate("/users"),
      });
    }
  };

  return (
    <div className="w-[420px]">
      <h1 className="font-medium text-[24px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
        {title} yaratish
      </h1>
      <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
        {title} malumotlarini kiriting
      </span>
      <Form onFinish={onFinish} className="pt-5!">
        <Form.Item
          name="first_name"
          rules={[{ required: true, message: "Ismni kiriting" }]}
        >
          <Input
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder="Foydalanuvchi ismi"
          />
        </Form.Item>

        <Form.Item
          name="last_name"
          rules={[{ required: true, message: "Familiyani kiriting" }]}
        >
          <Input
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder="Foydalanuvchi familiyasi"
          />
        </Form.Item>

        <Form.Item
          name="phone_number"
          rules={[
            { required: true, message: "Telefon raqamni kiriting" },
            {
              pattern: /^\+998\d{9}$/,
              message:
                "Telefon raqam +998 bilan boshlanishi va 9 raqamdan iborat bo‘lishi kerak",
            },
          ]}
        >
          <Input
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder="Telefon nomeri"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: "Parolni kiriting" }]}
        >
          <Input
            type="password"
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder="Parol"
          />
        </Form.Item>

        <Form.Item
          name="salary"
          rules={[
            { required: true, message: "Oylikni kiriting" },
            {
              type: "number",
              min: 0,
              message: "Oylik 0 dan kam bo‘lmasligi kerak",
              transform: (value) => Number(value),
            },
          ]}
        >
          <Input
            type="number"
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder="Oylik"
          />
        </Form.Item>

        <Form.Item
          name="payment_day"
          rules={[
            {
              type: "number",
              min: 1,
              max: 30,
              message: "To‘lov kuni 1 dan 30 gacha bo‘lishi kerak",
              transform: (value) => Number(value),
            },
          ]}
        >
          <Input
            type="number"
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder="To'lov kuni (1-30)"
          />
        </Form.Item>

        <div className="flex items-center justify-center">
          <Button
            disabled={createUser.isPending}
            loading={createUser.isPending}
            type="primary"
            htmlType="submit"
            className="bg-[#8C57FF]! w-[115px]"
          >
            <span>Yaratish</span>
            <ArrowRight className="w-[12px] h-[12px]" />
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default memo(CreateUserForm);
