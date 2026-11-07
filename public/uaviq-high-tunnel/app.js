import {
  Aircraft, Flyer, SPECS, payloadKg, FLY_Z, CANOPY, AVIONICS_W, BLOWER_W, RESERVE, DODGES, DODGE_TILT, T_DODGE,
  doubletTilt, runMission, runSorties, MISSION_END,
} from "./sim.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const DEG = 180 / Math.PI;

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

/** Sizes a canvas to its CSS box (capped at 2x pixel ratio) and returns a context that draws in CSS pixels. */
function fitCanvas(c) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = c.clientWidth, h = c.clientHeight;
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (c.width !== pw || c.height !== ph) {
    c.width = pw;
    c.height = ph;
  }
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

const signed = (v, digits = 2, unit = " m") => {
  const r = Number(v.toFixed(digits));
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(digits)}${unit}`;
};
const MONO = '"JetBrains Mono", ui-monospace, Consolas, monospace';

// ---------------------------------------------------------------------------------------------------------------
// Flight sandbox: the report's dodge test, or pilot input, flown live by every aircraft with the same controller
// ---------------------------------------------------------------------------------------------------------------
const DT = 0.002; // integration step, as in the report
const SAMPLE_EVERY = 10; // 0.02 s, the report's log interval
const HISTORY_S = 10;
const CLIMB_RATE = 0.75; // m/s for pilot height changes
const Z_MIN = 0.9, Z_MAX = 2.5;
const RELEASER_BOX = { none: null, "1L": [0.16, 0.17], "2L": [0.2, 0.22], "4L": [0.25, 0.26] }; // width, height (m)
const HANG = 0.24; // releaser centre below the aircraft centre (m)

class Sandbox {
  constructor(root) {
    this.root = root;
    this.lanesEl = $("#lanes", root);
    this.strip = $("#strip", root);
    this.resultEl = $("#simResult", root);
    this.settings = { soc: 0.3, releaser: "1L", blower: false, showX650: false };
    this.stick = 0;
    this.keyTilt = 0;
    this.paused = false;
    this.visible = false;
    this.acc = 0;
    this.raf = 0;
    this.lastTele = 0;
    this.bindUI();
    this.reset();
    let first = !reduceMotion;
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible && first) {
        first = false;
        this.runTest();
      }
      this.kick();
    }, { threshold: 0.2 }).observe(root);
    document.addEventListener("visibilitychange", () => this.kick());
    new ResizeObserver(() => this.draw()).observe(this.lanesEl);
  }

  get t() {
    return this.n * DT;
  }

  aux() {
    return AVIONICS_W + (this.settings.blower ? BLOWER_W : 0);
  }

  reset() {
    const keys = this.settings.showX650 ? ["x500", "x650", "proposed"] : ["x500", "proposed"];
    const aux = this.aux();
    this.lanes = keys.map((key) => {
      const ac = new Aircraft(SPECS[key], payloadKg(SPECS[key], this.settings.releaser));
      return { key, ac, f: new Flyer(ac, { soc: this.settings.soc, aux }), camX: 0, worst: 0, satUntil: -1 };
    });
    this.n = 0;
    this.acc = 0;
    this.zTarget = this.zr = FLY_Z;
    this.quietUntil = 0.5;
    this.maneuvers = [];
    this.test = false;
    this.hist = [];
    this.resultEl.replaceChildren();
    this.setBusy(false);
    this.buildLanes();
    this.draw();
  }

  buildLanes() {
    this.lanesEl.style.setProperty("--lanes", this.lanes.length);
    this.lanesEl.replaceChildren(...this.lanes.map((L) => {
      const canvas = el("canvas", { role: "img", "aria-label": `${L.ac.name}: side view while holding height` });
      const vals = {};
      const cell = (key, label) => {
        vals[key] = el("b", { text: "–" });
        return el("div", {}, el("span", { text: label }), vals[key]);
      };
      L.chip = el("span", { class: "lane-chip ok", text: "holding" });
      L.meter = el("div", { class: "meter", role: "presentation" }, el("i"));
      L.loadVal = el("b", { text: "–" });
      L.vals = vals;
      L.canvas = canvas;
      return el("div", { class: "lane" },
        el("div", { class: "lane-head" },
          el("span", { class: "lane-name", style: `color:${L.ac.color}`, text: L.ac.name }), L.chip),
        canvas,
        el("div", { class: "tele" },
          el("div", { class: "tele-load" }, el("span", { text: "Motor load" }), L.meter, L.loadVal),
          el("div", { class: "tele-grid" },
            cell("err", "Height error"), cell("worst", "Worst dip"), cell("tw", "Thrust/weight"),
            cell("bat", "Battery"), cell("amps", "Current"), cell("tilt", "Tilt"))));
    }));
  }

  bindUI() {
    const r = this.root;
    $("#runTest", r).addEventListener("click", () => this.runTest());
    $$("[data-dodge]", r).forEach((b) => b.addEventListener("click", () => this.dodge(Number(b.dataset.dodge))));
    $$("[data-climb]", r).forEach((b) => b.addEventListener("click", () => this.climb(Number(b.dataset.climb))));
    $("#pause", r).addEventListener("click", () => this.togglePause());
    $("#reset", r).addEventListener("click", () => {
      this.reset();
      this.kick();
    });
    const restart = () => {
      this.reset();
      this.kick();
    };
    $$('input[name="soc"]', r).forEach((i) => i.addEventListener("change", () => {
      this.settings.soc = Number(i.value);
      restart();
    }));
    $$('input[name="rel"]', r).forEach((i) => i.addEventListener("change", () => {
      this.settings.releaser = i.value;
      restart();
    }));
    $("#blower", r).addEventListener("change", (e) => {
      this.settings.blower = e.target.checked;
    });
    $("#showX650", r).addEventListener("change", (e) => {
      this.settings.showX650 = e.target.checked;
      restart();
    });
    const stick = $("#stick", r);
    stick.addEventListener("input", () => {
      this.stick = Number(stick.value) / 100;
    });
    const spring = () => {
      stick.value = 0;
      this.stick = 0;
    };
    for (const ev of ["pointerup", "pointercancel", "touchend", "blur", "keyup"]) stick.addEventListener(ev, spring);
    window.addEventListener("pointerup", () => {
      if (this.stick) spring();
    });
    r.addEventListener("keydown", (e) => {
      if (e.target !== r && e.target.tagName !== "BUTTON") return; // radios and the slider keep their own keys
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        this.keyTilt = e.key === "ArrowLeft" ? -1 : 1;
        e.preventDefault();
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (!e.repeat) this.climb(e.key === "ArrowUp" ? 0.5 : -0.5);
        e.preventDefault();
      }
    });
    r.addEventListener("keyup", (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") this.keyTilt = 0;
    });
    r.addEventListener("focusout", () => {
      this.keyTilt = 0;
    });
  }

  setBusy(busy) {
    $$("[data-dodge], [data-climb]", this.root).forEach((b) => {
      b.disabled = busy;
    });
  }

  togglePause() {
    this.paused = !this.paused;
    const b = $("#pause", this.root);
    b.textContent = this.paused ? "Resume" : "Pause";
    b.setAttribute("aria-pressed", String(this.paused));
    this.kick();
  }

  dodge(sign) {
    if (this.test) return;
    const start = Math.max(this.t, ...this.maneuvers.map((m) => m.t0 + 1.6));
    this.maneuvers.push({ t0: start, sign });
    if (this.paused) this.togglePause();
  }

  climb(dz) {
    if (this.test) return;
    this.zTarget = Math.min(Z_MAX, Math.max(Z_MIN, this.zTarget + dz));
  }

  runTest() {
    this.reset();
    this.test = true;
    this.maneuvers = DODGES.map(([t0, sign]) => ({ t0, sign }));
    for (const L of this.lanes) L.stats = { n: 0, sat: 0, dip: Infinity, tilt: 0, tw: Infinity };
    this.setBusy(true);
    this.resultEl.replaceChildren(el("p", {}, "Running the report test: two hard ±30° stick doublets, 3 s apart…"));
    if (this.paused) this.togglePause();
    this.kick();
  }

  finishTest() {
    this.test = false;
    this.setBusy(false);
    const rows = this.lanes.map((L) => ({
      L, dip: L.stats.dip, sat: (100 * L.stats.sat) / L.stats.n, tilt: L.stats.tilt * DEG, tw: L.stats.tw,
    }));
    const a = rows[0], b = rows[rows.length - 1];
    const s = this.settings;
    const asReport = s.releaser === "1L" && !s.blower && (s.soc === 0.3 || s.soc === 0.95);
    const settings = `${Math.round(s.soc * 100)} % battery, ${s.releaser === "none" ? "no releaser" : `${s.releaser.replace("L", " L")} releaser`}${s.blower ? ", blower on" : ""}`;
    this.resultEl.replaceChildren(
      el("p", {},
        el("b", { text: `Result (${settings}). ` }),
        `${a.L.ac.short} sank ${Math.abs(Math.min(a.dip, 0)).toFixed(2)} m with its rotors at maximum ${a.sat.toFixed(1)} % of the time; `
        + `the ${b.L.ac.short.toLowerCase()} aircraft held within ${Math.abs(Math.min(b.dip, 0)).toFixed(2)} m`
        + `${b.sat < 0.05 ? " and never ran out of thrust." : `, at maximum ${b.sat.toFixed(1)} % of the time.`}`
        + (asReport ? " Same numbers as our report." : "")),
      el("div", { class: "table-scroll" }, el("table", { class: "tbl" },
        el("thead", {}, el("tr", {}, ["Aircraft", "Lowest point vs hold height", "Rotors at maximum", "Peak tilt",
          "Lowest thrust/weight"].map((h, i) => el("th", { scope: "col", class: i ? "num" : null, text: h })))),
        el("tbody", {}, rows.map((row) => el("tr", {},
          el("th", { scope: "row", style: `color:${row.L.ac.color}`, text: row.L.ac.name }),
          el("td", { class: "num", text: signed(row.dip) }),
          el("td", { class: "num", text: `${row.sat.toFixed(1)} % of the time` }),
          el("td", { class: "num", text: `${row.tilt.toFixed(0)}°` }),
          el("td", { class: "num", text: row.tw.toFixed(2) })))))));
  }

  tiltAt(t) {
    for (const m of this.maneuvers) {
      const v = doubletTilt(t, m.t0, m.sign);
      if (v !== null) return v;
    }
    if (this.test) return 0;
    return (this.keyTilt || this.stick) * DODGE_TILT;
  }

  tick() {
    const t = this.t;
    let vzr = 0;
    if (!this.test && Math.abs(this.zTarget - this.zr) > 1e-9) { // pilot height change: ramp the reference
      const dz = this.zTarget - this.zr;
      this.zr += Math.sign(dz) * Math.min(Math.abs(dz), CLIMB_RATE * DT);
      vzr = Math.sign(dz) * CLIMB_RATE;
      this.quietUntil = t + 1.0;
    }
    const tilt = this.tiltAt(t);
    const aux = this.aux();
    const ref = [0, 0, this.zr, vzr];
    const sample = this.n % SAMPLE_EVERY === 0;
    for (const L of this.lanes) {
      const f = L.f;
      f.step(DT, ref, tilt, 0, aux);
      if (!this.test) f.soc = this.settings.soc; // free flight compares at the chosen charge; the sortie shows the drain
      if (f.sat) L.satUntil = t + 0.3;
      if (!sample) continue;
      const dz = f.z - this.zr;
      if (t >= this.quietUntil) L.worst = Math.min(L.worst, dz);
      if (this.test && t >= 1.0) {
        const s = L.stats;
        s.n += 1;
        s.sat += f.sat ? 1 : 0;
        s.dip = Math.min(s.dip, dz);
        s.tilt = Math.max(s.tilt, Math.abs(f.th));
        s.tw = Math.min(s.tw, f.tw);
      }
    }
    if (sample) {
      this.hist.push({ t, zr: this.zr, z: this.lanes.map((L) => L.f.z) });
      while (this.hist.length && this.hist[0].t < t - HISTORY_S - 0.5) this.hist.shift();
    }
    if (this.test && t >= T_DODGE - 1e-9) this.finishTest();
    if (this.maneuvers.length) this.maneuvers = this.maneuvers.filter((m) => t < m.t0 + 1.6);
    this.n += 1;
  }

  kick() {
    if (this.raf || !this.visible || document.hidden || this.paused) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame((now) => this.frame(now));
  }

  frame(now) {
    this.raf = 0;
    if (!this.visible || document.hidden || this.paused) return;
    this.acc += Math.max(0, Math.min((now - this.last) / 1000, 0.05));
    this.last = now;
    while (this.acc >= DT) {
      this.tick();
      this.acc -= DT;
    }
    this.draw(now);
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  draw(now = performance.now()) {
    for (const L of this.lanes) this.drawLane(L);
    this.drawStrip();
    if (now - this.lastTele > 110) {
      this.lastTele = now;
      this.updateTele();
    }
  }

  releaserBottom(L) {
    const box = RELEASER_BOX[this.settings.releaser];
    return box ? L.f.z - HANG - box[1] / 2 : L.f.z - 0.08;
  }

  drawLane(L) {
    const { ctx, w: W, h: H } = fitCanvas(L.canvas);
    if (!W || !H) return;
    const f = L.f, ac = L.ac, t = this.t;
    L.camX += (f.x - L.camX) * 0.12;
    L.camX = Math.min(Math.max(L.camX, f.x - 0.9), f.x + 0.9);
    const groundY = H - 20;
    const s = Math.min((groundY - 6) / 2.75, W / 3.2);
    const X = (x) => W / 2 + (x - L.camX) * s;
    const Y = (z) => groundY - z * s;
    const xa = L.camX - W / 2 / s - 0.6, xb = L.camX + W / 2 / s + 0.6;

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#15202b");
    sky.addColorStop(1, "#0b0e11");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(170, 190, 210, 0.09)"; // tunnel hoops every 2 m, they show the sideways motion
    ctx.lineWidth = 3;
    for (let hx = Math.floor(xa / 2) * 2; hx <= xb; hx += 2) {
      ctx.beginPath();
      ctx.moveTo(X(hx), 0);
      ctx.lineTo(X(hx), groundY);
      ctx.stroke();
    }
    for (let i = Math.floor(xa / 0.3); i * 0.3 <= xb; i += 1) { // strawberry plants, canopy 0.6 m
      const px = X(i * 0.3);
      const leaf = ctx.createLinearGradient(0, Y(CANOPY), 0, groundY);
      leaf.addColorStop(0, "#2f7d45");
      leaf.addColorStop(1, "#173d24");
      ctx.fillStyle = leaf;
      ctx.beginPath();
      ctx.ellipse(px, groundY, 0.17 * s, CANOPY * s, 0, Math.PI, 2 * Math.PI);
      ctx.fill();
      const r = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
      ctx.fillStyle = "#d8344a";
      ctx.beginPath();
      ctx.arc(px + (r - 0.5) * 0.18 * s, groundY - (0.15 + 0.3 * r) * s, Math.max(1.6, 0.025 * s), 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.fillStyle = "#2a2018";
    ctx.fillRect(0, groundY, W, H - groundY);

    ctx.setLineDash([7, 5]); // height reference
    ctx.strokeStyle = "rgba(0, 212, 255, 0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, Y(this.zr));
    ctx.lineTo(W, Y(this.zr));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `600 11px ${MONO}`;
    ctx.fillStyle = "rgba(0, 212, 255, 0.85)";
    ctx.textAlign = "right";
    ctx.fillText(`hold ${this.zr.toFixed(2)} m`, W - 8, Y(this.zr) - 6);
    ctx.fillStyle = "rgba(160, 220, 170, 0.75)";
    ctx.textAlign = "left";
    ctx.fillText("canopy 0.6 m", 8, Y(CANOPY) - 6);

    const th = f.th, ux = Math.cos(th), uz = -Math.sin(th), nx = Math.sin(th), nz = Math.cos(th);
    const P = (x, z) => [X(x), Y(z)];
    const ends = [-1, 1].map((sg) => [f.x + sg * ac.arm * ux, f.z + sg * ac.arm * uz]);
    const box = RELEASER_BOX[this.settings.releaser];
    if (box) {
      const cx = f.x - HANG * nx, cz = f.z - HANG * nz;
      ctx.strokeStyle = "#8a8f96";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(...P(f.x, f.z));
      ctx.lineTo(...P(cx, cz));
      ctx.stroke();
      const [bw, bh] = box;
      ctx.fillStyle = "#b07a4f";
      ctx.strokeStyle = "#e0b48a";
      ctx.beginPath();
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], i) => {
        const [px, pz] = P(cx + (a * bw / 2) * ux + (b * bh / 2) * nx, cz + (a * bw / 2) * uz + (b * bh / 2) * nz);
        if (i) ctx.lineTo(px, pz); else ctx.moveTo(px, pz);
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    [f.f1, f.f2].forEach((fi, i) => { // thrust arrows, red when the rotor pair is at maximum
      const [ex, ez] = ends[i];
      const atMax = fi >= 0.985 * f.fmax;
      const len = 0.08 + (fi / f.fmax) * 0.5;
      const [ax0, az0] = P(ex + 0.07 * nx, ez + 0.07 * nz);
      const [ax1, az1] = P(ex + len * nx, ez + len * nz);
      ctx.strokeStyle = atMax ? "#ff5a4f" : "rgba(255, 255, 255, 0.35)";
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = atMax ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(ax0, az0);
      ctx.lineTo(ax1, az1);
      ctx.stroke();
      const ang = Math.atan2(az1 - az0, ax1 - ax0), hs = atMax ? 9 : 7;
      ctx.beginPath();
      ctx.moveTo(ax1 + Math.cos(ang) * 2, az1 + Math.sin(ang) * 2);
      ctx.lineTo(ax1 - Math.cos(ang - 0.5) * hs, az1 - Math.sin(ang - 0.5) * hs);
      ctx.lineTo(ax1 - Math.cos(ang + 0.5) * hs, az1 - Math.sin(ang + 0.5) * hs);
      ctx.fill();
    });
    ctx.strokeStyle = ac.color; // arms
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(...P(...ends[0]));
    ctx.lineTo(...P(...ends[1]));
    ctx.stroke();
    ctx.lineCap = "butt";
    for (const [ex, ez] of ends) { // propeller discs
      const cx = ex + 0.045 * nx, cz = ez + 0.045 * nz, r = ac.propD / 2;
      ctx.strokeStyle = "rgba(220, 228, 236, 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(...P(cx - r * ux, cz - r * uz));
      ctx.lineTo(...P(cx + r * ux, cz + r * uz));
      ctx.stroke();
      ctx.fillStyle = "#d7dde3";
      ctx.beginPath();
      ctx.arc(...P(cx, cz), 3, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.save(); // avionics pod
    ctx.translate(...P(f.x, f.z));
    ctx.rotate(th);
    ctx.fillStyle = "#e8edf2";
    ctx.fillRect(-0.08 * s, -0.035 * s, 0.16 * s, 0.07 * s);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillStyle = "#f0f0f0";
    ctx.font = `700 15px ${MONO}`;
    ctx.fillText(`${f.z.toFixed(2)} m`, 10, 22);
    ctx.font = `600 10px ${MONO}`;
    ctx.fillStyle = "#8d939a";
    ctx.fillText("HEIGHT", 10, 35);
    const bottom = this.releaserBottom(L);
    let warn = null;
    if (f.z <= 0.001) warn = "ON THE GROUND";
    else if (bottom < CANOPY) warn = "INTO THE CANOPY";
    else if (L.satUntil > t) warn = "ROTORS AT MAX";
    if (warn && (warn !== "ROTORS AT MAX" || Math.floor(performance.now() / 180) % 2 === 0)) {
      ctx.font = `800 13px ${MONO}`;
      const tw = ctx.measureText(warn).width + 18;
      ctx.fillStyle = "rgba(255, 90, 79, 0.92)";
      ctx.fillRect(W - tw - 8, 8, tw, 24);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(warn, W - tw / 2 - 8, 25);
    }
  }

  drawStrip() {
    const { ctx, w: W, h: H } = fitCanvas(this.strip);
    if (!W || !H) return;
    ctx.fillStyle = "#0c0d0e";
    ctx.fillRect(0, 0, W, H);
    const pl = 46, pr = 12, pt = 26, pb = 22;
    const t1 = Math.max(this.t, HISTORY_S), t0 = t1 - HISTORY_S;
    const zLo = 0, zHi = 2.8;
    const X = (t) => pl + ((t - t0) / HISTORY_S) * (W - pl - pr);
    const Y = (z) => pt + (1 - (z - zLo) / (zHi - zLo)) * (H - pt - pb);
    ctx.font = `600 10px ${MONO}`;
    ctx.textAlign = "right";
    for (const z of [0, 0.5, 1, 1.5, 2, 2.5]) {
      ctx.strokeStyle = "#1d1f22";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pl, Y(z));
      ctx.lineTo(W - pr, Y(z));
      ctx.stroke();
      ctx.fillStyle = "#6f757c";
      ctx.fillText(`${z.toFixed(1)} m`, pl - 6, Y(z) + 3);
    }
    ctx.fillStyle = "rgba(47, 125, 69, 0.25)";
    ctx.fillRect(pl, Y(CANOPY), W - pl - pr, Y(0) - Y(CANOPY));
    ctx.textAlign = "center";
    ctx.fillStyle = "#6f757c";
    for (let s = Math.ceil(t0); s <= t1; s += 2) ctx.fillText(`${s} s`, X(s), H - 6);
    const draw = (pick, color, width, dash = []) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      let started = false;
      for (const h of this.hist) {
        if (h.t < t0) continue;
        const x = X(h.t), y = Y(pick(h));
        if (started) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        started = true;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    draw((h) => h.zr, "rgba(0, 212, 255, 0.7)", 1.5, [6, 5]);
    this.lanes.forEach((L, i) => draw((h) => h.z[i] ?? h.z[0], L.ac.color, 2.2));
    ctx.textAlign = "left";
    ctx.font = `700 11px ${MONO}`;
    let lx = pl;
    for (const [name, color] of [["Height over the last 10 s:", "#a9adb3"],
      ...this.lanes.map((L) => [L.ac.short, L.ac.color]), ["hold height", "rgba(0, 212, 255, 0.9)"]]) {
      ctx.fillStyle = color;
      ctx.fillText(name, lx, 15);
      lx += ctx.measureText(name).width + 16;
    }
  }

  updateTele() {
    const set = (node, text, cls = "") => {
      node.textContent = text;
      node.className = cls;
    };
    for (const L of this.lanes) {
      const f = L.f;
      const load = Math.min(f.load, 1);
      L.meter.firstChild.style.width = `${(load * 100).toFixed(1)}%`;
      L.meter.classList.toggle("hot", load >= 0.85 && load < 0.985);
      L.meter.classList.toggle("max", load >= 0.985);
      L.loadVal.textContent = `${Math.round(load * 100)} %`;
      const err = f.z - this.zr;
      set(L.vals.err, signed(err), Math.abs(err) > 0.15 ? "bad" : "");
      set(L.vals.worst, L.worst < -0.005 ? signed(L.worst) : "0.00 m", L.worst < -0.15 ? "bad" : "");
      set(L.vals.tw, f.tw.toFixed(2), f.tw < 1.3 ? "bad" : f.tw >= 2 ? "good" : "");
      set(L.vals.bat, `${Math.max(0, f.soc * 100).toFixed(0)} % · ${(f.volts / L.ac.cells).toFixed(2)} V`,
        f.soc < RESERVE ? "bad" : "");
      set(L.vals.amps, `${f.amps.toFixed(0)} A`);
      const deg = Math.round(f.th * DEG);
      set(L.vals.tilt, `${deg < 0 ? "−" : ""}${Math.abs(deg)}°`);
      let chip = ["holding", "ok"];
      if (f.z <= 0.001) chip = ["on the ground", "bad"];
      else if (this.releaserBottom(L) < CANOPY) chip = ["into the canopy", "bad"];
      else if (L.satUntil > this.t) chip = ["rotors at max", "bad"];
      else if (f.soc < RESERVE) chip = ["battery reserve", "warn"];
      else if (f.tw < 1.3) chip = ["low thrust margin", "warn"];
      L.chip.textContent = chip[0];
      L.chip.className = `lane-chip ${chip[1]}`;
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Two-tunnel sortie: precomputed with the same model, then played back
// ---------------------------------------------------------------------------------------------------------------
const ROUTE = [ // x range (m) of each zone along the route
  { name: "TUNNEL 1", x0: 0, x1: 60, fill: "rgba(47, 125, 69, 0.16)" },
  { name: "WINDY TRANSIT", x0: 60, x1: 80, fill: "rgba(0, 212, 255, 0.10)" },
  { name: "TUNNEL 2 · BLOWER ON", x0: 80, x1: 140, fill: "rgba(47, 125, 69, 0.16)" },
];
const PHASE_AT = [[8, "Take-off"], [68, "Tunnel 1"], [82, "Windy transit"], [92, "Reorient"],
  [152, "Tunnel 2, blower on"], [160.1, "Landing"]];

class Sortie {
  constructor(root) {
    this.root = root;
    this.canvas = $("#sortieCanvas", root);
    this.clock = $("#sortieClock", root);
    this.statsEl = $("#sortieStats", root);
    this.playBtn = $("#sortiePlay", root);
    this.speed = 10;
    this.t = 0;
    this.playing = false;
    this.runs = null;
    this.playBtn.addEventListener("click", () => (this.playing ? this.pause() : this.play()));
    $("#sortieRestart", root).addEventListener("click", () => {
      this.t = 0;
      this.play();
    });
    $$('input[name="speed"]', root).forEach((i) => i.addEventListener("change", () => {
      this.speed = Number(i.value);
    }));
    let first = true;
    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (!this.visible) return;
      if (!this.runs) this.compute();
      if (first) {
        first = false;
        if (!reduceMotion) this.play();
      }
      this.draw();
    }, { threshold: 0.25 }).observe(root);
    new ResizeObserver(() => this.runs && this.draw()).observe(this.canvas);
  }

  compute() {
    this.runs = ["x500", "x650", "proposed"].map((key) => {
      const ac = new Aircraft(SPECS[key], payloadKg(SPECS[key], "1L"));
      return { ac, ...runMission(ac) };
    });
    this.statsEl.replaceChildren(el("p", { class: "fine", text: "Flying the following sorties down to the 20 % reserve…" }));
    const pause = () => new Promise((resolve) => setTimeout(resolve));
    Promise.all(this.runs.map((r) => runSorties(r.ac, r, pause))).then((stats) => {
      stats.forEach((s, i) => Object.assign(this.runs[i], s));
      this.showStats();
      this.draw();
    });
  }

  showStats() {
    const pct = (v) => (v * 100).toFixed(0);
    this.statsEl.replaceChildren(el("div", { class: "table-scroll" }, el("table", { class: "tbl" },
      el("thead", {}, el("tr", {}, ["Per sortie", "Battery used", "Sorties per charge", "Thrust/weight",
        "Peak motor load", "Worst height error"].map((h, i) => el("th", { scope: "col", class: i ? "num" : null, text: h })))),
      el("tbody", {}, this.runs.map((r) => el("tr", { class: r.ac.key === "proposed" ? "hl" : null },
        el("th", { scope: "row", style: `color:${r.ac.color}`, text: r.ac.name }),
        el("td", { class: "num", text: `${pct(r.used)} %` }),
        el("td", { class: "num", text: r.sorties.toFixed(1) }),
        el("td", { class: "num", text: `${r.minTw.toFixed(2)} → ${r.lastTw.toFixed(2)}` }),
        el("td", { class: "num", text: `${pct(r.peakLoad)} → ${pct(r.lastLoad)} %` }),
        el("td", { class: "num", text: `${r.maxErr.toFixed(2)} m` })))))),
    el("p", { class: "fine", text: "Sorties are flown back to back from a 98 % charge, and one counts if it lands above the 20 % "
      + "reserve (the orange tick on each battery bar). Arrows run from the first sortie to the last full one. Peak motor "
      + "load is the busiest motors' thrust as a share of their maximum at that moment's battery voltage. The X500 runs on "
      + "its 4S 5 Ah pack, the X650s on a 6S 10 Ah pack." }));
  }

  play() {
    if (!this.runs) this.compute();
    if (this.t >= MISSION_END) this.t = 0;
    this.playing = true;
    this.playBtn.textContent = "❚❚ Pause";
    this.last = performance.now();
    if (!this.raf) this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  pause() {
    this.playing = false;
    this.playBtn.textContent = this.t >= MISSION_END ? "▶ Replay" : "▶ Play";
  }

  frame(now) {
    this.raf = 0;
    if (!this.playing) return;
    if (this.visible && !document.hidden) {
      this.t = Math.min(MISSION_END, this.t + Math.max(0, Math.min((now - this.last) / 1000, 0.05)) * this.speed);
      this.draw();
    }
    this.last = now;
    if (this.t >= MISSION_END) {
      this.pause();
      return;
    }
    this.raf = requestAnimationFrame((n) => this.frame(n));
  }

  draw() {
    if (!this.runs) return;
    const { ctx, w: W, h: H } = fitCanvas(this.canvas);
    if (!W || !H) return;
    const narrow = W < 640;
    const pl = narrow ? 70 : 104, pr = narrow ? 96 : 150, top = 34, rowH = (H - top - 12) / 3;
    const X = (x) => pl + (x / 140) * (W - pl - pr);
    ctx.fillStyle = "#0c0d0e";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = `700 ${narrow ? 9 : 10.5}px ${MONO}`;
    for (const z of ROUTE) {
      ctx.fillStyle = z.fill;
      ctx.fillRect(X(z.x0), top - 6, X(z.x1) - X(z.x0), H - top - 6);
      ctx.fillStyle = "#a9adb3";
      ctx.fillText(z.name, (X(z.x0) + X(z.x1)) / 2, 20);
    }
    const t = this.t;
    const k = Math.min(Math.round(t / 0.02), this.runs[0].log.t.length - 1);
    if (t > 66 && t < 94) { // wind streaks in the transit
      ctx.strokeStyle = "rgba(0, 212, 255, 0.35)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i += 1) {
        const y = top + 8 + ((i * 37) % (H - top - 30));
        const x = X(60) + ((t * 40 + i * 53) % (X(80) - X(60)));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(Math.min(x + 18, X(80)), y);
        ctx.stroke();
      }
    }
    this.runs.forEach((r, i) => {
      const y0 = top + i * rowH, base = y0 + rowH - 12;
      const log = r.log;
      ctx.strokeStyle = "#25272a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(X(0), base + 0.5);
      ctx.lineTo(X(140), base + 0.5);
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.fillStyle = r.ac.color;
      ctx.font = `700 ${narrow ? 10 : 12}px ${MONO}`;
      ctx.fillText(r.ac.short, 8, y0 + rowH / 2 + 4);
      const zs = Math.min(18, (rowH - 22) / 1.6);
      ctx.strokeStyle = r.ac.color; // flown path so far
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let j = 0; j <= k; j += 25) {
        const x = X(log.x[j]), y = base - log.z[j] * zs;
        if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      const x = X(log.x[k]), y = base - log.z[k] * zs - 4, th = log.th[k];
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(th);
      ctx.strokeStyle = r.ac.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-11, 0);
      ctx.lineTo(11, 0);
      ctx.stroke();
      ctx.strokeStyle = "#d7dde3";
      ctx.lineWidth = 2;
      for (const sx of [-11, 11]) {
        ctx.beginPath();
        ctx.moveTo(sx - 7, -4);
        ctx.lineTo(sx + 7, -4);
        ctx.stroke();
      }
      ctx.fillStyle = "#b07a4f";
      ctx.fillRect(-3, 4, 6, 6);
      ctx.restore();
      const soc = log.soc[k];
      const gx = W - pr + 12, gw = pr - 54, gy = y0 + rowH / 2 - 8;
      ctx.fillStyle = "#1a1b1d";
      ctx.fillRect(gx, gy, gw, 16);
      ctx.fillStyle = soc > 0.5 ? "#2fe07a" : soc > RESERVE ? "#f5a524" : "#ff5a4f";
      ctx.fillRect(gx, gy, Math.max(0, gw * soc), 16);
      ctx.fillStyle = "#ff5f1f";
      ctx.fillRect(gx + gw * RESERVE, gy - 3, 2, 22);
      ctx.fillStyle = "#f0f0f0";
      ctx.font = `700 11px ${MONO}`;
      ctx.textAlign = "left";
      ctx.fillText(`${Math.max(0, soc * 100).toFixed(0)}%`, gx + gw + 6, gy + 12);
      if (t >= MISSION_END) {
        ctx.fillStyle = r.ac.color;
        ctx.font = `700 ${narrow ? 9 : 11}px ${MONO}`;
        ctx.textAlign = "right";
        const tail = r.sorties == null ? "" : ` → ${r.sorties.toFixed(1)} sorties per charge`;
        ctx.fillText(`${(r.used * 100).toFixed(0)} % used${tail}`, W - pr - 8, y0 + 16);
      }
    });
    ctx.textAlign = "left";
    ctx.fillStyle = "#6f757c";
    ctx.font = `600 10px ${MONO}`;
    ctx.fillText("BATTERY", W - pr + 12, 20);
    const phase = PHASE_AT.find(([end]) => t < end)?.[1] ?? "Landed";
    this.clock.textContent = `t = ${t.toFixed(0)} s · ${t >= MISSION_END ? "Landed" : phase}`;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Cost: quote, charts and parts list from data/bom.json (exported from the BOM workbook's source)
// ---------------------------------------------------------------------------------------------------------------
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const roundTo = (v, step) => Math.round(v / step) * step;
const money = (v, step = 1) => usd0.format(roundTo(v, step));
const range = ([lo, hi], step = 1) => `${money(lo, step)}–${money(hi, step).slice(1)}`;
const safeUrl = (u) => (typeof u === "string" && u.startsWith("https://") ? u : null);

function stockClass(text) {
  const s = (text || "").toLowerCase();
  if (s.startsWith("in stock") || s.startsWith("add to cart")) return "good";
  if (/backorder|sold out|out of stock/.test(s)) return "bad";
  if (s.startsWith("listed as available")) return "warn";
  return "";
}

const KIND_TAG = { Replace: "tag-warn", Add: "tag-good", Spare: "tag-info", Allowance: "tag-muted" };

function linkOrText(text, url, cls) {
  const href = safeUrl(url);
  return href ? el("a", { href, target: "_blank", rel: "noopener noreferrer", text })
    : el("span", { class: cls, text });
}

async function initCost() {
  let data;
  try {
    const res = await fetch("data/bom.json");
    if (!res.ok) throw new Error(res.statusText);
    data = await res.json();
  } catch {
    $("#bomTable").replaceWith(el("p", {}, "The parts list could not be loaded. ",
      el("a", { href: "files/UAV-IQ_BOM.xlsx" }, "Download the BOM (Excel)"), " instead."));
    return;
  }
  const U = data.uplift;
  const hw = data.totals.list * U;
  const eng = data.hours.eng.map((h) => h * data.rates.eng);
  const tech = data.hours.tech.map((h) => h * data.rates.tech);
  const base = [0, 1].map((i) => hw + eng[i] + tech[i]);
  const sw = data.hours.sw.map((h) => h * data.rates.eng);
  const hover = data.hours.hover.map((h) => h * data.rates.eng);
  const second = data.options.find((o) => o.text.startsWith("Second autonomy set"));
  const charger = data.options.find((o) => o.text.startsWith("6S charger"));
  const baseText = `≈ ${range(base, 100)}`;
  $$('[data-bind="baseRange"]').forEach((e) => { e.textContent = baseText; });
  $$('[data-bind="checked"]').forEach((e) => { e.textContent = data.checked; });
  const hrs = (h) => `${h[0]}–${h[1]} h`;

  const row = (label, basis, value, cls) => el("tr", { class: cls },
    el("th", { scope: "row" }, label, basis ? el("span", { class: "basis", text: basis }) : null),
    el("td", { class: "num", text: value }));
  $("#quoteTable").replaceChildren(
    el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Line" }), el("th", { scope: "col", class: "num", text: "USD" }))),
    el("tbody", {},
    row("Hardware: new parts", `${usd2.format(data.totals.list)} at list × ${U} for shipping, import duties and procurement`,
      `≈ ${money(hw, 100)}`),
    row("Engineering: integration, sensor bring-up, safety set-up, documentation",
      `${hrs(data.hours.eng)} × $${data.rates.eng}/h`, range(eng)),
    row("Technician: assembly, wiring, mount fabrication", `${hrs(data.hours.tech)} × $${data.rates.tech}/h`, range(tech)),
    row("Base package (UCLA's autonomy core reused)", null, baseText, "base"),
    row("Option: flight-stack set-up (PX4 sensor fusion, collision prevention, failsafes, Jetson drivers)",
      `${hrs(data.hours.sw)} × $${data.rates.eng}/h`, `+ ${range(sw)}`, "opt"),
    row("Option: builder hover check and baseline tune, if you allow flights",
      `${hrs(data.hours.hover)} × $${data.rates.eng}/h`, `+ ${range(hover)}`, "opt"),
    second && row("Option: second autonomy set so the X500 keeps flying (Jetson bundle, D455, GNSS, radio)",
      `${usd2.format(second.ext)} at list × ${U}`, `+ ≈ ${money(second.ext * U, 100)}`, "opt"),
    charger && row("Option: 6S charger, if UCLA has none", `${usd2.format(charger.ext)} at list × ${U}`,
      `+ ≈ ${money(charger.ext * U, 10)}`, "opt")));
  $("#quoteNote").textContent = `Base package plus the flight-stack set-up: about ${range([base[0] + sw[0], base[1] + sw[1]], 100)}. `
    + "Sales tax extra. Lower-cost and 3-D lidar variants on request.";

  const seg = (cls, v, max, label) => el("i", { class: cls, style: `width:${(100 * v) / max}%`, title: `${label}: ${money(v)}`,
    text: v / max > 0.1 ? money(v, 100) : "" });
  $("#stackBars").replaceChildren(
    ...["Low", "High"].map((name, i) => el("div", { class: "stack-row" }, el("span", { text: name }),
      el("div", { class: "stack-bar", role: "img",
        "aria-label": `${name} estimate ${money(base[i], 100)}: hardware ${money(hw, 100)}, engineering ${money(eng[i])}, technician ${money(tech[i])}` },
      seg("seg-hw", hw, base[1], "HW"), seg("seg-eng", eng[i], base[1], "Eng"), seg("seg-tech", tech[i], base[1], "Tech")),
      el("b", { class: "stack-total", text: `≈ ${money(base[i], 100)}` }))),
    el("div", { class: "legend" },
      el("span", {}, el("i", { class: "seg-hw" }), "Hardware (landed)"),
      el("span", {}, el("i", { class: "seg-eng" }), `Engineering, $${data.rates.eng}/h`),
      el("span", {}, el("i", { class: "seg-tech" }), `Technician, $${data.rates.tech}/h`)));

  const cats = new Map();
  for (const b of data.bom) cats.set(b.cat, (cats.get(b.cat) || 0) + b.ext);
  const sorted = [...cats.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0][1];
  $("#catBars").replaceChildren(...sorted.map(([cat, v]) => el("div", { class: "catbar" },
    el("span", { text: cat }),
    el("div", { class: "track", role: "presentation" }, el("i", { style: `width:${(100 * v) / top}%` })),
    el("b", { text: `${money(v)} · ${(100 * v) / data.totals.list < 1 ? "<1" : Math.round((100 * v) / data.totals.list)}%` }))));

  const table = $("#bomTable");
  const groups = [];
  for (const b of data.bom) {
    const g = groups.find((x) => x.cat === b.cat);
    if (g) g.items.push(b); else groups.push({ cat: b.cat, items: [b] });
  }
  table.replaceChildren(
    el("thead", {}, el("tr", {}, ["#", "Item", "Vendor", "Qty", "Unit", "Extended", `Stock on ${data.checked}`, "Type"]
      .map((h, i) => el("th", { scope: "col", class: [3, 4, 5].includes(i) ? "num" : null, text: h })))),
    el("tbody", {}, groups.flatMap((g) => [
      el("tr", { class: "group" }, el("th", { colspan: "8", scope: "colgroup" }, g.cat,
        el("span", { text: usd2.format(g.items.reduce((s, b) => s + b.ext, 0)) }))),
      ...g.items.map((b) => el("tr", {},
        el("td", { class: "num", text: b.n }),
        el("td", { class: "item" }, linkOrText(b.item, b.url, "est"),
          b.sku ? el("span", { class: "sku", text: b.sku }) : null,
          b.notes ? el("span", { class: "note", text: b.notes }) : null),
        el("td", { text: b.vendor }),
        el("td", { class: "num", text: b.qty }),
        el("td", { class: "num", text: usd2.format(b.unit) }),
        el("td", { class: "num", text: usd2.format(b.ext) }),
        el("td", { class: `stock ${stockClass(b.stock)}`, text: b.estimate ? "Estimate" : b.stock || "–" }),
        el("td", {}, el("span", { class: `tag ${KIND_TAG[b.kind] || ""}`, text: b.kind })))),
    ])));
  $("#showNotes").addEventListener("change", (e) => table.classList.toggle("notes", e.target.checked));
  $("#bomTotals").replaceChildren(
    el("div", {}, el("span", { text: "Parts at verified list prices" }), el("b", { text: usd2.format(data.totals.verified) })),
    el("div", {}, el("span", { text: "Allowances (estimates)" }), el("b", { text: usd2.format(data.totals.allowances) })),
    el("div", {}, el("span", { text: "Total at list" }), el("b", { text: usd2.format(data.totals.list) })),
    el("div", { class: "grand" }, el("span", { text: `In the quote (× ${U}: shipping, duties, procurement)` }),
      el("b", { text: `≈ ${money(hw, 100)}` })));

  $$('[data-bind="reusedNote"]').forEach((e) => {
    e.textContent = `the core costs ${usd2.format(data.reusedCore)} new`;
  });
  $("#reusedTable").replaceChildren(
    el("thead", {}, el("tr", {}, ["Item", "Price new", "Notes"].map((h, i) => el("th", { scope: "col", class: i === 1 ? "num" : null, text: h })))),
    el("tbody", {}, data.reused.map((r) => el("tr", {},
      el("td", { class: "item" }, linkOrText(r.item, r.url, "est"), r.vendor ? el("span", { class: "sku", text: r.vendor }) : null),
      el("td", { class: "num", text: r.unit == null ? "–" : usd2.format(r.unit) }),
      el("td", { text: r.notes || "" })))));
  const chg = (v) => `${v < 0 ? "−" : "+"}${usd2.format(Math.abs(v))}`;
  $("#optionsTable").replaceChildren(
    el("thead", {}, el("tr", {}, ["Option", "Change at list", "In the quote", `Stock on ${data.checked}`, "Notes"]
      .map((h, i) => el("th", { scope: "col", class: i === 1 || i === 2 ? "num" : null, text: h })))),
    el("tbody", {}, data.options.map((o) => el("tr", {},
      el("td", { class: "item" }, linkOrText(o.text, o.url, "est"), el("span", { class: "sku", text: o.vendor })),
      el("td", { class: `num ${o.change < 0 ? "chg-save" : "chg-add"}`, text: chg(o.change) }),
      el("td", { class: `num ${o.change < 0 ? "chg-save" : "chg-add"}`, text: chg(o.change * U) }),
      el("td", { class: `stock ${stockClass(o.stock)}`, text: o.stock }),
      el("td", { text: o.notes || "" })))));
}

// ---------------------------------------------------------------------------------------------------------------
function initViewer() {
  const frame = $("#viewerFrame");
  const wrap = frame.parentElement;
  if (!matchMedia("(min-width: 760px)").matches) return; // phones get the poster and a full-screen link
  new IntersectionObserver(([e], obs) => {
    if (!e.isIntersecting) return;
    frame.src = "viewer/";
    wrap.classList.add("live");
    obs.disconnect();
  }, { rootMargin: "300px" }).observe(wrap);
}

for (const [name, init] of [["viewer", initViewer], ["sandbox", () => new Sandbox($("#sandbox"))],
  ["sortie", () => new Sortie($("#sortie"))], ["cost", initCost]]) {
  try {
    const p = init();
    if (p instanceof Promise) p.catch((err) => console.error(`${name}:`, err));
  } catch (err) {
    console.error(`${name}:`, err);
  }
}
