"use client";

import type { FishboneAnalysis } from "@/types/interview";

// 鱼骨图（问题根因分析）
// 中心问题在右侧，根因分支向左延伸（上下交替）
export function Fishbone({ data }: { data: FishboneAnalysis }) {
  if (!data?.categories?.length) {
    return <p className="text-sm text-neutral-400">暂无鱼骨图数据</p>;
  }

  // 防护：过滤掉 causes 为 undefined/null 的项，并保证 causes 是数组
  const safeCategories = data.categories.map((c) => ({
    category: c.category || "未分类",
    causes: Array.isArray(c.causes) ? c.causes : [],
  }));
  const categories = safeCategories;
  const half = Math.ceil(categories.length / 2);
  const upper = categories.slice(0, half);
  const lower = categories.slice(half);

  const SVG_W = 760;
  const SVG_H = 420;
  const SPINE_Y = SVG_H / 2;
  const SPINE_END_X = SVG_W - 30; // 鱼头位置
  const SPINE_START_X = 30;

  const BRANCH_LEN = 130; // 分支长度

  const upperColor = "#0369a1";
  const lowerColor = "#7c3aed";
  const headColor = "#dc2626";

  function renderBranch(
    cat: { category: string; causes: string[] },
    index: number,
    isUpper: boolean
  ) {
    // 沿主骨均匀分布
    const total = isUpper ? upper.length : lower.length;
    const span = (SPINE_END_X - SPINE_START_X - 120) / (total + 1);
    const baseX = SPINE_START_X + 80 + span * (index + 1);

    const dir = isUpper ? -1 : 1; // 上为负 y
    const branchEndY = SPINE_Y + dir * BRANCH_LEN;
    const color = isUpper ? upperColor : lowerColor;

    return (
      <g key={`${cat.category}-${index}`}>
        {/* 分支斜线 */}
        <line
          x1={baseX}
          y1={SPINE_Y}
          x2={baseX - 30}
          y2={branchEndY}
          stroke={color}
          strokeWidth={2}
        />
        {/* 类别标签 */}
        <rect
          x={baseX - 60}
          y={branchEndY - (isUpper ? 22 : 4)}
          width={90}
          height={20}
          rx={4}
          fill={color}
          opacity={0.1}
        />
        <text
          x={baseX - 15}
          y={branchEndY + (isUpper ? -8 : 14)}
          textAnchor="middle"
          fontSize={12}
          fontWeight={600}
          fill={color}
        >
          {cat.category}
        </text>
        {/* cause 小斜线 + 文本 */}
        {cat.causes.map((cause, ci) => {
          // 沿分支线分布，从主骨往分支末端
          const t = (ci + 1) / (cat.causes.length + 1);
          const lineX = baseX + (baseX - 30 - baseX) * t;
          const lineY = SPINE_Y + (branchEndY - SPINE_Y) * t;
          return (
            <g key={`cause-${ci}`}>
              <line
                x1={lineX}
                y1={lineY}
                x2={lineX - 14}
                y2={lineY - dir * 8}
                stroke={color}
                strokeWidth={1}
                opacity={0.7}
              />
              <text
                x={lineX - 18}
                y={lineY - dir * 6}
                textAnchor="end"
                fontSize={10}
                fill="#475569"
              >
                {cause.length > 22 ? cause.slice(0, 21) + "…" : cause}
              </text>
            </g>
          );
        })}
      </g>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white p-3">
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ minWidth: SVG_W }}>
        {/* 主骨 */}
        <line
          x1={SPINE_START_X}
          y1={SPINE_Y}
          x2={SPINE_END_X}
          y2={SPINE_Y}
          stroke="#334155"
          strokeWidth={3}
        />
        {/* 鱼头（中心问题） */}
        <polygon
          points={`${SPINE_END_X},${SPINE_Y} ${SPINE_END_X + 20},${SPINE_Y - 18} ${SPINE_END_X + 20},${SPINE_Y + 18}`}
          fill={headColor}
        />
        <rect
          x={SPINE_END_X + 24}
          y={SPINE_Y - 50}
          width={0}
          height={0}
          fill="none"
        />
        {/* 中心问题文本（换行处理） */}
        {(() => {
          const text = data.problem;
          const maxLen = 8;
          const lines: string[] = [];
          for (let i = 0; i < text.length; i += maxLen) {
            lines.push(text.slice(i, i + maxLen));
          }
          return lines.slice(0, 5).map((line, i) => (
            <text
              key={i}
              x={SPINE_END_X + 28}
              y={SPINE_Y - 40 + i * 16}
              fontSize={11}
              fontWeight={600}
              fill={headColor}
            >
              {line}
            </text>
          ));
        })()}

        {/* 上分支 */}
        {upper.map((c, i) => renderBranch(c, i, true))}
        {/* 下分支 */}
        {lower.map((c, i) => renderBranch(c, i, false))}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: upperColor }} /> 上方根因
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: lowerColor }} /> 下方根因
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: headColor }} /> 中心问题
        </span>
      </div>
    </div>
  );
}
