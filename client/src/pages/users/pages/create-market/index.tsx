import { memo } from "react";
import { Button, Form, Input, type FormProps } from "antd";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useTranslation } from "react-i18next";

type FieldType = {
  name: string;
  phone_number: string;
  tariff_home: string | number;
  tariff_center: string | number;
  password: string;
};

const CreateMarket = () => {
  const { t } = useTranslation("users");
  const { createUser } = useUser("market");
  const navigate = useNavigate();

  const onFinish: FormProps<FieldType>["onFinish"] = (values) => {
    const newMarket = {
      ...values,
      tariff_home: Number(values.tariff_home),
      tariff_center: Number(values.tariff_center),
    };
    createUser.mutate(newMarket, {
      onSuccess: () => {
        navigate("/all-users");
      },
    });
  };

  return (
    <div className="w-[420px]">
      <h1 className="font-medium text-[24px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
        {t("marketTitle")}
      </h1>
      <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
        {t("marketDescription")}
      </span>
      <Form onFinish={onFinish} className="pt-5!">
        <Form.Item
          name="name"
          rules={[{ required: true, message: t("enterName") }]}
        >
          <Input
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder={t("enterName")}
          />
        </Form.Item>

        <Form.Item
          name="phone_number"
          rules={[
            { required: true, message: t("enterPhoneNumber") },
            {
              pattern: /^\+998\d{9}$/,
              message: t("phoneNumberPattern"),
            },
          ]}
        >
          <Input
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder={t("enterPhoneNumber")}
          />
        </Form.Item>

        <Form.Item
          name="tariff_home"
          rules={[
            { required: true, message: t("enterHomeTariff") },
            {
              type: "number",
              min: 0,
              message: t("tariffMin"),
              transform: (value) => Number(value),
            },
          ]}
        >
          <Input
            type="number"
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder={t("enterHomeTariff")}
          />
        </Form.Item>

        <Form.Item
          name="tariff_center"
          rules={[
            { required: true, message: t("enterCenterTariff") },
            {
              type: "number",
              min: 0,
              message: t("tariffMin"),
              transform: (value) => Number(value),
            },
          ]}
        >
          <Input
            type="number"
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder={t("enterCenterTariff")}
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: t("enterPassword") }]}
        >
          <Input
            type="password"
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder={t("enterPassword")}
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
            <span>{t("create")}</span>
            <ArrowRight className="w-[12px] h-[12px]" />
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default memo(CreateMarket);
