import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import QRCode from "qrcode";

export const exportToExcel = async (
  data: any[],
  // fileName: string,
  header?: {
    qrCodeToken?: string;
    regionName?: string;
    courierName?: string;
    totalOrders?: number | string;
    date?: string;
  }
) => {
  if (!Array.isArray(data) || data.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hisobot", {
    pageSetup: { paperSize: 9, orientation: "portrait" },
  });

  const regionName = header?.regionName || "Viloyat nomi";
  const courierName = header?.courierName || "Kuryer ismi";
  const totalOrders = header?.totalOrders || data.length;
  const totalSum = data.reduce(
    (sum, row) => sum + (Number(row?.Narxi || 0) || 0),
    0
  );

  // === QR kod (125x125 px)
  if (header?.qrCodeToken) {
    const qrImageBase64 = await QRCode.toDataURL(`post_${header.qrCodeToken}`, {
      width: 125,
    });
    const qrImageId = workbook.addImage({
      base64: qrImageBase64,
      extension: "png",
    });

    sheet.addImage(qrImageId, {
      tl: { col: 1, row: 0 }, // B1
      ext: { width: 125, height: 125 },
    });

    sheet.mergeCells("B1:B3");
    sheet.getRow(1).height = 30;
    sheet.getRow(2).height = 30;
    sheet.getRow(3).height = 30;
  }

  // === Header ma’lumotlar
  sheet.getCell("H1").value = header?.date
    ? new Date(Number(header.date)).toLocaleString("uz-UZ")
    : "";
  sheet.getCell("H2").value = regionName;
  sheet.getCell("H3").value = courierName;

  // C–F ustunlarini merge qilamiz
  sheet.mergeCells("C2:D2");
  sheet.mergeCells("E2:F2");
  sheet.mergeCells("C3:D3");
  sheet.mergeCells("E3:F3");

  sheet.getCell("C2").value = "Buyurtmalar soni:";
  sheet.getCell("E2").value = `${totalOrders} ta`;

  sheet.getCell("C3").value = "Jami summa:";
  sheet.getCell("E3").value = totalSum.toLocaleString("en-US");

  // Header style
  sheet.getRows(1, 3)?.forEach((row) => {
    row.eachCell((cell) => {
      cell.font = { bold: true, size: 13 };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
    });
  });

  // Bo‘sh qator — header va jadval orasiga
  sheet.addRow([]);

  // === Jadval header
  const headerKeys = Object.keys(data[0]);
  const headerRow = sheet.addRow(headerKeys);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFC000" },
    };
    cell.font = { bold: true, size: 12 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // === Jadval ma’lumotlari
  data.forEach((row) => {
    const dataRow = sheet.addRow(Object.values(row));
    dataRow.eachCell((cell) => {
      cell.font = { size: 12 };
      cell.alignment = {
        vertical: "middle",
        horizontal: "left",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // === Umumiy qator
  // const totalRow = sheet.addRow([]);
  // totalRow.getCell(2).value = "Umumiy:";
  // totalRow.getCell(headerKeys.indexOf("Narxi") + 1).value = totalSum.toLocaleString("en-US");
  // totalRow.eachCell((cell) => {
  //     cell.font = { bold: true, size: 12 };
  //     cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC000" } };
  //     cell.border = {
  //         top: { style: "thin" },
  //         left: { style: "thin" },
  //         bottom: { style: "thin" },
  //         right: { style: "thin" },
  //     };
  // });

  // === Ustun kengliklari
  headerKeys.forEach((key, index) => {
    const maxLength = Math.max(
      key.length,
      ...data.map((row) => (row[key] ? row[key].toString().length : 0))
    );
    sheet.getColumn(index + 1).width = key.toLowerCase().includes("izoh")
      ? 35
      : Math.min(maxLength + 5, 25);
  });

  // === Faylni yaratish va yuklash
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
  });
  const fileRegionNames = regionName ? regionName : "";
  const fileCourierNames = courierName ? courierName : "";
  const d = new Date(Number(header?.date ?? 0));
  const formattedDate = `${d.getDate().toString().padStart(2, "0")}.${(
    d.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}.${d.getFullYear()}`;

  saveAs(
    blob,
    `${fileRegionNames}_${fileCourierNames}-${
      header?.date
        ? formattedDate
        : ""
    }.xlsx`
  );
};
