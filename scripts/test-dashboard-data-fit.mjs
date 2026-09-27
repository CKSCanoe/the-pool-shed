import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const css=fs.readFileSync(path.join(root,"public","assets","css","system","24-product-hub.css"),"utf8");
const failures=[];

for (const required of [
  "grid-template-columns: minmax(0, 1fr) 264px",
  "grid-template-columns: 196px minmax(0, 1fr)",
  "height: 310px",
  "grid-template-columns: minmax(0, .95fr) minmax(0, 1.3fr) minmax(0, .9fr)",
  "@media (max-width: 1720px)",
  ".dashboard-project-table-wrap th:nth-child(1)",
  "table-layout: fixed",
  "min-width: 0",
  "min-width: 980px"
]) {
  if (!css.includes(required)) failures.push(`Missing dashboard data-fit rule: ${required}`);
}

const tableBlock=css.slice(css.indexOf(".dashboard-project-table-wrap table"), css.indexOf(".dashboard-project-table-wrap th {"));
if (!/min-width:\s*0/.test(tableBlock)) failures.push("Desktop project table still has a forced minimum width.");
if (!/table-layout:\s*fixed/.test(tableBlock)) failures.push("Desktop project table is not fixed-layout.");
if (/minmax\(245px/.test(css) || /minmax\(360px/.test(css)) failures.push("Old hard minimum widths still squeeze insight cards.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Dashboard data-fit checks passed: insights reflow before clipping and project table fits desktop width.");
