import { createContext, memo, useMemo, useState } from "react";
import upload from "../../../shared/assets/product/upload.png";
import { Image } from "antd";
import { useProduct } from "../../../shared/api/hooks/useProduct";
import { X } from "lucide-react";
import { useParams } from "react-router-dom";
import Popup from "../../../shared/ui/Popup";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import useNotification from "antd/es/notification/useNotification";

// ✅ Yup validation
const schema = yup.object().shape({
  name: yup.string().required("Mahsulot nomi majburiy!"),
  image: yup
    .mixed<FileList>()
    .required("Rasm yuklash majburiy!")
    .test("fileRequired", "Rasm tanlanmagan!", (value) => {
      const files = value as FileList;
      return files && files.length > 0;
    }),
});

interface FormValues {
  name: string;
  image: FileList;
}

const Context = createContext({ name: "Default" });

const AddProduct = () => {
  const { createProduct } = useProduct();
  const [showMarket, setShowMarket] = useState(false);

  // const location = useLocation();
  // const market = location.state?.market;

  const { id } = useParams();

  const [dragActive, setDragActive] = useState(false);

  // 🔑 react-hook-form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
  });

  const file = watch("image")?.[0] || null;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setValue("image", e.dataTransfer.files as any);
    }
  };

  const handleDiscard = () => {
    reset();
  };

  const [api, contextHolder] = useNotification();

  const onSubmit = async (values: FormValues) => {
    // if (!market) return

    const formData = new FormData();
    formData.append("name", values.name);
    formData.append("market_id", id ? id : "");
    formData.append("image", values.image[0]);

    try {
      createProduct.mutate(formData, {
        onSuccess: () => {
          api.success({
            message: "Muvaffaqiyatli!",
            description: "Mahsulot muvaffaqiyatli qo'shildi.",
            placement: "topRight",
          });
        },
        onError: () => {
          api.error({
            message: "Xatolik!",
            description: "Mahsulot qo'shishda muammo yuz berdi.",
            placement: "topRight",
          });
        },
      });
      reset();
    } catch (err) {
      console.error(err);
    }
  };

  const contextValue = useMemo(() => ({ name: "Ant Design" }), []);

  return (
    <Context.Provider value={contextValue}>
      {contextHolder}
      <section>
        <div className="w-full bg-white p-5 text-[#2E263DE5] flex gap-5 flex-col rounded-md dark:text-[#E7E3FCE5] dark:bg-[#312d4b]">
          <h2 className="text-[18px] font-medium opacity-[90%] select-none">
            Product information
          </h2>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-5 h-full"
          >
            {/* Name input */}
            <div>
              <input
                className="w-full border px-4 py-3 rounded-md"
                type="text"
                placeholder="Product Name"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Image input */}
            <div className="flex justify-between mt-2">
              <h2 className="text-[18px] font-medium opacity-[90%] select-none">
                Product Image
              </h2>
              <h2 className="text-[15px] font-medium text-[#8C57FF] select-none">
                Add media from URL
              </h2>
            </div>

            <div
              className={`w-full flex-1 border border-dashed rounded-md border-gray-300 flex items-center justify-center flex-col gap-2 transition ${
                dragActive ? "bg-purple-50 border-[#8C57FF]" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDrop={handleDrop}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
            >
              {!file ? (
                <>
                  <div className="bg-[#F0EFF0] rounded-md p-2 dark:bg-[#3f3b59] mt-[48px]">
                    <img src={upload} alt="Upload" />
                  </div>
                  <h2 className="font-medium text-[24px] select-none">
                    Drag and drop your image here
                  </h2>
                  <p className="text-[#2E263D66] select-none">or</p>
                  <div className="relative mb-[48px]">
                    <button
                      type="button"
                      className="border border-[#8C57FF] text-[#8C57FF] px-[14px] py-[8px] rounded-md font-medium text-[13px]"
                    >
                      Browse Image
                    </button>
                    <input
                      type="file"
                      {...register("image")}
                      className="absolute top-0 left-0 opacity-0 w-full h-full cursor-pointer"
                    />
                  </div>
                  {errors.image && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.image.message}
                    </p>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 relative">
                  <Image
                    src={URL.createObjectURL(file)}
                    className="max-h-[200px] object-contain"
                  />
                  <p className="text-[14px] font-medium">{file.name}</p>
                  <button
                    type="button"
                    className="absolute top-1 right-1 bg-red-500 rounded-full text-white"
                    onClick={() => reset({ image: undefined })}
                  >
                    <X className="w-[20px] h-[20px]" />
                  </button>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowMarket(true)}
                type="button"
                className="border px-4 py-2 rounded-md border-[#8A8D93] text-[#8A8D93] font-medium mt-4"
              >
                Discard
              </button>
              <button
                type="submit"
                className="bg-[#8C57FF] text-white px-4 py-2 rounded-md font-medium mt-4"
              >
                Save Product
              </button>
            </div>
          </form>
        </div>

        {showMarket && (
          <Popup isShow={showMarket} onClose={() => setShowMarket(false)}>
            <div className="p-4 bg bg-white">
              <p className="mb-4">Haqiqatan ham formani tozalamoqchimisiz?</p>
              <div className="flex justify-end gap-2">
                <button
                  className="px-4 py-2 bg-gray-300 rounded"
                  onClick={() => setShowMarket(false)}
                >
                  Yo‘q
                </button>
                <button
                  className="px-4 py-2 bg-red-500 text-white rounded"
                  onClick={() => {
                    handleDiscard();
                    setShowMarket(false);
                  }}
                >
                  Ha
                </button>
              </div>
            </div>
          </Popup>
        )}
      </section>
    </Context.Provider>
  );
};

export default memo(AddProduct);
