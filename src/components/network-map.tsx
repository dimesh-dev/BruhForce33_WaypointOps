"use client";
import React from "react";
import { useState } from "react";
import { Minus, Navigation, Plus, Layers } from "lucide-react";
import { routes } from "@/lib/demo-data";
import { IconButton } from "./ui-primitives";

export function NetworkMap({
  selected,
  onSelect,
  depot = "All depots",
  large = false,
}: {
  selected: number;
  onSelect: (index: number) => void;
  depot?: string;
  large?: boolean;
}) {
  const [zoom, setZoom] = useState(1),
    [traffic, setTraffic] = useState(false);
  return (
    <div className={`network-map ${large ? "large" : ""}`}>
      <svg
        className="map-svg"
        viewBox="0 0 720 430"
        role="group"
        aria-label="Illustrative delivery route map of western Sri Lanka and the Kandy corridor"
      >
        <defs>
          <pattern
            id="mapgrid"
            width="34"
            height="34"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 34 0 L 0 0 0 34"
              fill="none"
              stroke="#deded3"
              strokeWidth=".5"
            />
          </pattern>
          <filter id="marker-shadow">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity=".15" />
          </filter>
        </defs>
        <rect width="720" height="430" fill="#f0f0e8" />
        <g
          transform={`translate(${360 - 360 * zoom} ${215 - 215 * zoom}) scale(${zoom})`}
        >
          <path
            d="M0 0 H148 L128 55 156 98 139 146 160 190 143 235 162 279 158 332 176 374 166 430 H0Z"
            fill="#d7e4e2"
          />
          <path
            d="M148 0 L128 55 156 98 139 146 160 190 143 235 162 279 158 332 176 374 166 430"
            fill="none"
            stroke="#b9d1cd"
            strokeWidth="2"
          />
          <path
            d="M420 0 Q410 65 474 85 T544 168 T649 217 L720 202 V0Z M578 325 Q627 272 720 319 V430 H622Z M291 0 Q272 57 321 91 T340 190 L394 164 403 59 381 0Z"
            fill="#dfe6d5"
            opacity=".8"
          />
          <rect
            x="165"
            width="555"
            height="430"
            fill="url(#mapgrid)"
            opacity=".7"
          />
          {[
            "M150 18 C234 90 167 170 224 233 S252 363 287 430",
            "M165 251 C275 183 320 221 395 162 S494 123 572 152 651 198 720 155",
            "M161 306 C281 323 369 280 437 299 S590 364 720 335",
            "M203 0 C272 106 303 148 355 230 S436 355 431 430",
            "M372 0 C361 96 446 149 473 229 S555 336 595 430",
            "M169 141 Q314 101 405 114 T650 37",
            "M185 365 Q310 381 335 430",
          ].map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke="#deded1" strokeWidth="8" />
              <path d={d} fill="none" stroke="#fffdf5" strokeWidth="5" />
            </g>
          ))}
          <g fill="#b2bba3" opacity=".6">
            {[
              [390, 73],
              [429, 97],
              [599, 78],
              [623, 112],
              [650, 251],
              [456, 372],
              [372, 343],
              [299, 53],
              [610, 384],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={12 + (i % 3) * 6} />
            ))}
          </g>
          <g className="map-city">
            <text x="178" y="91">
              NEGOMBO
            </text>
            <text x="244" y="177">
              GAMPAHA
            </text>
            <text x="182" y="280">
              COLOMBO
            </text>
            <text x="285" y="400">
              PANADURA
            </text>
            <text x="526" y="116">
              KANDY
            </text>
            <text x="414" y="212">
              KEGALLE
            </text>
            <text x="531" y="353">
              RATNAPURA
            </text>
            <text
              className="ocean-label"
              transform="translate(67 251) rotate(-90)"
            >
              INDIAN OCEAN
            </text>
          </g>
          {traffic && (
            <path
              d="M271 216 L322 267"
              stroke="#c97b45"
              strokeWidth="11"
              opacity=".25"
              strokeLinecap="round"
            />
          )}
          {routes.map(
            (r, i) =>
              (depot === "All depots" || r.depot === depot) && (
                <g
                  key={r.id}
                  className={`map-route ${selected === i ? "selected" : ""}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`Select ${r.name}`}
                  onClick={() => onSelect(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(i);
                    }
                  }}
                >
                  <polyline
                    points={r.points}
                    fill="none"
                    stroke="white"
                    strokeWidth="9"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={r.points}
                    fill="none"
                    stroke={r.color}
                    strokeWidth={selected === i ? "4" : "3"}
                    strokeLinejoin="round"
                    strokeDasharray={selected === i ? "none" : "5 4"}
                  />
                  {r.points
                    .split(" ")
                    .slice(1)
                    .map((p, j) => {
                      const [x, y] = p.split(",");
                      return (
                        <circle
                          key={j}
                          cx={x}
                          cy={y}
                          r="5"
                          fill={j < r.done ? r.color : "#fff"}
                          stroke={r.color}
                          strokeWidth="2"
                        />
                      );
                    })}
                  <g
                    transform={`translate(${[239, 322, 514][i]},${[293, 267, 224][i]})`}
                    filter="url(#marker-shadow)"
                  >
                    <rect
                      x="-15"
                      y="-16"
                      width="30"
                      height="30"
                      rx="9"
                      fill={r.color}
                    />
                    <path
                      d="M-8-5 H2 V5 H-8Z M2-2 H6 L9 2 V5 H2 M-5 8 A2 2 0 1 0-5 4 A2 2 0 1 0-5 8 M6 8 A2 2 0 1 0 6 4 A2 2 0 1 0 6 8"
                      fill="none"
                      stroke="white"
                      strokeWidth="1.5"
                    />
                  </g>
                </g>
              ),
          )}
          <g filter="url(#marker-shadow)">
            <rect
              x="112"
              y="197"
              width="126"
              height="30"
              rx="7"
              fill="#282f28"
            />
            <text x="127" y="216" fill="white" fontSize="10" fontWeight="600">
              ◈ PELIYAGODA DC
            </text>
            <circle
              cx="162"
              cy="233"
              r="8"
              fill="#282f28"
              stroke="white"
              strokeWidth="3"
            />
            <rect
              x="478"
              y="121"
              width="101"
              height="28"
              rx="7"
              fill="#282f28"
            />
            <text x="493" y="139" fill="white" fontSize="10" fontWeight="600">
              ◈ KANDY HUB
            </text>
          </g>
        </g>
      </svg>
      <div className="map-weather">
        <span>☀</span>
        <b>
          28°<small>Clear skies</small>
        </b>
        <span className="weather-divider" />
        <span>Good roads ahead</span>
      </div>
      <div className="map-controls">
        <IconButton
          icon={Plus}
          label="Zoom in"
          onClick={() => setZoom(Math.min(zoom + 0.2, 1.8))}
        />
        <IconButton
          icon={Minus}
          label="Zoom out"
          onClick={() => setZoom(Math.max(zoom - 0.2, 0.8))}
        />
        <IconButton
          icon={Layers}
          label={traffic ? "Hide traffic layer" : "Show traffic layer"}
          onClick={() => setTraffic(!traffic)}
          aria-pressed={traffic}
        />
      </div>
      <span className="map-scale">
        └────┘<small>{Math.round(20 / zoom)} km · schematic</small>
      </span>
      {traffic && (
        <span className="traffic-label">Slow traffic · City retail loop</span>
      )}
      <span className="map-compass">
        N<Navigation size={18} />
      </span>
    </div>
  );
}
