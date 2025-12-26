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
import { useTranslation } from "react-i18next";
import { buildAdminPath } from "../../shared/const/index";

message.config({
  maxCount: 5,
  duration: 3,
  top: 70,
});

const Login: FC = () => {
  const { t } = useTranslation("login");

  const validationSchema = yup.object().shape({
    // phone_number Formik state-da +998901234567 shaklida saqlanadi,
    // shu uchun regex bilan tekshirilyapti:
    phone_number: yup
      .string()
      .required(t("required.phone_number"))
      .matches(/^\+998\d{9}$/, t("invalid.phone_number")),
    password: yup
      .string()
      .required(t("required.password"))
      .min(4, t("invalid.password_length")),
  });

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
        navigate(buildAdminPath());
        setSubmitting(false);
      },
      onError: (err: any) => {
        const errorMsg = err?.response?.data?.error?.message;
        let errorDesc: any;

        switch (true) {
          case errorMsg === "Phone number or password incorrect":
            errorDesc = "Telefon raqam yoki parol noto'g'ri";
            break;
          case errorMsg === "You have been blocked by superadmin":
            errorDesc = "Siz superadmin tomonidan bloklangansiz";
            break;
          default:
            errorDesc = "Server nosozlik";
            break;
        }

        message.error(errorDesc);
        setSubmitting(false);
      },
    });
  };

  return (
    <>
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
        {!network.online ? (
          <div className="bg-red-500 text-white px-6 py-2 rounded-lg shadow-lg">
            {t("offline")}
          </div>
        ) : (
          showOnline && (
            <div className="bg-green-500 text-white px-6 py-2 rounded-lg shadow-lg">
              {t("online")}
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
            enableReinitialize={false}>
            {({ handleSubmit, isSubmitting }: FormikProps<ILogin>) => (
              <Form onSubmit={handleSubmit}>
                <div className="flex items-center justify-center gap-2 text-xl sm:text-2xl mb-6">
                  <img src={logo} alt="" className="h-8 sm:h-10" />
                  <strong className="bold">Beepost</strong>
                </div>

                <div className="mb-5 text-center">
                  <p className="text-lg sm:text-2xl">{t("welcome_message")}</p>
                </div>

                {/* Phone number */}
                {/* Phone number */}
                <div className="mb-4">
                  <Field name="phone_number">
                    {({ field, form }: any) => (
                      <Input
                        {...field}
                        size="large"
                        placeholder="+998 90 123 45 67"
                        value={(function () {
                          if (!field.value) return "+998 ";
                          let digits = field.value.replace(/\D/g, "");
                          if (digits.startsWith("998")) {
                            digits = digits.slice(3);
                          }

                          let formatted = "+998 ";
                          if (digits.length > 0) {
                            formatted += digits
                              .replace(
                                /(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/,
                                (_: any, a: any, b: any, c: any, d: any) =>
                                  [a, b, c, d].filter(Boolean).join(" ")
                              )
                              .trim();
                          }
                          return formatted;
                        })()}
                        onChange={(e) => {
                          let val = e.target.value.replace(/\D/g, ""); // faqat raqamlar
                          if (val.startsWith("998")) {
                            val = val.slice(3);
                          }
                          form.setFieldValue("phone_number", "+998" + val);
                        }}
                      />
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
                    placeholder={t("placeholder.password")}
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
                  className="bg-[#8C57FF]! w-full">
                  {t("button.submit")}
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
