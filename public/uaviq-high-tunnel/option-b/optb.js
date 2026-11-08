// Option B page: one custom side-pod frame at a time, every section filled from data/models.json.
// The per-sortie tables fly the Option A page's side-view model (../sim.js) for every aircraft.
import {
  SPECS, Aircraft, payloadKg, simulate, missionRef, missionWind, AVIONICS_W, BLOWER_W, MISSION_END, RESERVE,
} from "../sim.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function el(tag, props = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "style") e.style.cssText = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const pct = (v) => `${Math.round(100 * v)} %`;
const cm = (m) => `${Math.round(100 * m)} cm`;
const FILS = ["ASA", "PA-CF", "TPU"];
const FIL_CLASS = { ASA: "fil-asa", "PA-CF": "fil-pacf", TPU: "fil-tpu" };
const FIL_LINE = { ASA: "Anycubic ASA filament", "PA-CF": "Anycubic PA6-CF filament", TPU: "Anycubic TPU 95A filament" };
const FLAG_TAG = { ref: "tag-bad", warn: "tag-warn", info: "tag-info", good: "tag-good" };
const KIND_TAG = { Replace: "tag-warn", Add: "tag-good", Spare: "tag-info", Allowance: "tag-muted", Make: "tag-info" };
const B_COLOR = "#00d4ff";
const safeUrl = (u) => (typeof u === "string" && u.startsWith("https://") ? u : null);

let DATA, A_BOM, cur;
let viewerLive = false;
const SORTIES = { "1L": null, "2L": null };

function stockClass(text) {
  const s = (text || "").toLowerCase();
  if (s.startsWith("in stock") || s.startsWith("add to cart")) return "good";
  if (/backorder|sold out|out of stock/.test(s)) return "bad";
  if (s.startsWith("listed as available")) return "warn";
  return "";
}

const head = (cols, num = []) => el("thead", {}, el("tr", {}, cols.map((h, i) =>
  el("th", { scope: "col", class: num.includes(i) ? "num" : null, text: h }))));

// ---- per-sortie tables: sim.js runMission / runSorties, with each aircraft's own blower power -----------------
function mission(ac, soc = 0.98) {
  const blower = ac.blowerW ?? BLOWER_W;
  const aux = (t) => AVIONICS_W + (t >= 92 && t < 152 ? blower : 0);
  const log = simulate(ac, MISSION_END, missionRef, { wind: missionWind, aux, soc, dt: 0.004, onGround: true, logDt: 0.02 });
  const start = log.soc[0], end = log.soc[log.soc.length - 1];
  const air = log.t.map((t, i) => (t >= 8 && t <= 152 ? i : -1)).filter((i) => i >= 0);
  return {
    start, end, used: start - end,
    minTw: Math.min(...air.map((i) => log.tw[i])),
    maxErr: Math.max(...air.map((i) => Math.abs(log.z[i] - log.zr[i]))),
    peakLoad: Math.min(1, Math.max(...log.load)),
  };
}

// yield to the page between sorties; a message is not clamped like setTimeout in a background tab
const pause = () => new Promise((resolve) => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => resolve();
  ch.port2.postMessage(0);
});

async function sorties(ac) {
  const runs = [mission(ac)];
  while (runs.at(-1).end >= RESERVE && runs.length < 30) {
    await pause();
    runs.push(mission(ac, runs.at(-1).end));
  }
  const full = runs.filter((r) => r.end >= RESERVE);
  const next = runs[full.length] ?? runs.at(-1);
  const last = full.at(-1) ?? runs[0];
  return {
    ...runs[0],
    sorties: full.length + (next.start - RESERVE) / (next.start - next.end),
    lastTw: last.minTw,
    lastLoad: last.peakLoad,
    maxErr: Math.max(...(full.length ? full : runs).map((r) => r.maxErr)),
  };
}

function specB(m) {
  const s = m.sim2d;
  return {
    ...SPECS.proposed, key: m.name, name: `Option B: ${m.name}`, short: m.name, color: B_COLOR,
    baseKg: s.fullKg - payloadKg({ mountKg: 0 }, s.vol), mountKg: 0, inertia: s.inertia, arm: s.arm, blowerW: s.blowerW,
  };
}

async function flyTable(vol) {
  const refs = (vol === "1L" ? ["x500", "x650", "proposed"] : ["x650", "proposed"]).map((k) => ({ spec: SPECS[k] }));
  const bs = DATA.order.filter((k) => DATA.models[k].vol === vol).map((k) => ({ spec: specB(DATA.models[k]), model: k }));
  const rows = [...refs, ...bs];
  for (const r of rows) r.res = await sorties(new Aircraft(r.spec, payloadKg(r.spec, vol)));
  SORTIES[vol] = rows;
  renderSortie(vol);
}

function renderSortie(vol) {
  const rows = SORTIES[vol];
  const box = $(`#sortie${vol}`);
  if (!rows) return;
  box.replaceChildren(el("div", { class: "table-scroll" }, el("table", { class: "tbl" },
    head(["Per sortie", "Battery used", "Sorties per charge", "Thrust/weight", "Peak motor load", "Worst height error"],
      [1, 2, 3, 4, 5]),
    el("tbody", {}, rows.map((r) => {
      const m = r.model && DATA.models[r.model];
      const res = r.res;
      return el("tr", { class: r.model === cur ? "hl sel" : r.spec.key === "proposed" ? "ref-a" : null },
        el("th", { scope: "row" },
          r.model ? el("button", { type: "button", class: "rowpick", style: `color:${r.spec.color}`, "data-model": r.model,
            text: `Option B: ${r.model}` }) : el("span", { style: `color:${r.spec.color}`, text: r.spec.name }),
          m && m.reference ? el("span", { class: "tag tag-bad mini", text: "reference" }) : null,
          m && !m.reference && m.flags.some((f) => f[0] === "warn") ? el("span", { class: "tag tag-warn mini", text: "reduced margin" }) : null),
        el("td", { class: "num", text: pct(res.used) }),
        el("td", { class: "num", text: res.sorties.toFixed(1) }),
        el("td", { class: "num", text: `${res.minTw.toFixed(2)} → ${res.lastTw.toFixed(2)}` }),
        el("td", { class: "num", text: `${Math.round(100 * res.peakLoad)} → ${Math.round(100 * res.lastLoad)} %` }),
        el("td", { class: "num", text: `${res.maxErr.toFixed(2)} m` }));
    })))));
  $$(".rowpick", box).forEach((b) => b.addEventListener("click", () => {
    $("#model").value = b.dataset.model;
    show(b.dataset.model, true);
  }));
}

// ---- one frame -------------------------------------------------------------------------------------------------
function viewer(m) {
  $("#viewerTitle").textContent = `Option B ${m.name}: ${m.title}`;
  const full = `viewer/?cfg=${encodeURIComponent(m.name)}`;
  $("#viewerFull").href = full;
  $("#viewerPoster").href = full;
  const img = $("#viewerPosterImg");
  img.src = m.media.render;
  img.alt = `3D model of Option B ${m.name}`;
  if (viewerLive) $("#viewerFrame").contentWindow.postMessage({ type: "ajb-cfg", cfg: m.name }, location.origin);
}

function initViewer() {
  const frame = $("#viewerFrame"), wrap = $("#viewerWrap");
  // the viewer reports each frame it shows; if the dropdown moved on while it loaded, send the newer choice
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.data?.type !== "ajb-viewer-shown" || e.data.cfg === cur) return;
    frame.contentWindow.postMessage({ type: "ajb-cfg", cfg: cur }, location.origin);
  });
  if (!matchMedia("(min-width: 760px)").matches) return; // phones get the poster and a full-screen link
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    frame.src = `viewer/?embed=1&cfg=${encodeURIComponent(cur)}`;
    wrap.classList.add("live");
    viewerLive = true;
    obs.disconnect();
  }, { rootMargin: "300px" }).observe(wrap);
}

// once the hero scrolls away the picker floats under the top bar; fixed, because a sticky one could not leave the hero
function floatPicker() {
  const slot = $("#pickerSlot"), card = $("#picker"), bar = $(".topbar");
  const update = () => {
    const r = slot.getBoundingClientRect(), y = bar.getBoundingClientRect().bottom;
    const float = r.top < y;
    if (float !== card.classList.contains("floating")) {
      slot.style.height = float ? `${r.height}px` : "";
      card.classList.toggle("floating", float);
    }
    card.style.top = float ? `${y}px` : "";
  };
  addEventListener("scroll", update, { passive: true });
  addEventListener("resize", update);
  update();
}

function kpis(m) {
  const a = SPECS.proposed;
  const aKg = a.baseKg + payloadKg(a, m.vol);
  const aTw = (4 * a.test.at(-1)[0]) / 1000 / aKg;
  const tile = (label, val, note, cls) => el("div", { class: "kpi" },
    el("p", { class: "kpi-label", text: label }), el("p", { class: `kpi-val ${cls || ""}`, text: val }),
    el("p", { class: "kpi-note", text: note }));
  const twCls = m.perf.tw >= 2 ? "good" : m.perf.tw >= 1.8 ? "warn" : "bad";
  const L = m.load;
  const loadCls = L.peak_share <= 0.8 ? "good" : L.peak_share <= 0.9 ? "warn" : "bad";
  $("#kpis").replaceChildren(
    tile("Take-off mass, full releaser", `${(m.mass.full_g / 1000).toFixed(2)} kg`,
      `Option A with the ${m.vol.replace("L", " L")}: ${aKg.toFixed(2)} kg`),
    tile("Thrust-to-weight", m.perf.tw.toFixed(2), `nominal battery voltage · Option A ${aTw.toFixed(2)} · target 2.0`, twCls),
    tile("Hover throttle", `${m.perf.hover_pct.toFixed(0)} %`, "full releaser, from the motor load test"),
    tile("Peak motor load (estimated)", pct(L.peak_share),
      `busiest motor's share of full thrust in the Gazebo mission · about ${L.peak_a.toFixed(0)} A of the ESC's ${L.esc_a} A`,
      loadCls),
    tile("Endurance", `${m.perf.end_rel_min.toFixed(1)} / ${m.perf.end_nav_min.toFixed(1)} min`,
      "releasing / navigating, using 80 % of the pack"),
    tile("New parts at list", usd0.format(m.bom_totals.list),
      `${A_BOM ? `Option A ${usd0.format(A_BOM.totals.list)} · ` : ""}plates and allowances estimated`));
}

function flight(m) {
  const v = $("#video");
  if (v.dataset.cfg !== m.name) {                // back to the poster: the video loads only on play
    v.pause();
    v.removeAttribute("src");
    v.load();
    v.dataset.cfg = m.name;
    $("#videoPoster").src = m.media.poster;
    $("#videoPoster").alt = `Still from the Gazebo flight of Option B ${m.name}`;
    $("#videoStart").hidden = false;
  }
  v.setAttribute("aria-label", `Gazebo recording of Option B ${m.name} flying the two-tunnel mission`);
  $("#videoCap").textContent = `Option B ${m.name}: ${m.title}. Take-off and landing play in real time, the rest at 2×.`
    + (m.lidar === "none" ? "" : " The window at the lower left is the lidar point cloud: the sensor's own scans from this "
      + "flight, placed by the drone's pose and coloured by height" + (m.lidar === "mid360" ? ", with the roof hidden." : "."));
  const g = m.gazebo, t = g.tunnel, rows = [];
  const motors = (a) => a.map((x) => x.toFixed(2)).join(", ");
  if (t) {
    rows.push(["Flight time, take-off to landing", `${t.flight_s.toFixed(0)} s`],
      ["Doses released over the rows", `${t.doses} / 6${m.pods === "twin" ? " (pairs)" : ""}`],
      ["Off the planned path: RMS / while releasing / peak",
        `${cm(t.xtrack_rms_m)} / ${cm(t.xtrack_rows_rms_m)} / ${t.xtrack_max_m.toFixed(2)} m`],
      ["Door passages: worst offset / rotor tips to the door frame",
        `${cm(t.door_offset_max_m)} / ${t.door_clearance_min_m.toFixed(2)} m`],
      ["Height error: RMS / peak", `${cm(t.track_z_rms_m)} / ${cm(t.track_z_max_m)}`],
      ["Position estimate against truth (RMS)", `${Math.round(1000 * t.est_h_rms_m)} mm`],
      ["Mean electrical power / endurance at that power",
        `${t.mean_power_w.toFixed(0)} W / ${t.endurance_min_at_mean_power.toFixed(1)} min`],
      ["Busiest motor command (rotor speed): peak / 99th percentile / time above 90 %",
        `${pct(t.motor_max)} / ${pct(t.motor_p99)} / ${t.time_any_motor_above_90pct_s.toFixed(0)} s`],
      ["Busiest motor's share of full thrust, estimated: peak / 99th percentile",
        `${pct(m.load.peak_share)} / ${pct(m.load.p99_share)}`],
      [`Busiest motor's current, estimated: peak (ESC rated ${m.load.esc_a} A)`, `${m.load.peak_a.toFixed(1)} A`],
      ["Sideways drift at touchdown, in the gusty gap", `${t.touchdown_drift_ms.toFixed(2)} m/s`]);
    if (t.motors_full) {
      rows.push(["Motors FR, RL, FL, RR, full releaser", motors(t.motors_full)],
        ["Motors after the last dose", motors(t.motors_empty)]);
    }
  }
  if (g.hover) {
    rows.push(["Hover: roll / left-right motor spread", `${g.hover.roll_deg.toFixed(1)}° / ${(100 * g.hover.motor_spread).toFixed(1)} %`]);
  }
  if (g.obstacle) {
    rows.push(["Obstacle stop, pilot flying at a post", g.obstacle.aborted
      ? `no stop: closest ${g.obstacle.min_gap_m.toFixed(2)} m` : `stopped ${g.obstacle.min_gap_m.toFixed(2)} m from the post`]);
  }
  $("#gzTable").replaceChildren(el("tbody", {}, rows.map(([a, b]) =>
    el("tr", {}, el("th", { scope: "row", text: a }), el("td", { class: "num", text: b })))));
}

function numbers(m) {
  $("#numbersTable").replaceChildren(el("tbody", {}, m.numbers.map(([a, b]) =>
    el("tr", {}, el("th", { scope: "row", text: a }), el("td", { class: "num", text: b })))));
  $("#checksTable").replaceChildren(head(["Check", "Value"], [1]), el("tbody", {}, m.checks.map((c) =>
    el("tr", {}, el("th", { scope: "row", text: c.name }),
      el("td", { class: "num" }, `${c.value} `, el("span", { class: c.ok ? "ok" : "bad", text: c.ok ? "✓" : "✗",
        "aria-label": c.ok ? "passes" : "fails" }))))));
}

function bom(m) {
  const groups = [];
  for (const b of m.bom) {
    const g = groups.find((x) => x.cat === b.cat);
    if (g) g.items.push(b); else groups.push({ cat: b.cat, items: [b] });
  }
  const link = (b) => (safeUrl(b.url) ? el("a", { href: b.url, target: "_blank", rel: "noopener noreferrer", text: b.item })
    : el("span", { class: "est", text: b.item }));
  $("#bomTable").replaceChildren(
    head(["#", "Item", "Vendor", "Qty", "Unit", "Extended", "Stock when checked", "Type"], [3, 4, 5]),
    el("tbody", {}, groups.flatMap((g) => [
      el("tr", { class: "group" }, el("th", { colspan: "8", scope: "colgroup" }, g.cat,
        el("span", { text: usd2.format(g.items.reduce((s, b) => s + b.ext, 0)) }))),
      ...g.items.map((b) => el("tr", { class: b.src === "B" ? "row-b" : null },
        el("td", { class: "num", text: b.n }),
        el("td", { class: "item" }, link(b), b.sku ? el("span", { class: "sku", text: b.sku }) : null,
          b.notes ? el("span", { class: "note", text: b.notes }) : null),
        el("td", { text: b.vendor || "–" }),
        el("td", { class: "num", text: b.qty }),
        el("td", { class: "num", text: usd2.format(b.unit) }),
        el("td", { class: "num", text: usd2.format(b.ext) }),
        el("td", { class: `stock ${stockClass(b.stock)}`, text: b.estimate ? "Estimate" : b.stock || "–" }),
        el("td", {}, el("span", { class: `tag ${KIND_TAG[b.kind] || ""}`, text: b.kind })))),
    ])));
  const T = m.bom_totals;
  const est = [];
  if (m.bom.some((b) => b.estimate && b.item.startsWith("Carbon plates"))) est.push("cut-to-order plates");
  if (m.bom.some((b) => b.estimate && b.kind === "Allowance")) est.push("wiring and harness allowances");
  if (m.bom.some((b) => b.estimate && b.item.startsWith("Livox"))) est.push("Mid-360");
  $("#bomTotals").replaceChildren(
    el("div", {}, el("span", { text: "At store prices (each item links to the page we checked)" }),
      el("b", { text: usd2.format(T.verified) })),
    el("div", {}, el("span", { text: `Estimates: ${est.join(", ")}` }), el("b", { text: usd2.format(T.estimates) })),
    el("div", { class: "grand" }, el("span", { text: `Option B ${m.name}, total at list` }), el("b", { text: usd2.format(T.list) })),
    el("div", {}, el("span", { text: "Option A (X650 kit, SF45/B), at list" }),
      el("b", { text: A_BOM ? usd2.format(A_BOM.totals.list) : "–" })));
}

function prints(m) {
  const sw = (f) => el("span", { class: `sw ${FIL_CLASS[f]}`, "aria-hidden": "true" });
  const tot = Object.fromEntries(FILS.map((f) => [f, { parts: 0, prints: 0, g: 0 }]));
  for (const p of m.printed) {
    tot[p.mat].parts += 1;
    tot[p.mat].prints += p.qty;
    tot[p.mat].g += p.qty * p.g;
  }
  const spools = (f) => {
    const line = m.bom.find((b) => b.item.startsWith(FIL_LINE[f]));
    return line ? `${line.qty} × ${line.item.split(", ").at(-1).replace(" spool", "")}` : "–";
  };
  const used = FILS.filter((f) => tot[f].prints);
  $("#filTable").replaceChildren(head(["Filament", "Parts", "Prints", "Grams", "Buy"], [1, 2, 3, 4]),
    el("tbody", {}, used.map((f) => el("tr", {},
      el("th", { scope: "row" }, sw(f), f),
      el("td", { class: "num", text: tot[f].parts }), el("td", { class: "num", text: tot[f].prints }),
      el("td", { class: "num", text: Math.round(tot[f].g) }), el("td", { class: "num", text: spools(f) }))),
    el("tr", { class: "sub" }, el("th", { scope: "row", text: "All printed parts" }),
      el("td", { class: "num", text: used.reduce((s, f) => s + tot[f].parts, 0) }),
      el("td", { class: "num", text: used.reduce((s, f) => s + tot[f].prints, 0) }),
      el("td", { class: "num", text: Math.round(used.reduce((s, f) => s + tot[f].g, 0)) }), el("td"))));
  $("#printTable").replaceChildren(head(["Part", "Qty", "g each", "g"], [1, 2, 3]),
    el("tbody", {}, used.flatMap((f) => [
      el("tr", { class: "sub" }, el("th", { scope: "row" }, sw(f), f), el("td"), el("td"),
        el("td", { class: "num", text: Math.round(tot[f].g) })),
      ...m.printed.filter((p) => p.mat === f).map((p) => el("tr", {},
        el("th", { scope: "row", class: "part", text: p.label }),
        el("td", { class: "num", text: p.qty }), el("td", { class: "num", text: p.g.toFixed(0) }),
        el("td", { class: "num", text: Math.round(p.qty * p.g) })))])));
  const big = m.largest_print;
  $("#printFit").textContent = `Largest part: ${big.label.toLowerCase()}, ${big.mm.join(" × ")} mm. Every part fits `
    + "both beds (Kobra S1 250 mm, Kobra X 260 mm).";
}

function carbon(m) {
  $("#tubeTable").replaceChildren(head(["Part", "Stock", "Qty × mm", "g each"], [2, 3]),
    el("tbody", {}, m.tubes.map((t) => el("tr", {},
      el("th", { scope: "row", class: "part", text: t.label }), el("td", { text: t.stock.replace("CF tube ", "") + " mm" }),
      el("td", { class: "num", text: `${t.qty} × ${t.len_mm.toFixed(0)}` }), el("td", { class: "num", text: t.g.toFixed(0) })))));
  $("#tubeBuyTable").replaceChildren(head(["Stock", "Tubes to buy", "Cuts per tube (mm)"], [1]),
    el("tbody", {}, m.tube_buy.map((b) => el("tr", {},
      el("th", { scope: "row", text: b.stock.replace("CF tube ", "") + " mm" }),
      el("td", { class: "num", text: `${b.lengths} × ${b.tube_mm.toLocaleString("en-US")} mm`
        + (b.per_pack > 1 ? ` (${b.packs} pack${b.packs > 1 ? "s" : ""} of ${b.per_pack})` : "") }),
      el("td", { class: "cuts", text: b.cuts.map((c) => c.join(" + ")).join("  |  ") })))));
  $("#plateTable").replaceChildren(head(["Plate", "Sheet", "Qty", "Size, mm", "g each"], [2, 3, 4]),
    el("tbody", {}, m.plates.map((p) => el("tr", {},
      el("th", { scope: "row", class: "part", text: p.label.split(",")[0] }), el("td", { text: p.stock.replace("CF sheet ", "") }),
      el("td", { class: "num", text: p.qty }), el("td", { class: "num", text: `${p.size_mm[0]} × ${p.size_mm[1]}` }),
      el("td", { class: "num", text: p.g.toFixed(0) })))));
  plateWays(m);
  $("#fastTable").replaceChildren(head(["Fastener", "Qty", "Where"], [1]),
    el("tbody", {}, m.hardware.map((h) => el("tr", {},
      el("th", { scope: "row", class: "part", text: h.item }), el("td", { class: "num", text: h.qty }),
      el("td", { text: h.use })))));
}

function plateWays(m) {
  const o = m.plate_options, pr = o.print;
  const a = (href, text) => (safeUrl(href) ? el("a", { href, target: "_blank", rel: "noopener noreferrer", text }) : text);
  const sheetCost = o.sheets.reduce((s, x) => s + x.ext, 0);
  const thick = pr.parts.map((p) => `${p.t_cf} → ${p.t_print} mm`).filter((v, i, all) => all.indexOf(v) === i).join(", ");
  const long = o.too_big.map((p) => `${p.label.toLowerCase()} (${p.size_mm.join(" × ")} mm)`).join(", ");
  const noBed = pr.parts.filter((p) => !p.fits_s1).map((p) => p.label.toLowerCase());
  $("#plateWays").replaceChildren(
    el("li", {}, el("b", { text: "Order them cut (our pick). " }), "Upload the plate outlines to ",
      a(o.cut.url, o.cut.vendor), ": carbon fibre 2.01 and 3.00 mm, waterjet-cut, instant quote, ships in days. "
      + `We estimate ${usd0.format(o.cut.est)} for this frame until it is quoted.`),
    el("li", {}, el("b", { text: "Cut them from plain sheet. " }),
      ...o.sheets.flatMap((s, i) => [i ? " and " : "", `${s.qty} × `, a(s.url, s.item), ` (${usd2.format(s.unit)})`]),
      `, ${usd2.format(sheetCost)} in total.`
      + (long ? ` The ${long} is longer than a ${o.sheet_mm.join(" × ")} mm sheet: order that one cut.` : "")
      + " Glue a 1:1 print of the outline on, cut with a diamond or carbide blade, drill the holes, sand the edges. Cut wet"
      + " or with dust extraction and wear a P2/N95 mask: carbon dust irritates."),
    el("li", {}, el("b", { text: "Print them in PA-CF on the Kobra S1. " }),
      `Same stiffness needs thicker plates (${thick}): ${pr.pacf_g} g of PA-CF (${pr.spools} × 0.5 kg spool${pr.spools > 1 ? "s" : ""}), `
      + `${pr.extra_g} g heavier, thrust-to-weight ${pr.tw_now.toFixed(2)} → ${pr.tw.toFixed(2)}. Nylon is weaker and creeps under `
      + "the clamp bolts, so this suits a test frame; the CAD needs the thicker plates and longer bolts first."
      + (noBed.length ? ` The ${noBed.join(", ")} is longer than the 250 mm bed and would have to be split.` : "")));
}

function show(name, push) {
  cur = name;
  const m = DATA.models[name];
  $("#flags").replaceChildren(...m.flags.map(([k, text]) => el("li", { class: `tag ${FLAG_TAG[k]}`, text })));
  const img = $("#render");
  img.src = m.media.render;
  img.alt = `3D model of Option B ${name}: ${m.title}`;
  $("#renderCap").textContent = `Option B ${name}: ${m.title} (3D model, printed parts coloured by filament)`;
  viewer(m);
  kpis(m);
  flight(m);
  numbers(m);
  bom(m);
  prints(m);
  carbon(m);
  for (const vol of ["1L", "2L"]) renderSortie(vol);
  document.title = `Option B ${name}: custom side-pod frame (draft) | AJ Builds Drone`;
  if (push) {
    const u = new URL(location);
    u.searchParams.set("model", name);
    history.replaceState(null, "", u);
  }
}

async function main() {
  try {
    [DATA, A_BOM] = await Promise.all([
      fetch("data/models.json").then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
      fetch("../data/bom.json").then((r) => (r.ok ? r.json() : null)).catch(() => null)]);
  } catch (err) {
    $("#main").prepend(el("p", { class: "wrap fine", text: `The frame data could not be loaded (${err.message}).` }));
    return;
  }
  const sel = $("#model");
  sel.replaceChildren(...DATA.order.map((k) => {
    const m = DATA.models[k];
    return el("option", { value: k, text: `${k}: ${m.title}${m.reference ? " (reference only)" : ""}` });
  }));
  const want = new URL(location).searchParams.get("model");
  sel.value = DATA.models[want] ? want : DATA.order[0];
  sel.addEventListener("change", () => show(sel.value, true));
  $$('[data-bind="checked"]').forEach((e) => { e.textContent = DATA.checked; });
  $$('[data-bind="checkedB"]').forEach((e) => { e.textContent = DATA.checkedB; });
  const he = $("#hotendLink");
  if (he && safeUrl(DATA.hotend?.url)) {
    he.href = DATA.hotend.url;
    he.textContent = `hardened-steel hotend (${usd2.format(DATA.hotend.unit)})`;
  }
  $("#showNotes").addEventListener("change", (e) => $("#bomTable").classList.toggle("notes", e.target.checked));
  $("#videoStart").addEventListener("click", () => {
    const v = $("#video");
    v.src = DATA.models[cur].media.video;
    $("#videoStart").hidden = true;
    v.play().catch(() => {});
  });
  show(sel.value, false);
  initViewer();
  floatPicker();
  setTimeout(async () => {
    await flyTable("1L");
    await flyTable("2L");
  }, 200);
}

main();
