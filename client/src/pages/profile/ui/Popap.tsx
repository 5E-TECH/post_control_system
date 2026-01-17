import { memo, useEffect } from "react";
import { Modal, Form, Input, Button, message } from "antd";
import { useProfile } from "../../../shared/api/hooks/useProfile";
import { useDispatch, useSelector } from "react-redux";
import { setEditing } from "../../../shared/lib/features/profile/profileEditSlice";
import type { RootState } from "../../../app/store";
import { User, Phone, Lock } from "lucide-react";

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
      message.error("Xatolik yuz berdi, qayta urinib ko'ring!");
      console.error(error);
    }
  };

  useEffect(() => {
    if (open) {
      form.resetFields();
      // agar mavjud bo'lsa, foydalanuvchi raqamini formatlab ko'rsatish
      if (user?.phone_number) {
        const digits = user.phone_number.replace(/\D/g, "");
        let formatted = "+998 ";
        if (digits.startsWith("998")) {
          const rest = digits.slice(3);
          formatted += rest
            .replace(
              /(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/,
              (_: string, a: string, b: string, c: string, d: string) =>
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
  const role = useSelector((state: RootState) => state.roleSlice);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnClose
      width={440}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-[#8C57FF] to-[#6366F1] flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white m-0">
              Profilni tahrirlash
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 m-0">
              Ma'lumotlaringizni yangilang
            </p>
          </div>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        preserve={false}
        className="mt-6"
      >
        <Form.Item
          label={
            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
              <Phone className="w-4 h-4" />
              Telefon raqam
            </span>
          }
          name="phone_number"
          className="mb-4"
        >
          <Input
            placeholder="+998 99 000 00 00"
            maxLength={17}
            size="large"
            className="rounded-lg"
            onChange={(e) => {
              let val = e.target.value.replace(/\D/g, "");
              if (val.startsWith("998")) {
                val = val.slice(3);
              }

              let formatted = "+998 ";
              if (val.length > 0) {
                formatted += val
                  .replace(
                    /(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/,
                    (_: string, a: string, b: string, c: string, d: string) =>
                      [a, b, c, d].filter(Boolean).join(" ")
                  )
                  .trim();
              }

              form.setFieldValue("phone_number", formatted);
            }}
          />
        </Form.Item>

        {role?.role !== "market" && role?.role !== "courier" && (
          <Form.Item
            label={
              <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
                <User className="w-4 h-4" />
                Ism
              </span>
            }
            name="name"
            className="mb-4"
          >
            <Input
              placeholder="Ismingizni kiriting"
              size="large"
              className="rounded-lg"
            />
          </Form.Item>
        )}

        <Form.Item
          label={
            <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm">
              <Lock className="w-4 h-4" />
              Yangi parol
            </span>
          }
          name="password"
          className="mb-6"
        >
          <Input.Password
            placeholder="Yangi parol kiriting"
            size="large"
            className="rounded-lg"
          />
        </Form.Item>

        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button
            onClick={onClose}
            size="large"
            className="flex-1 rounded-lg font-medium"
          >
            Bekor qilish
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            loading={updateProfil.isPending}
            className="flex-1 rounded-lg font-medium bg-[#8C57FF] hover:bg-[#7C3AED]!"
          >
            Saqlash
          </Button>
        </div>
      </Form>
    </Modal>
  );
};

export default memo(EditProfileModal);
