import { memo } from "react";
import { Button, Form, Input, type FormProps } from "antd";
import { ArrowRight } from "lucide-react";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

type FieldType = {
  first_name: string;
  last_name: string;
  phone_number: string;
  password: string;
  salary: string | number;
  payment_day?: string | number;
};

const CreateRegistrator = () => {
  const { t } = useTranslation("users");
  const { createUser } = useUser("registrator");
  const navigate = useNavigate();

  const [form] = Form.useForm<FieldType>();

  const onFinish: FormProps<FieldType>["onFinish"] = (values) => {
    const newRegistrator = {
      ...values,
      salary: Number(values.salary),
      payment_day: Number(values.payment_day),
      phone_number: values.phone_number.split(" ").join(""),
    };
    createUser.mutate(newRegistrator, {
      onSuccess: () => {
        navigate("/all-users");
      },
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;

    if (!input.startsWith("+998 ")) input = "+998 ";

    let val = input.replace(/\D/g, "").slice(3);

    if (val.length > 9) val = val.slice(0, 9);

    let formatted = "+998 ";
    if (val.length > 0) {
      formatted += val
        .replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/, (_, a, b, c, d) =>
          [a, b, c, d].filter(Boolean).join(" ")
        )
        .trim();
    }

    form.setFieldsValue({ phone_number: formatted });
  };

  return (
    <div className="min-[800px]:w-[420px]">
      <h1 className="font-medium text-[24px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
        {t("registratorTitle")}
      </h1>
      <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
        {t("registratorDescription")}
      </span>
      <Form
        form={form}
        onFinish={onFinish}
        initialValues={{ phone_number: "+998 " }}
        className="pt-5!"
      >
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
              pattern: /^\+998 \d{2} \d{3} \d{2} \d{2}$/,
              message: t("phoneNumberPattern"),
            },
          ]}
        >
          <Input
            placeholder={t("enterPhoneNumber")}
            className="h-[48px]"
            type="text"
            onChange={handlePhoneChange}
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

        <Form.Item
          name="salary"
          rules={[
            { required: true, message: t("enterSalary") },
            {
              type: "number",
              min: 0,
              message: t("salaryMin"),
              transform: (value) => Number(value),
            },
          ]}
        >
          <Input
            type="number"
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder={t("enterSalary")}
          />
        </Form.Item>

        <Form.Item
          name="payment_day"
          rules={[
            {
              type: "number",
              min: 1,
              max: 30,
              message: t("paymentDayRange"),
              transform: (value) => Number(value),
            },
          ]}
        >
          <Input
            type="number"
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FC66]! dark:text-[#E7E3FC66]!"
            placeholder={t("enterPaymentDay")}
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

export default memo(CreateRegistrator);
