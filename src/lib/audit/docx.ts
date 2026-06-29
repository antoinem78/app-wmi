// WMI audit document helpers — ported from the proven build_audit_docx.js
// (OASES build) into TypeScript for the portal. Branding: navy #26323B,
// orange #E8852A, Calibri, US Letter, 1in margins. Exhibits are styled tables/
// panels (no screenshots). Logo is passed in as a Buffer by the caller.
import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, LevelFormat, WidthType, ShadingType, VerticalAlign,
  BorderStyle, HeadingLevel, TableOfContents, PageNumber, PageBreak, TabStopType,
} from "docx";

export const NAVY = "26323B", ORANGE = "E8852A", LIGHT = "F4F1EA", GREY = "CCCCCC";
export const CONTENT_W = 9360; // US Letter, 1in margins

type RunOpts = { size?: number; bold?: boolean; italics?: boolean; color?: string };
export const t = (x: string, o: RunOpts = {}) => new TextRun({ text: x, font: "Calibri", size: o.size, bold: o.bold, italics: o.italics, color: o.color });
export const para = (x: string, o: RunOpts & { after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({ spacing: { after: o.after ?? 140, line: 276 }, alignment: o.align, children: [t(x, { size: o.size || 22, bold: o.bold, italics: o.italics, color: o.color })] });
export const h1 = (x: string) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: ORANGE, space: 4 } }, children: [t(x, { size: 30, bold: true, color: NAVY })] });
export const h2 = (x: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 }, children: [t(x, { size: 25, bold: true, color: ORANGE })] });
export const h3 = (x: string) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 170, after: 80 }, children: [t(x, { size: 22, bold: true, color: NAVY })] });
export const bullet = (kids: TextRun[] | string) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 70, line: 270 }, children: Array.isArray(kids) ? kids : [t(kids, { size: 22 })] });
export const numItem = (kids: TextRun[] | string) => new Paragraph({ numbering: { reference: "nums", level: 0 }, spacing: { after: 70, line: 270 }, children: Array.isArray(kids) ? kids : [t(kids, { size: 22 })] });
export const figcap = (x: string) => new Paragraph({ spacing: { before: 40, after: 200 }, children: [t(x, { size: 17, italics: true, color: "666666" })] });

export function statusRun(text: string): TextRun[] {
  let c = "2E7D32";
  if (/inactive/i.test(text)) c = "C62828";
  else if (/needs/i.test(text)) c = "B26A00";
  else if (/no recent/i.test(text)) c = "666666";
  return [t(text, { size: 18, color: c, bold: /inactive|needs/i.test(text) })];
}

const BRD = { style: BorderStyle.SINGLE, size: 1, color: GREY };
const BORDERS = { top: BRD, bottom: BRD, left: BRD, right: BRD };
type CellOpts = { size?: number; bold?: boolean; color?: string; fill?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] };
function cell(val: TextRun[] | string, w: number, o: CellOpts = {}) {
  const runs = Array.isArray(val) ? val : [t(val, { size: o.size || 20, bold: o.bold, color: o.color })];
  return new TableCell({
    borders: BORDERS, width: { size: w, type: WidthType.DXA },
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 }, verticalAlign: VerticalAlign.CENTER,
    children: runs.map((r) => new Paragraph({ alignment: o.align, spacing: { after: 0, line: 264 }, children: [r] })),
  });
}
export type CellVal = string | { __runs: TextRun[] };
export function table(widths: number[], header: string[] | null, rows: CellVal[][], o: { aligns?: ((typeof AlignmentType)[keyof typeof AlignmentType] | undefined)[] } = {}) {
  const out: TableRow[] = [];
  if (header) out.push(new TableRow({ tableHeader: true, children: header.map((l, i) => cell([t(l, { size: 20, bold: true, color: "FFFFFF" })], widths[i], { fill: NAVY })) }));
  rows.forEach((r, idx) => out.push(new TableRow({ children: r.map((v, i) =>
    cell(typeof v === "object" && v.__runs ? v.__runs : (v as string), widths[i], { fill: idx % 2 ? LIGHT : undefined, align: o.aligns?.[i], size: 20 })) })));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, rows: out });
}

export function exhibitPanel(title: string, lines: { t: string; size?: number; bold?: boolean; italics?: boolean; color?: string }[]) {
  const W = CONTENT_W, nb = (col: string) => ({ style: BorderStyle.SINGLE, size: 1, color: col });
  const head = new TableRow({ children: [new TableCell({ width: { size: W, type: WidthType.DXA }, shading: { fill: NAVY, type: ShadingType.CLEAR }, margins: { top: 70, bottom: 70, left: 150, right: 150 }, borders: { top: nb(NAVY), bottom: nb(NAVY), left: nb(NAVY), right: nb(NAVY) }, children: [new Paragraph({ spacing: { after: 0 }, children: [t(title, { size: 19, bold: true, color: "FFFFFF" })] })] })] });
  const body = new TableRow({ children: [new TableCell({ width: { size: W, type: WidthType.DXA }, shading: { fill: "F7F4ED", type: ShadingType.CLEAR }, margins: { top: 130, bottom: 130, left: 170, right: 170 }, borders: { top: nb(GREY), bottom: nb(GREY), left: nb(GREY), right: nb(GREY) }, children: lines.map((l) => new Paragraph({ spacing: { after: 70, line: 270 }, children: [new TextRun({ text: l.t, font: "Consolas", size: l.size || 20, bold: l.bold, italics: l.italics, color: l.color || "333333" })] })) })] });
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [head, body] });
}

// Cover page + a PART divider page.
export function cover(opts: { title: string; subtitle: string; client: string; website?: string; customerId: string; date: string; logo?: Buffer }) {
  const c: Paragraph[] = [];
  if (opts.logo) c.push(new Paragraph({ spacing: { before: 400, after: 200 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: opts.logo, transformation: { width: 260, height: 96 }, altText: { title: "WMI", description: "Web Marketing International", name: "logo" } })] }));
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, children: [t("WEB MARKETING INTERNATIONAL LTD", { size: 24, bold: true, color: NAVY })] }));
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [t("Google Premier Partner", { size: 20, color: ORANGE, bold: true })] }));
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 360, after: 80 }, children: [t(opts.title, { size: 40, bold: true, color: NAVY })] }));
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320 }, children: [t(opts.subtitle, { size: 20, color: "555555" })] }));
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [t(`Prepared for: ${opts.client}`, { size: 22, bold: true })] }));
  if (opts.website) c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [t(`Website: ${opts.website}`, { size: 20 })] }));
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [t(`Google Ads Customer ID: ${opts.customerId}`, { size: 20 })] }));
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [t("Prepared by: Web Marketing International Ltd", { size: 20 })] }));
  c.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [t(`${opts.date}  |  Private & Confidential`, { size: 18, color: "888888" })] }));
  c.push(new Paragraph({ children: [new PageBreak()] }));
  return c;
}
export function partDivider(part: string, title: string) {
  return [
    new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { before: 1600, after: 80 }, children: [t(part, { size: 44, bold: true, color: ORANGE })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [t(title, { size: 30, bold: true, color: NAVY })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}
export const contents = () => new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" });

export function buildAuditDoc(children: (Paragraph | Table | TableOfContents)[], docTitle: string, logo?: Buffer) {
  void logo;
  return new Document({
    creator: "Web Marketing International Ltd", title: docTitle,
    styles: { default: { document: { run: { font: "Calibri", size: 22, color: "222222" } } }, paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: NAVY, font: "Calibri" }, paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 25, bold: true, color: ORANGE, font: "Calibri" }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, color: NAVY, font: "Calibri" }, paragraph: { spacing: { before: 170, after: 80 }, outlineLevel: 2 } },
    ] },
    numbering: { config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { run: { color: ORANGE }, paragraph: { indent: { left: 460, hanging: 260 } } } }] },
      { reference: "nums", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
    ] },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ spacing: { after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD", space: 2 } }, tabStops: [{ type: TabStopType.RIGHT, position: 9360 }], children: [t("Web Marketing International Ltd", { size: 16, color: "888888" }), t("\t" + docTitle, { size: 16, color: "888888" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 }, children: [t("Private & Confidential   |   Page ", { size: 16, color: "888888" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888", font: "Calibri" })] })] }) },
      children,
    }],
  });
}
