const pairs = [
  ['white on steel-blue primary', '#FFFFFF', '#2F6B84', 4.5],
  ['white on steel-blue hover', '#FFFFFF', '#24566A', 4.5],
  ['primary text on light canvas', '#18242C', '#F5F7F8', 4.5],
  ['secondary text on light canvas', '#5F6D75', '#F5F7F8', 4.5],
  ['dark primary text on dark canvas', '#EEF3F5', '#0F1419', 4.5],
  ['dark secondary text on dark canvas', '#A9B5BB', '#0F1419', 4.5],
  ['dark steel-blue ink on dark soft selection', '#DFF3FB', '#17313D', 4.5],
  ['success text/background', '#176B42', '#E6F5EE', 4.5],
  ['warning text/background', '#89500A', '#FFF3DF', 4.5],
  ['danger text/background', '#91303A', '#FDEBED', 4.5],
  ['info text/background', '#245A7F', '#E8F2F9', 4.5],
  ['dark success/background', '#55C68A', '#173226', 4.5],
  ['dark warning/background', '#E2A451', '#3A2C18', 4.5],
  ['dark danger/background', '#E07079', '#3A2024', 4.5],
  ['dark info/background', '#6FA9D3', '#183044', 4.5],
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
  if (ratio < minimum) {
    console.error(`FAIL ${name}: ${ratio.toFixed(2)}:1 < ${minimum}:1`);
    failed = true;
  } else {
    console.log(`PASS ${name}: ${ratio.toFixed(2)}:1`);
  }
}
if (failed) process.exit(1);
