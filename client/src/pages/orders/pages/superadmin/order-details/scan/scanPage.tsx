import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Scanner } from "@yudiel/react-qr-scanner";

export default function ScanPage() {
  const navigate = useNavigate();
  const [_, setData] = useState("");
  const [error, setError] = useState("");

  const handleScan = (result: any) => {
    if (result) {
      let scannedValue = "";

      if (Array.isArray(result) && result.length > 0) {
        scannedValue = result[0]?.rawValue || "";
      } else if (typeof result === "object" && result.rawValue) {
        scannedValue = result.rawValue;
      } else if (typeof result === "string") {
        scannedValue = result;
      }

      if (scannedValue) {
        setData(scannedValue);
        setError("");

        // 🔊 beep ovozi
        const audio = new Audio("/sound/beep.mp3");
        audio.play().catch((err) => console.error("Ovoz chiqmadi:", err));

        // tokenni ajratib olish
        const token = scannedValue.split("/").at(-1);

        // 🔀 sahifaga yo‘naltirish
        navigate(`/scan/${token}`);
      }
    }
  };

  const handleError = () => {
    setError("Kamera yuklanmadi yoki ruxsat berilmadi");
  };

  return (
    <div className="text-center">
      <h2 className="mb-3 font-semibold text-lg">QR kodni skaner qiling:</h2>

      <Scanner
        onScan={handleScan}
        onError={handleError}
        components={{
          finder: undefined,
          torch: undefined,
          tracker: undefined,
          onOff: undefined,
          zoom: undefined,
        }}
        sound={false}
        constraints={{
          facingMode: "environment",
        }}
        styles={{
          container: {
            width: "100%",
            height: "320px",
            borderRadius: "20px",
            overflow: "hidden",
          },
          video: {
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scale(1.5)",
            borderRadius: "20px",
          },
        }}
      />

      {error && (
        <p className="text-red-500 mt-2 text-sm font-medium">{error}</p>
      )}
    </div>
  );
}
