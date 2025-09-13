import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';

const barData = [
  { name: 'Balans', value: -15000 },
  { name: 'Kassa', value: 40000 },
];

const dokons = [
  { name: 'Market1', value: -13000 },
  { name: 'Yandex', value: -17000 },
  { name: 'Uzum', value: -7000 },
  { name: 'Asaxiy', value: -3000 },
];

const kurierlar = [
  { name: 'Andijon (Komil aka)', value: 30000 },
  { name: 'Buxoro (Rustam aka)', value: 5000 },
];

export default function FinanceUI() {
  return (
    <div className="w-full from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-1">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="w-full h-[810px] bg-white/80 dark:bg-[#312D4B] backdrop-blur-xl rounded-2xl shadow-2xl p-8 flex flex-col"
      >
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-800 dark:text-gray-100">
            Bugungi holat
          </h1>
          <p className="text-green-500 font-bold text-2xl tabular-nums">
            +25 000
          </p>
        </div>

        {/* 3 ustun */}
        <div className="grid grid-cols-3 gap-8 flex-1 h-full">
          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col items-center justify-center h-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                  formatter={(value: number) =>
                    `${value.toLocaleString()} so‘m`
                  }
                />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.value >= 0
                          ? 'url(#positiveGradient)'
                          : 'url(#negativeGradient)'
                      }
                    />
                  ))}
                </Bar>
                <defs>
                  <linearGradient
                    id="positiveGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#4ade80" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                  <linearGradient
                    id="negativeGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#f87171" />
                    <stop offset="100%" stopColor="#dc2626" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Do‘konlar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col h-full"
          >
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
              Do‘konlar
            </h3>
            <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <table className="w-full text-sm">
                <tbody>
                  {dokons.map((item, idx) => (
                    <tr
                      key={idx}
                      className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <td className="p-3 text-gray-700 dark:text-gray-300">
                        {item.name}
                      </td>
                      <td
                        className={`p-3 text-right tabular-nums ${
                          item.value < 0 ? 'text-red-500' : 'text-green-500'
                        }`}
                      >
                        {item.value.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t bg-gray-50 dark:bg-gray-800">
                    <td className="p-3">Total:</td>
                    <td className="p-3 text-right text-red-500">-75 000</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>

          {/* Kurierlar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="flex flex-col h-full"
          >
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-4">
              Kurierlar
            </h3>
            <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <table className="w-full text-sm">
                <tbody>
                  {kurierlar.map((item, idx) => (
                    <tr
                      key={idx}
                      className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                    >
                      <td className="p-3 text-gray-700 dark:text-gray-300">
                        {item.name}
                      </td>
                      <td
                        className={`p-3 text-right tabular-nums ${
                          item.value < 0 ? 'text-red-500' : 'text-green-500'
                        }`}
                      >
                        {item.value.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold border-t bg-gray-50 dark:bg-gray-800">
                    <td className="p-3">Total:</td>
                    <td className="p-3 text-right text-green-500">+60 000</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>
        </div>
        <div className="border-b border-r border-l border-[#a5a4a4] w-[1000px] flex justify-center items-center mr-[3px]   px-3 py-1 rounded-[9px] text-red-500 tabular-nums font-bold mx-auto">
          <span className="text-2xl">-15 000</span>
        </div>
      </motion.div>
    </div>
  );
}
