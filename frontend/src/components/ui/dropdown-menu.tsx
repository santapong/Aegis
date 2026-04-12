"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
}

interface DropdownMenuProps {
  items: DropdownItem[];
  className?: string;
}

export function DropdownMenu({ items, className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
      >
        <MoreVertical size={16} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 w-44 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-xl z-40 py-1"
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors rounded-md mx-1 w-[calc(100%-0.5rem)]",
                  item.variant === "danger"
                    ? "text-destructive hover:bg-destructive/10"
                    : "text-foreground hover:bg-accent"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
