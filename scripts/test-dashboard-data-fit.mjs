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
  "min-width: 980px"
]) {
  if (!css.includes(required)) failures.push(`Missing dashboard data-fit rule: ${required}`);
}

// v1.85: the rule that applies is the later one in 60-responsive-layout.css (the project table scrolls sideways on a
// laptop instead of squashing nine columns); the earlier fixed-layout lines here were always overridden and were removed.
const responsive=fs.readFileSync(path.join(root,"public","assets","css","system","60-responsive-layout.css"),"utf8");
if (!/\.dashboard-project-table-wrap\{[^}]*overflow-x:auto/.test(responsive)) failures.push("Project table must scroll sideways rather than squash.");
if (!/\.dashboard-project-table-wrap table\{[^}]*min-width:1060px/.test(responsive)) failures.push("Project table needs its readable minimum width.");
if (/minmax\(245px/.test(css) || /minmax\(360px/.test(css)) failures.push("Old hard minimum widths still squeeze insight cards.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Dashboard data-fit checks passed: insights reflow before clipping and project table fits desktop width.");
