import { Button, Input, message } from "antd";
import React, { useEffect, useState, type FC } from "react";

import logo from "../../shared/assets/login/logo.svg";
import left from "../../shared/assets/login/Frame 1.svg";
import right from "../../shared/assets/login/Tree.svg";
import line from "../../shared/assets/login/Mask.svg";

import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setToken } from "../../shared/lib/features/login/authSlice";
import type { ILogin } from "../../shared/types/typesLogin";
import { useLogin } from "../../shared/api/hooks/useLogin";

import { Formik, Form, Field, ErrorMessage, type FormikProps } from "formik";
import * as yup from "yup";

import { useNetworkState, usePrevious } from "@uidotdev/usehooks";
import InputMask from "react-input-mask";

message.config({
  maxCount: 5,
  duration: 3,
  top: 70,
});

const validationSchema = yup.object().shape({
  // phone_number Formik state-da +998901234567 shaklida saqlanadi,
  // shu uchun regex bilan tekshirilyapti:
  phone_number: yup
    .string()
    .required("Iltimos telefon raqamni kiriting!")
    .matches(/^\+998\d{9}$/, "Iltimos telefon raqamni to'g'ri kiriting!"),
  password: yup
    .string()
    .required("Please input your password!")
    .min(4, "Parol kamida 4 ta belgidan iborat bo‘lishi kerak!"),
});

const Login: FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { signinUser } = useLogin();

  const [showOnline, setShowOnline] = useState(false);

  const network = useNetworkState();
  const prevOnline = usePrevious(network.online);

  useEffect(() => {
    // faqat offline bo'lganidan keyin online bo'lsa ko'rsat
    if (prevOnline === false && network.online === true) {
      setShowOnline(true);
      const timer = setTimeout(() => {
        setShowOnline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [network.online, prevOnline]);

  // Default qiymatni +998 bilan boshlash foydalanuvchiga qulay:
  const initialValues: ILogin = {
    phone_number: "+998", // UI-da mask bilan ko'rinadi
    password: "",
  };

  const onFinish = (values: ILogin, { setSubmitting }: any) => {
    // values.phone_number shu yerda +998901234567 formatida bo'lishi kerak
    signinUser.mutate(values, {
      onSuccess: (res) => {
        dispatch(setToken(res?.data?.data));
        navigate("/");
        setSubmitting(false);
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
    <>
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
        {!network.online ? (
          <div className="bg-red-500 text-white px-6 py-2 rounded-lg shadow-lg">
            Internet aloqasi mavjud emas !!!
          </div>
        ) : (
          showOnline && (
            <div className="bg-green-500 text-white px-6 py-2 rounded-lg shadow-lg">
              Siz internetga ulandingiz ✅
            </div>
          )
        )}
      </div>

      <div className="flex items-center justify-center min-h-[100vh] bg-gray-100 relative px-4 sm:px-10">
        <div className="absolute bottom-0 left-0 w-full">
          <img
            src={line}
            alt="line"
            className="w-full absolute bottom-0 left-0"
          />
          <div className="w-full flex justify-between items-center h-[30vh] px-6">
            <img src={left} alt="Left plant" className=" w-[200px]" />

            <img src={right} alt="Right plant" className=" w-[80px]" />
          </div>
        </div>

        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-2xl w-[460px] max-w-full mx-4">
          <Formik
            initialValues={initialValues}
            validationSchema={validationSchema}
            onSubmit={onFinish}
            enableReinitialize={false}
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
                {/* Phone number */}
                <div className="mb-4">
                  <Field name="phone_number">
                    {({ field, form }: any) => (
                      <InputMask
                        {...field}
                        mask="+\9\9\8 99 999 99 99"
                        maskChar={null}
                        value={field.value.replace(
                          /^(\+998)(\d{2})(\d{3})(\d{2})(\d{2})$/,
                          "+998 $2 $3 $4 $5"
                        )}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "");
                          const formatted = `+${digitsOnly}`;
                          form.setFieldValue("phone_number", formatted);
                        }}
                      >
                        {(inputProps: any) => (
                          <Input
                            {...inputProps}
                            size="large"
                            placeholder="+998 90 123 45 67"
                          />
                        )}
                      </InputMask>
                    )}
                  </Field>

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
    </>
  );
};

export default React.memo(Login);
