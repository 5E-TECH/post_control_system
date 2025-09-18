import { Button, Input, message } from 'antd';
import React, { type FC } from 'react';

import logo from '../../shared/assets/login/logo.svg';
import left from '../../shared/assets/login/Frame 1.svg';
import right from '../../shared/assets/login/Tree.svg';
import line from '../../shared/assets/login/Mask.svg';

import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setToken } from '../../shared/lib/features/login/authSlice';
import type { ILogin } from '../../shared/types/typesLogin';
import { useLogin } from '../../shared/api/hooks/useLogin';

import { Formik, Form, Field, ErrorMessage, type FormikProps } from 'formik';
import * as yup from 'yup';

message.config({
  maxCount: 5,
  duration: 3,
  top: 70,
});

const validationSchema = yup.object().shape({
  phone_number: yup
    .string()
    .required('Please input your phone!')
    .min(9, "Iltimos telefon raqamni to'g'ri kiriting!"),
  password: yup
    .string()
    .required('Please input your password!')
    .min(4, 'Parol kamida 4 ta belgidan iborat bo‘lishi kerak!'),
});

const Login: FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { signinUser } = useLogin();

  const initialValues: ILogin = {
    phone_number: '',
    password: '',
  };

  const onFinish = (values: ILogin, { setSubmitting }: any) => {
    signinUser.mutate(values, {
      onSuccess: (res) => {
        dispatch(setToken(res?.data?.data));
        navigate('/');
        setSubmitting(false); // ✅ Formik loading to‘xtatildi
      },
      onError: (err: any) => {
        const errorMsg =
          err?.response?.data?.message ||
          "Telefon raqam yoki parol noto'g'ri !!!";
        message.error(errorMsg);
        setSubmitting(false); 
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
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          onSubmit={onFinish}
        >
          {({ handleSubmit, isSubmitting }: FormikProps<ILogin>) => (
            <Form onSubmit={handleSubmit}>
              <div className="flex items-center justify-center gap-2 text-xl sm:text-2xl mb-6">
                <img src={logo} alt="" className="h-8 sm:h-10" />
                <strong className="bold">Beepost</strong>
              </div>

              <div className="mb-5 text-center">
                <p className="text-lg sm:text-2xl">Welcome to Beepost! 👋🏻</p>
              </div>

              {/* Phone number */}
              <div className="mb-4">
                <Field
                  as={Input}
                  name="phone_number"
                  size="large"
                  placeholder="Phone number"
                />
                <ErrorMessage
                  name="phone_number"
                  component="div"
                  className="text-red-500 text-sm mt-1"
                />
              </div>

              {/* Password */}
              <div className="mb-4">
                <Field
                  as={Input.Password}
                  name="password"
                  size="large"
                  placeholder="Password"
                />
                <ErrorMessage
                  name="password"
                  component="div"
                  className="text-red-500 text-sm mt-1"
                />
              </div>

              <Button
                loading={signinUser.isPending || isSubmitting}
                type="primary"
                htmlType="submit"
                size="large"
                className="bg-[#8C57FF]! w-full"
              >
                Submit
              </Button>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default React.memo(Login);
