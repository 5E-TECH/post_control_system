import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BrowserMultiFormatReader } from "@zxing/browser";

export default function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();

    BrowserMultiFormatReader.listVideoInputDevices()
      .then((videoInputDevices) => {
        if (videoInputDevices.length === 0) {
          throw new Error("Video qurilma topilmadi");
        }

        let deviceId = videoInputDevices[0].deviceId;

        // 📷 orqa kamerani tanlash (agar bo‘lsa)
        const backCamera = videoInputDevices.find((d) =>
          d.label.toLowerCase().includes("back")
        );
        if (backCamera) deviceId = backCamera.deviceId;

        if (!videoRef.current) return;

        // ✅ faqat 1 marta scan qiladi va avtomatik stop bo‘ladi
        codeReader
          .decodeOnceFromVideoDevice(deviceId, videoRef.current)
          .then((result) => {
            const res = result.getText();
            const token = res.split("/").at(-1);

            // 🔊 beep ovoz
            const audio = new Audio(
              "../../../../../../../sound/beep.mp3"
            );
            audio.play().catch((err) => console.error("Ovoz chiqmadi:", err));

            // 🔀 keyingi bosqichga o‘tish
            navigate(`/scan/${token}`);
          })
          .catch((err) => console.error("QR Scan xatosi:", err));
      })
      .catch((err) => console.error("Video qurilma xatosi:", err));

    // ❌ Sahifadan chiqqanda kamerani to‘xtatish
    return () => {
      if (videoRef.current?.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop);
        videoRef.current.srcObject = null;
      }
    };
  }, [navigate]);

  return (
    <div>
      <h2>QR kodni skaner qiling:</h2>
      <video ref={videoRef} id="video" width="100%" />
    </div>
  );
}
