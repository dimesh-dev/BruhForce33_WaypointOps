"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

/* ------------------------------------------------------------------ toast */

interface Toast {
  message: string;
  tone: "success" | "error";
}
const ToastContext = createContext<
  (message: string, tone?: Toast["tone"]) => void
>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const show = useCallback(
    (message: string, tone: Toast["tone"] = "success") =>
      setToast({ message, tone }),
    [],
  );
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          className={`toast ${toast.tone === "error" ? "toast-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {toast.tone === "error" ? (
            <AlertTriangle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          {toast.message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

/* ----------------------------------------------------------------- dialog */

export function Dialog({
  title,
  eyebrow = "WAYPOINT · CONNECTED OPERATIONS",
  onClose,
  children,
  wide,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const box = ref.current;
    box
      ?.querySelector<HTMLElement>(
        "input,select,textarea,button:not(.dialog-close)",
      )
      ?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !box) return;
      const items = [
        ...box.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input,select,textarea,a[href]",
        ),
      ];
      const first = items[0];
      const last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={`modal ${wide ? "wide" : ""}`}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id="dialog-title">{title}</h2>
          </div>
          <button
            className="icon-btn dialog-close"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  );
}

/* --------------------------------------------------------------- bits */

export function Badge({
  kind,
  children,
}: {
  kind: string;
  children: ReactNode;
}) {
  return (
    <span className={`badge ${kind}`}>
      <i />
      {children}
    </span>
  );
}

export function Meter({
  label,
  value,
  max,
  unit,
  warnAt = 0.9,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  warnAt?: number;
}) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="capacity">
      <div>
        <span>{label}</span>
        <b>
          {Number(value.toFixed(1))} / {Number(max.toFixed(1))} {unit}
        </b>
      </div>
      <div
        className="capacity-track"
        role="meter"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      >
        <i
          style={{
            width: `${ratio * 100}%`,
            background: ratio > warnAt ? "#cd8b4c" : "#829475",
          }}
        />
      </div>
    </div>
  );
}

export function Empty({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function ErrorList({
  title,
  items,
}: {
  title: string;
  items: { rule?: string; message: string }[];
}) {
  return (
    <div className="inline-callout warning" role="alert">
      <AlertTriangle size={20} />
      <div>
        <b>{title}</b>
        <ul className="violation-list">
          {items.map((v, i) => (
            <li key={i}>
              {v.rule && <code>{v.rule}</code>} {v.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
