import { memo } from 'react';
import LogoSus from '../assets/profile-image/logo.svg';
import { motion } from 'framer-motion';

const Suspense = () => {
  return (
    <div className="w-full h-screen flex items-center justify-center bg-transparent">
      <motion.img
        src={LogoSus}
        alt="Loading Logo"
        className="w-40 h-40"
        initial={{ scale: 0.8, opacity: 0.7 }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
};

export default memo(Suspense);
