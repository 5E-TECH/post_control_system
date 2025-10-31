import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import QRCode from "qrcode";

function formatPhoneNumber(phone: string = ""): string {
    if (!phone) return "";
    const digits = phone.replace(/\D/g, "");
    const cleaned = digits.replace(/^998/, "");
    if (cleaned.length === 9)
        return cleaned.replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, "$1 $2 $3 $4");
    return cleaned;
}

export const exportCardsToExcel = async (data: any[], fileName: string) => {
    if (!Array.isArray(data) || data.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Buyurtmalar");

    const borderStyle = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
    } as const;

    // Har bir kartochka 3 ta ustundan foydalanadi (A–C va E–G)
    const cardWidth = 3;
    const cardHeight = 4;

    let currentRow = 1;

    for (let i = 0; i < data.length; i += 2) {
        // --- Chap kartochka (1-chi)
        const leftItem = data[i];
        const leftColOffset = 0;
        await addCard(worksheet, workbook, leftItem, i + 1, currentRow, leftColOffset, borderStyle);

        // --- O‘ng kartochka (2-chi) agar mavjud bo‘lsa
        if (data[i + 1]) {
            const rightItem = data[i + 1];
            const rightColOffset = 4; // D ustunidan keyin (ya'ni E–G)
            await addCard(worksheet, workbook, rightItem, i + 2, currentRow, rightColOffset, borderStyle);
        }

        // Har bir juft kartochkadan keyin bitta bo‘sh qator
        currentRow += cardHeight + 1;
    }

    // Alignment — ichkariga masofa
    worksheet.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell((cell) => {
            cell.alignment = {
                ...cell.alignment,
                horizontal: "left",
                vertical: "middle",
                indent: 1,
            };
        });
    });

    // --- Faylni saqlash
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `${fileName}.xlsx`);
};

// 🔧 Kartochka chizuvchi yordamchi funksiya
async function addCard(
    ws: ExcelJS.Worksheet,
    wb: ExcelJS.Workbook,
    item: any,
    index: number,
    startRow: number,
    colOffset: number,
    borderStyle: any
) {
    const qrValue = item["QR code"] || item.qrCode || item.qr_code_token || "";

    const c = (col: number) => col + colOffset; // ustun siljishi uchun

    // --- 1-satr: Raqam + Manzil
    ws.mergeCells(startRow, c(1), startRow, c(2));
    const cell1 = ws.getCell(startRow, c(1));
    cell1.value = `${index} | ${item.Tuman || item.manzil || ""}`;
    cell1.font = { bold: true };
    cell1.border = borderStyle;
    ws.getCell(startRow, c(3)).border = borderStyle;

    // --- 2-satr: Mijoz + Telefon
    ws.getCell(startRow + 1, c(1)).value = item.Mijoz || item.mijoz || "";
    ws.getCell(startRow + 1, c(2)).value = formatPhoneNumber(
        item["Telefon raqam"] || item.telefon || ""
    );
    ws.getCell(startRow + 1, c(1)).border = borderStyle;
    ws.getCell(startRow + 1, c(2)).border = borderStyle;
    ws.getCell(startRow + 1, c(3)).border = borderStyle;

    // --- 3-satr: Market + Narx
    ws.getCell(startRow + 2, c(1)).value = item.Firma || item.market || "";
    const priceCell = ws.getCell(startRow + 2, c(2));
    priceCell.value = `${(Number(item.Narxi || item.summa) || 0).toLocaleString("uz-UZ")}`;
    priceCell.alignment = { horizontal: "left", vertical: "middle" };
    ws.getCell(startRow + 2, c(1)).border = borderStyle;
    ws.getCell(startRow + 2, c(2)).border = borderStyle;
    ws.getCell(startRow + 2, c(3)).border = borderStyle;

    // --- 4-satr: Izoh
    ws.mergeCells(startRow + 3, c(1), startRow + 3, c(2));
    ws.getCell(startRow + 3, c(1)).value = item.Izoh || item.izoh || "";
    ws.getCell(startRow + 3, c(1)).border = borderStyle;
    ws.getCell(startRow + 3, c(3)).border = borderStyle;

    // --- QR (C ustunini 4 qatorga birlashtiramiz)
    ws.mergeCells(startRow, c(3), startRow + 3, c(3));

    // --- QR kod rasmi
    if (qrValue) {
        try {
            const qrDataUrl = await QRCode.toDataURL(qrValue.toString());
            const imageId = wb.addImage({
                base64: qrDataUrl,
                extension: "png",
            });

            ws.addImage(imageId, {
                tl: { col: c(2.1), row: startRow - 0.8 },
                ext: { width: 150, height: 150 },
            });
        } catch (err) {
            console.error("QR kod yaratishda xato:", err);
        }
    }

    // --- Ustun kengliklari
    ws.getColumn(c(1)).width = 24;
    ws.getColumn(c(2)).width = 15;
    ws.getColumn(c(3)).width = 19.5;

    // // --- Qator balandliklari
    // for (let r = 0; r < 4; r++) {
    //     ws.getRow(startRow + r).height = 35;
    // }

    ws.getRow(startRow).height = 20;
    ws.getRow(startRow + 1).height = 20;
    ws.getRow(startRow + 2).height = 20;
    ws.getRow(startRow + 3).height = 60;
}
