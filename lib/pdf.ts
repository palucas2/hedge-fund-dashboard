import jsPDF from "jspdf";
import type { MarketRecapDTO } from "@/lib/types";

export function exportRecapPdf(recap: MarketRecapDTO) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  function ensureSpace(lineHeight: number) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  doc.setFontSize(16);
  doc.text(`Market Recap — ${recap.date.slice(0, 10)}`, margin, y);
  y += 28;

  const lines = recap.content.split("\n");
  for (const line of lines) {
    const isHeading = line.trim().startsWith("##");
    const text = line.replace(/^##\s*/, "").trim();
    if (text === "") {
      y += 10;
      continue;
    }

    doc.setFontSize(isHeading ? 13 : 10);
    doc.setFont("helvetica", isHeading ? "bold" : "normal");

    const wrapped = doc.splitTextToSize(text, maxWidth);
    for (const wLine of wrapped) {
      ensureSpace(16);
      doc.text(wLine, margin, y);
      y += isHeading ? 18 : 14;
    }
    if (isHeading) y += 4;
  }

  doc.save(`market-recap-${recap.date.slice(0, 10)}.pdf`);
}
