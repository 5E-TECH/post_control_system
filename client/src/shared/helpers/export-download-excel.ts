import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";

export const exportToExcel = (data: any[], fileName: string) => {
  if (!Array.isArray(data) || data.length === 0) {
    return;
  }

  const headerKeys = Object.keys(data[0]);

  // ✅ Narxni raqamga o‘girish
  const parseNumber = (value: any): number => {
    if (typeof value === "string") {
      return parseFloat(value.replace(/[^0-9.-]+/g, "")) || 0;
    }
    return typeof value === "number" ? value : 0;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString("en-US");
  };

  // ✅ Ustun nomlarini aniqlash
  const narxiKey =
    headerKeys.find((key) => key.toLowerCase().includes("narxi")) || "narxi";

  const telefonKey =
    headerKeys.find((key) => key.toLowerCase().includes("telefon")) ||
    "telefon";

  // ✅ Umumiy summani hisoblash
  const totalSum = data.reduce((sum, row) => {
    return sum + parseNumber(row[narxiKey]);
  }, 0);

  // ✅ Umumiy qatorni tayyorlash
  const totalRow: any = {};
  headerKeys.forEach((key) => {
    if (key === telefonKey) {
      totalRow[key] = "Umumiy";
    } else if (key === narxiKey) {
      totalRow[key] = formatNumber(totalSum);
    } else {
      totalRow[key] = "";
    }
  });

  // ✅ Umumiy qatorni qo‘shamiz
  const finalData = [...data, totalRow];

  // ✅ Sheet yasash
  const worksheet = XLSX.utils.json_to_sheet(finalData);

  // ✅ Ustun kengligini avtomatik belgilash
  const columnWidths = headerKeys.map((key) => {
    const maxLength = finalData.reduce((max, row) => {
      const cellValue = row[key] ? row[key].toString() : "";
      return Math.max(max, cellValue.length);
    }, key.length);

    // Agar bu ustun "Izoh" bo‘lsa — uni kengroq qilamiz
    if (key.toLowerCase().includes("izoh")) {
      return { wch: 30 }; // Izoh ustuni uchun kenglikni oshiramiz
    }

    return { wch: maxLength + 4 };
  });
  worksheet["!cols"] = columnWidths;

  // ✅ Header (thead) style
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
  const totalRowIndex = range.e.r; // Umumiy qator indeksi

  for (let row = 1; row <= range.e.r; row++) {
    for (let col = 0; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      const key = headerKeys[col];

      if (cell) {
        // ✅ Umumiy qatorning faqat 2 ta ustuniga style beriladi
        if (row === totalRowIndex && (key === telefonKey || key === narxiKey)) {
          cell.s = {
            fill: { fgColor: { rgb: "FFC000" } },
            font: { bold: true, sz: 13 },
            alignment: {
              vertical: "center",
              horizontal: key === telefonKey ? "left" : "right",
              indent: 1,
            },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } },
            },
          };
        } else {
          // ✅ Oddiy data row style
          cell.s = {
            font: { sz: 13 },
            alignment: {
              vertical: "center",
              horizontal: "left",
              indent: 1,
            },
          };
        }
      }
    }
  }

  // ✅ Qator balandliklari (padding effekti uchun)
  worksheet["!rows"] = [
    { hpt: 30 }, // Header
    ...Array(range.e.r).fill({ hpt: 20 }), // Har bir data row + umumiy
  ];

  // ✅ Workbook yaratish
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, `${fileName}.xlsx`);
};
