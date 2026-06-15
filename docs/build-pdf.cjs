/* Build a print-ready HTML from DESIGN.md (diagrams inlined as base64). */
const fs = require("fs");
const path = require("path");
const { marked } = require("marked");

const ROOT = __dirname;
let md = fs.readFileSync(path.join(ROOT, "DESIGN.md"), "utf8");

// Replace each ```mermaid block with the matching rendered PNG (base64-inlined).
let idx = 0;
md = md.replace(/```mermaid\n[\s\S]*?```/g, () => {
  idx++;
  const file = path.join(ROOT, "diagrams", `diagram-${idx}.png`);
  const b64 = fs.readFileSync(file).toString("base64");
  return `<img class="diagram" src="data:image/png;base64,${b64}" alt="Diagram ${idx}"/>`;
});

marked.setOptions({ gfm: true });
const bodyHtml = marked.parse(md);

const css = `
  @page { size: Letter; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #222; font-size: 11pt; line-height: 1.5; }
  h1 { color: #1F3A5F; font-size: 22pt; border-bottom: 2px solid #2E5A88; padding-bottom: 4px; margin-top: 26px; }
  h2 { color: #2E5A88; font-size: 16pt; margin-top: 22px; }
  h3 { color: #2E5A88; font-size: 13pt; margin-top: 16px; }
  h1:first-of-type { margin-top: 0; }
  p { margin: 8px 0; }
  code { font-family: Consolas, "Courier New", monospace; background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 9.5pt; }
  pre { background: #f4f4f4; padding: 10px 12px; border-radius: 4px; overflow-x: auto; page-break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 9pt; line-height: 1.35; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10pt; page-break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 6px 9px; text-align: left; vertical-align: top; }
  th { background: #2E5A88; color: #fff; }
  tr:nth-child(even) td { background: #f7f9fb; }
  img.diagram { display: block; max-width: 86%; height: auto; margin: 14px auto; page-break-inside: avoid; border: 1px solid #e3e3e3; padding: 6px; border-radius: 4px; }
  blockquote { border-left: 3px solid #ccc; margin: 8px 0; padding: 2px 12px; color: #555; font-style: italic; }
  h1, h2, h3 { page-break-after: avoid; }
  ul, ol { margin: 8px 0; }
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${bodyHtml}</body></html>`;
fs.writeFileSync(path.join(ROOT, "DESIGN.print.html"), html);
console.log("Wrote docs/DESIGN.print.html (" + idx + " diagrams inlined)");
