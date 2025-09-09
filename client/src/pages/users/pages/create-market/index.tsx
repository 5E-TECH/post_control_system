import { memo } from "react";
import { Button, Form, Input, type FormProps } from "antd";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMarket } from "../../../../shared/api/hooks/useMarket/useMarket";

type FieldType = {
  market_name: string;
  phone_number: string;
  tariff_home: string | number;
  tariff_center: string | number;
  password: string;
};

const CreateMarket = () => {
  const { createMarket } = useMarket();
  const navigate = useNavigate();

  const onFinish: FormProps<FieldType>["onFinish"] = (values) => {
    const newMarket = {
      ...values,
      tariff_home: Number(values.tariff_home),
      tariff_center: Number(values.tariff_center),
    };
    createMarket.mutate(newMarket, {
      onSuccess: () => {
        navigate("/all-users");
      },
    });
  };

  return (
    <div className="w-[420px]">
      <h1 className="font-medium text-[24px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
        Market yaratish
      </h1>
      <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
        Market ma'lumotlarini kiriting
      </span>
      <Form onFinish={onFinish} className="pt-5!">
        <Form.Item
          name="market_name"
          rules={[{ required: true, message: "Market nomini kiriting" }]}
        >
          <Input
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder="Market nomini kiriting"
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
            placeholder="Telefon raqamni kiriting"
          />
        </Form.Item>

        <Form.Item
          name="tariff_home"
          rules={[
            { required: true, message: "Uy tarifi qiymatini kiriting" },
            {
              type: "number",
              min: 0,
              message: "Tarif 0 dan kam bo‘lmasligi kerak",
              transform: (value) => Number(value),
            },
          ]}
        >
          <Input
            type="number"
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder="Uy tarifini kiriting (so'm)"
          />
        </Form.Item>

        <Form.Item
          name="tariff_center"
          rules={[
            { required: true, message: "Markaz tarifi qiymatini kiriting" },
            {
              type: "number",
              min: 0,
              message: "Tarif 0 dan kam bo‘lmasligi kerak",
              transform: (value) => Number(value),
            },
          ]}
        >
          <Input
            type="number"
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder="Markaz tarifini kiriting (so'm)"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: "Parolni kiriting" }]}
        >
          <Input
            type="password"
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder="Parolni kiriting"
          />
        </Form.Item>

        <div className="flex items-center justify-center">
          <Button
            disabled={createMarket.isPending}
            loading={createMarket.isPending}
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

export default memo(CreateMarket);
