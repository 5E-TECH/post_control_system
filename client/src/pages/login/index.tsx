import { Button, Form, Input, message, type FormProps } from "antd";
import React, { type FC } from "react";

import logo from "../../shared/assets/login/logo.svg";
import left from "../../shared/assets/login/Frame 1.svg";
import right from "../../shared/assets/login/Tree.svg";
import line from "../../shared/assets/login/Mask.svg";

import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setToken } from "../../shared/lib/features/login/authSlice";
import type { ILogin } from "../../shared/types/typesLogin";
import { useLogin } from "../../shared/api/hooks/useLogin";
import type { RootState } from "../../app/store";

message.config({
  maxCount: 5,
  duration: 3,
  top: 70,
});

const Login: FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { signinUser } = useLogin();

  
  const initialValues = useSelector((state: RootState) => state.signInSlice);
  const onFinish: FormProps<ILogin>["onFinish"] = (values: any) => {
    signinUser.mutate(values, {
      onSuccess: (res) => {
        dispatch(setToken(res?.data?.data));
        navigate('/')
      },
      onError: (err: any) => {
      const errorMsg =
        err?.response?.data?.message || "Telefon raqam yoki parol noto'g'ri !!!";
      message.error(errorMsg);
    },
    });
  };

  return (
    <div className="flex items-center justify-center min-h-[90vh] bg-gray-100 relative px-4 sm:px-10">
      <div className="absolute bottom-0 flex w-full justify-between px-4 sm:px-10">
        <div>
          <div>
            <img
              src={left}
              alt="Left plant"
              className="h-[100px] w-[60px] sm:h-[221px] sm:w-[98px] mb-6 sm:mb-14 mr-6 sm:mr-28"
            />
          </div>
          <div>
            <img
              src={right}
              alt="Right plant"
              className="h-[100px] w-[60px] sm:h-[221px] sm:w-[92px]"
            />
          </div>
        </div>
        <div>
          <img src={line} alt="" className="" />
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-lg shadow-2xl w-[460px] max-w-full mx-4">
        <Form
          name="basic"
          layout="vertical"
          initialValues={initialValues}
          onFinish={onFinish}
          autoComplete="off"
        >
          <div className="flex items-center justify-center gap-2 text-xl sm:text-2xl mb-6">
            <img src={logo} alt="" className="h-8 sm:h-10" />
            <strong className="bold">Beepost</strong>
          </div>

          <div className="mb-5 text-center">
            <p className="text-lg sm:text-2xl">Welcome to Beepost! 👋🏻</p>
          </div>

          <Form.Item<ILogin>
            name="phone_number"
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
                min: 4,
                message: "Parol kamida 6 ta belgidan iborat bo‘lishi kerak!",
              },
            ]}
          >
            <Input.Password size="large" placeholder="Password" type="text" />
          </Form.Item>

          <Form.Item label={null}>
            <Button
              loading={signinUser.isPending}
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
