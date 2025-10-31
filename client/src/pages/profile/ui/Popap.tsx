import { memo, useEffect } from "react";
import { Modal, Form, Input, Button, message } from "antd";
import { useProfile } from "../../../shared/api/hooks/useProfile";
import { useDispatch } from "react-redux";
import { setEditing } from "../../../shared/lib/features/profile/profileEditSlice";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    name?: string;
    password?: string;
    phone_number?: string;
  };
  refetch: () => void;
}

interface FormValues {
  name?: string;
  phone_number?: string;
  password?: string;
}

const EditProfileModal = ({
  open,
  onClose,
  user,
  refetch,
}: EditProfileModalProps) => {
  const [form] = Form.useForm<FormValues>();
  const { updateProfil } = useProfile();
  const dispatch = useDispatch();

  const handleSubmit = async (values: FormValues) => {
    try {
      // faqat raqamlarni olib, +998 bilan birlashtirish
      let phone_number = values.phone_number
        ? values.phone_number.replace(/\D/g, "")
        : undefined;

      if (phone_number && !phone_number.startsWith("998")) {
        phone_number = "998" + phone_number;
      }

      const cleanedValues = {
        ...values,
        phone_number: phone_number ? "+" + phone_number : undefined,
      };

      await updateProfil.mutateAsync({
        data: cleanedValues,
        id: "",
      });

      message.success("Profil muvaffaqiyatli yangilandi!");
      dispatch(setEditing(null));
      refetch();
      onClose();
      form.resetFields();
    } catch (error) {
      message.error("Xatolik yuz berdi, qayta urinib ko‘ring!");
      console.error(error);
    }
  };

  useEffect(() => {
    if (open) {
      form.resetFields();
      // agar mavjud bo‘lsa, foydalanuvchi raqamini formatlab ko‘rsatish
      if (user?.phone_number) {
        const digits = user.phone_number.replace(/\D/g, "");
        let formatted = "+998 ";
        if (digits.startsWith("998")) {
          const rest = digits.slice(3);
          formatted += rest
            .replace(
              /(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/,
              (_: any, a: any, b: any, c: any, d: any) =>
                [a, b, c, d].filter(Boolean).join(" ")
            )
            .trim();
        }
        form.setFieldValue("phone_number", formatted);
      } else {
        form.setFieldValue("phone_number", "+998 ");
      }
    }
  }, [open, form, user]);

  return (
    <Modal
      title="Edit Profile"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        preserve={false}
      >
        <Form.Item label="Phone Number" name="phone_number">
          <Input
            placeholder="+998 99 000 00 00"
            maxLength={17}
            onChange={(e) => {
              let val = e.target.value.replace(/\D/g, ""); // faqat raqamlar
              if (val.startsWith("998")) {
                val = val.slice(3);
              }

              // formatlash
              let formatted = "+998 ";
              if (val.length > 0) {
                formatted += val
                  .replace(
                    /(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/,
                    (_: any, a: any, b: any, c: any, d: any) =>
                      [a, b, c, d].filter(Boolean).join(" ")
                  )
                  .trim();
              }

              form.setFieldValue("phone_number", formatted);
            }}
          />
        </Form.Item>

        <Form.Item label="Name" name='name'>
          <Input placeholder="Name" />
        </Form.Item>

        <Form.Item label="Password" name="password">
          <Input.Password placeholder="Password" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            Save Changes
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default memo(EditProfileModal);
