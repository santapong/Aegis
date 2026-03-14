import { useToastStore } from "@/stores/toast-store";

export function useToast() {
  const addToast = useToastStore((s) => s.addToast);

  return {
    toast: {
      success: (message: string, description?: string) =>
        addToast({ type: "success", message, description }),
      error: (message: string, description?: string) =>
        addToast({ type: "error", message, description }),
      warning: (message: string, description?: string) =>
        addToast({ type: "warning", message, description }),
      info: (message: string, description?: string) =>
        addToast({ type: "info", message, description }),
    },
  };
}
