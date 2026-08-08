'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';

interface DraggablePanelProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export default function DraggablePanel({ id, children, className = '' }: DraggablePanelProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      animate={{ opacity: isDragging ? 0.7 : 1, scale: isDragging ? 1.02 : 1 }}
      transition={{ duration: 0.15 }}
      className={`relative ${className}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex gap-0.5 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
        title="Drag to reorder"
      >
        <div className="flex flex-col gap-0.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex gap-0.5">
              <div className="h-1 w-1 rounded-full bg-white/40" />
              <div className="h-1 w-1 rounded-full bg-white/40" />
            </div>
          ))}
        </div>
      </div>
      <div className="group h-full">
        {children}
      </div>
    </motion.div>
  );
}
