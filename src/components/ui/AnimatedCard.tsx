'use client';
import { motion } from 'framer-motion';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number; // stagger delay in seconds
  id?: string;
}

export default function AnimatedCard({ children, className = '', delay = 0, id }: AnimatedCardProps) {
  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ scale: 1.005, transition: { duration: 0.2 } }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
