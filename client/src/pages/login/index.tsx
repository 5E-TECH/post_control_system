import { Button, Form, Input, type FormProps } from "antd";
import React from "react";

import logo from "../../shared/assets/login/logo.svg";
import left from "../../shared/assets/login/Frame 1.svg"
import right from "../../shared/assets/login/Tree.svg"

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
    <div className="flex items-center justify-center min-h-[90vh] bg-gray-100">
      <div className="absolute bottom-0 flex w-full justify-between px-10">
        <img src={left} alt="Left plant" className="h-[221px] w-[98] mb-14 mr-28" />
        <img src={right} alt="Right plant" className="h-[221px] w-[92px]" />
      </div>
      {/* <div className="absolute bottom-0 w-full flex justify-center z-0">
        <img
          src={background}
          alt="Gray decorative line"
          className="opacity-70 h-10" // rang va balandlikni sozlashing mumkin
        />
      </div> */}
      <div className="max-w-sm bg-white p-8 rounded-lg w-[460px] shadow-2xl">
        <Form
          name="basic"
          layout="vertical"
          initialValues={initialValues}
          onFinish={onFinish}
          autoComplete="off"
        >
          <div className="flex items-center justify-center gap-2 text-2xl mb-6">
            <img src={logo} alt="" />
            <strong className="bold">Beepost</strong>
          </div>

          <div className="mb-5">
            <p className="text-2xl">Welcome to Beepost! 👋🏻</p>
          </div>

          <Form.Item<ILogin>
            name="phone"
            rules={[
              { required: true, message: "Please input your phone!" },
              { min: 9, message: "Iltimos telefon raqamni to'g'ri kiriting!" },
            ]}
          >
            <Input size="large" placeholder="Phone number" type="text" />
          </Form.Item>

          <Form.Item<ILogin>
            name="password"
            rules={[
              { required: true, message: "Please input your password!" },
              {
                min: 6,
                message: "Parol kamida 6 ta belgidan iborat bo‘lishi kerak!",
              },
            ]}
          >
            <Input.Password size="large" placeholder="Password" type="text" />
          </Form.Item>

          <Form.Item label={null}>
            <Button
              loading={createUser.isPending}
              type="primary"
              htmlType="submit"
              size="large"
              className="bg-[#8C57FF]! w-full"
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
