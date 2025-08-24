import { Button, Form, Input, type FormProps } from "antd";
import React from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../../shared/lib";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../shared/api";
import { clearSignInData } from "../../shared/lib/features/login/signInSlice";
import { setToken } from "../../shared/lib/features/login/authSlice";
import type { ILogin } from "../../shared/types/typesLogin";
import { useLogin } from "../../shared/api/hooks/useLogin";

const Login = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { createUser } = useLogin();

  const initialValues = useSelector((state: RootState) => state.signInSlice);

  const login = useMutation({
    mutationFn: (data: any) => api.post("user/login", data),
  });

  const onFinish: FormProps<ILogin>["onFinish"] = (values: any) => {
    login.mutate(values, {
      onSuccess: (res) => {
        dispatch(clearSignInData());
        dispatch(setToken(res?.data?.accsestoken));
        navigate("/profile");
      },
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-white px-4">
      <div className="w-full max-w-sm bg-gray-200 p-8 rounded-lg">
        <Form
          name="basic"
          layout="vertical"
          initialValues={initialValues}
          onFinish={onFinish}
          autoComplete="off"
        >
          <h2 className="text-lg font-semibold text-center mb-4">Login</h2>

          <Form.Item<ILogin>
            label="Phone"
            name="phone"
            rules={[
              { required: true, message: "Please input your phone!" },
              { min: 9, message: "Iltimos telefon raqamni to'g'ri kiriting!" },
            ]}
          >
            <Input size="large" />
          </Form.Item>

          <Form.Item<ILogin>
            label="Password"
            name="password"
            rules={[
              { required: true, message: "Please input your password!" },
              {
                min: 6,
                message: "Parol kamida 6 ta belgidan iborat bo‘lishi kerak!",
              },
            ]}
          >
            <Input.Password size="large" />
          </Form.Item>

          <Form.Item label={null}>
            <Button
              loading={createUser.isPending}
              type="primary"
              htmlType="submit"
              size="large"
              className="w-full"
            >
              Submit
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
};

export default React.memo(Login);
