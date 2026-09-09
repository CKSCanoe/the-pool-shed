const pairs = [
  ["selection white on Pool Teal", "#FFFFFF", "#007A8C", 4.5],
  ["navy on Aqua", "#102B3A", "#00A7C4", 4.5],
  ["success text/background", "#176B42", "#EAF7EF", 4.5],
  ["attention text/background", "#895005", "#FFF5DA", 4.5],
  ["danger text/background", "#9E3039", "#FDEDEF", 4.5],
  ["info text/background", "#145F80", "#EAF5FA", 4.5],
  ["primary text/canvas", "#17252E", "#F3F6F8", 4.5],
  ["secondary text/canvas", "#5B6972", "#F3F6F8", 4.5],
  ["dark secondary/canvas", "#A7B7C0", "#0C1821", 4.5],
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
