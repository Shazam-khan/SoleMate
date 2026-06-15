/* Build DESIGN.docx from docs/DESIGN.md, embedding rendered diagram PNGs. */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  LevelFormat, TableOfContents, PageBreak, ExternalHyperlink, PageNumber,
  Header, Footer,
} = require("docx");

const ROOT = __dirname;
const CONTENT_WIDTH = 9360; // US Letter, 1" margins (DXA)
const IMG_W = 620; // px

const pngSize = (file) => {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

// ---- inline markdown -> runs ----
function parseInline(text, base = {}) {
  const runs = [];
  const re = /(\[([^\]]+)\]\(([^)]+)\))|(\*\*([^*]+)\*\*)|(`([^`]+)`)/g;
  let last = 0, m;
  const plain = (t) => { if (t) runs.push(new TextRun({ text: t, ...base })); };
  while ((m = re.exec(text))) {
    plain(text.slice(last, m.index));
    if (m[1]) {
      if (/^https?:\/\//.test(m[3])) {
        runs.push(new ExternalHyperlink({
          link: m[3],
          children: [new TextRun({ text: m[2], style: "Hyperlink", ...base })],
        }));
      } else {
        // Local/relative path link -> render as monospace text (no broken rel).
        runs.push(new TextRun({ text: m[2], font: "Consolas", ...base }));
      }
    } else if (m[4]) {
      runs.push(new TextRun({ text: m[5], bold: true, ...base }));
    } else if (m[6]) {
      runs.push(new TextRun({ text: m[7], font: "Consolas", ...base }));
    }
    last = re.lastIndex;
  }
  plain(text.slice(last));
  return runs.length ? runs : [new TextRun({ text: "", ...base })];
}

const stripMd = (t) => t.replace(/\*\*/g, "").replace(/`/g, "");

// ---- read + split ----
const md = fs.readFileSync(path.join(ROOT, "DESIGN.md"), "utf8");
const firstHr = md.indexOf("\n---\n");
const titleBlock = md.slice(0, firstHr);
const body = md.slice(firstHr + 5);
const lines = body.split(/\r?\n/);

// title metadata
const titleLine = (titleBlock.match(/^#\s+(.+)$/m) || [])[1] || "Design";
const metaLines = [...titleBlock.matchAll(/^\*\*(.+?)\*\*\s*(.+)$/gm)]
  .map((m) => [stripMd(m[1]).replace(/:$/, ""), stripMd(m[2])]);

const children = [];
let mermaidIdx = 0;

const headingFor = (lvl) =>
  [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][lvl - 1];

function addCodeBlock(buf) {
  for (const ln of buf) {
    children.push(new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: "F4F4F4" },
      spacing: { after: 0 },
      children: [new TextRun({ text: ln || " ", font: "Consolas", size: 18 })],
    }));
  }
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
}

function addImage(idx) {
  const file = path.join(ROOT, "diagrams", `diagram-${idx}.png`);
  if (!fs.existsSync(file)) return;
  const { w, h } = pngSize(file);
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 160 },
    children: [new ImageRun({
      type: "png",
      data: fs.readFileSync(file),
      transformation: { width: IMG_W, height: Math.round(IMG_W * h / w) },
      altText: { title: `Diagram ${idx}`, description: `Diagram ${idx}`, name: `diagram${idx}` },
    })],
  }));
}

function addTable(rows) {
  const headerCells = rows[0];
  const ncol = headerCells.length;
  const colW = Math.floor(CONTENT_WIDTH / ncol);
  const widths = Array(ncol).fill(colW);
  widths[ncol - 1] = CONTENT_WIDTH - colW * (ncol - 1);
  const border = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const mkRow = (cells, isHeader) => new TableRow({
    tableHeader: isHeader,
    children: cells.map((c, i) => new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      shading: isHeader ? { type: ShadingType.CLEAR, fill: "2E5A88" } : undefined,
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({
        children: isHeader
          ? [new TextRun({ text: stripMd(c), bold: true, color: "FFFFFF" })]
          : parseInline(c),
      })],
    })),
  });
  children.push(new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [mkRow(headerCells, true), ...rows.slice(2).map((r) => mkRow(r, false))],
  }));
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
}

const splitRow = (ln) =>
  ln.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((s) => s.trim());

// ---- main parse loop ----
let i = 0;
while (i < lines.length) {
  const line = lines[i];
  if (!line.trim()) { i++; continue; }

  const hm = line.match(/^(#{1,4})\s+(.+)$/);
  if (hm) {
    children.push(new Paragraph({
      heading: headingFor(hm[1].length),
      children: parseInline(stripMd(hm[2]) === hm[2] ? hm[2] : hm[2]).map(
        (r) => r
      ),
    }));
    i++; continue;
  }

  if (line.startsWith("```")) {
    const info = line.slice(3).trim();
    const buf = [];
    i++;
    while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; }
    i++; // closing fence
    if (info === "mermaid") addImage(++mermaidIdx);
    else addCodeBlock(buf);
    continue;
  }

  if (line.trim().startsWith("|")) {
    const rows = [];
    while (i < lines.length && lines[i].trim().startsWith("|")) {
      rows.push(splitRow(lines[i])); i++;
    }
    if (rows.length >= 2) addTable(rows);
    continue;
  }

  const bullet = line.match(/^(\s*)[-*]\s+(.+)$/);
  if (bullet) {
    while (i < lines.length && /^(\s*)[-*]\s+(.+)$/.test(lines[i])) {
      const m = lines[i].match(/^(\s*)[-*]\s+(.+)$/);
      const lvl = Math.min(1, Math.floor(m[1].length / 2));
      children.push(new Paragraph({
        numbering: { reference: "bullets", level: lvl },
        children: parseInline(m[2]),
      }));
      i++;
    }
    continue;
  }

  const num = line.match(/^\s*\d+\.\s+(.+)$/);
  if (num) {
    while (i < lines.length && /^\s*\d+\.\s+(.+)$/.test(lines[i])) {
      const m = lines[i].match(/^\s*\d+\.\s+(.+)$/);
      children.push(new Paragraph({
        numbering: { reference: "numbers", level: 0 },
        children: parseInline(m[1]),
      }));
      i++;
    }
    continue;
  }

  if (line.startsWith("> ")) {
    children.push(new Paragraph({
      indent: { left: 360 },
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: "CCCCCC", space: 8 } },
      children: parseInline(line.slice(2), { italics: true, color: "555555" }),
    }));
    i++; continue;
  }

  if (line.trim() === "---") {
    children.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "DDDDDD", space: 1 } },
      spacing: { after: 120 }, children: [],
    }));
    i++; continue;
  }

  // paragraph: gather until blank / next block
  const buf = [line];
  i++;
  while (i < lines.length && lines[i].trim() &&
         !/^(#{1,4}\s|```|\s*[-*]\s|\s*\d+\.\s|>\s|\|)/.test(lines[i]) &&
         lines[i].trim() !== "---") {
    buf.push(lines[i]); i++;
  }
  children.push(new Paragraph({
    spacing: { after: 120 },
    children: parseInline(buf.join(" ")),
  }));
}

// ---- title page + TOC ----
const titlePage = [
  new Paragraph({ spacing: { before: 2400 }, children: [] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text: titleLine, bold: true, size: 48, color: "1F3A5F" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 600 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "2E5A88", space: 4 } },
    children: [new TextRun({ text: "Architecture & DevOps Design Document", italics: true, size: 26, color: "555555" })],
  }),
  ...metaLines.map((m) => new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 80 },
    children: [
      new TextRun({ text: `${m[0]}:  `, bold: true }),
      new TextRun({ text: m[1] }),
    ],
  })),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun("Table of Contents")],
  }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ---- document ----
const heading = (size, color, before, after, lvl) => ({
  run: { size, bold: true, font: "Arial", color },
  paragraph: { spacing: { before, after }, outlineLevel: lvl, keepNext: true },
});

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(30, "1F3A5F", 280, 140, 0) },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(25, "2E5A88", 220, 110, 1) },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(22, "2E5A88", 180, 90, 2) },
      { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, ...heading(21, "555555", 140, 70, 3) },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 280 } } } },
      ] },
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } },
      ] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "SoleMate — Design Document   |   Page ", size: 16, color: "888888" }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" }),
        ],
      })] }),
    },
    children: [...titlePage, ...children],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(path.join(ROOT, "DESIGN.docx"), buf);
  console.log("Wrote docs/DESIGN.docx (" + buf.length + " bytes), " + mermaidIdx + " diagrams embedded");
});
