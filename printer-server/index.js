// server-printer/index.js
import express from "express";
import fs from "fs";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🖨️ Printer device path (Linux uchun)
const PRINTER_PATH = "/dev/usb/lp0";

// ✅ Test route
app.get("/", (req, res) => {
  res.send("🖨️ Printer server ishlayapti!");
});

// 🔥 Asosiy route: printerdan chop etish
app.post("/printer/raw", async (req, res) => {
  try {
    const { tspl } = req.body;

    if (!tspl) {
      return res.status(400).json({ success: false, message: "tspl kerak" });
    }

    if (!fs.existsSync(PRINTER_PATH)) {
      return res
        .status(404)
        .json({ success: false, message: "Printer topilmadi (/dev/usb/lp0)" });
    }

    // TSPL ma'lumotni printerga yozamiz
    fs.writeFileSync(PRINTER_PATH, Buffer.from(tspl, "utf8"));
    console.log("✅ Print yuborildi!");
    res.json({ success: true, message: "Print yuborildi" });
  } catch (error) {
    console.error("❌ Print xatosi:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🖨️ Printer server ${PORT}-portda ishlayapti`);
});
