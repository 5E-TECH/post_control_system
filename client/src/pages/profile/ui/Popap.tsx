import { memo, useEffect } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { useProfile } from '../../../shared/api/hooks/useProfile';
import { useDispatch } from 'react-redux';
// import type { RootState } from '../../../app/store';
import { setEditing } from '../../../shared/lib/features/profile/profileEditSlice';

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
  refetch,
}: EditProfileModalProps) => {
  const [form] = Form.useForm<FormValues>();
  const { updateProfil } = useProfile();

  // const data = useSelector((state: RootState) => state.profileEditSlice.value);
  const dispatch = useDispatch();

  const handleSubmit = async (values: FormValues) => {
    try {
      await updateProfil.mutateAsync({
        data: values,
        id: '', // self update bo‘lsa backendda id kerak emas
      });
      message.success('Profil muvaffaqiyatli yangilandi!');
      dispatch(setEditing(null));
      refetch();
      onClose();
      form.resetFields();
    } catch (error) {
      message.error('Xatolik yuz berdi, qayta urinib ko‘ring!');
      console.error(error);
    }
  };

  // Modal ochilganda inputlarni bo‘shlab qo‘yish
  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

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
        <Form.Item
          label="Phone Number"
          name="phone_number"
        >
          <Input placeholder="Phone number" />
        </Form.Item>

        <Form.Item
          label="Name"
          name="name"
        >
          <Input placeholder="Name" />
        </Form.Item>

        <Form.Item
          label="Password"
          name="password"
        >
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
