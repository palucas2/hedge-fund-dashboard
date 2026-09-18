const SECTION_COLORS = ["border-link", "border-bull", "border-bear", "border-lateral"];

export default function RecapContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: { heading: string | null; lines: string[] }[] = [];
  let current: { heading: string | null; lines: string[] } = { heading: null, lines: [] };

  for (const line of lines) {
    if (line.trim().startsWith("##")) {
      if (current.heading || current.lines.length > 0) blocks.push(current);
      current = { heading: line.replace(/^##\s*/, "").trim(), lines: [] };
    } else if (line.trim() !== "") {
      current.lines.push(line);
    }
  }
  blocks.push(current);

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <div key={i} className={block.heading ? `rounded-card border-l-4 bg-card p-4 ${SECTION_COLORS[i % SECTION_COLORS.length]}` : ""}>
          {block.heading && <h3 className="mb-2 text-sm font-semibold text-text-primary">{block.heading}</h3>}
          <div className="space-y-1 text-sm text-text-secondary">
            {block.lines.map((line, j) => {
              const bullet = line.trim().match(/^[-*•]\s*(.+)/);
              return bullet ? (
                <div key={j} className="flex gap-2">
                  <span className="text-link">•</span>
                  <span>{bullet[1]}</span>
                </div>
              ) : (
                <p key={j}>{line}</p>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
