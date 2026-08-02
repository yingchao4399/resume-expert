"use client";

import type { MindMapNode } from "@/types/interview";

// 简单树状思维导图（横向，左到右）
// 不依赖外部库，纯 SVG 自绘
export function MindMap({ data }: { data: MindMapNode }) {
  // 计算每个节点的 y 位置（叶子均匀分布）
  const LEVEL_X = [20, 220, 440]; // 三层 x 坐标
  const NODE_H = 32;
  const NODE_W = 180;
  const LEAF_GAP = 8;

  type PositionedNode = {
    node: MindMapNode;
    x: number;
    y: number;
    height: number;
    isLeaf: boolean;
    children?: PositionedNode[];
  };

  // 计算子树高度（叶子数 * (NODE_H + GAP)）
  function calcHeight(node: MindMapNode): number {
    if (!node.children || node.children.length === 0) {
      return NODE_H + LEAF_GAP;
    }
    return node.children.reduce((sum, c) => sum + calcHeight(c), 0);
  }

  function layout(node: MindMapNode, depth: number, startY: number): PositionedNode {
    const x = LEVEL_X[Math.min(depth, LEVEL_X.length - 1)];
    if (!node.children || node.children.length === 0) {
      return { node, x, y: startY, height: NODE_H + LEAF_GAP, isLeaf: true };
    }

    let curY = startY;
    const children = node.children.map((c) => {
      const h = calcHeight(c);
      const child = layout(c, depth + 1, curY);
      curY += h;
      return child;
    });

    const totalHeight = curY - startY;
    // 父节点 y 居中于子节点
    const firstChildY = children[0]?.y ?? startY;
    const lastChildY = children[children.length - 1]?.y ?? startY;
    const centerY = (firstChildY + lastChildY) / 2;

    return { node, x, y: centerY, height: totalHeight, isLeaf: false, children };
  }

  const totalHeight = calcHeight(data);
  const root = layout(data, 0, 0);
  const svgHeight = Math.max(totalHeight + 40, 200);
  const svgWidth = LEVEL_X[LEVEL_X.length - 1] + NODE_W + 40;

  // 颜色按层级
  const colors = ["#0f172a", "#0369a1", "#0891b2"];
  const bgColors = ["#f1f5f9", "#e0f2fe", "#ecfeff"];

  function renderNode(pn: PositionedNode, depth: number): React.ReactNode {
    const color = colors[Math.min(depth, colors.length - 1)];
    const bg = bgColors[Math.min(depth, bgColors.length - 1)];
    const isRoot = depth === 0;
    const w = isRoot ? NODE_W + 20 : NODE_W;
    const h = NODE_H;
    // 防护：label 可能 undefined
    const labelText = String(pn.node.label ?? "");
    const displayText = labelText.length > 14 ? labelText.slice(0, 13) + "…" : labelText;

    return (
      <g key={`${labelText}-${pn.x}-${pn.y}`}>
        {/* 连线到子节点 */}
        {pn.children?.map((child, i) => {
          const x1 = pn.x + w;
          const y1 = pn.y + h / 2;
          const x2 = child.x;
          const y2 = child.y + h / 2;
          const midX = (x1 + x2) / 2;
          return (
            <path
              key={`line-${i}`}
              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.5}
            />
          );
        })}
        {/* 节点矩形 */}
        <rect
          x={pn.x}
          y={pn.y}
          width={w}
          height={h}
          rx={6}
          fill={bg}
          stroke={color}
          strokeWidth={isRoot ? 2 : 1}
        />
        <text
          x={pn.x + w / 2}
          y={pn.y + h / 2 + 4}
          textAnchor="middle"
          fontSize={isRoot ? 13 : 12}
          fontWeight={isRoot ? 600 : 400}
          fill={color}
        >
          {displayText}
        </text>
        {/* 递归子节点 */}
        {pn.children?.map((c) => renderNode(c, depth + 1))}
      </g>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white p-3">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ minWidth: svgWidth }}
      >
        {renderNode(root, 0)}
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#f1f5f9] border border-[#0f172a]" /> 主题
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#e0f2fe] border border-[#0369a1]" /> 领域
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#ecfeff] border border-[#0891b2]" /> 知识点（✓ 掌握 / △ 一般 / ✗ 不足）
        </span>
      </div>
    </div>
  );
}
