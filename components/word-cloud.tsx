"use client";

import cloud from "d3-cloud";
import { useEffect, useRef, useState } from "react";

interface Word {
  word: string;
  count: number;
}

interface PlacedWord {
  text: string;
  size: number;
  x: number;
  y: number;
  rotate: number;
}

// the Sentiment Research mark's palette, deepened for legibility on white
const COLORS = ["#0091d4", "#e0761f", "#16a34a", "#d327a8", "#7c4fd8", "#0a0a0e"];

/** Word cloud (§A9 visual outputs, v1) with PNG export via canvas snapshot. */
export function WordCloud({ words, width = 560, height = 320 }: { words: Word[]; width?: number; height?: number }) {
  const [placed, setPlaced] = useState<PlacedWord[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (words.length === 0) return;
    const max = Math.max(...words.map((w) => w.count));
    const layout = cloud()
      .size([width, height])
      .words(words.map((w) => ({ text: w.word, size: 14 + (w.count / max) * 42 })))
      .padding(3)
      .rotate(() => 0)
      .font("sans-serif")
      .fontSize((d) => d.size ?? 14)
      .on("end", (output) => {
        setPlaced(
          output.map((d) => ({
            text: String(d.text),
            size: Number(d.size),
            x: Number(d.x),
            y: Number(d.y),
            rotate: Number(d.rotate),
          })),
        );
      });
    layout.start();
  }, [words, width, height]);

  function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const data = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const link = document.createElement("a");
      link.download = "word-cloud.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(data)))}`;
  }

  if (words.length === 0) {
    return <p className="text-sm text-slate-400">Not enough consumer language available for a word cloud.</p>;
  }

  return (
    <div>
      <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Word cloud of consumer language">
        <g transform={`translate(${width / 2},${height / 2})`}>
          {placed.map((w, i) => (
            <text
              key={w.text}
              textAnchor="middle"
              transform={`translate(${w.x},${w.y}) rotate(${w.rotate})`}
              fontSize={w.size}
              fontFamily="sans-serif"
              fill={COLORS[i % COLORS.length]}
            >
              {w.text}
            </text>
          ))}
        </g>
      </svg>
      <button type="button" onClick={exportPng} className="mt-1 text-xs text-slate-500 underline">
        Export as image
      </button>
    </div>
  );
}
