"use client";
import React from "react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import type { MetricProps, IconButtonProps, BadgeProps } from "@/lib/types";

export function IconButton({
  icon: Icon,
  label,
  onClick,
  ...props
}: IconButtonProps) {
  return (
    <button
      className="icon-btn"
      aria-label={label}
      title={label}
      onClick={onClick}
      {...props}
    >
      <Icon size={18} />
    </button>
  );
}

export function Badge({ children, kind }: BadgeProps) {
  return (
    <span
      className={`badge ${kind || String(children).toLowerCase().replaceAll(" ", "-")}`}
    >
      <i />
      {children}
    </span>
  );
}

export function Metric({
  title,
  value,
  suffix,
  icon: Icon,
  trend,
  color,
  bars,
  onClick,
}: MetricProps) {
  return (
    <section className={`metric ${color}`}>
      <div className="metric-top">
        <span>{title}</span>
        <Icon size={17} />
      </div>
      <div className="metric-middle">
        <span className="metric-value">
          {value}
          <small>{suffix}</small>
        </span>
        {bars ? (
          <div className="spark-bars" aria-hidden="true">
            {bars.map((n, i) => (
              <i style={{ height: n + "%", opacity: 0.3 + i * 0.07 }} key={i} />
            ))}
          </div>
        ) : (
          <span className="attention-count">
            <ArrowUpRight size={24} />
          </span>
        )}
      </div>
      {onClick ? (
        <button className="metric-note text-btn" onClick={onClick}>
          {trend}
          <ArrowRight size={13} />
        </button>
      ) : (
        <span className="metric-note">{trend}</span>
      )}
    </section>
  );
}

export function Capacity({ label, value }: { label: string; value: number }) {
  return (
    <div className="capacity">
      <div>
        <span>{label}</span>
        <b>{value}%</b>
      </div>
      <div className="capacity-track">
        <i
          style={{
            width: value + "%",
            background: value > 85 ? "#cd8b4c" : "#829475",
          }}
        />
      </div>
    </div>
  );
}
