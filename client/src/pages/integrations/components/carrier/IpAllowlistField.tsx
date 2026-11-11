import { Form, Input } from "antd";
import { CARRIER_IP_ENTRY_MAX_LENGTH } from "../../../../shared/api/hooks/useCarrierAccounts";
import { parseIpLines } from "./carrierLib";

const ipExtra = (max: number) =>
  `Har qatorda bitta: IPv4 (203.0.113.10), IPv4 diapazon (203.0.113.0/24) yoki IPv6 manzil (2001:db8::1). IPv6 diapazon qabul qilinmaydi. Ko'pi bilan ${max} ta; bo'sh — cheklov yo'q.`;

/** Shundan ko'p qatorda textarea o'smaydi — aylantirish chizig'i chiqadi. */
const MAX_VISIBLE_ROWS = 12;

interface Props {
  name: string;
  max: number;
  /** Eng kam ko'rinadigan qator; yozuvlar ko'paysa maydon o'sadi. */
  rows: number;
  /** Yaratishda «(ixtiyoriy)» yorlig'i. */
  optional?: boolean;
  placeholder?: string;
  /** Tahrirlashda: bo'shatish cheklovni olib tashlashini aytadi. */
  clearHint?: boolean;
}

/**
 * IP cheklovi — bir qatorda bitta yozuv.
 *
 * ⚠️ Bu yerda faqat SHAKL chegaralari (yozuvlar soni, uzunligi) — server
 * DTO bilan bir xil. Yozuvning MA'NOSI (kanonik IP, host bitli CIDR, IPv6
 * diapazon) serverda tekshiriladi va 400 matni toast'da aynan chiqadi:
 * ikki xil tekshiruvchi bir-biridan farq qilib qolmasin.
 *
 * Bitta `Form.Item` (name + label + extra): antd yorliqni (`htmlFor`), xato
 * (`<id>_help`) va izohni (`<id>_extra`) textarea'ga `aria-describedby`
 * bilan o'zi bog'laydi — ekran o'quvchi format qoidasini ham, xatoni ham
 * eshitadi. Chegaradan oshganda xato matni yozish paytida chiqadi
 * (`validateTrigger: onChange`), hisoblagich rangi faqat qo'shimcha belgi.
 *
 * `autoSize` — server rad etgan yozuv (toast'da nomi bilan) ko'rinib tursin.
 * Bu yerdagi qiymat sir emas; kalit maydoni esa `autoSize` siz
 * (CarrierKeyOnceModal).
 */
export const IpAllowlistField = ({
  name,
  max,
  rows,
  optional,
  placeholder,
  clearHint,
}: Props) => {
  const form = Form.useFormInstance();
  const value = Form.useWatch(name, form) as string | undefined;
  const count = parseIpLines(value).length;

  return (
    <Form.Item
      name={name}
      label={
        <span>
          IP cheklovi
          {optional && (
            <span className="ms-1 text-gray-500 dark:text-gray-400">(ixtiyoriy)</span>
          )}
        </span>
      }
      className="!mb-4"
      extra={
        <>
          <div className={`flex justify-end ${count > max ? "text-red-500" : ""}`}>
            {count} / {max}
          </div>
          <div>
            {ipExtra(max)}
            {clearHint && " Hammasini o'chirsangiz — cheklov olib tashlanadi."}
          </div>
        </>
      }
      rules={[
        {
          validator: (_, v: string | undefined) => {
            const lines = parseIpLines(v);
            if (lines.length > max) {
              return Promise.reject(new Error(`Ko'pi bilan ${max} ta yozuv`));
            }
            const long = lines.find((l) => l.length > CARRIER_IP_ENTRY_MAX_LENGTH);
            if (long) {
              return Promise.reject(
                new Error(
                  `Yozuv ${CARRIER_IP_ENTRY_MAX_LENGTH} belgidan oshmasin: ${long.slice(0, 24)}…`,
                ),
              );
            }
            return Promise.resolve();
          },
        },
      ]}
    >
      <Input.TextArea
        autoSize={{ minRows: rows, maxRows: MAX_VISIBLE_ROWS }}
        style={{ resize: "none" }}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
    </Form.Item>
  );
};

export default IpAllowlistField;
