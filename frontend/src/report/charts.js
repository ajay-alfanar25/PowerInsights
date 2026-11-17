
/* ksa_report_charts.js - dependency-free chart + UI helpers (inline SVG / HTML) for the KSA-REACTIVE reports.
   No external libraries, so the reports work offline and never touch a third-party CDN. */
(function (root) {
  'use strict';
  const KC = root.KC = root.KC || {};
  const NS = 'http://www.w3.org/2000/svg';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  KC.esc = esc;

  KC.techColor = key => { const t = KC.TECHS.find(x => x.key === key); return 'var(--c' + (t ? t.slot : 8) + ')'; };
  KC.STAGE_COLOR = { 'In Operation': 'var(--s-done)', 'Under Installation': 'var(--s-exe)', 'Tendering': 'var(--s-pre)', 'Planned / Announced': 'var(--ink-3)', 'Delivered': 'var(--s-done)', 'Pre-award': 'var(--s-pre)', 'Awarded': 'var(--s-awd)', 'Under execution': 'var(--s-exe)', 'Completed': 'var(--s-done)' };
  KC.techLabel = key => (KC.TECHS.find(x => x.key === key) || {}).label || key;

  /* ---------- tooltip ---------- */
  let tipEl;
  const tipNode = () => tipEl || (tipEl = Object.assign(document.body.appendChild(document.createElement('div')), { id: 'kc-tip' }));
  KC.tip = {
    show(ev, html) {
      const t = tipNode(); t.innerHTML = html; t.classList.add('on');
      const w = t.offsetWidth, h = t.offsetHeight;
      let x = ev.clientX + 14, y = ev.clientY + 14;
      if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
      if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
      t.style.left = Math.max(4, x) + 'px'; t.style.top = Math.max(4, y) + 'px';
    },
    hide() { tipNode().classList.remove('on'); }
  };
  const bindTip = (node, html) => {
    node.addEventListener('mousemove', e => KC.tip.show(e, typeof html === 'function' ? html() : html));
    node.addEventListener('mouseleave', KC.tip.hide);
  };
  KC.bindTip = bindTip;

  // remove only previously drawn chart nodes, so a legend placed in the same container survives
  KC._clr = c => c.querySelectorAll(':scope > .kc-ch').forEach(n => n.remove());
  const mark = n => { n.classList.add('kc-ch'); return n; };
  const widthOf = (c, dflt) => { const w = c.clientWidth; return w && w > 120 ? w : dflt; };
  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  function niceTicks(max, n) {
    const step = niceStep(max / (n || 4));
    const top = Math.ceil(max / step) * step, t = [];
    for (let v = 0; v <= top + 1e-9; v += step) t.push(v);
    return t;
  }

  /* ---------- KPI tiles ---------- */
  KC.kpis = function (parent, items) {
    const w = document.createElement('div'); w.className = 'kpis';
    items.forEach(i => {
      const k = document.createElement('div'); k.className = 'kpi';
      k.innerHTML = `<div class="v"${String(i.value).length > 8 ? ' style="font-size:21px"' : ''}>${esc(i.value)}</div><div class="l">${esc(i.label)}</div>${i.sub ? `<div class="s">${esc(i.sub)}</div>` : ''}`;
      if (i.tip) bindTip(k, i.tip);
      w.appendChild(k);
    });
    parent.appendChild(w); return w;
  };

  /* ---------- horizontal bars ---------- */
  KC.hbars = function (c, rows, o) {
    o = o || {}; KC._clr(c);
    if (!rows.length) { const n = mark(document.createElement('div')); n.className += ' notice'; n.textContent = 'Nothing to show for this selection.'; c.appendChild(n); return; }
    const max = o.max || Math.max(1, ...rows.map(r => r.value));
    const w = mark(document.createElement('div')); w.className += ' hbars';
    if (o.lw) w.style.setProperty('--lw', o.lw + 'px');
    rows.forEach(r => {
      const row = document.createElement('div'); row.className = 'hrow' + (r.onClick ? ' click' : '');
      row.innerHTML = `<div class="lab" title="${esc(r.label)}">${esc(r.label)}</div>` +
        `<div class="trk"><div class="bar" style="width:${Math.max(0, r.value / max * 100)}%;background:${r.color || o.color || 'var(--c1)'}"></div></div>` +
        `<div class="val">${(o.fmt || KC.fmt)(r.value)}${r.suffix || ''}</div>`;
      if (r.tip) bindTip(row, r.tip);
      if (r.onClick) row.addEventListener('click', r.onClick);
      w.appendChild(row);
    });
    c.appendChild(w);
  };

  /* ---------- legend ---------- */
  KC.legend = function (c, items, o) {
    o = o || {};
    const l = document.createElement('div'); l.className = 'legend';
    items.forEach(i => {
      const it = document.createElement('span'); it.className = 'it' + (o.onToggle ? ' click' : '') + (i.off ? ' off' : '');
      it.innerHTML = `<span class="sw" style="background:${i.color}"></span>${esc(i.label)}${i.n != null ? ` <span class="faint">${i.n}</span>` : ''}`;
      if (o.onToggle) it.addEventListener('click', () => o.onToggle(i));
      l.appendChild(it);
    });
    c.appendChild(l); return l;
  };

  /* ---------- stacked columns (SVG) ---------- */
  KC.columns = function (c, cats, series, o) {
    o = o || {}; KC._clr(c);
    const W = o.width || widthOf(c, 640), H = o.height || (W < 420 ? 220 : 250), m = { l: 30, r: 6, t: 16, b: 26 };
    const totals = cats.map((_, i) => series.reduce((s, x) => s + (x.values[i] || 0), 0));
    const ticks = niceTicks(Math.max(1, ...totals), 4), top = ticks[ticks.length - 1];
    const iw = W - m.l - m.r, ih = H - m.t - m.b, band = iw / cats.length, bw = Math.min(34, band * 0.64);
    const y = v => m.t + ih - v / top * ih;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart kc-ch', role: 'img', 'aria-label': o.aria || 'Column chart' }, c);
    ticks.forEach(t => {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'axis' : 'grid' }, svg);
      svgEl('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' }, svg).textContent = t;
    });
    const every = Math.max(1, Math.ceil(cats.length / Math.max(4, Math.floor((W - 40) / 34))));
    cats.forEach((cat, i) => {
      const cx = m.l + band * i + band / 2;
      if (i % every === 0) svgEl('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }, svg).textContent = cat;
      let acc = 0;
      series.forEach(s => {
        const v = s.values[i] || 0; if (!v) return;
        const y0 = y(acc), y1 = y(acc + v);
        const r = svgEl('rect', { x: cx - bw / 2, y: y1, width: bw, height: Math.max(1, y0 - y1), rx: 2, class: 'seg', style: 'fill:' + s.color }, svg);
        if (o.onClick) { r.style.cursor = 'pointer'; r.addEventListener('click', () => o.onClick(cat, s, i)); }
        if(o.percentPerColumn){const label=svgEl('text',{x:cx,y:(y0+y1)/2,'text-anchor':'middle','dominant-baseline':'middle',style:'fill:#fff!important;stroke:#000!important;stroke-width:2.5px;paint-order:stroke;font-size:10px;pointer-events:none'},svg);label.textContent=(v/totals[i]*100).toFixed(1)+'%';}
        acc += v;
      });
      if (o.totals && totals[i]) { const t = svgEl('text', { x: cx, y: y(totals[i]) - 5, 'text-anchor': 'middle', class: 'strong' }, svg); t.textContent = totals[i]; }
      const hit = svgEl('rect', { x: m.l + band * i, y: m.t, width: band, height: ih, class: 'hit' }, svg);
      bindTip(hit, () => `<b>${esc(cat)}</b>` + series.filter(s => s.values[i]).map(s => `<br><span class="m">${esc(s.label)}:</span> ${s.values[i]}${o.percentPerColumn?' ('+(s.values[i]/totals[i]*100).toFixed(1)+'%)':''}`).join('') + (series.length > 1 ? `<br><span class="m">Total:</span> <b>${totals[i]}</b>` : '') + (o.tipExtra ? o.tipExtra(cat, i) : ''));
    });
    if (o.yLabel) svgEl('text', { x: m.l, y: 9 }, svg).textContent = o.yLabel;
  };

  /* ---------- donut ---------- */
  KC.donut = function (c, rows, o) {
    o = o || {}; KC._clr(c);
    const total = rows.reduce((s, r) => s + r.value, 0);
    const wrap = mark(document.createElement('div')); wrap.className += ' donutwrap'; c.appendChild(wrap);
    const S = 150, R = 66, r0 = 42, cx = S / 2, cy = S / 2;
    const svg = svgEl('svg', { viewBox: `0 0 ${S} ${S}`, class: 'chart', role: 'img', 'aria-label': o.aria || 'Donut chart' }, wrap);
    svg.style.maxWidth = '150px';
    const pt = (rad, a) => [cx + rad * Math.sin(a), cy - rad * Math.cos(a)];
    let a0 = 0;
    const live = rows.filter(r => r.value > 0);
    live.forEach(r => {
      const a1 = a0 + r.value / total * Math.PI * 2;
      let node;
      if (live.length === 1) node = svgEl('circle', { cx, cy, r: (R + r0) / 2, fill: 'none', 'stroke-width': R - r0, style: 'stroke:' + r.color }, svg);
      else {
        const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0), big = (a1 - a0) > Math.PI ? 1 : 0;
        node = svgEl('path', { d: `M${x0},${y0} A${R},${R} 0 ${big} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${big} 0 ${x3},${y3} Z`, class: 'seg', style: 'fill:' + r.color }, svg);
      }
      node.style.cursor = r.onClick ? 'pointer' : 'default';
      bindTip(node, r.tip || (() => `<b>${esc(r.label)}</b><br>${r.value} (${KC.pct(r.value, total)})`));
      if (r.onClick) node.addEventListener('click', r.onClick);
      a0 = a1;
    });
    svgEl('text', { x: cx, y: cy + 3, 'text-anchor': 'middle', style: 'font-size:20px;font-weight:750;fill:var(--ink)' }, svg).textContent = o.center != null ? o.center : total;
    svgEl('text', { x: cx, y: cy + 17, 'text-anchor': 'middle', style: 'font-size:10px' }, svg).textContent = o.centerSub || '';
    const list = document.createElement('div'); list.className = 'dlist';
    rows.forEach(r => {
      const d = document.createElement('div'); d.className = 'r';
      d.innerHTML = `<span class="sw" style="background:${r.color}"></span><span>${esc(r.label)}</span><span class="n">${r.value}</span><span class="p">${KC.pct(r.value, total)}</span>`;
      if (r.onClick) { d.style.cursor = 'pointer'; d.addEventListener('click', r.onClick); }
      list.appendChild(d);
    });
    wrap.appendChild(list);
  };

  /* ---------- stage bar ---------- */
  KC.stagebar = function (c, counts, o) {
    o = o || {}; KC._clr(c);
    const total = KC.STAGES.reduce((s, k) => s + (counts[k] || 0), 0) || 1;
    const root = mark(document.createElement('div'));
    const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:2px;height:30px';
    const lab = document.createElement('div'); lab.style.cssText = 'display:flex;gap:2px;margin-top:6px';
    KC.STAGES.forEach(k => {
      const n = counts[k] || 0; if (!n) return;
      const seg = document.createElement('div');
      seg.style.cssText = `flex:${n};background:${KC.STAGE_COLOR[k]};border-radius:4px;min-width:6px;display:flex;align-items:center;justify-content:center;color:${k === 'Pre-award' ? '#0b0b0b' : '#fff'};font-weight:700;font-size:12px;cursor:${o.onClick ? 'pointer' : 'default'}`;
      seg.textContent = n;
      bindTip(seg, () => `<b>${k}</b>: ${n} (${KC.pct(n, total)})<br><span class="m">${esc(KC.STAGE_NOTE[k])}</span>`);
      if (o.onClick) seg.addEventListener('click', () => o.onClick(k));
      bar.appendChild(seg);
      const l = document.createElement('div'); l.style.cssText = `flex:${n};min-width:6px;font-size:11px;color:var(--ink-2);line-height:1.2;overflow:hidden`;
      l.textContent = n / total > .08 ? k : '';
      lab.appendChild(l);
    });
    root.appendChild(bar); root.appendChild(lab); c.appendChild(root);
  };

  /* ---------- heatmap ---------- */
  KC.heat = function (c, rowLabels, colLabels, matrix, o) {
    o = o || {}; KC._clr(c);
    const max = Math.max(1, ...matrix.flat());
    const t = mark(document.createElement('table')); t.className += ' heat';
    let h = '<thead><tr><th></th>' + colLabels.map(l => `<th>${esc(l)}</th>`).join('') + '</tr></thead><tbody>';
    rowLabels.forEach((rl, i) => {
      h += `<tr><th class="rl">${esc(rl)}</th>`;
      colLabels.forEach((cl, j) => {
        const v = matrix[i][j];
        const lvl = v ? Math.min(4, Math.max(1, Math.ceil(v / max * 4))) : 0;
        h += `<td class="${lvl ? 'h' + lvl : 'z'}" data-i="${i}" data-j="${j}">${v || '·'}</td>`;
      });
      h += '</tr>';
    });
    t.innerHTML = h + '</tbody>'; c.appendChild(t);
    t.querySelectorAll('td').forEach(td => {
      const i = +td.dataset.i, j = +td.dataset.j;
      bindTip(td, () => `<b>${esc(rowLabels[i])}</b> &times; ${esc(colLabels[j])}<br>${matrix[i][j]} ${o.unit || ''}`);
      if (o.onClick && matrix[i][j]) { td.style.cursor = 'pointer'; td.addEventListener('click', () => o.onClick(i, j)); }
    });
  };

  /* ---------- schematic geo scatter (no basemap, no tiles) ---------- */
  const CITIES = [['Riyadh', 24.71, 46.68], ['Jeddah', 21.49, 39.19], ['Dammam', 26.43, 50.10], ['Tabuk', 28.38, 36.58], ['Najran', 17.49, 44.13], ['Madinah', 24.47, 39.61]];
  KC.dots = function (c, points, o) {
    o = o || {}; KC._clr(c);
    const b = { x0: 32, x1: 57, y0: 15.5, y1: 32.5 }, k = Math.cos(24 * Math.PI / 180);
    const W = o.width || widthOf(c, 640), iw = W - 20, ih = iw * ((b.y1 - b.y0) / ((b.x1 - b.x0) * k)), H = ih + 20;
    const X = lon => 10 + (lon - b.x0) / (b.x1 - b.x0) * iw, Y = lat => 10 + (b.y1 - lat) / (b.y1 - b.y0) * ih;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart kc-ch', role: 'img', 'aria-label': o.aria || 'Schematic location map' }, c);
    svgEl('rect', { x: 10, y: 10, width: iw, height: ih, rx: 6, style: 'fill:var(--surface-2);stroke:var(--line)' }, svg);
    for (let lo = 32; lo <= 56; lo += 4) { svgEl('line', { x1: X(lo), x2: X(lo), y1: 10, y2: 10 + ih, class: 'grid' }, svg); svgEl('text', { x: X(lo), y: H - 1, 'text-anchor': 'middle' }, svg).textContent = lo + '°E'; }
    for (let la = 18; la <= 32; la += 4) { svgEl('line', { x1: 10, x2: 10 + iw, y1: Y(la), y2: Y(la), class: 'grid' }, svg); svgEl('text', { x: 14, y: Y(la) - 3 }, svg).textContent = la + '°N'; }
    CITIES.forEach(([n, la, lo]) => {
      svgEl('circle', { cx: X(lo), cy: Y(la), r: 2, style: 'fill:var(--ink-3)' }, svg);
      svgEl('text', { x: X(lo) + 5, y: Y(la) + 3, style: 'font-size:10px;fill:var(--ink-3)' }, svg).textContent = n;
    });
    const cid='kcclip'+Math.random().toString(36).slice(2,7); const cp=svgEl('clipPath',{id:cid},svg); svgEl('rect',{x:10,y:10,width:iw,height:ih},cp);
    (o.lines || []).forEach(l => {
      const pl = svgEl('polyline', { points: l.pts.map(p => X(p[1]) + ',' + Y(p[0])).join(' '), fill: 'none', 'stroke-width': 2, 'stroke-linecap': 'round', 'clip-path': 'url(#'+cid+')', style: 'stroke:' + l.color + ';opacity:.85' }, svg);
      if (l.tip) bindTip(pl, l.tip);
    });
    points.forEach(p => {
      const ring = svgEl('circle', { cx: X(p.lon), cy: Y(p.lat), r: p.r || 5, 'stroke-width': 2, style: `fill:${p.approx ? 'var(--surface)' : p.color};stroke:${p.approx ? p.color : 'var(--surface)'};cursor:${p.onClick ? 'pointer' : 'default'}` }, svg);
      if (p.tip) bindTip(ring, p.tip);
      if (p.onClick) ring.addEventListener('click', p.onClick);
    });
  };

  /* ---------- sortable table ---------- */
  KC.table = function (c, cols, rows, o) {
    o = o || {}; KC._clr(c);
    let sortKey = o.sort || null, dir = o.dir || -1;
    const wrap = mark(document.createElement('div')); wrap.className += ' tscroll'; c.appendChild(wrap);
    function draw() {
      let r = rows.slice();
      if (sortKey != null) {
        const col = cols.find(x => x.key === sortKey), g = col.sortVal || col.get;
        r.sort((a, b) => { const x = g(a), y = g(b); return (x == null ? 1 : y == null ? -1 : (x > y ? 1 : x < y ? -1 : 0)) * dir; });
      }
      const lim = o.limit || 500;
      wrap.innerHTML = `<table class="dt"><thead><tr>${cols.map(x => `<th class="${x.cls || ''}" data-k="${x.key}">${esc(x.label)}${sortKey === x.key ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead><tbody>` +
        r.slice(0, lim).map((row, i) => `<tr class="${o.onRow ? 'click' : ''}" data-i="${i}">${cols.map(x => `<td class="${x.cls || ''}">${x.html ? x.get(row) : esc(x.get(row) == null ? '-' : x.get(row))}</td>`).join('')}</tr>`).join('') + '</tbody></table>';
      wrap.querySelectorAll('th').forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; if (sortKey === k) dir = -dir; else { sortKey = k; dir = -1; } draw(); }));
      if (o.onRow) wrap.querySelectorAll('tbody tr').forEach(tr => tr.addEventListener('click', () => o.onRow(r[+tr.dataset.i])));
    }
    draw();
  };

  /* ---------- card with optional table view ---------- */
  KC.card = function (parent, o) {
    const el = document.createElement('div'); el.className = 'card' + (o.cls ? ' ' + o.cls : '');
    el.innerHTML = `<div class="card-head"><div><h3>${esc(o.title)}</h3>${o.sub ? `<div class="sub">${esc(o.sub)}</div>` : ''}</div>${o.table ? '<button class="tbl-toggle noprint" type="button">Table view</button>' : ''}</div><div class="cb"></div>` +
      (o.desc ? `<p class="desc">${o.desc}</p>` : '') + (o.so ? `<div class="so">${o.so}</div>` : '');
    parent.appendChild(el);
    const body = el.querySelector('.cb'); let showTable = false;
    const draw = () => {
      body.innerHTML = '';
      if (showTable && o.table) KC.table(body, o.table.cols, o.table.rows, o.table.opts);
      else o.render(body);
      const b = el.querySelector('.tbl-toggle'); if (b) b.textContent = showTable ? 'Chart view' : 'Table view';
    };
    const btn = el.querySelector('.tbl-toggle'); if (btn) btn.addEventListener('click', () => { showTable = !showTable; draw(); });
    draw();
    let lastW = body.clientWidth, tmr;
    const resized=()=>{ if(!body.isConnected){window.removeEventListener('resize',resized);return;} clearTimeout(tmr); tmr=setTimeout(()=>{const w=body.clientWidth;if(w&&Math.abs(w-lastW)>40&&!showTable){lastW=w;draw();}},200); }; window.addEventListener('resize',resized);
    return { el, body, redraw: draw };
  };

  /* ---------- tabs ---------- */
  KC.tabs = function (bar, defs, onSelect) {
    bar.setAttribute('role', 'tablist'); bar.classList.add('tabs'); bar.innerHTML = '';
    const btns = defs.map(d => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tab'; b.setAttribute('role', 'tab'); b.dataset.key = d.key;
      b.innerHTML = (d.color ? `<span class="swatch" style="background:${d.color}"></span>` : '') + esc(d.label) + (d.count != null ? ` <span class="count">${d.count}</span>` : '');
      b.addEventListener('click', () => select(d.key));
      bar.appendChild(b); return b;
    });
    function select(key) { btns.forEach(b => b.setAttribute('aria-selected', b.dataset.key === key ? 'true' : 'false')); onSelect(key); }
    return select;
  };

  /* ---------- theme toggle ---------- */
  KC.themeButton = function (parent) {
    const b = document.createElement('button'); b.className = 'themebtn noprint'; b.type = 'button'; b.textContent = 'Light / Dark';
    let cur = null; try { cur = localStorage.getItem('ksa-theme'); } catch (e) {}
    if (cur) document.documentElement.setAttribute('data-theme', cur);
    b.addEventListener('click', () => {
      const isDark = (document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
      const n = isDark ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', n);
      try { localStorage.setItem('ksa-theme', n); } catch (e) {}
    });
    parent.appendChild(b); return b;
  };

  /* ---------- detail drawer (record + its sources) ---------- */
  let drawer, over;
  function ensureDrawer() {
    if (drawer) return;
    over = Object.assign(document.body.appendChild(document.createElement('div')), { id: 'kc-over' });
    drawer = Object.assign(document.body.appendChild(document.createElement('aside')), { id: 'kc-drawer' });
    over.addEventListener('click', KC.closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') KC.closeDrawer(); });
  }
  KC.closeDrawer = function () { if (!drawer) return; drawer.classList.remove('on'); over.classList.remove('on'); };
  KC.openRecord = function (r) {
    ensureDrawer();
    const kv = (r.rows || []).map(([k, v]) => `<div>${esc(k)}</div><div>${v == null || v === '' ? 'Not publicly disclosed' : v}</div>`).join('');
    drawer.innerHTML = `<button class="x" aria-label="Close" type="button">&times;</button><div>${r.badges || ''}</div><h2>${esc(r.title)}</h2><div class="kv">${kv}</div>` +
      (r.extra || '') + (r.notes ? `<h4>Analyst notes</h4><div class="muted" style="font-size:12.5px">${esc(r.notes)}</div>` : '') +
      `<h4>Sources</h4>` + ((r.sources || []).length ? r.sources.map(s => `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} — ${esc(s.publisher)} (${esc(s.date)})</a>`).join('') : `<div class="muted" style="font-size:12.5px">${esc(r.noSource || 'No public web source for this record.')}</div>`);
    drawer.querySelector('.x').addEventListener('click', KC.closeDrawer);
    drawer.classList.add('on'); over.classList.add('on'); drawer.scrollTop = 0;
  };
  KC.confPill = c => `<span class="pill ${c === 'High' ? 'hi' : c === 'Medium' ? 'me' : 'lo'}">${esc(c)} confidence</span>`;
  KC.openProject = function (p, M) {
    const src = (p.source_ids || []).map(id => M.DATA.sources[id]).filter(Boolean);
    const pk = (M.pkgBy[p.id] || []).map(k => {
      const s = M.DATA.sources[k.source_id];
      return `<div style="margin:6px 0;font-size:12.5px"><b>${esc(k.contractor)}</b> — ${esc(k.role)}<br><span class="muted">Value: ${esc(k.value || 'Not publicly disclosed')} · Date: ${esc(k.date || 'Not publicly disclosed')} · ${esc(k.role_type)}</span>${s ? `<br><a class="src" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} (${esc(s.publisher)})</a>` : ''}</div>`;
    }).join('');
    KC.openRecord({
      badges: `<span class="pill" style="border-color:${KC.techColor(p.group)};color:var(--ink)"><span class="dot" style="background:${KC.techColor(p.group)}"></span>${esc(KC.techLabel(p.group))}${p.isSVC ? ' (SVC)' : ''}</span> <span class="pill">${esc(p.stage)}</span> ${KC.confPill(p.confidence)}`,
      title: p.name,
      rows: [
        ['Owner', esc(p.owner)], ['Location', esc((p.locations || []).map(l => l.name).join(' → '))],
        ['Capacity', esc(p.capacity)], ['Total value', esc(p.total_value)], ['Award / date', esc(p.award_date)],
        ['Date basis', esc(KC.BASIS_LABEL[p.yearBasis] || '')], ['Target', esc(p.completion_target)], ['Status', esc(p.status)],
        ['Main EPC', esc(p.epc.join(', ') || 'Not publicly disclosed')], ['Equipment / converter manufacturer', esc(p.oem.join(', ') || 'Not publicly disclosed')],
        ['Aliases', esc((p.aliases || []).join('; ') || '-')]
      ],
      extra: pk ? `<h4>Contract packages</h4>${pk}` : '',
      notes: p.notes, sources: src
    });
  };
  KC.projectLink = function (M) { return p => KC.openProject(p, M); };
})(window);

