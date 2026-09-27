const pairs = [
  ['white on Pool Teal primary', '#FFFFFF', '#187C8C', 4.5],
  ['white on Pool Teal hover', '#FFFFFF', '#126273', 4.5],
  ['primary text on light canvas', '#17242C', '#F4F6F5', 4.5],
  ['secondary text on light canvas', '#5C6971', '#F4F6F5', 4.5],
  ['muted text on light action-soft', '#616E76', '#E2F1F3', 4.5],
  ['dark primary text on dark canvas', '#EDF3F4', '#0F171C', 4.5],
  ['dark secondary text on dark canvas', '#AAB8BE', '#0F171C', 4.5],
  ['dark muted text on dark surface', '#8E9EA5', '#162127', 4.5],
  ['dark Pool Teal ink on dark soft selection', '#86CED6', '#17383E', 4.5],
  ['success text/background', '#1D6848', '#E7F4ED', 4.5],
  ['warning text/background', '#8C5613', '#FBF1E3', 4.5],
  ['danger text/background', '#91353C', '#F9E9EA', 4.5],
  ['info text/background', '#2B6482', '#E8F1F6', 4.5],
  ['dark success/background', '#91D4AD', '#173328', 4.5],
  ['dark warning/background', '#EDC17F', '#392A17', 4.5],
  ['dark danger/background', '#EDA0A5', '#3B2024', 4.5],
  ['dark info/background', '#9CC9DD', '#19303C', 4.5],
];

function luminance(hex) {
  const rgb = [1,3,5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = rgb.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
let failed = false;
for (const [name, fg, bg, minimum] of pairs) {
  const ratio = contrast(fg, bg);
  if (ratio < minimum) { console.error(`FAIL ${name}: ${ratio.toFixed(2)}:1 < ${minimum}:1`); failed = true; }
  else console.log(`PASS ${name}: ${ratio.toFixed(2)}:1`);
}
if (failed) process.exit(1);
