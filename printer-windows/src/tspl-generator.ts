import { PrintOrder } from './types';

/**
 * TSPL command generator
 * Server dagi koddan olingan - bir xil format
 */
export class TsplGenerator {
  /**
   * PrintOrder dan TSPL buyruq yaratish
   */
  static generate(order: PrintOrder): string {
    const {
      orderPrice,
      operator,
      customerName,
      customerPhone,
      extraNumber,
      qrCode,
      region,
      district,
      address,
      market,
      comment,
      created_time,
      whereDeliver,
      items,
    } = order;

    const maxLineLength = 40;
    const productLines: string[] = [];
    let currentLine = '';

    // Mahsulotlarni qatorlarga bo'lish
    for (const item of items) {
      const text = `${item.product}-${item.quantity}, `;
      if ((currentLine + text).length > maxLineLength) {
        productLines.push(currentLine.trim());
        currentLine = text;
      } else {
        currentLine += text;
      }
    }

    // Oxirgi qatorni qo'shish
    if (currentLine.trim()) {
      productLines.push(currentLine.trim());
    }

    // TSPL buyruqni yaratish
    let y = 320;
    const productTextLines = productLines
      .map((line, i) => {
        const prefix = i === 0 ? 'Mahsulot: ' : '           ';
        const result = `TEXT 20,${y},"3",0,1,1,"${prefix}${line}"`;
        y += 30;
        return result;
      })
      .join('\n');

    // Ism 20 belgidan uzun bo'lsa qisqartirish
    const displayName = customerName.length > 20
      ? `${customerName.slice(0, 19)}...`
      : customerName;

    const tspl = `
SIZE 100 mm,60 mm
GAP 2 mm,0 mm
CLS
TEXT 175,20,"4",0,1,1,"Beepost"
TEXT 350,20,"3",0,1,1,"(${created_time})"
TEXT 20,80,"4",0,1,1,"${displayName}"
TEXT 20,120,"4",0,1,1,"${customerPhone}"
TEXT 20,170,"3",0,1,1,"${extraNumber || ''}"
TEXT 20,190,"3",0,1,1,"-----------------------------"
TEXT 20,230,"3",0,1,1,"Narxi:"
TEXT 160,230,"3",0,1,1,"${orderPrice}"
TEXT 20,260,"3",0,1,1,"Tuman: ${region} ${district}"
TEXT 20,290,"3",0,1,1,"Manzil: ${address || '-'}"
${productTextLines}
TEXT 20,${y},"3",0,1,1,"Izoh: ${comment || '-'}"
TEXT 20,${y + 30},"2",0,1,1,"Jo'natuvchi: ${market} (${whereDeliver})"
TEXT 20,${y + 60},"2",0,1,1,"Mutaxasis: ${operator || '-'}"
QRCODE 560,50,L,8,A,0,"${qrCode}"
PRINT 1
`.trim();

    return tspl;
  }

  /**
   * Test label yaratish
   */
  static generateTestLabel(): string {
    return `
SIZE 100 mm,60 mm
GAP 2 mm,0 mm
CLS
TEXT 100,100,"4",0,1,1,"BEEPOST PRINTER"
TEXT 100,150,"3",0,1,1,"Test Label"
TEXT 100,200,"2",0,1,1,"${new Date().toLocaleString()}"
TEXT 100,250,"2",0,1,1,"Printer ishlayapti!"
PRINT 1
`.trim();
  }
}
