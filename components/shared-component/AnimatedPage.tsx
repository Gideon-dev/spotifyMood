'use client';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

export function AnimatedPage({ children,styling }: { children: ReactNode , styling?: string}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5 }}
      className={`${styling}`}
    >
      {children}
    </motion.div>
  );
}
