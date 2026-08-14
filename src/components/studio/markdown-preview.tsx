import type { ReactNode } from "react";

export function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let inCode = false;
  let code: string[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    blocks.push(<ul key={`list-${blocks.length}`} className="list-disc space-y-1 pl-5">{list.map((item, index) => <li key={index}>{inline(item)}</li>)}</ul>);
    list = [];
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushList();
      if (inCode) {
        blocks.push(<pre key={`code-${blocks.length}`} className="overflow-auto rounded-md bg-neutral-950 p-3 text-[11px] text-neutral-100"><code>{code.join("\n")}</code></pre>);
        code = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) { code.push(line); continue; }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const className = level === 1 ? "text-xl font-semibold" : level === 2 ? "text-lg font-semibold" : "text-sm font-semibold";
      blocks.push(<div key={`heading-${blocks.length}`} className={className}>{inline(heading[2])}</div>);
      continue;
    }
    const item = line.match(/^\s*[-*+]\s+(.+)$/);
    if (item) { list.push(item[1]); continue; }
    flushList();
    if (!line.trim()) blocks.push(<div key={`space-${blocks.length}`} className="h-2" />);
    else if (/^<[^>]+>/.test(line.trim())) blocks.push(<p key={`html-${blocks.length}`} className="font-mono text-[11px] text-neutral-500">{line}</p>);
    else blocks.push(<p key={`p-${blocks.length}`}>{inline(line)}</p>);
  }
  flushList();
  if (code.length) blocks.push(<pre key="code-final" className="overflow-auto rounded-md bg-neutral-950 p-3 text-[11px] text-neutral-100"><code>{code.join("\n")}</code></pre>);
  return <div className="space-y-2 text-sm leading-6 text-neutral-700">{blocks}</div>;
}

function inline(value: string): ReactNode {
  const parts = value.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-neutral-100 px-1 py-0.5 text-xs">{part.slice(1, -1)}</code>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

