import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssRoot = path.join(root, "public", "assets", "css");
const sources = [
  "system/10-legacy-compat.css",
  "system/20-sales-product.css",
  "system/21-catalogue.css",
  "system/22-bundles.css",
  "system/23-platform-feature-overrides.css",
  "system/24-product-hub.css",
  "system/30-workspace-core.css",
  "system/31-project-workspace.css",
  "system/32-sales-workspace.css",
  "system/33-workspace-polish.css",
  "system/34-customer-workspace.css",
  "system/35-warehouse-workspace.css",
  "system/40-design-system.css",
  "system/41-sales-order-command.css",
  "system/42-sales-order-parity.css",
  "system/43-sales-order-finder-polish.css",
  "system/44-purchase-order-command.css",
  "system/45-project-360-command.css",
  "system/46-product-hub-command.css",
  "system/47-inventory-location-control.css",
  "system/48-fulfilment-command.css",
  "system/49-supplier-command.css",
  "system/50-finance-command.css",
  "system/51-analytics-command.css",
  "system/52-automation-command.css",
  "system/53-settings-command.css",
  "system/54-production-readiness.css",
  "system/55-login-command.css",
  "system/56-executive-premium-components.css",
  "system/57-notifications-command.css",
  "system/58-foundation-authority.css",
  "system/59-my-work-action-authority.css",
];
const banner = `/*
 Pool Shed application stylesheet.
 GENERATED FILE — do not edit directly.
 Source order is deliberately stable. Shared component/design authority lives
 in system/40-design-system.css.
*/\n`;
const output = banner + sources.map((rel) => {
  const full = path.join(cssRoot, rel);
  if (!fs.existsSync(full)) throw new Error(`Missing CSS source module: ${rel}`);
  return `\n/* ===== MODULE: ${rel} ===== */\n${fs.readFileSync(full, "utf8")}`;
}).join("\n");
fs.writeFileSync(path.join(cssRoot, "app.css"), output);
console.log(`Built app.css from ${sources.length} maintained CSS modules.`);
