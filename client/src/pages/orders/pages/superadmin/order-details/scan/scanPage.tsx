import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function ScanPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();

    // Video qurilmalarni olish
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((videoInputDevices) => {
        if (videoInputDevices.length === 0)
          throw new Error("Video qurilma topilmadi");
        const deviceId = videoInputDevices[0].deviceId;

        // QR kodni skanerlash
        codeReader
          .decodeOnceFromVideoDevice(deviceId, "video")
          .then((result) => {
            const res = result.getText();
            const token = res.split("/").at(-1);
            navigate(`/scan/${token}`);
          })
          .catch((err) => console.error("QR Scan xatosi:", err));
      })
      .catch((err) => console.error("Video qurilma xatosi:", err));

    // Clean up: video oqimini to‘xtatish
    return () => {
      const video = document.querySelector<HTMLVideoElement>("video");
      if (video && video.srcObject instanceof MediaStream) {
        video.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [navigate]);

  return (
    <div>
      <h2>QR kodni skaner qiling:</h2>
      <video id="video" width="100%" />
    </div>
  );
}
