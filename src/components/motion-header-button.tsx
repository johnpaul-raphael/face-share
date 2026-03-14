'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { PlusCircle } from 'lucide-react';

export function MotionHeaderButton({ href }: { href: string }) {
  return (
    <Link href={href}>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent/10 transition-colors"
      >
        <PlusCircle className="h-4 w-4" />
        Join Event
      </motion.button>
    </Link>
  );
}
