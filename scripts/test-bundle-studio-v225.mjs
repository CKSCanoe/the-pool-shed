import fs from "node:fs";
const legacy=fs.readFileSync("public/assets/js/01-legacy-01.js","utf8");
const studio=fs.readFileSync("public/bundle-studio-v224.js","utf8");
const html=fs.readFileSync("public/index.html","utf8");
const checks=[
 [legacy.includes("window.__POOL_SHED_GET_PRODUCTS__"),"catalogue bridge is exposed"],
 [legacy.includes("return Array.isArray(data && data.products) ? data.products : []"),"bridge returns live products"],
 [studio.includes("__POOL_SHED_GET_PRODUCTS__"),"Bundle Builder consumes catalogue bridge"],
 [studio.includes("Catalogue is still loading"),"loading state is explicit"],
 [studio.includes("version:VERSION"),"module version exported"],
 [html.includes("v2.2.5-catalogue-bridge-fix"),"build marker updated"]
];
for(const [ok,msg] of checks){if(!ok)throw new Error("Failed: "+msg);console.log("PASS",msg)}
console.log("Bundle Studio v2.2.5 checks passed");
