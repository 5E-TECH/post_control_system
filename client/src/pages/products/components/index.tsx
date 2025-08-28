import { memo, useState } from "react";
import upload from "../../../shared/assets/product/upload.png";
import { Image } from "antd";

const AddProduct = () => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);

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

  return (
    <section>
      <div className="w-full  h-[478px] bg-white p-5 text-[#2E263DE5] flex gap-5 flex-col rounded-md dark:text-[#E7E3FCE5] dark:bg-[#312d4b]">
        <h2 className="text-[18px] font-medium opacity-[90%] select-none">Product information</h2>
        <div>
          <form action="">
            <input
              className="w-full border px-4 py-3 rounded-md"
              type="text"
              placeholder="Product Name"
            />
          </form>
        </div>
        <div className="flex justify-between mt-5">
          <h2 className="text-[18px] font-medium opacity-[90%] select-none">Product Image</h2>
          <h2 className="text-[15px] font-medium text-[#8C57FF] select-none">Add media from URL</h2>
        </div>

        {/* Upload Area */}
        <div
          className={`w-full h-full border border-dashed rounded-md border-gray-300 flex items-center justify-center flex-col gap-2 transition ${
            dragActive ? "bg-purple-50 border-[#8C57FF]" : ""
          }`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragLeave={handleDragLeave}
        >
          {!file ? (
            <>
              <div className="bg-[#F0EFF0] rounded-md p-2 dark:bg-[#3f3b59]">
                <img src={upload} alt="Upload" />
              </div>
              <h2 className="font-medium text-[24px] select-none">
                Drag and drop your image here
              </h2>
              <p className="text-[#2E263D66] select-none">or</p>
              <div className="relative">
                <button className="border border-[#8C57FF] text-[#8C57FF] px-[14px] py-[8px] rounded-md font-medium text-[13px]">
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
            <div className="flex flex-col items-center gap-2">
              <Image src={URL.createObjectURL(file)} className="max-h-[200px] object-contain"/>
              <p className="text-[14px] font-medium">{file.name}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default memo(AddProduct);
