import { memo, useState } from "react";
import upload from "../../../shared/assets/product/upload.png";
import { Image } from "antd";
import { useProduct } from "../../../shared/api/hooks/useProduct";
import { X } from "lucide-react";
import { useLocation } from "react-router-dom";
import Popup from "../../../shared/ui/Popup";

const AddProduct = () => {
  const { createProduct } = useProduct();
  const [showMarket, setShowMarket] = useState(false);

  const location = useLocation();
  const market = location.state?.market;

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [productName, setProductName] = useState("");

  // 🔑 tashqaridan chaqiriladigan funksiya

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDiscard = () => {
    setFile(null);
    setProductName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName || !file) {
      // setShowMarket(true); // faqat state ni true qilamiz
      return;
    }

    if (!market) {
      // setShowMarket(true);
      return;
    }

    const formData = new FormData();
    formData.append("name", productName);
    formData.append("market_id", market.id);
    formData.append("image", file);

    try {
      await createProduct.mutate(formData);
      setProductName("");
      setFile(null);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section>
      <div className="w-full bg-white p-5 text-[#2E263DE5] flex gap-5 flex-col rounded-md dark:text-[#E7E3FCE5] dark:bg-[#312d4b]">
        <h2 className="text-[18px] font-medium opacity-[90%] select-none">
          Product information
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 h-full">
          <input
            className="w-full border px-4 py-3 rounded-md"
            type="text"
            placeholder="Product Name"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />

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
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragLeave={handleDragLeave}
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
                    className="absolute top-0 left-0 opacity-0 w-full h-full cursor-pointer"
                    onChange={handleFileChange}
                  />
                </div>
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
                  onClick={() => setFile(null)}
                >
                  <X className="w-[20px] h-[20px]" />
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4">
            <button
              onClick={() => setShowMarket(true)}
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
                  handleDiscard(); // Tozalash
                  setShowMarket(false); // Popupni yopish
                }}
              >
                Ha
              </button>
            </div>
          </div>
        </Popup>
      )}
    </section>
  );
};

export default memo(AddProduct);
