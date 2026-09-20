// packages/core/src/schema.ts
function normalizeCornerRadius(v) {
  if (v == null) return { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
  if (typeof v === "number") {
    const r = Math.max(0, v);
    return { topLeft: r, topRight: r, bottomRight: r, bottomLeft: r };
  }
  return {
    topLeft: Math.max(0, v.topLeft || 0),
    topRight: Math.max(0, v.topRight || 0),
    bottomRight: Math.max(0, v.bottomRight || 0),
    bottomLeft: Math.max(0, v.bottomLeft || 0)
  };
}
function isUniformCornerRadius(v) {
  if (v == null || typeof v === "number") return true;
  const c = normalizeCornerRadius(v);
  return c.topLeft === c.topRight && c.topRight === c.bottomRight && c.bottomRight === c.bottomLeft;
}
var VALID_CLIP_SHAPES = [
  "none",
  "circle",
  "ellipse",
  "triangle",
  "hexagon",
  "star",
  "heart"
];
function normalizeCropRect(v) {
  if (!v || typeof v !== "object") return void 0;
  const c = v;
  const n2 = {
    x: typeof c.x === "number" ? c.x : 0,
    y: typeof c.y === "number" ? c.y : 0,
    width: typeof c.width === "number" ? c.width : 1,
    height: typeof c.height === "number" ? c.height : 1
  };
  if (n2.width <= 0 || n2.height <= 0) return void 0;
  return {
    x: Math.max(0, Math.min(1, n2.x)),
    y: Math.max(0, Math.min(1, n2.y)),
    width: Math.max(0.01, Math.min(1, n2.width)),
    height: Math.max(0.01, Math.min(1, n2.height))
  };
}
function normalizeImageClip(v) {
  if (!v) return { shape: "none" };
  if (typeof v === "string") {
    return { shape: VALID_CLIP_SHAPES.includes(v) ? v : "none" };
  }
  const shape = v.shape || "none";
  const clip = { shape: VALID_CLIP_SHAPES.includes(shape) ? shape : "none" };
  const crop = normalizeCropRect(v.crop);
  if (crop) {
    crop.width = Math.min(crop.width, 1 - crop.x);
    crop.height = Math.min(crop.height, 1 - crop.y);
    clip.crop = crop;
  }
  return clip;
}
function regularPolygonPoints(cx, cy, r, sides, startDeg = -90) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const ang = (startDeg - 90) * (Math.PI / 180) + i * 2 * Math.PI / sides;
    pts.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  return pts;
}
function starPoints2(cx, cy, outer, inner, points, startDeg = -90) {
  const pts = [];
  const step = Math.PI / points;
  const startRad = (startDeg - 90) * (Math.PI / 180);
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const ang = startRad + i * step;
    pts.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  return pts;
}
function heartPathScaled(w, h) {
  const sx = w / 100;
  const sy = h / 100;
  const p = (x, y) => `${(x * sx).toFixed(2)},${(y * sy).toFixed(2)}`;
  return `M${p(50, 88)} C${p(20, 65)} ${p(2, 45)} ${p(2, 28)} C${p(2, 13)} ${p(14, 5)} ${p(27, 5)} C${p(39, 5)} ${p(46, 14)} ${p(50, 22)} C${p(54, 14)} ${p(61, 5)} ${p(73, 5)} C${p(86, 5)} ${p(98, 13)} ${p(98, 28)} C${p(98, 45)} ${p(80, 65)} ${p(50, 88)} Z`;
}
function buildClipSvgPath(shape, w, h) {
  if (shape === "none") return "";
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2;
  const f = (n2) => n2.toFixed(2);
  switch (shape) {
    case "circle":
      return `M ${f(cx - R)},${f(cy)} a ${f(R)},${f(R)} 0 1,0 ${f(2 * R)},0 a ${f(R)},${f(R)} 0 1,0 ${f(-2 * R)},0 Z`;
    case "ellipse": {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${f(cx - rx)},${f(cy)} a ${f(rx)},${f(ry)} 0 1,0 ${f(2 * rx)},0 a ${f(rx)},${f(ry)} 0 1,0 ${f(-2 * rx)},0 Z`;
    }
    case "triangle":
      return `M ${f(w / 2)},0 L 0,${f(h)} L ${f(w)},${f(h)} Z`;
    case "hexagon":
      return "M " + regularPolygonPoints(cx, cy, R, 6).map((p) => `${f(p.x)},${f(p.y)}`).join(" L ") + " Z";
    case "star":
      return "M " + starPoints2(cx, cy, R, R * 0.382, 5).map((p) => `${f(p.x)},${f(p.y)}`).join(" L ") + " Z";
    case "heart":
      return heartPathScaled(w, h);
    default:
      return "";
  }
}
function drawClipOnContext(ctx, shape, w, h) {
  if (shape === "none") return;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2;
  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.closePath();
      break;
    case "ellipse":
      ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.closePath();
      break;
    case "triangle":
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(0, h);
      ctx.lineTo(w, h);
      ctx.closePath();
      break;
    case "hexagon":
      regularPolygonPoints(cx, cy, R, 6).forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      break;
    case "star":
      starPoints2(cx, cy, R, R * 0.382, 5).forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.closePath();
      break;
    case "heart": {
      const sx = w / 100;
      const sy = h / 100;
      const X = (x) => x * sx;
      const Y = (y) => y * sy;
      ctx.moveTo(X(50), Y(88));
      ctx.bezierCurveTo(X(20), Y(65), X(2), Y(45), X(2), Y(28));
      ctx.bezierCurveTo(X(2), Y(13), X(14), Y(5), X(27), Y(5));
      ctx.bezierCurveTo(X(39), Y(5), X(46), Y(14), X(50), Y(22));
      ctx.bezierCurveTo(X(54), Y(14), X(61), Y(5), X(73), Y(5));
      ctx.bezierCurveTo(X(86), Y(5), X(98), Y(13), X(98), Y(28));
      ctx.bezierCurveTo(X(98), Y(45), X(80), Y(65), X(50), Y(88));
      ctx.closePath();
      break;
    }
    default:
      break;
  }
}

// ../../test-shots/clip-test.ts
var pass = 0;
var fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log("  PASS", name);
  } else {
    fail++;
    console.log("  FAIL", name);
  }
}
console.log("buildClipSvgPath:");
var circle = buildClipSvgPath("circle", 100, 100);
check("circle starts with M and ends Z", circle.startsWith("M") && circle.endsWith("Z"));
check("circle contains arc (a)", circle.includes(" a "));
var heart = buildClipSvgPath("heart", 200, 100);
check("heart uses bezier C and Z", heart.includes("C") && heart.endsWith("Z"));
check("heart x scaled by 2 (100 -> 200 box)", heart.includes("196.00") && heart.includes("4.00"));
var tri = buildClipSvgPath("triangle", 100, 100);
check("triangle has L commands", tri.includes("L"));
var none = buildClipSvgPath("none", 100, 100);
check("none returns empty", none === "");
check("all shapes return non-empty path", ["circle", "ellipse", "triangle", "hexagon", "star", "heart"].every((s) => buildClipSvgPath(s, 120, 80).length > 0));
console.log("normalizeImageClip:");
check("string -> {shape}", JSON.stringify(normalizeImageClip("star")) === JSON.stringify({ shape: "star" }));
check("undefined -> none", normalizeImageClip(void 0).shape === "none");
check("null -> none", normalizeImageClip(null).shape === "none");
check("object passes through", normalizeImageClip({ shape: "hexagon" }).shape === "hexagon");
check("object invalid -> none", normalizeImageClip({ shape: "bogus" }).shape === "none");
console.log("drawClipOnContext (mock ctx):");
function makeMock() {
  const calls = [];
  return {
    calls,
    beginPath() {
      calls.push("beginPath");
    },
    moveTo(x, y) {
      calls.push(`moveTo(${x.toFixed(1)},${y.toFixed(1)})`);
    },
    lineTo(x, y) {
      calls.push(`lineTo(${x.toFixed(1)},${y.toFixed(1)})`);
    },
    arc(_x, _y, _r, _s, _e, _c) {
      calls.push("arc");
    },
    ellipse(_x, _y, _rx, _ry, _rot, _s, _e) {
      calls.push("ellipse");
    },
    bezierCurveTo() {
      calls.push("bezierCurveTo");
    },
    closePath() {
      calls.push("closePath");
    }
  };
}
var mc = makeMock();
drawClipOnContext(mc, "circle", 100, 100);
check("circle: begin+arc+close", mc.calls[0] === "beginPath" && mc.calls.includes("arc") && mc.calls[mc.calls.length - 1] === "closePath");
var mh = makeMock();
drawClipOnContext(mh, "heart", 200, 100);
check("heart: begin+bezier+close", mh.calls[0] === "beginPath" && mh.calls.filter((c) => c === "bezierCurveTo").length === 6 && mh.calls[mh.calls.length - 1] === "closePath");
var mt = makeMock();
drawClipOnContext(mt, "triangle", 100, 100);
check("triangle: moveTo + 2 lineTo + close (3 vertices)", mt.calls[0] === "beginPath" && mt.calls.filter((c) => c.startsWith("lineTo")).length === 2 && mt.calls[mt.calls.length - 1] === "closePath");
console.log("corner helpers:");
check("uniform equal corners", isUniformCornerRadius({ topLeft: 5, topRight: 5, bottomRight: 5, bottomLeft: 5 }));
check("non-uniform detected", !isUniformCornerRadius({ topLeft: 5, topRight: 6, bottomRight: 5, bottomLeft: 5 }));
check("number is uniform", isUniformCornerRadius(10));
var n = normalizeCornerRadius({ topLeft: 2, topRight: 3, bottomRight: 4, bottomLeft: 5 });
check("normalize object", n.topLeft === 2 && n.bottomLeft === 5);
console.log(`
RESULT: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
