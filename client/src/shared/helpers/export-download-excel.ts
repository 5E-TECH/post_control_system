import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";

export const exportToExcel = (data: any[], fileName: string) => {
  if (!Array.isArray(data) || data.length === 0) {
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);

  // ✅ Ustun kengligini avtomatik belgilash
  const columnWidths = Object.keys(data[0]).map((key) => {
    const maxLength = data.reduce((max, row) => {
      const cellValue = row[key] ? row[key].toString() : "";
      return Math.max(max, cellValue.length);
    }, key.length);
    return { wch: maxLength + 4 };
  });
  worksheet["!cols"] = columnWidths;

  // ✅ Header (thead) style
  const headerKeys = Object.keys(data[0]);
  headerKeys.forEach((_, index) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: 0, c: index })];
    if (cell) {
      cell.s = {
        fill: { fgColor: { rgb: "FFC000" } },
        font: { bold: true, sz: 12 },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };
    }
  });

  // ✅ Data rows (tbody) style — shrift + padding + vertical center
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "");
  for (let row = 1; row <= range.e.r; row++) {
    for (let col = 0; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      if (cell) {
        cell.s = {
          ...(cell.s || {}),
          font: { sz: 13 },
          alignment: {
            vertical: "center",
            horizontal: "left",
            indent: 1, // ✅ Chapdan bo‘sh joy
          },
        };
      }
    }
  }

  // ✅ Qator balandliklari (padding effekti uchun)
  worksheet["!rows"] = [
    { hpt: 30 }, // Header qatori
    ...Array(range.e.r).fill({ hpt: 20 }), // ✅ Har bir data row
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, `${fileName}.xlsx`);
};
