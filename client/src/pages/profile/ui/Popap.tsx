import { memo, useEffect } from "react";
import { Modal, Form, Input, Button, message } from "antd";
import { useProfile } from "../../../shared/api/hooks/useProfile";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string;
  };
  refetch: () => void;
}

interface FormValues {
  first_name: string;
  last_name: string;
  phone_number: string;
  password?: string;
}

const EditProfileModal = ({ open, onClose, user, refetch }: EditProfileModalProps) => {
  const [form] = Form.useForm<FormValues>();
  const { updateProfil } = useProfile();

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        password: "",
      });
    }
  }, [user, form]);

  const handleSubmit = async (values: FormValues) => {
    try {
      await updateProfil.mutateAsync({
        id: user.id,
        data: values,
      });
      message.success("Profil muvaffaqiyatli yangilandi!");
      refetch();
      onClose();
    } catch (error) {
      message.error("Xatolik yuz berdi, qayta urinib ko‘ring!");
      console.error(error);
    }
  };

  return (
    <Modal
      title="Edit Profile"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnClose  // ✅ modal yopilganda eski qiymatlar saqlanmaydi
    >
      <Form
        form={form}           // ✅ form hook ulandi
        layout="vertical"
        onFinish={handleSubmit}
        preserve={false}      // ✅ eski form qiymatlari saqlanmaydi
      >
        <Form.Item
          label="First Name"
          name="first_name"
          rules={[{ required: true, message: "First name majburiy!" }]}
        >
          <Input placeholder="First name" />
        </Form.Item>

        <Form.Item
          label="Last Name"
          name="last_name"
          rules={[{ required: true, message: "Last name majburiy!" }]}
        >
          <Input placeholder="Last name" />
        </Form.Item>

        <Form.Item
          label="Phone Number"
          name="phone_number"
          rules={[{ required: true, message: "Phone number majburiy!" }]}
        >
          <Input placeholder="Phone number" />
        </Form.Item>

        <Form.Item label="Password" name="password">
          <Input.Password placeholder="New password" />
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
