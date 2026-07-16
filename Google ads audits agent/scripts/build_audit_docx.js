/*
 * build_audit_docx.js  -  reusable WMI audit document helpers (docx-js)
 * -------------------------------------------------------------------------
 * Proven helper library extracted from the OASES audit build. Import these
 * helpers and feed them content from the structured findings artifact.
 *
 * Setup:  npm i docx        (run inside the workspace, not a cloud-synced dir)
 * Logo:   trim WMI-new-logo.png to wmi-logo-trim.png (PIL) and place on white.
 * Build:  node build_audit_docx.js   ->  writes example.docx
 * QA:     soffice --headless --convert-to pdf example.docx ; eyeball it.
 *
 * NOTE on screenshots: browser screenshots can't be saved to disk in the agent
 * environment, so use exhibitTable()/exhibitPanel() to reproduce account and
 * website extracts as styled, captioned figures instead of embedding images.
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  Header, Footer, AlignmentType, LevelFormat, WidthType, ShadingType, VerticalAlign,
  BorderStyle, HeadingLevel, TableOfContents, PageNumber, PageBreak, TabStopType
} = require("docx");

// ---- branding ----
const NAVY = "26323B", ORANGE = "E8852A", LIGHT = "F4F1EA", GREY = "CCCCCC";
const CONTENT_W = 9360; // US Letter, 1in margins

// ---- text + headings ----
const t = (x, o = {}) => new TextRun(Object.assign({ text: x, font: "Calibri" }, o));
const para = (x, o = {}) => new Paragraph({ spacing: { after: o.after ?? 140, line: 276 }, alignment: o.align,
  children: [t(x, { size: o.size || 22, bold: o.bold, italics: o.italics, color: o.color })] });
const h1 = (x) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: ORANGE, space: 4 } }, children: [t(x, { size: 30, bold: true, color: NAVY })] });
const h2 = (x) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 }, children: [t(x, { size: 25, bold: true, color: ORANGE })] });
const h3 = (x) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 170, after: 80 }, children: [t(x, { size: 22, bold: true, color: NAVY })] });
const bullet = (kids) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 70, line: 270 }, children: Array.isArray(kids) ? kids : [t(kids, { size: 22 })] });
const numItem = (kids) => new Paragraph({ numbering: { reference: "nums", level: 0 }, spacing: { after: 70, line: 270 }, children: kids });
const figcap = (x) => new Paragraph({ spacing: { before: 40, after: 200 }, children: [t(x, { size: 17, italics: true, color: "666666" })] });

// colour-code a status cell (Active / Needs attention / Inactive / No recent)
function statusRun(text) {
  let c = "2E7D32";
  if (/inactive/i.test(text)) c = "C62828";
  else if (/needs/i.test(text)) c = "B26A00";
  else if (/no recent/i.test(text)) c = "666666";
  return [t(text, { size: 18, color: c, bold: /inactive|needs/i.test(text) })];
}

// ---- tables ----
const BRD = { style: BorderStyle.SINGLE, size: 1, color: GREY };
const BORDERS = { top: BRD, bottom: BRD, left: BRD, right: BRD };
function cell(val, w, o = {}) {
  const runs = Array.isArray(val) ? val : [t(val, { size: o.size || 20, bold: o.bold, color: o.color })];
  return new TableCell({ borders: BORDERS, width: { size: w, type: WidthType.DXA },
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 }, verticalAlign: VerticalAlign.CENTER,
    children: runs.map(r => new Paragraph({ alignment: o.align, spacing: { after: 0, line: 264 }, children: [r] })) });
}
// table(widths[], headerLabels[]|null, rows[][], {aligns:[]})  - cells may be strings or {__runs:[...]}
function table(widths, header, rows, o = {}) {
  const out = [];
  if (header) out.push(new TableRow({ tableHeader: true, children: header.map((l, i) => cell([t(l, { size: 20, bold: true, color: "FFFFFF" })], widths[i], { fill: NAVY })) }));
  rows.forEach((r, idx) => out.push(new TableRow({ children: r.map((v, i) =>
    cell(v && v.__runs ? v.__runs : v, widths[i], { fill: idx % 2 ? LIGHT : undefined, align: o.aligns && o.aligns[i], size: 20 })) })));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, rows: out });
}

// styled "screenshot-like" panel: navy title bar + monospace body in a cream box
function exhibitPanel(title, lines) {
  const W = CONTENT_W, nb = (col) => ({ style: BorderStyle.SINGLE, size: 1, color: col });
  const head = new TableRow({ children: [new TableCell({ width: { size: W, type: WidthType.DXA }, shading: { fill: NAVY, type: ShadingType.CLEAR },
    margins: { top: 70, bottom: 70, left: 150, right: 150 }, borders: { top: nb(NAVY), bottom: nb(NAVY), left: nb(NAVY), right: nb(NAVY) },
    children: [new Paragraph({ spacing: { after: 0 }, children: [t(title, { size: 19, bold: true, color: "FFFFFF" })] })] })] });
  const body = new TableRow({ children: [new TableCell({ width: { size: W, type: WidthType.DXA }, shading: { fill: "F7F4ED", type: ShadingType.CLEAR },
    margins: { top: 130, bottom: 130, left: 170, right: 170 }, borders: { top: nb(GREY), bottom: nb(GREY), left: nb(GREY), right: nb(GREY) },
    children: lines.map(l => new Paragraph({ spacing: { after: 70, line: 270 }, children: [t(l.t, { size: l.size || 20, bold: l.bold, italics: l.italics, color: l.color || "333333", font: "Consolas" })] })) })] });
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [W], rows: [head, body] });
}

// ---- assemble a document from a children array ----
function buildDoc(children, docTitle) {
  const logo = fs.existsSync("wmi-logo-trim.png") ? fs.readFileSync("wmi-logo-trim.png") : null;
  return new Document({
    creator: "Web Marketing International Ltd", title: docTitle,
    styles: { default: { document: { run: { font: "Calibri", size: 22, color: "222222" } } }, paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: NAVY, font: "Calibri" }, paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 25, bold: true, color: ORANGE, font: "Calibri" }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, color: NAVY, font: "Calibri" }, paragraph: { spacing: { before: 170, after: 80 }, outlineLevel: 2 } } ] },
    numbering: { config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { run: { color: ORANGE }, paragraph: { indent: { left: 460, hanging: 260 } } } }] },
      { reference: "nums", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] } ] },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ spacing: { after: 0 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD", space: 2 } },
        tabStops: [{ type: TabStopType.RIGHT, position: 9360 }], children: [t("Web Marketing International Ltd", { size: 16, color: "888888" }), t("\t" + docTitle, { size: 16, color: "888888" })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 },
        children: [t("Private & Confidential   |   Page ", { size: 16, color: "888888" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888", font: "Calibri" })] })] }) },
      children
    }]
  });
}

module.exports = { NAVY, ORANGE, LIGHT, CONTENT_W, t, para, h1, h2, h3, bullet, numItem, figcap, statusRun, table, exhibitPanel, buildDoc,
  TableOfContents, PageBreak, AlignmentType, ImageRun, Paragraph, Packer };

// ---- tiny demo when run directly ----
if (require.main === module) {
  const { Packer } = require("docx");
  const c = [];
  c.push(h1("Conversion Tracking: The Root Cause"));
  c.push(para("Page view is set as a primary conversion across all 38 campaigns, while the real lead action reaches none of them."));
  c.push(table([3400, 1700, 1500, 2760], ["Conversion action", "Applied to", "Type", "Status"], [
    ["Submit lead form", "0 of 38 campaigns", "Primary", { __runs: statusRun("Needs attention") }],
    ["Page view", "38 of 38 campaigns", "Primary", { __runs: statusRun("Needs attention") }],
    ["Engagement", "38 of 38 campaigns", "Primary", { __runs: statusRun("Active") }]
  ], { aligns: [undefined, AlignmentType.CENTER, AlignmentType.CENTER, AlignmentType.CENTER] }));
  c.push(figcap("Exhibit: account-default primary conversion actions. Source: Google Ads account <ID>."));
  c.push(exhibitPanel("Live element: Demo request form (example.com/contact)", [
    { t: "Field 1:  Full Name" }, { t: "Field 2:  Company Email" },
    { t: "No phone, no qualification, no GCLID capture.", italics: true, color: "8A4B00" }
  ]));
  Packer.toBuffer(buildDoc(c, "Demo - WMI Audit Helpers")).then(b => { fs.writeFileSync("example.docx", b); console.log("wrote example.docx", b.length); });
}
