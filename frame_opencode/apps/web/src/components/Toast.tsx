"use client";

import { useEffect, useState } from "react";
import { cls } from "@/lib/utils";

export type ToastKind = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  body?: string;
}

let toastSeq = 0;
const TOAST_EVENT = "frame:toast";

function emit(kind: ToastKind, title: string, body?: string) {
  window.dispatchEvent(
    new CustomEvent<ToastItem>(TOAST_EVENT, {
      detail: { id: ++toastSeq, kind, title, body },
    }),
  );
}

export const toast = {
  success: (title: string, body?: string) => emit("success", title, body),
  error: (title: string, body?: string) => emit("error", title, body),
  warning: (title: string, body?: string) => emit("warning", title, body),
  info: (title: string, body?: string) => emit("info", title, body),
};

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ToastItem>).detail;
      setItems((prev) => [...prev, detail]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== detail.id));
      }, 5200);
    };
    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <div className="toast-wrap" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={cls("toast", item.kind)} role="status">
          <button className="toast-close" onClick={() => dismiss(item.id)} aria-label="Dismiss">
            ×
          </button>
          <div className="toast-title">{item.title}</div>
          {item.body ? <div className="toast-body">{item.body}</div> : null}
        </div>
      ))}
    </div>
  );
}