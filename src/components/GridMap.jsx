import React, { useMemo } from "react";
import { isInViewRange } from "../utils/message";

const VIEW_RADIUS = 5;
const GRID_SIZE = VIEW_RADIUS * 2 + 1; // 11x11 viewport centered on user

// 🎨 Category Colors (for alert markers)
const CATEGORY_COLORS = {
  medical: "0, 122, 255",
  danger: "255, 0, 0",
  shelter: "0, 200, 100",
  transport: "255, 200, 0",
  food: "234, 179, 8",
  default: "120, 120, 120",
};

// 🎨 Solid category colors (for styled markers)
const MARKER_BG = {
  danger: "#ef4444",
  medical: "#3b82f6",
  shelter: "#22c55e",
  food: "#f59e0b",
  transport: "#a855f7",
  default: "#64748b",
};

// 🔵 Radius glow colors (soft, translucent — drawn BEHIND markers)
const RADIUS_COLORS = {
  medical:   { r: 34,  g: 197, b: 94  },
  danger:    { r: 239, g: 68,  b: 68  },
  shelter:   { r: 59,  g: 130, b: 246 },
  food:      { r: 234, g: 179, b: 8   },
  transport: { r: 168, g: 85,  b: 247 },
  default:   { r: 148, g: 163, b: 184 },
};

// Category emoji for compact display on cells
const CATEGORY_EMOJI = {
  medical: "🚑",
  danger: "🔥",
  shelter: "🏠",
  food: "🍞",
  transport: "🚗",
};

// Legend items
const LEGEND = [
  { label: "Danger", color: "#ef4444", emoji: "🔴" },
  { label: "Medical", color: "#3b82f6", emoji: "🔵" },
  { label: "Shelter", color: "#22c55e", emoji: "🟢" },
  { label: "Transport", color: "#a855f7", emoji: "🟡" },
  { label: "You", color: "#ffffff", emoji: "⬜" },
];

export default function GridMap({
  messages,
  groupedMessages,
  selectedCategory,
  userLocation,
}) {
  // Fallback user location
  const user = userLocation || { x: 5, y: 5 };
  const centerIdx = VIEW_RADIUS;

  // 🛡️ STEP 1: Normalize messages
  const allMessages = useMemo(() => {
    if (Array.isArray(messages)) return messages;
    if (groupedMessages) {
      return Object.values(groupedMessages).flat();
    }
    return [];
  }, [messages, groupedMessages]);

  // 🔍 STEP 2: Filter by category safely
  const categoryFiltered = useMemo(() => {
    if (!selectedCategory) return allMessages;
    return allMessages.filter(
      (msg) => msg?.category === selectedCategory
    );
  }, [allMessages, selectedCategory]);

  // 📍 STEP 2b: Filter to only messages within VIEW_RADIUS of user
  const visibleMessages = useMemo(() => {
    return categoryFiltered.filter((msg) =>
      isInViewRange(user, msg, VIEW_RADIUS)
    );
  }, [categoryFiltered, user.x, user.y]);

  // 🧠 STEP 3: Build user-centered grid
  const gridData = useMemo(() => {
    const grid = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => [])
    );

    visibleMessages.forEach((msg) => {
      if (!msg?.location) return;

      const gridCol = centerIdx + (msg.location.x - user.x);
      const gridRow = centerIdx + (msg.location.y - user.y);

      if (
        gridRow >= 0 && gridRow < GRID_SIZE &&
        gridCol >= 0 && gridCol < GRID_SIZE
      ) {
        grid[gridRow][gridCol] = [...grid[gridRow][gridCol], msg];
      }
    });

    return grid;
  }, [visibleMessages, user.x, user.y]);

  // 🔵 STEP 3b: Build radius glow grid (user-centered coordinates)
  const radiusGrid = useMemo(() => {
    const grid = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => ({ r: 0, g: 0, b: 0, a: 0 }))
    );

    visibleMessages.forEach((msg) => {
      if (!msg?.location) return;

      const mgCol = centerIdx + (msg.location.x - user.x);
      const mgRow = centerIdx + (msg.location.y - user.y);
      const radius = msg.radius || 2;
      const cat = msg.category || "default";
      const color = RADIUS_COLORS[cat] || RADIUS_COLORS.default;

      const minRow = Math.max(0, Math.floor(mgRow - radius));
      const maxRow = Math.min(GRID_SIZE - 1, Math.ceil(mgRow + radius));
      const minCol = Math.max(0, Math.floor(mgCol - radius));
      const maxCol = Math.min(GRID_SIZE - 1, Math.ceil(mgCol + radius));

      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const dx = col - mgCol;
          const dy = row - mgRow;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist <= radius) {
            const falloff = 1 - (dist / radius);
            const alpha = 0.15 * falloff;

            grid[row][col].r += color.r * alpha;
            grid[row][col].g += color.g * alpha;
            grid[row][col].b += color.b * alpha;
            grid[row][col].a += alpha;
          }
        }
      }
    });

    return grid;
  }, [visibleMessages, user.x, user.y]);

  // 🧭 STEP 4: Route path from user to nearest medical
  const routePath = useMemo(() => {
    if (selectedCategory !== "medical") return [];

    let target = null;
    let minDist = Infinity;

    visibleMessages.forEach((msg) => {
      if (!msg?.location) return;
      const rx = msg.location.x - user.x;
      const ry = msg.location.y - user.y;
      const dist = Math.abs(rx) + Math.abs(ry);

      if (dist < minDist && dist > 0) {
        minDist = dist;
        target = { gridCol: centerIdx + rx, gridRow: centerIdx + ry };
      }
    });

    if (!target) return [];

    const path = [];
    let col = centerIdx, row = centerIdx;

    while (col !== target.gridCol) {
      path.push(`${row}-${col}`);
      col += col < target.gridCol ? 1 : -1;
    }

    while (row !== target.gridRow) {
      path.push(`${row}-${col}`);
      row += row < target.gridRow ? 1 : -1;
    }

    return path;
  }, [visibleMessages, selectedCategory, user.x, user.y]);

  // ───────────────────────── UI HELPERS ─────────────────────────

  // Distance from center for fade effect
  const distFromCenter = (row, col) => {
    const dx = col - centerIdx;
    const dy = row - centerIdx;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Radius glow background string
  const getRadiusBg = (row, col) => {
    const rc = radiusGrid[row][col];
    if (rc.a <= 0) return null;
    return `rgba(${Math.min(255, Math.round(rc.r))}, ${Math.min(255, Math.round(rc.g))}, ${Math.min(255, Math.round(rc.b))}, ${Math.min(0.5, rc.a).toFixed(3)})`;
  };

  // Cell background
  const getCellBg = (cell, isPath, isUser, row, col) => {
    const radiusBg = getRadiusBg(row, col);
    const dist = distFromCenter(row, col);
    // Outer cells fade darker
    const fadeFactor = Math.max(0, 1 - (dist / (VIEW_RADIUS + 1)));
    const baseBg = `rgba(15, 23, 42, ${1 - fadeFactor * 0.3})`;

    if (isPath) return "rgba(56, 189, 248, 0.25)";
    if (!cell || cell.length === 0) return radiusBg || baseBg;

    const strongest = cell.reduce((a, b) =>
      (a?.priority || 0) > (b?.priority || 0) ? a : b
    );
    const category = strongest?.category || "default";
    const colorBase = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;

    let intensity = 0.3;
    if ((strongest?.priority || 0) >= 5) intensity = 1;
    else if ((strongest?.priority || 0) >= 3) intensity = 0.7;

    let conf = strongest?.confidence ?? 0.5;
    if (conf > 1) conf = conf / 100;

    return `rgba(${colorBase}, ${Math.max(intensity * conf, 0.2)})`;
  };

  // Distance label (units from user)
  const getDistLabel = (row, col) => {
    const dx = Math.abs(col - centerIdx);
    const dy = Math.abs(row - centerIdx);
    return dx + dy;
  };

  return (
    <div className="map-wrapper" style={{
      background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
      padding: "20px 16px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.05)",
      textAlign: "center",
    }}>
      {/* Header */}
      <h3 style={{ color: "white", margin: "0 0 4px", fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
        🗺️ Emergency Grid Map
      </h3>
      <p style={{ fontSize: 11, color: "rgba(148,163,184,0.6)", margin: "0 0 14px" }}>
        Showing nearby alerts · {GRID_SIZE}×{GRID_SIZE} view
      </p>

      {/* Grid */}
      <div className="map-grid-container">
        {visibleMessages.length === 0 && (
          <div style={{ padding: "36px 20px", color: "rgba(148,163,184,0.5)", fontSize: 13 }}>
            📡 No nearby alerts detected
          </div>
        )}

        {visibleMessages.length > 0 && (
          <div className="map-grid-inner">
            {gridData.map((row, rowIndex) => (
              <div key={rowIndex} className="map-row">
                {row.map((cell, colIndex) => {
                  const key = `${rowIndex}-${colIndex}`;
                  const isPath = routePath.includes(key);
                  const isUser = rowIndex === centerIdx && colIndex === centerIdx;
                  const hasAlert = cell.length > 0;
                  const dist = getDistLabel(rowIndex, colIndex);
                  const category = hasAlert ? (cell[0]?.category || "default") : null;
                  const markerColor = category ? (MARKER_BG[category] || MARKER_BG.default) : null;
                  const emoji = hasAlert ? (CATEGORY_EMOJI[category] || "⚠️") : null;

                  // --- USER CELL ---
                  if (isUser) {
                    return (
                      <div
                        key={key}
                        className="map-cell-user"
                        style={{
                          background: hasAlert
                            ? getCellBg(cell, false, true, rowIndex, colIndex)
                            : "rgba(30,41,59,0.9)",
                        }}
                        title={`You (${user.x}, ${user.y})${hasAlert ? ` · ${cell.length} alert(s) here` : ""}`}
                      >
                        <span className="cell-emoji">
                          {hasAlert ? emoji : "📍"}
                        </span>
                        <span className="cell-sublabel" style={{ color: "#94a3b8" }}>
                          You
                        </span>
                      </div>
                    );
                  }

                  // --- ALERT CELL ---
                  if (hasAlert) {
                    return (
                      <div
                        key={key}
                        className="map-cell-alert"
                        style={{
                          background: markerColor,
                          boxShadow: `0 2px 8px ${markerColor}55, 0 0 0 1px ${markerColor}33`,
                        }}
                        title={`${cell.length} alert(s) · ${dist} unit${dist !== 1 ? "s" : ""} away`}
                      >
                        <span className="cell-emoji">
                          {cell.length > 1 ? cell.length : emoji}
                        </span>
                        <span className="cell-sublabel">
                          {dist}u
                        </span>
                      </div>
                    );
                  }

                  // --- EMPTY CELL ---
                  const bg = getCellBg(cell, isPath, false, rowIndex, colIndex);
                  const hasGlow = radiusGrid[rowIndex][colIndex].a > 0;

                  return (
                    <div
                      key={key}
                      className="map-cell"
                      style={{
                        background: bg,
                        border: `1px solid rgba(255,255,255,${hasGlow ? "0.06" : "0.03"})`,
                      }}
                      title={isPath ? "Route" : hasGlow ? "Alert zone" : ""}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="map-legend">
        {LEGEND.map((item) => (
          <div key={item.label} className="map-legend-item">
            <span style={{ fontSize: 9 }}>{item.emoji}</span>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}