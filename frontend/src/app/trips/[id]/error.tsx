"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TripDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Trip detail route error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <motion.div
        className="text-center max-w-md mx-auto px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 mb-6"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 10, delay: 0.2 }}
        >
          <AlertTriangle size={32} className="text-destructive" />
        </motion.div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          Trip failed to load
        </h2>
        <p className="text-muted-foreground mb-8">
          {error.message || "An unexpected error occurred while loading this trip."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset} icon={<RefreshCw size={16} />}>
            Try again
          </Button>
          <Link href="/trips">
            <Button variant="outline" icon={<ArrowLeft size={16} />}>
              Back to trips
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" icon={<Home size={16} />}>
              Dashboard
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
