"use client";
import Image from "next/image";
import React from "react";
import { useState } from "react";
import { Check, Download, Sparkles, BarChart3 } from "lucide-react";
import { Capacity } from "./ui-primitives";

export function Insights({ onExport }: { onExport: () => void }) {
  const [period, setPeriod] = useState("This week");
  const demandValues =
    period === "This week"
      ? [124, 88, 104, 148, 184, 158]
      : [142, 114, 126, 174, 196, 180];
  const volume = (day: number, brand: number) =>
    Math.round(demandValues[day] * [1, 0.66, 0.4][brand]);
  return (
    <>
      <div className="insight-toolbar">
        <div className="segmented">
          {["This week", "Next week"].map((p) => (
            <button
              className={period === p ? "active" : ""}
              key={p}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <span>Illustrative planning estimates · not a trained forecast</span>
      </div>
      <div className="insight-grid">
        <section className="panel chart-panel">
          <div className="panel-header">
            <div>
              <h2>Make space for demand.</h2>
              <p>Planned volume by brand · m³</p>
            </div>
            <BarChart3 size={22} />
          </div>
          <div className="bar-chart">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <div className="chart-day" key={d}>
                <div className="chart-columns">
                  {[0, 1, 2].map((b) => (
                    <div
                      key={b}
                      className={["fresh", "style", "tech"][b]}
                      tabIndex={0}
                      role="img"
                      aria-label={`${d}, ${["Fresh", "Style", "Tech"][b]}: ${volume(i, b)} cubic meters`}
                      style={{ height: `${(volume(i, b) / 220) * 100}%` }}
                    >
                      <span>{volume(i, b)} m³</span>
                    </div>
                  ))}
                </div>
                <span>{d}</span>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot green" />
              Fresh
            </span>
            <span>
              <i className="legend-dot orange" />
              Style
            </span>
            <span>
              <i className="legend-dot purple" />
              Tech
            </span>
          </div>
        </section>
        <section className="panel context-panel illustrated-context">
          <Image
            width={1536}
            height={1024}
            sizes="(max-width: 700px) 100vw, 800px"
            className="context-sketch"
            src="/images/island-network.png"
            alt=""
          />
          <span className="eyebrow">CAPACITY OUTLOOK</span>
          <h2>
            A little headroom.
            <br />A lot of confidence.
          </h2>
          <p className="muted">
            Friday demand is expected to peak. Check refrigerated capacity
            before confirming extra orders.
          </p>
          <Capacity
            label="Refrigerated capacity required"
            value={period === "This week" ? 88 : 96}
          />
          <Capacity
            label="Dry-box capacity required"
            value={period === "This week" ? 73 : 82}
          />
          <Capacity
            label="Van capacity required"
            value={period === "This week" ? 65 : 78}
          />
          <button className="btn secondary full" onClick={onExport}>
            <Download size={16} />
            Export current delivery data
          </button>
        </section>
      </div>
      <div className="info-note">
        <Sparkles size={20} />
        <p>
          These charts demonstrate a future capacity-planning experience. Model
          development and predictive accuracy belong to the Datathon phase and
          are outside this prototype.
        </p>
      </div>
    </>
  );
}
