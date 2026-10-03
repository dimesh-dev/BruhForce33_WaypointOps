"use client";
/*
 * Custom form controls in the Waypoint visual system: Select (listbox),
 * NumberField (stepper), DatePicker (calendar) and PhotoPicker. They replace
 * the browser defaults so every screen looks the same on every device, and
 * keep full keyboard and screen-reader support.
 */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";

/* ----------------------------------------------------------- positioning */

interface Anchor {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  above: boolean;
}

/** Fixed-position popover below (or above) a trigger, kept on screen while scrolling. */
function useAnchor(
  open: boolean,
  trigger: React.RefObject<HTMLElement | null>,
  minWidth = 0,
  preferred = 320,
) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const place = useCallback(() => {
    const el = trigger.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const aboveSpace = r.top - 12;
    const above = below < Math.min(preferred, 220) && aboveSpace > below;
    const width = Math.max(r.width, minWidth);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setAnchor({
      top: above ? r.top - 6 : r.bottom + 6,
      left,
      width,
      maxHeight: Math.max(160, Math.min(preferred, above ? aboveSpace : below)),
      above,
    });
  }, [trigger, minWidth, preferred]);
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);
  return anchor;
}

function useDismiss(
  open: boolean,
  close: () => void,
  refs: React.RefObject<HTMLElement | null>[],
) {
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return;
      close();
    };
    document.addEventListener("pointerdown", down, true);
    return () => document.removeEventListener("pointerdown", down, true);
  }, [open, close, refs]);
}

function Popover({
  anchor,
  children,
  className = "",
}: {
  anchor: Anchor | null;
  children: ReactNode;
  className?: string;
}) {
  if (!anchor || typeof document === "undefined") return null;
  return createPortal(
    <div
      className={`wp-popover ${anchor.above ? "above" : ""} ${className}`}
      style={{
        top: anchor.above ? undefined : anchor.top,
        bottom: anchor.above ? window.innerHeight - anchor.top : undefined,
        left: anchor.left,
        minWidth: anchor.width,
        maxHeight: anchor.maxHeight,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------------- Select */

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
  warning?: string;
  disabled?: boolean;
}

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  label,
  ariaLabel,
  placeholder = "Choose…",
  compact,
  className = "",
}: {
  value: T | "";
  onChange: (value: T) => void;
  options: (SelectOption<T> | T)[];
  label?: ReactNode;
  ariaLabel?: string;
  placeholder?: string;
  /** Toolbar size, for filters. */
  compact?: boolean;
  className?: string;
}) {
  const opts = useMemo(
    () =>
      options.map((o) =>
        typeof o === "string" ? { value: o, label: o } : o,
      ) as SelectOption<T>[],
    [options],
  );
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const anchor = useAnchor(open, trigger, compact ? 180 : 0);
  const selected = opts.find((o) => o.value === value);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [
    trigger,
    list as React.RefObject<HTMLElement | null>,
  ]);

  const openList = () => {
    const i = opts.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : opts.findIndex((o) => !o.disabled));
    setOpen(true);
  };
  useEffect(() => {
    if (open) list.current?.focus({ preventScroll: true });
  }, [open, anchor]);
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (i: number) => {
    const o = opts[i];
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
    trigger.current?.focus();
  };
  const move = (from: number, step: number) => {
    let i = from;
    for (let n = 0; n < opts.length; n++) {
      i = (i + step + opts.length) % opts.length;
      if (!opts[i].disabled) return i;
    }
    return from;
  };
  const onListKey = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // keep Escape/Tab from reaching the dialog
    if (e.key === "ArrowDown")
      (e.preventDefault(), setActive((a) => move(a, 1)));
    else if (e.key === "ArrowUp")
      (e.preventDefault(), setActive((a) => move(a, -1)));
    else if (e.key === "Home") (e.preventDefault(), setActive(move(-1, 1)));
    else if (e.key === "End")
      (e.preventDefault(), setActive(move(opts.length, -1)));
    else if (e.key === "Enter" || e.key === " ")
      (e.preventDefault(), choose(active));
    else if (e.key === "Escape")
      (e.preventDefault(), setOpen(false), trigger.current?.focus());
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      const now = Date.now();
      typed.current = {
        text:
          (now - typed.current.at < 600 ? typed.current.text : "") +
          e.key.toLowerCase(),
        at: now,
      };
      const i = opts.findIndex(
        (o) =>
          !o.disabled && o.label.toLowerCase().startsWith(typed.current.text),
      );
      if (i >= 0) setActive(i);
    }
  };

  const button = (
    <button
      ref={trigger}
      type="button"
      id={`${id}-trigger`}
      className={`wp-select ${compact ? "compact" : ""} ${open ? "open" : ""} ${className}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? `${id}-list` : undefined}
      aria-label={ariaLabel}
      aria-labelledby={
        !ariaLabel && label ? `${id}-label ${id}-trigger` : undefined
      }
      onClick={() => (open ? setOpen(false) : openList())}
      onKeyDown={(e) => {
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
          e.preventDefault();
          openList();
        }
      }}
    >
      <span className={`wp-select-value ${selected ? "" : "placeholder"}`}>
        {selected ? selected.label : placeholder}
        {selected?.warning && (
          <AlertTriangle size={13} className="warn-icon" aria-hidden="true" />
        )}
      </span>
      <ChevronDown size={15} className="chev" aria-hidden="true" />
    </button>
  );

  return (
    <>
      {label ? (
        <div className="field wp-field">
          <span id={`${id}-label`} className="wp-label">
            {label}
          </span>
          {button}
        </div>
      ) : (
        button
      )}
      {open && (
        <Popover anchor={anchor}>
          <ul
            ref={list}
            id={`${id}-list`}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={label ? `${id}-label` : undefined}
            aria-label={ariaLabel}
            aria-activedescendant={`${id}-opt-${active}`}
            className="wp-listbox"
            onKeyDown={onListKey}
          >
            {opts.map((o, i) => (
              <li
                key={o.value || `empty-${i}`}
                id={`${id}-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                className={`${i === active ? "active" : ""} ${o.value === value ? "selected" : ""} ${o.disabled ? "disabled" : ""}`}
                onPointerMove={() => !o.disabled && setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="opt-text">
                  <span>{o.label}</span>
                  {o.hint && <small>{o.hint}</small>}
                  {o.warning && (
                    <small className="opt-warning">
                      <AlertTriangle size={11} aria-hidden="true" /> {o.warning}
                    </small>
                  )}
                </span>
                {o.value === value && (
                  <Check size={15} className="opt-check" aria-hidden="true" />
                )}
              </li>
            ))}
          </ul>
        </Popover>
      )}
    </>
  );
}

/* ----------------------------------------------------------- NumberField */

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  decimals = 0,
  suffix,
  required,
}: {
  label: ReactNode;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  suffix?: string;
  required?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const clamp = (n: number) =>
    Number(Math.min(max, Math.max(min, n)).toFixed(decimals));
  const bump = (d: number) => {
    const next = clamp((Number.isFinite(value) ? value : min) + d);
    setText(String(next));
    onChange(next);
  };
  return (
    <div className="field wp-field">
      <label htmlFor={id} className="wp-label">
        {label}
      </label>
      <div className="wp-stepper">
        <button
          type="button"
          aria-label="Decrease"
          onClick={() => bump(-step)}
          disabled={value <= min}
        >
          <Minus size={15} />
        </button>
        <span className="wp-stepper-input">
          <input
            id={id}
            inputMode={decimals ? "decimal" : "numeric"}
            value={text}
            required={required}
            aria-valuemin={min}
            aria-valuemax={max === Number.MAX_SAFE_INTEGER ? undefined : max}
            role="spinbutton"
            aria-valuenow={value}
            onChange={(e) => {
              const raw = e.target.value.replace(
                decimals ? /[^0-9.]/g : /[^0-9]/g,
                "",
              );
              setText(raw);
              const n = Number(raw);
              if (raw !== "" && Number.isFinite(n)) onChange(n);
            }}
            onBlur={() => {
              const n = clamp(Number(text) || min);
              setText(String(n));
              onChange(n);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") (e.preventDefault(), bump(step));
              if (e.key === "ArrowDown") (e.preventDefault(), bump(-step));
            }}
          />
          {suffix && <span className="wp-suffix">{suffix}</span>}
        </span>
        <button
          type="button"
          aria-label="Increase"
          onClick={() => bump(step)}
          disabled={value >= max}
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ DatePicker */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fromIso = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => {
  const d = fromIso(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

export function DatePicker({
  value,
  onChange,
  ariaLabel = "Date",
  today,
  note,
}: {
  value: string;
  onChange: (iso: string) => void;
  ariaLabel?: string;
  /** Marks a reference day (e.g. the scenario's current date). */
  today?: string;
  /** Optional per-day annotation, e.g. "No deliveries" on Sundays. */
  note?: (iso: string) => string | undefined;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(value.slice(0, 7));
  const [focus, setFocus] = useState(value);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const anchor = useAnchor(open, trigger, 300, 380);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, [trigger, panel]);

  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector<HTMLElement>(`[data-day="${focus}"]`)
        ?.focus({ preventScroll: true });
  }, [open, focus, anchor]);

  const days = useMemo(() => {
    const first = fromIso(`${month}-01`);
    const offset = (first.getUTCDay() + 6) % 7;
    const start = addDays(`${month}-01`, -offset);
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);
  const label = fromIso(value).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const monthLabel = fromIso(`${month}-01`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const shiftMonth = (n: number) => {
    const d = fromIso(`${month}-01`);
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(iso(d).slice(0, 7));
  };
  const go = (d: string) => {
    setFocus(d);
    setMonth(d.slice(0, 7));
  };
  const pick = (d: string) => {
    onChange(d);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`wp-select wp-date ${open ? "open" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${label}`}
        onClick={() => {
          if (!open) {
            setMonth(value.slice(0, 7));
            setFocus(value);
          }
          setOpen(!open);
        }}
      >
        <CalendarDays size={15} aria-hidden="true" />
        <span className="wp-select-value">{label}</span>
        <ChevronDown size={15} className="chev" aria-hidden="true" />
      </button>
      {open && (
        <Popover anchor={anchor} className="wp-calendar-pop">
          <div
            ref={panel}
            role="dialog"
            aria-label={ariaLabel}
            className="wp-calendar"
            onKeyDown={(e) => {
              e.stopPropagation();
              const moves: Record<string, number> = {
                ArrowLeft: -1,
                ArrowRight: 1,
                ArrowUp: -7,
                ArrowDown: 7,
              };
              if (moves[e.key])
                (e.preventDefault(), go(addDays(focus, moves[e.key])));
              else if (e.key === "PageUp")
                (e.preventDefault(), go(addDays(focus, -30)));
              else if (e.key === "PageDown")
                (e.preventDefault(), go(addDays(focus, 30)));
              else if (e.key === "Escape")
                (e.preventDefault(), setOpen(false), trigger.current?.focus());
            }}
          >
            <div className="wp-cal-head">
              <button
                type="button"
                className="icon-btn"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft size={16} />
              </button>
              <b id={`${id}-month`} aria-live="polite">
                {monthLabel}
              </b>
              <button
                type="button"
                className="icon-btn"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <div
              className="wp-cal-grid"
              role="grid"
              aria-labelledby={`${id}-month`}
            >
              {WEEKDAYS.map((w) => (
                <span key={w} className="wp-cal-dow" role="columnheader">
                  {w}
                </span>
              ))}
              {days.map((d) => {
                const outside = d.slice(0, 7) !== month;
                const hint = note?.(d);
                return (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    data-day={d}
                    tabIndex={d === focus ? 0 : -1}
                    aria-selected={d === value}
                    aria-label={`${fromIso(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}${hint ? `, ${hint}` : ""}`}
                    title={hint}
                    className={`wp-cal-day ${outside ? "outside" : ""} ${d === value ? "selected" : ""} ${d === today ? "today" : ""} ${hint ? "muted-day" : ""}`}
                    onClick={() => pick(d)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        (e.preventDefault(), pick(d));
                    }}
                  >
                    {Number(d.slice(8))}
                  </button>
                );
              })}
            </div>
            {today && (
              <button
                type="button"
                className="text-btn wp-cal-today"
                onClick={() => pick(today)}
              >
                Go to the current run
              </button>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}

/* ----------------------------------------------------------- PhotoPicker */

export function PhotoPicker({
  label,
  value,
  onFile,
  onClear,
}: {
  label: ReactNode;
  value: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  return (
    <div className="field wp-field">
      <span id={`${id}-label`} className="wp-label">
        {label}
      </span>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="wp-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Delivery photo preview" />
          <div className="wp-photo-actions">
            <button
              type="button"
              className="btn secondary small-btn"
              onClick={() => input.current?.click()}
            >
              <RefreshCw size={14} /> Retake
            </button>
            <button
              type="button"
              className="btn secondary small-btn"
              onClick={onClear}
            >
              <X size={14} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="wp-dropzone"
          aria-labelledby={`${id}-label`}
          onClick={() => input.current?.click()}
        >
          <Camera size={22} aria-hidden="true" />
          <b>Take or choose a photo</b>
          <small>Stored on this phone until it syncs</small>
        </button>
      )}
    </div>
  );
}
