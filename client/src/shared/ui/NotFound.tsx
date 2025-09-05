import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-[#8C57FF] via-purple-800 to-black text-white px-4">
      <motion.h1
        className="text-9xl font-extrabold tracking-widest drop-shadow-lg"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 80 }}
      >
        404
      </motion.h1>

      <motion.h2
        className="mt-6 text-2xl md:text-3xl font-semibold text-gray-200"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        Sahifa topilmadi
      </motion.h2>

      <motion.p
        className="mt-2 text-gray-300 text-center max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        Kechirasiz, siz qidirayotgan sahifa mavjud emas yoki o‘chirilgan.
      </motion.p>

      <motion.div
        className="mt-8"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <Link
          to="/"
          className="relative inline-block px-8 py-3 font-medium group"
        >
          <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-[#8C57FF] to-purple-600 rounded-xl blur-md opacity-70 group-hover:opacity-100 transition duration-300"></span>
          <span className="relative text-lg font-bold tracking-wide bg-black/70 rounded-xl px-6 py-3">
            Bosh sahifaga qaytish
          </span>
        </Link>
      </motion.div>
    </div>
  );
}
