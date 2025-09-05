import { memo } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { useProfile } from '../../../shared/api/hooks/useProfile';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../../app/store';
import { setEditing } from '../../../shared/lib/features/profile/profileEditSlice';

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

const EditProfileModal = ({
  open,
  onClose,
  user,
  refetch,
}: EditProfileModalProps) => {
  const [form] = Form.useForm<FormValues>();
  const { updateProfil } = useProfile();

  const data = useSelector((state: RootState) => state.profileEditSlice.value);
  const dispatch = useDispatch();
  const handleSubmit = async (values: FormValues) => {
    try {
      await updateProfil.mutateAsync({
        id: user.id,
        data: values,
      });
      message.success('Profil muvaffaqiyatli yangilandi!');
      dispatch(setEditing(null));
      refetch();
      onClose();
    } catch (error) {
      message.error('Xatolik yuz berdi, qayta urinib ko‘ring!');
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
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        preserve={false}
        initialValues={data || user}
      >
        <Form.Item
          label="Phone Number"
          name="phone_number"
          rules={[{ required: true, message: 'Phone number majburiy!' }]}
        >
          <Input placeholder="Phone number" />
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
