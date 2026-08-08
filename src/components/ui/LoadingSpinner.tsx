'use client';
import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export default function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  const sizes = { sm: 24, md: 40, lg: 64 };
  const s = sizes[size];

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.div
        style={{ width: s, height: s }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="rounded-full border-2 border-violet-500/30 border-t-violet-500"
      />
      {message && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-white/50"
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}
