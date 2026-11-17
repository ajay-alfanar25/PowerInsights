
/* ksa_report_core.js
 * Shared analytics layer for the KSA-REACTIVE report pages.
 * Reads ksa_reactive_data.json and derives everything the charts need at load time,
 * so adding/editing records in the JSON updates every report automatically.
 *
 * Nothing here invents data: every derived field is computed from text already in the JSON,
 * and where the text does not support a value the field is null (reports show that as
 * "not stated", never as an estimate).
 */
(function (root) {
  'use strict';
  const KC = root.KC = root.KC || {};

  /* ---------- technology groups (fixed order + fixed colour slot per entity) ---------- */
  KC.TECHS = [
    { key: 'STATCOM', label: 'STATCOM',               short: 'STATCOM', slot: 1 },
    { key: 'HVDC',    label: 'HVDC',                  short: 'HVDC',    slot: 2 },
    { key: 'SYNCOND', label: 'Synchronous Condenser', short: 'Sync. Cond.', slot: 3 },
    { key: 'DC',      label: 'DC System',             short: 'DC System', slot: 4 },
    { key: 'REN',     label: 'Renewables',            short: 'Renewables', slot: 5 }
  ];
  KC.STAGES = ['In Operation', 'Under Installation', 'Awarded', 'Tendering', 'Planned / Announced', 'Delivered', 'Pre-award', 'Under execution', 'Completed'];
  KC.STAGE_NOTE = {
    'In Operation': 'HVDC link in operation', 'Under Installation': 'HVDC link under installation', 'Tendering': 'Tender / RFQ / bid stage; no award recorded', 'Planned / Announced': 'Planned or announced target; no award recorded', 'Delivered': 'STATCOM/SVC completion confirmed in the reference or by the team',
    'Pre-award': 'Tender, RFQ, bids submitted, planned or only a development agreement - no contract yet',
    'Awarded': 'Contract awarded; execution progress not confirmed in the source',
    'Under execution': 'Contract awarded and work reported as ongoing (design, construction or commissioning)',
    'Completed': 'Energized, commissioned, installed or operational'
  };

  function techGroup(p) {
    const t = p.technology_category || '';
    if (t === 'HVDC') return 'HVDC';
    if (/synchronous/i.test(t)) return 'SYNCOND';
    return 'STATCOM';            // STATCOM + SVC-tagged records (variant "SVC")
  }

  /* ---------- stage from the free-text status ---------- */
  function stageOf(status) {
    const s = (status || '').toLowerCase();
    if (/^operational/.test(s)) return 'Completed';
    if (/tender|rfq|pts issued|not yet awarded|planned|planning|proposed|feasibility|development agreement/.test(s)) return 'Pre-award';
    if (/under execution/.test(s)) return 'Under execution';
    if (/completed|energized|installed/.test(s)) return 'Completed';
    if (/awarded/.test(s)) return 'Awarded';
    return 'Pre-award';
  }

  /* ---------- year + the basis the year comes from ----------
   * award        : year of a reported contract award / signing / commissioning
   * tender       : year embedded in an SEC PTS number (tender issuance year)
   * supplier-log : date of a component order in a supplier's log - a proxy for award, not the award itself
   */
  function yearOf(p) {
    if(p.specs?.analysis_year!==undefined){const n=Number(p.specs.analysis_year);return {year:Number.isInteger(n)&&n>=1900&&n<=2200?n:null,basis:'award'};}
    const a = p.award_date || '';
    let m = a.match(/PTS\s*[–—-]?\s*(\d{2})[A-Z]/);
    if (m) return { year: 2000 + parseInt(m[1], 10), basis: 'tender' };
    if (/reactor|supply date|sunten/i.test(a)) {
      m = a.match(/(20\d{2})/);
      return m ? { year: +m[1], basis: 'supplier-log' } : { year: null, basis: 'none' };
    }
    m = a.match(/(20\d{2})/);
    return m ? { year: +m[1], basis: 'award' } : { year: null, basis: 'none' };
  }
  KC.BASIS_LABEL = {
    'award': 'Award / signing / commissioning year',
    'tender': 'Tender issued (year from SEC PTS number)',
    'supplier-log': 'Component order date (proxy for award)',
    'none': 'No date available'
  };

  /* ---------- rating (MVAr) ----------
   * unit   : MVAr of one STATCOM unit / site as stated (capacitive side)
   * count  : number of units when the text says "N x" explicitly
   * total  : unit * count, only when both are explicit
   * "2 x 13.8kV, 30 MVAr" is ambiguous (units or voltage levels?) -> unit only, no total.
   */
  function ratingOf(p) {
    const t=String(p.specs&&p.specs.rating_mvar||''); let a;
    if ((a=t.match(/^(\d+)\s*x\s*\(?\s*[+±]?(\d+(?:\.\d+)?)/i))) return {unit:+a[2],count:+a[1],total:+a[1]*+a[2],note:'explicit count and per-unit rating'};
    if (/EPC-calculated requirement/i.test(t) && (a=t.match(/^(\d+(?:\.\d+)?)/))) return {unit:null,count:null,total:+a[1],note:'EPC-calculated interconnection requirement'};
    if (/combined/i.test(t) && (a=t.match(/(?:up to\s*)?(\d+(?:\.\d+)?)/i))) return {unit:null,count:null,total:+a[1],note:'combined rating; per-site rating not stated'};
    if ((a=t.match(/^-\d+(?:\.\d+)?\s*\/\s*\+(\d+(?:\.\d+)?)/))) return {unit:+a[1],count:null,total:null,note:'capacitive side'};
    if ((a=t.match(/^[+±]?(\d+(?:\.\d+)?)(?:\s*\/|\s*\(|\s+per|$)/i))) return {unit:+a[1],count:null,total:null,note:'as stated; capacitive side for signed ranges'};

    const c = (p.capacity || '').replace(/−/g, '-');
    let m;
    if ((m = c.match(/^(\d+)\s*x\s*\(?\s*[+±]?(\d+(?:\.\d+)?)\s*(?:\/|MVAr|\))/i))) return { unit: +m[2], count: +m[1], total: +m[1] * +m[2], note: 'capacitive side; explicit unit count' };
    if ((m = c.match(/^(\d+)\s*x\s*\(\s*\+?(\d+(?:\.\d+)?)\s*MVAr/i)))
      return { unit: +m[2], count: +m[1], total: +m[1] * +m[2], note: 'capacitive side' };
    if ((m = c.match(/^(\d+)\s*x\s*±?\s*(\d+(?:\.\d+)?)\s*MVAr/i)))
      return { unit: +m[2], count: +m[1], total: +m[1] * +m[2] };
    if ((m = c.match(/^\+(\d+(?:\.\d+)?)\s*MVAr\s*\(capacitive\)/i)))
      return { unit: +m[1], count: null, total: null };
    if ((m = c.match(/^(\d+(?:\.\d+)?)\s*MVAr\s*\(capacitive\)/i)))
      return { unit: +m[1], count: null, total: null };
    if ((m = c.match(/^(\d+(?:\.\d+)?)\s*MVAr[^;]*EPC-calculated/i)))
      return { unit: null, count: null, total: +m[1], note: 'EPC-calculated interconnection requirement' };
    if ((m = c.match(/^(\d+)\s*×\s*[\d.]+kV,\s*(\d+(?:\.\d+)?)\s*MVAr\s*STATCOM per site\s*\((\d+) sites\)/i)))
      return { unit: +m[2], count: +m[3], total: +m[2] * +m[3] };
    if ((m = c.match(/^(\d+)\s*×\s*[\d.]+kV,\s*(\d+(?:\.\d+)?)\s*MVAr/i)))
      return { unit: +m[2], count: null, total: null };
    if ((m = c.match(/^(\d+(?:\.\d+)?)\s*MVAr/i)))
      return { unit: +m[1], count: null, total: null };
    return { unit: null, count: null, total: null };
  }
  KC.SIZE_BANDS = [
    { key: '<=10',  label: '10 MVAr and below', test: u => u <= 10 },
    { key: '11-20', label: '11 - 20 MVAr',      test: u => u > 10 && u <= 20 },
    { key: '21-40', label: '21 - 40 MVAr',      test: u => u > 20 && u <= 40 },
    { key: '41-200',label: '41 - 200 MVAr',     test: u => u > 40 && u <= 200 },
    { key: '>200',  label: 'Above 200 MVAr',    test: u => u > 200 }
  ];

  /* ---------- money: disclosed numbers only ---------- */
  function usdM(str) {
    if (!str) return null;
    let m = str.match(/\$\s*([\d,.]+)\s*(million|billion|m|bn)\b/i);
    if (!m) m = str.match(/USD\s*([\d,.]+)\s*(million|billion|m|bn)\b/i);
    if (m) { let v = parseFloat(m[1].replace(/,/g, '')); return /^b/i.test(m[2]) ? v * 1000 : v; }
    m = str.match(/\(~\s*\$?([\d,.]+)\s*million\)/i);          // "(~$36.99 million)"
    if (m) return parseFloat(m[1].replace(/,/g, ''));
    m = str.match(/SAR\s*~?\s*([\d,.]+)\s*(million|billion|bn|m)\b/i);
    if (m) { let v = parseFloat(m[1].replace(/,/g, '')); if (/^b/i.test(m[2])) v *= 1000; return v / 3.75; }
    return null;
  }
  // A value counts as "disclosed" only when the field itself leads with an amount.
  // "Not publicly disclosed (part of a $5.33bn bundle ...)" must NOT be read as a number.
  function disclosedUsdM(str) {
    if (!str || !/^\s*(Converter station:\s*)?~?\s*(\$|SAR|USD|\u20ac)/i.test(str)) return null;
    return usdM(str);
  }
  KC.usdM = disclosedUsdM;

  /* ---------- company-name normalisation (split combined strings, map aliases) ---------- */
  const CANON = [
    [/cepco|civil\s*(&|and)\s*electrical projects/i, 'CEPCO'],
    [/al[\s-]*gihaz/i, 'Al Gihaz'],
    [/hd\s*hyundai\s*electric|hyundai\s*electric/i, 'HD Hyundai Electric'],
    [/hyundai/i, 'Hyundai E&C'],
    [/siemens/i, 'Siemens Energy'],
    [/nr electric/i, 'NR Electric'],
    [/hitachi/i, 'Hitachi Energy'],
    [/^abb\b/i, 'ABB (legacy)'],
    [/areva|alstom/i, 'GE Vernova / Alstom lineage'],
    [/^ge\b|ge vernova|ge renewable/i, 'GE Vernova'],
    [/larsen|^l&t/i, 'L&T'],
    [/alfanar\s*&\s*nari/i, 'Alfanar & NARI'],
    [/alfanar/i, 'Alfanar'],
    [/^nr$/i, 'NR Electric'],
    [/^rx-?hk$/i, 'RXHK'],
    [/^xj\b/i, 'XJ Electric'],
    [/aetcon/i, 'AETCON'],
    [/national contracting|^ncc/i, 'NCC'],
    [/prysmian/i, 'Prysmian'],
    [/ssem/i, 'SSEM'],
    [/^cet\b|china electric power equipment/i, 'CET (China Electric Power Equipment & Technology)'],
    [/china energy engineering|ceec/i, 'CEEC (China)'],
    [/xi.?an electric/i, "Xi'an Electric"],
    [/giza cable/i, 'Giza Cable'],
    [/elsewedy/i, 'Elsewedy Electric'],
    [/ojaimi/i, 'Al-Ojaimi']
  ];
  function canon(name) {
    const n = name.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim();
    for (const [re, c] of CANON) if (re.test(n) || re.test(name)) return c;
    return n;
  }
  function splitParties(contractor) {
    // "GE Renewable ... (now GE Vernova) + Alfanar" -> ["GE...", "Alfanar"]; parentheses may hide a '+'
    const flat = contractor.replace(/\(.*?\)/g, m => m.replace(/\+/g, ' and '));
    return flat.split(/\s\+\s/).map(s => s.trim()).filter(Boolean);
  }
  KC.canon = canon;

  /* ---------- rough operating region from coordinates (indicative only) ---------- */
  function regionOf(loc) {
    if (!loc || loc.lat == null) return null;
    const { lat, lon } = loc;
    if (lon >= 48.3) return 'Eastern';
    if (lat >= 26.3 && lon <= 43.5) return 'Northern';
    if (lat <= 20.3 && lon <= 46) return 'Southern';
    if (lon <= 41.6) return 'Western';
    return 'Central';
  }
  KC.REGIONS = ['Central', 'Western', 'Northern', 'Eastern', 'Southern'];

  /* ---------- build the model ---------- */
  KC.build = function (DATA) {
    const act = new Set(DATA.projects.map(p => p.id));
    const pkgBy = {};
    DATA.packages.forEach(k => { if (act.has(k.project_id)) (pkgBy[k.project_id] = pkgBy[k.project_id] || []).push(k); });

    const projects = DATA.projects.map(p => {
      const y = yearOf(p), r = ratingOf(p), pk = pkgBy[p.id] || [];
      const units=Number(p.specs?.number_of_units); if(Number.isFinite(units)&&units>0&&r.unit!=null){r.count=units;r.total=units*r.unit;}
      const epc = [], oem = [];
      pk.forEach(k => {
        const parties = splitParties(k.contractor).map(canon);
        if (k.role_type === 'EPC') parties.forEach(x => epc.push(x));
        else if (k.role_type === 'OEM') parties.forEach(x => oem.push(x));
        else if (parties.length >= 2) { oem.push(parties[0]); parties.slice(1).forEach(x => epc.push(x)); }
        else { epc.push(parties[0]); oem.push(parties[0]); }
      });
      // General Specs are the single source of truth: when a record states its EPC contractor or
      // equipment maker there, the dashboards use exactly that. Package roles are only the fallback.
      const sp = p.specs || {};
      const specParties = s => (s ? String(s).replace(/\([^)]*\)/g, ' ').split(/;|,|\s\+\s|\sand\s|\swith\s/i)
        .map(x => x.trim()).filter(x => x && !/^(not |no info|tbd|n\/?a\b|publicly not available|yet to decide)/i.test(x)).map(canon) : []);
      const isHV = techGroup(p) === 'HVDC';
      const hasEpc = !!(sp.epc_contractor && String(sp.epc_contractor).trim());
      const sEpc = (/(\bcet\b|china electric power)/i.test(sp.epc_contractor || '') && /alfanar/i.test(sp.epc_contractor || '')) ? ['Alfanar + CET (China Electric Power Equipment & Technology)'] : specParties(sp.epc_contractor);
      const hasOem = isHV || !!(sp.manufacturer && String(sp.manufacturer).trim());
      const sOem = isHV ? specParties(sp.converter_valve) : specParties(sp.manufacturer);
      if (hasEpc) { epc.length = 0; sEpc.forEach(x => epc.push(x)); }
      if (hasOem) { oem.length = 0; sOem.forEach(x => oem.push(x)); }
      const pkgValues = pk.map(k => disclosedUsdM(k.value)).filter(v => v != null);
      const val = p.cost_estimated ? null : disclosedUsdM(p.total_value);
      const prim = (p.locations || [])[0];
      return Object.assign({}, p, {
        group: techGroup(p),
        isSVC: p.variant === 'SVC',
        stage: (p.stage_override === 'Planned' ? 'Planned / Announced' : p.stage_override) || stageOf(p.status),
        year: y.year, yearBasis: y.basis,
        rating: r,
        epc: [...new Set(epc)], oem: [...new Set(oem)],
        valueUSDm: val,
        packageValuesUSDm: pkgValues,
        region: techGroup(p) === 'HVDC' ? null : regionOf(prim),
        nSources: (p.source_ids || []).length,
        isTender: ['Tendering','Pre-award'].includes((p.stage_override === 'Planned' ? 'Planned / Announced' : p.stage_override) || stageOf(p.status))
      });
    });

    const byTech = {};
    KC.TECHS.forEach(t => byTech[t.key] = []);
    projects.forEach(p => byTech[p.group].push(p));
    byTech.DC = DATA.dc_system || [];
    byTech.REN = DATA.renewables || [];

    return { DATA, projects, byTech, pkgBy, active: act };
  };

  /* ---------- small stat helpers ---------- */
  KC.countBy = (arr, fn) => { const m = new Map(); arr.forEach(x => { const k = fn(x); if (k == null) return; m.set(k, (m.get(k) || 0) + 1); }); return m; };
  KC.entries = m => [...m.entries()].map(([k, v]) => ({ key: k, n: v }));
  KC.sum = (arr, fn) => arr.reduce((s, x) => s + (fn ? fn(x) || 0 : x || 0), 0);
  KC.fmt = n => n == null ? '-' : Math.round(n).toLocaleString('en-US');
  KC.pct = (n, d) => d ? Math.round(100 * n / d) + '%' : '-';

  /* contractor / OEM league table for a set of projects */
  KC.league = function (list, role) {
    const m = new Map();
    list.forEach(p => (role === 'epc' ? p.epc : p.oem).forEach(n => {
      if (!m.has(n)) m.set(n, []);
      m.get(n).push(p);
    }));
    return [...m.entries()].map(([name, ps]) => ({ name, n: ps.length, projects: ps }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  };

  /* disclosure coverage: how much of each key field is actually known */
  KC.coverage = function (list) {
    const n = list.length || 1;
    const c = f => list.filter(f).length;
    return [
      { key: 'Recorded award / milestone year',      n: c(p => p.yearBasis === 'award'), of: list.length },
      { key: 'Rating (MVAr / MW)',     n: c(p => p.rating.unit != null || p.rating.total != null || /\bMW\b|\bkV\b/.test(p.capacity || '') && !/not publicly/i.test(p.capacity)), of: list.length },
      { key: 'EPC contractor known',   n: c(p => p.epc.length), of: list.length },
      { key: 'Equipment OEM known',    n: c(p => p.oem.length), of: list.length },
      { key: 'Contract value disclosed', n: c(p => p.valueUSDm != null || p.packageValuesUSDm.length), of: list.length },
      { key: 'Exact location (not approximate)', n: c(p => (p.locations || []).length && (p.locations || []).every(l => l.approx === false)), of: list.length }
    ];
  };

  /* ---------- timelines ---------- */
  KC.timeline = function (list, groupFn, groups, opts) {
    opts = opts || {};
    const ys = list.map(p => p.year).filter(y => y != null);
    if (!ys.length) return { cats: [], series: [], undated: list.length };
    const lo = opts.from != null ? opts.from : Math.min.apply(null, ys), hi = opts.to != null ? opts.to : Math.max.apply(null, ys);
    const cats = []; for (let y = lo; y <= hi; y++) cats.push(y);
    const series = groups.map(g => ({ key: g.key, label: g.label, color: g.color,
      values: cats.map(y => list.filter(p => p.year === y && groupFn(p) === g.key).length) }));
    return { cats, series, undated: list.filter(p => p.year == null).length };
  };

  /* ---------- owner grouping ---------- */
  KC.ownerGroup = function (o) {
    o = o || '';
    if (/national grid/i.test(o)) return 'SEC / National Grid SA';
    if (/SPPC|NREP/i.test(o)) return 'SEC / SPPC (NREP IPP)';
    if (/gccia/i.test(o)) return 'GCCIA';
    if (/enowa|neom/i.test(o)) return 'ENOWA';
    if (/modon/i.test(o)) return 'Modon';
    if (/^SEC\b/.test(o) && !/unconfirmed/i.test(o)) return 'SEC';
    return 'Other / unconfirmed';
  };

  /* ---------- HVDC: disclosed EPC package value per km (only where both are stated) ---------- */
  KC.hvdcPerKm = function (M) {
    const out = [];
    M.DATA.packages.forEach(k => {
      if (!M.active.has(k.project_id) || !/^HVDC/.test(k.project_id) || k.role_type !== 'EPC') return;
      const v = KC.usdM(k.value); if (v == null) return;
      const m = (k.role + ' ' + k.value).match(/(\d[\d,]*(?:\.\d+)?)\s*km/i); if (!m) return;
      const km = parseFloat(m[1].replace(/,/g, '')); if (!km) return;
      const proj = M.projects.find(p => p.id === k.project_id);
      out.push({ pkg: k, project: proj, contractor: canon(splitParties(k.contractor)[0]), usdm: v, km, perKm: v / km, date: k.date || '' });
    });
    return out.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  };

  /* ---------- DC system normalisation ---------- */
  KC.dcEpc = function (n) {
    n = (n || '').trim();
    if (/alfanar/i.test(n)) return 'Alfanar Construction';
    if (/^delta/i.test(n)) return 'Delta';
    if (/elsewedy/i.test(n)) return 'Elsewedy Electric';
    if (/ojaimi/i.test(n)) return 'Al-Ojaimi';
    if (/jal international/i.test(n)) return 'JAL International';
    if (/osais/i.test(n)) return 'Osais';
    if (/nour/i.test(n)) return 'Nour Energy';
    return n.replace(/\b\w/g, c => c.toUpperCase()).replace(/\bAuva\b/i, 'AUVA').replace(/\bKfia\b/i, 'KFIA');
  };
  KC.dcFamily = b => /VRL/i.test(b || '') ? 'VRL series (battery Ah rating)' : /SMG/i.test(b || '') ? 'SMG series (model number)' : 'Not specified';
  KC.dcSupplier = s => /not specified/i.test(s || '') ? 'Not specified' : s;

  /* ---------- renewables: how is reactive support linked to the project? ---------- */
  KC.renLinkage = function (r) {
    const s = r.statcom_status || '';
    if (/^Confirmed\s*—\s*Synchronous/i.test(s)) return 'Synchronous condenser (confirmed)';
    if (/^Confirmed\s*—\s*STATCOM/i.test(s)) return 'STATCOM required (RFQ stage)';
    if (/^No STATCOM-specific/i.test(s)) return 'None publicly confirmed';
    if (/^Studied only/i.test(s)) return 'Academic study only';
    if (/^Grid-code/i.test(s)) return 'Grid-code implied only';
    return 'Possible link (unconfirmed)';
  };
  KC.REN_LINK_ORDER = ['STATCOM required (RFQ stage)', 'Synchronous condenser (confirmed)', 'Possible link (unconfirmed)', 'Grid-code implied only', 'Academic study only', 'None publicly confirmed'];

  /* ---------- shared facts used by the narratives (everything computed, nothing typed in) ---------- */
  KC.facts = function (M) {
    const S = M.byTech.STATCOM, H = M.byTech.HVDC, Y = M.byTech.SYNCOND, D = M.byTech.DC, R = M.byTech.REN;
    const pre = l => l.filter(p => ['Pre-award','Tendering','Planned / Announced'].includes(p.stage));
    const isNrep = p => /NREP/i.test(p.owner || '');
    const grid = M.projects;
    const f = { S, H, Y, D, R, grid };
    f.stage = l => { const o = {}; KC.STAGES.forEach(k => o[k] = l.filter(p => p.stage === k).length); return o; };
    const sp = pre(S);
    f.tender = {
      all: sp, nrep: sp.filter(isNrep), sec: sp.filter(p => !isNrep(p)),
      mvarSec: KC.sum(sp.filter(p => !isNrep(p)), p => p.rating.total),
      mvarNrep: KC.sum(sp.filter(isNrep), p => p.rating.total)
    };
    f.tender.mvarAll = f.tender.mvarSec + f.tender.mvarNrep;
    f.tender.byYear = {}; f.tender.sec.forEach(p => { if (p.year) f.tender.byYear[p.year] = (f.tender.byYear[p.year] || 0) + 1; });
    // does the latest tender year consist of consecutive PTS numbers (i.e. likely a single issuing batch)?
    (function(){
      const ys=Object.keys(f.tender.byYear).map(Number).sort(); f.tender.batchYear=null;
      if(!ys.length) return; const ly=ys[ys.length-1];
      const nums=f.tender.sec.filter(p=>p.year===ly).map(p=>{const m=(p.award_date||'').match(/PTS\s*[\u2013\u2014-]?\s*\d{2}[A-Z]{2}(\d+)/);return m?+m[1]:null;});
      if(nums.length>=4 && nums.every(n=>n!=null)){nums.sort((a,b)=>a-b); if(nums[nums.length-1]-nums[0]===nums.length-1) f.tender.batchYear=ly;}
    })();
    f.epcLeague = KC.league(S, 'epc'); f.oemLeague = KC.league(S, 'oem');
    f.hvdcOem = KC.league(H, 'oem'); f.hvdcEpc = KC.league(H, 'epc');
    f.dc = {
      approved: D.filter(x => x.status === 'Approved'), design: D.filter(x => x.status !== 'Approved'),
      share: (list, sup) => list.length ? list.filter(x => KC.dcSupplier(x.supplier) === sup).length / list.length : 0,
      crossRef: D.filter(x => x.cross_ref)
    };
    f.ren = {
      mw: KC.sum(R, r => r.capacity_mw),
      byLink: {}, mwByLink: {}
    };
    R.forEach(r => { const k = KC.renLinkage(r); f.ren.byLink[k] = (f.ren.byLink[k] || 0) + 1; f.ren.mwByLink[k] = (f.ren.mwByLink[k] || 0) + (r.capacity_mw || 0); });
    f.perKm = KC.hvdcPerKm(M);
    return f;
  };

  /* load JSON then build */
  KC.load = function (url) {
    return fetch((url || 'ksa_reactive_data.json') + '?t=' + Date.now(), { cache: 'no-store' }).then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' loading ' + (url || 'ksa_reactive_data.json'));
      return r.json();
    }).then(KC.build);
  };

  KC.scriptError = function (err) {
    console.error(err);
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#7a1f1f;color:#fff;padding:10px 16px;font:13px Arial,sans-serif';
    d.textContent = 'Report script error (data loaded fine): ' + (err && err.message ? err.message : err) + ' - see the browser console.';
    document.body.appendChild(d);
  };
  KC.loadError = function (err) {
    document.body.innerHTML =
      '<div style="padding:40px;font-family:Arial,sans-serif;max-width:640px;margin:60px auto;background:#1b1f27;color:#fff;border-radius:10px;line-height:1.6;">' +
      '<h2 style="margin-top:0;color:#ff7a7a;">Could not load ksa_reactive_data.json</h2>' +
      '<p>Keep this HTML, <code>ksa_report_core.js</code>, <code>ksa_report_charts.js</code>, <code>ksa_report_base.css</code> and <code>ksa_reactive_data.json</code> in the <b>same folder</b>, ' +
      'and open the page through a local server (<code>python -m http.server 8000</code>) rather than by double-clicking it.</p>' +
      '<p style="color:#ffd27a;">' + (location.protocol === 'file:' ? 'This page was opened as a file (file://). Open it from <b>http://localhost:8000/</b> instead.' : 'Page address: <code>' + location.href + '</code><br>Data file it tried: <code>' + new URL('ksa_reactive_data.json', location.href).href + '</code> - paste that address into a new browser tab; if it does not show JSON text, the server cannot read the file (see README).') + '</p>' +
      '<p style="color:#999;font-size:12px;">Technical detail: ' + err + '</p></div>';
  };
})(window);

