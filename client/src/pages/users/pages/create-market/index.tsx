import { memo } from 'react';
import { Button, Form, Input, Select, type FormProps } from 'antd';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../../../shared/api/hooks/useRegister';
import { useTranslation } from 'react-i18next';
import { useApiNotification } from '../../../../shared/hooks/useApiNotification';
import { buildAdminPath } from '../../../../shared/const';

type FieldType = {
  name: string;
  phone_number: string;
  tariff_home: string | number;
  tariff_center: string | number;
  default_tariff: string;
  password: string;
};

const CreateMarket = () => {
  const { t } = useTranslation('users');
  const { createUser } = useUser('market');
  const navigate = useNavigate();

  const [form] = Form.useForm<FieldType>();
  const { handleApiError } = useApiNotification();
  const onFinish: FormProps<FieldType>['onFinish'] = (values) => {
    const newMarket = {
      ...values,
      tariff_home: Number(String(values.tariff_home).replace(/,/g, '')),
      tariff_center: Number(String(values.tariff_center).replace(/,/g, '')),
      phone_number: values.phone_number.split(' ').join(''),
    };
    createUser.mutate(newMarket, {
      onSuccess: () => {
        navigate(buildAdminPath('all-users'));
      },
      onError: (err: any) =>
        handleApiError(err, 'Foydalanuvchi yaratishda xatolik yuz berdi'),
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;

    if (!input.startsWith('+998 ')) input = '+998 ';

    let val = input.replace(/\D/g, '').slice(3);

    if (val.length > 9) val = val.slice(0, 9);

    let formatted = '+998 ';
    if (val.length > 0) {
      formatted += val
        .replace(/(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/, (_, a, b, c, d) =>
          [a, b, c, d].filter(Boolean).join(' '),
        )
        .trim();
    }

    form.setFieldsValue({ phone_number: formatted });
  };

  return (
    <div className="min-[800px]:w-[420px]">
      <h1 className="font-medium text-[24px] text-[#2E263DE5] dark:text-[#E7E3FCE5]">
        {t('marketTitle')}
      </h1>
      <span className="font-normal text-[15px] text-[#2E263DB2] dark:text-[#E7E3FCB2]">
        {t('marketDescription')}
      </span>
      <Form
        form={form}
        onFinish={onFinish}
        initialValues={{ default_tariff: 'center', phone_number: '+998 ' }}
        className="pt-5!"
      >
        <Form.Item
          name="name"
          rules={[{ required: true, message: t('enterName') }]}
        >
          <Input
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FCCC]! dark:text-[#E7E3FCCC]!"
            placeholder={t('enterName')}
          />
        </Form.Item>

        <Form.Item
          name="phone_number"
          rules={[
            { required: true, message: t('enterPhoneNumber') },
            {
              pattern: /^\+998 \d{2} \d{3} \d{2} \d{2}$/,
              message: t('phoneNumberPattern'),
            },
          ]}
        >
          <Input
            placeholder={t('enterPhoneNumber')}
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FCCC]! dark:text-[#E7E3FCCC]!"
            type="text"
            onChange={handlePhoneChange}
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: t('enterPassword') }]}
        >
          <Input.Password
            type="password"
            className="custom-password h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:text-[#E7E3FC66]!"
            placeholder={t('enterPassword')}
          />
        </Form.Item>

        <Form.Item
          name="tariff_home"
          rules={[{ required: true, message: t('enterHomeTariff') }]}
          normalize={(value) => {
            if (!value) return value;
            const onlyNums = value.replace(/\D/g, '');
            return onlyNums.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          }}
        >
          <Input
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FCCC]! dark:text-[#E7E3FCCC]!"
            placeholder={t('enterHomeTariff')}
          />
        </Form.Item>

        <Form.Item
          name="tariff_center"
          rules={[{ required: true, message: t('enterCenterTariff') }]}
          normalize={(value) => {
            if (!value) return value;
            const onlyNums = value.replace(/\D/g, '');
            return onlyNums.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          }}
        >
          <Input
            className="h-[48px] dark:bg-[#312D4B]! dark:border-[#E7E3FC38]! dark:placeholder:text-[#E7E3FCCC]! dark:text-[#E7E3FCCC]!"
            placeholder={t('enterCenterTariff')}
          />
        </Form.Item>

        <Form.Item name="default_tariff">
          <Select
            defaultValue="center"
            placeholder="Yetkazib berish"
            className="h-[48px]!"
          >
            <Select.Option value="center">Markazgacha</Select.Option>
            <Select.Option value="address">Manzilgacha</Select.Option>
          </Select>
        </Form.Item>

        <div className="flex items-center justify-center">
          <Button
            disabled={createUser.isPending}
            loading={createUser.isPending}
            type="primary"
            htmlType="submit"
            className="bg-[#8C57FF]! w-[115px]"
          >
            <span>{t('create')}</span>
            <ArrowRight className="w-[12px] h-[12px]" />
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default memo(CreateMarket);
