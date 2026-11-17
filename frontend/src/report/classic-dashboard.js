import * as d3 from 'd3';
function dashboardData(M) {
 const value=x=>x==null||/^(not |no info|tbd|n\/a)/i.test(String(x))?'Not available':String(x);
 return {hvdc:M.byTech.HVDC.map(p=>({id:p.id,name:p.name,status:p.stage,mw:Number(p.specs.analysis_capacity_mw ?? p.specs.capacity_mw)||null,scope:!p.specs.country_2||/^Saudi Arabia(?:$|\s*\()/i.test(p.specs.country_2)?'Domestic':'International',region:p.specs.region,epc:value(p.specs.epc_contractor),valve:value(p.specs.converter_valve),tech:value(p.specs.converter_technology),year:p.year,yearText:p.year?String(p.year):'Not available',owner:p.owner,dc:value(p.specs.dc_voltage_kv),ends:[p.specs.terminal_a,p.specs.terminal_b].filter(Boolean).join(' ↔ '),geo:p.specs.region,epcFull:p.specs.epc_contractor,subs:p.specs.other_notes||p.components?.other_subparts,capNote:''})),
 statcom:M.byTech.STATCOM.map(p=>({id:p.id,name:p.name,legacy:p.isSVC,type:value(p.specs.project_type),status:['Tendering','Planned / Announced','Planned','Pre-award'].includes(p.stage)?'Planned':p.stage,epc:p.epc.join(' + ')||'Not available',oem:p.oem.join(' + ')||'Not available',epcFull:value(p.specs.epc_contractor),oemFull:value(p.specs.manufacturer),teamRef:false,owner:p.owner,award:p.award_date,year:p.year,region:p.specs.region||p.region,geo:(p.locations||[]).map(l=>l.name).join('; '),rating:value(p.specs.rating_mvar),mvar:p.rating.total??p.rating.unit,voltage:value(p.specs.connection_voltage_kv),vclass:value(p.specs.connection_voltage_kv)==='Not available'?'Not available':p.specs.connection_voltage_kv+' kV',units:p.specs.number_of_units,cost:p.recorded_cost_usd??(!p.cost_estimated?p.cost_value_usd:null),costValue:p.cost_value_usd,costEstimated:p.cost_estimated,costDisplay:p.specs.cost||'Not available',costBasis:p.cost_basis,equivalentMvar:p.equivalent_mvar,sourceLinks:['STATCOM-01','STATCOM-33'].includes(p.id)?(p.source_ids||[]).map(id=>M.DATA.sources[id]?.url).filter(Boolean):[]}))};
}

export function mountClassicDashboard(host,M,state={},onEdit=null){
 const cleanups=[]; let filteredRows=[]; host.innerHTML="<div class=\"classic-shell\"><style>\n.classic-shell {\n  --color-bg: #f7f8fa; --color-panel: #ffffff; --color-fg: #17202b; --color-fg-muted: #5d6877;\n  --color-border-line: #dde2e8; --color-ok: #1d7a4a; --color-warn: #a35f00; --color-bad: #c0392b;\n  --c1: #1f5fa8; --c2: #d07a1f; --c3: #2f8f7a; --c4: #7a4fb0; --c5: #b8456b; --c6: #5b7a1e; --c7: #3a8fc2; --c8: #8a6d3b;\n  --cds-chart-muted: #b9c1cb; --cds-chart-grid: #e8ecf0; --cds-chart-axis: #b9c1cb; --cds-chart-reference: #1f5fa8;\n  --cds-surface-popover: #ffffff; --cds-border: #dde2e8; --cds-shadow-popover: 0 4px 16px rgba(23, 32, 43, .12);\n  --cds-text-secondary: #5d6877;\n  --font-anthropic-sans: \"IBM Plex Sans\", system-ui, -apple-system, \"Segoe UI\", Arial, sans-serif;\n  --font-anthropic-serif: \"Source Serif 4\", Georgia, \"Times New Roman\", serif;\n  --cds-font-size-caption: 12px; --cds-font-size-body: 14px; --cds-font-size-heading: 15px; --cds-font-size-title: 28px;\n  --cds-font-weight-medium: 600;\n  --cds-gap-xs: 4px; --cds-gap-sm: 8px; --cds-gap-md: 14px; --cds-gap-lg: 24px; --cds-gap-xl: 36px;\n  --cds-pad-xs: 4px; --cds-pad-sm: 8px; --cds-pad-md: 12px; --cds-pad-lg: 18px; --cds-pad-xl: 28px;\n  --cds-radius: 8px; --cds-dur-slow: 300ms;\n  color-scheme: light;\n}\n@media (prefers-color-scheme: dark) {\n  .classic-shell {\n    --color-bg: #0f141a; --color-panel: #171e26; --color-fg: #e6ebf0; --color-fg-muted: #9aa6b4;\n    --color-border-line: #2a333e; --color-ok: #4cc488; --color-warn: #e0a54a; --color-bad: #ef6b5b;\n    --c1: #6aa6e8; --c2: #e8a160; --c3: #5cc2aa; --c4: #a989d8; --c5: #e07ea0; --c6: #a4c45a; --c7: #74bde8; --c8: #c9a874;\n    --cds-chart-muted: #4a5562; --cds-chart-grid: #232b35; --cds-chart-axis: #4a5562; --cds-chart-reference: #6aa6e8;\n    --cds-surface-popover: #1d2530; --cds-border: #2a333e; --cds-shadow-popover: 0 4px 16px rgba(0, 0, 0, .45);\n    --cds-text-secondary: #9aa6b4;\n    color-scheme: dark;\n  }\n}\n* { box-sizing: border-box; }\n.classic-shell { margin: 0; background: var(--color-bg); color: var(--color-fg); font-family: var(--font-anthropic-sans); font-size: 14px; line-height: 1.45; }\n.classic-shell > .wrap { max-width: 1280px; margin-inline: auto; padding-block: 28px 40px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }\n.dash-skeleton { position: relative; }\n.dash-skeleton::after { content: \"\"; position: absolute; inset: 8px 0 auto 0; height: 60%; border-radius: var(--cds-radius); background: var(--cds-chart-grid); }\n.classic-shell .foot { margin-top: 28px; font-size: 12px; color: var(--color-fg-muted); border-top: 1px solid var(--color-border-line); padding-top: 12px; }\n\n#dash-root #st-type-filter,#dash-root #st-voltage-filter,#dash-root #st-export{font:inherit;font-size:var(--cds-font-size-caption);padding:var(--cds-pad-xs) var(--cds-pad-sm);border:1px solid var(--color-border-line);border-radius:var(--cds-radius);background:var(--color-bg);color:var(--color-fg);min-height:36px;max-width:100%;box-shadow:0 1px 2px #00000008;}\n#dash-root #st-type-filter,#dash-root #st-voltage-filter{cursor:pointer;max-width:235px;}\n#dash-root #st-type-filter:focus-visible,#dash-root #st-voltage-filter:focus-visible{outline:2px solid var(--cds-chart-reference);outline-offset:2px;}\n#dash-root #page-statcom>.kx-grid{grid-template-columns:repeat(4,minmax(0,1fr));}\n#dash-root #page-statcom>.kx-grid .kx-hb-row{grid-template-columns:minmax(65px,1fr) minmax(40px,1fr) auto;gap:6px;}\n#dash-root #page-statcom>.kx-grid .kx-hb-val{font-size:11px;white-space:normal;}\n@media(max-width:1100px){#dash-root #page-statcom>.kx-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}\n@media(max-width:650px){#dash-root #page-statcom>.kx-grid{grid-template-columns:1fr;}}\n\n#dash-root #st-price .kx-hb{display:block;}\n#dash-root #st-price .kx-hb-row{display:grid;grid-template-columns:minmax(0,1fr);gap:5px;margin-bottom:18px;}\n#dash-root #st-price .kx-hb-label{grid-row:1;max-width:none;}\n#dash-root #st-price .kx-hb-val{grid-row:2;text-align:left;white-space:normal;}\n#dash-root #st-price .kx-hb-track{grid-row:3;width:100%;margin-top:3px;}\n\n#dash-root #st-price{container-type:inline-size;align-self:start;}\n#dash-root #st-price .kx-chart{min-height:0;height:auto;}\n#dash-root #st-price .kx-hb-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:6px 5px;margin-bottom:16px;align-items:center;}\n#dash-root #st-price .kx-hb-label{grid-row:1;grid-column:1;white-space:nowrap;font-size:clamp(9px,2.85cqw,12px);max-width:none;}\n#dash-root #st-price .kx-hb-val{grid-row:1;grid-column:2;text-align:right;white-space:nowrap;font-size:clamp(9px,2.85cqw,12px);}\n#dash-root #st-price .kx-hb-track{grid-row:2;grid-column:1/-1;width:100%;margin-top:0;height:12px;}\n#dash-root #st-price .kx-hb-row:last-child{margin-bottom:0;}\n\n#dash-root #page-statcom>.kx-grid{grid-template-columns:repeat(3,minmax(0,1fr));}\n#dash-root #page-statcom>.cost-analysis-row{grid-template-columns:minmax(260px,1fr) minmax(0,2fr);align-items:start;}\n@media(max-width:850px){#dash-root #page-statcom>.cost-analysis-row{grid-template-columns:1fr;}}\n\n*{scrollbar-width:thin;scrollbar-color:rgba(110,125,145,.48) transparent;}\n*::-webkit-scrollbar{width:5px;height:5px;}\n*::-webkit-scrollbar-track{background:transparent;}\n*::-webkit-scrollbar-thumb{background:rgba(110,125,145,.48);border-radius:20px;}\n*::-webkit-scrollbar-thumb:hover{background:rgba(90,110,135,.72);}\n\n#dash-root #st-cost-reference{height:var(--price-card-height,360px);box-sizing:border-box;overflow:hidden;min-height:0;}\n#dash-root #st-cost-reference .kx-tablewrap{flex:1 1 0;min-height:0;max-height:none;overflow:auto;border:1px solid var(--color-border-line);border-radius:7px;}\n#dash-root #st-cost-reference .kx-table{width:max-content;min-width:100%;table-layout:auto;font-size:12px;}\n#dash-root #st-cost-reference .kx-table th,#dash-root #st-cost-reference .kx-table td{padding:8px 10px;line-height:1.35;}\n#dash-root #st-cost-reference .kx-table th:first-child,#dash-root #st-cost-reference .kx-table td:first-child{min-width:0;width:90px;max-width:100px;white-space:nowrap;}\n#dash-root #st-cost-reference .kx-table th{max-width:125px;background:var(--color-panel);white-space:normal;}\n#dash-root #st-cost-reference .kx-table td{white-space:nowrap;}\n#dash-root #st-cost-reference .kx-table td:last-child{white-space:normal;min-width:140px;max-width:180px;}\n#dash-root #st-cost-reference tbody tr:nth-child(odd){background:color-mix(in srgb,var(--color-panel) 92%,var(--cds-chart-reference) 8%);}\n#dash-root #st-cost-reference tbody tr:nth-child(even){background:var(--color-panel);}\n#dash-root #st-cost-reference tbody tr:hover{background:color-mix(in srgb,var(--color-panel) 84%,var(--cds-chart-reference) 16%);}\n#dash-root #st-cost-reference>.kx-note{font-size:11px;line-height:1.4;margin:0;flex:none;}\n@media(max-width:850px){#dash-root #st-cost-reference{height:360px;}}\n\n.classic-shell > .wrap{max-width:none;margin:0;padding:0}.classic-shell{padding:0;width:100%;min-width:0}.classic-shell .foot{margin-bottom:0} #dash-root .kx-table tbody tr{cursor:pointer}\n</style>\n<div class=\"wrap\">\n<div id=\"dash-root\">\n<style>\n#dash-root .kx { display: flex; flex-direction: column; gap: var(--cds-gap-lg); font-family: var(--font-anthropic-sans); color: var(--color-fg); }\n#dash-root .kx-head { display: flex; flex-direction: column; gap: var(--cds-gap-xs); }\n#dash-root .kx-title { font-family: var(--font-anthropic-serif); font-weight: 400; font-size: var(--cds-font-size-title); margin: 0; text-wrap: balance; }\n#dash-root .kx-take { margin: 0; font-size: var(--cds-font-size-body); color: var(--color-fg-muted); max-width: 70ch; }\n#dash-root .kx-take b { color: var(--color-fg); font-weight: 600; font-variant-numeric: tabular-nums; }\n#dash-root .kx-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--cds-gap-md); }\n#dash-root .kx-tabs { display: inline-flex; gap: var(--cds-gap-xs); padding: 3px; border: 1px solid var(--color-border-line); border-radius: var(--cds-radius); background: var(--color-panel); }\n#dash-root .kx-tab { font: inherit; font-size: var(--cds-font-size-body); padding: var(--cds-pad-xs) var(--cds-pad-md); border: 0; border-radius: calc(var(--cds-radius) - 2px); background: transparent; color: var(--color-fg-muted); cursor: pointer; }\n#dash-root .kx-tab[aria-selected=\"true\"] { background: var(--color-bg); color: var(--color-fg); box-shadow: 0 0 0 1px var(--color-border-line); }\n#dash-root .kx-tab:focus-visible, #dash-root .kx-toggle input:focus-visible, #dash-root .kx-search:focus-visible, #dash-root th button:focus-visible { outline: 2px solid var(--cds-chart-reference); outline-offset: 2px; }\n#dash-root .kx-toggle { display: inline-flex; align-items: center; gap: var(--cds-gap-sm); font-size: var(--cds-font-size-caption); color: var(--color-fg-muted); cursor: pointer; }\n#dash-root [hidden] { display: none !important; }\n#dash-root .kx-page { display: flex; flex-direction: column; gap: var(--cds-gap-lg); }\n#dash-root .kx-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr)); gap: var(--cds-gap-md); }\n#dash-root .kx-tile { background: var(--color-panel); border: 1px solid var(--color-border-line); border-radius: var(--cds-radius); padding: var(--cds-pad-md) var(--cds-pad-lg); display: flex; flex-direction: column; gap: var(--cds-gap-xs); min-width: 0; }\n#dash-root .kx-tile-label { font-size: var(--cds-font-size-caption); color: var(--color-fg-muted); }\n#dash-root .kx-tile-num { font-family: var(--font-anthropic-serif); font-weight: 400; font-size: var(--cds-font-size-title); font-variant-numeric: tabular-nums; line-height: 1.1; }\n#dash-root .kx-tile-sub { font-size: var(--cds-font-size-caption); color: var(--color-fg-muted); font-variant-numeric: tabular-nums; }\n#dash-root .kx-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr)); gap: var(--cds-gap-md); }\n#dash-root .kx-card { background: var(--color-panel); border: 1px solid var(--color-border-line); border-radius: var(--cds-radius); padding: var(--cds-pad-lg); display: flex; flex-direction: column; gap: var(--cds-gap-sm); min-width: 0; }\n#dash-root .kx-card h2 { margin: 0; font-size: var(--cds-font-size-heading); font-weight: var(--cds-font-weight-medium); }\n#dash-root .kx-note { margin: 0; font-size: var(--cds-font-size-caption); color: var(--color-fg-muted); }\n#dash-root .kx-chart { position: relative; min-height: 160px; }\n#dash-root .kx-hb { display: grid; grid-template-columns: minmax(6rem, max-content) 1fr auto; gap: 6px var(--cds-gap-sm); align-items: center; font-size: var(--cds-font-size-caption); }\n#dash-root .kx-hb-label { color: var(--color-fg); overflow-wrap: anywhere; max-width: 13rem; }\n#dash-root .kx-hb-track { display: flex; height: 14px; min-width: 0; }\n#dash-root .kx-hb-seg { height: 100%; }\n#dash-root .kx-hb-seg:first-child { border-radius: 4px 0 0 4px; }\n#dash-root .kx-hb-seg:last-child { border-radius: 0 4px 4px 0; }\n#dash-root .kx-hb-seg:only-child { border-radius: 4px; }\n#dash-root .kx-hb-val { color: var(--color-fg-muted); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }\n#dash-root .kx-hb-row { display: contents; }\n#dash-root .kx-hb-row.kx-muted .kx-hb-label { color: var(--color-fg-muted); }\n#dash-root .kx-legend { display: flex; flex-wrap: wrap; gap: var(--cds-gap-sm) var(--cds-gap-md); font-size: var(--cds-font-size-caption); color: var(--color-fg-muted); }\n#dash-root .kx-legend span { display: inline-flex; align-items: center; gap: 6px; }\n#dash-root .kx-sw { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }\n#dash-root .kx-tip { position: absolute; z-index: 5; pointer-events: none; background: var(--cds-surface-popover); border: 1px solid var(--cds-border); border-radius: var(--cds-radius); box-shadow: var(--cds-shadow-popover); padding: var(--cds-pad-xs) var(--cds-pad-sm); font-size: var(--cds-font-size-caption); white-space: nowrap; }\n#dash-root .kx-tip-h { color: var(--cds-text-secondary); }\n#dash-root .kx-tablewrap { max-height: 28rem; overflow: auto; border-top: 1px solid var(--color-border-line); }\n#dash-root .kx-table { width: 100%; border-collapse: collapse; font-size: var(--cds-font-size-caption); }\n#dash-root .kx-table th { position: sticky; top: 0; background: var(--color-panel); text-align: left; font-weight: var(--cds-font-weight-medium); color: var(--color-fg-muted); border-bottom: 1px solid var(--color-border-line); padding: 0; z-index: 1; }\n#dash-root .kx-table th button { font: inherit; color: inherit; background: none; border: 0; padding: var(--cds-pad-xs) var(--cds-pad-sm); cursor: pointer; text-align: left; width: 100%; }\n#dash-root .kx-table td { padding: var(--cds-pad-xs) var(--cds-pad-sm); border-bottom: 1px solid var(--color-border-line); vertical-align: top; }\n#dash-root .kx-table td.kx-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }\n#dash-root .kx-table td:first-child { min-width: 14rem; }\n#dash-root .kx-pill { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: var(--cds-font-size-caption); border: 1px solid var(--color-border-line); white-space: nowrap; }\n#dash-root .kx-pill[data-s=\"In Operation\"], #dash-root .kx-pill[data-s=\"Awarded\"], #dash-root .kx-pill[data-s=\"Delivered\"] { color: var(--color-ok); }\n#dash-root .kx-pill[data-s=\"Under Installation\"] { color: var(--color-ok); }\n#dash-root .kx-pill[data-s=\"Tendering\"], #dash-root .kx-pill[data-s=\"Planned\"] { color: var(--color-warn); }\n#dash-root .kx-pill[data-s=\"Planned / Announced\"] { color: var(--color-fg-muted); }\n#dash-root .kx-search { font: inherit; font-size: var(--cds-font-size-caption); padding: var(--cds-pad-xs) var(--cds-pad-sm); border: 1px solid var(--color-border-line); border-radius: var(--cds-radius); background: var(--color-bg); color: var(--color-fg); width: min(100%, 18rem); }\n#dash-root .kx-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--cds-gap-sm); }\n#dash-root .kx-fail { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: inherit; color: var(--color-fg-muted); font-size: var(--cds-font-size-caption); }\n#dash-root .kx-fail::before { content: \"\"; width: .375rem; height: .375rem; border-radius: 50%; background: var(--color-bad); }\n#dash-root [data-dash-source-state=empty] { color: transparent; }\n#dash-root [data-dash-source-state=refreshing] { opacity: .5; transition: opacity var(--cds-dur-slow); }\n#dash-root .kx-svg text { fill: var(--color-fg-muted); font-size: 11px; font-family: var(--font-anthropic-sans); }\n</style>\n\n\n\n<div class=\"kx\">\n  <div class=\"kx-bar\">\n    <div class=\"kx-tabs\" role=\"tablist\" aria-label=\"Dashboard pages\">\n      <button class=\"kx-tab\" role=\"tab\" id=\"all\" data-tab=\"all\" aria-selected=\"true\">All</button>\n      <button class=\"kx-tab\" role=\"tab\" id=\"hvdc\" data-tab=\"hvdc\" aria-selected=\"false\">HVDC</button>\n      <button class=\"kx-tab\" role=\"tab\" id=\"statcom\" data-tab=\"statcom\" aria-selected=\"false\">STATCOM</button>\n    </div>\n    <label class=\"kx-toggle\" id=\"legacy-toggle\" hidden><input type=\"checkbox\" id=\"kx-legacy\"> Include legacy SVCs (2006\u20132014)</label>\n  </div>\n\n  <!-- ================= HVDC ================= -->\n  <section class=\"kx-page\" id=\"page-hvdc\">\n    <div class=\"kx-head\">\n      <h1 class=\"kx-title\">Saudi HVDC pipeline</h1>\n      <p class=\"kx-take\"><b data-source=\"hv_kpis\" data-field=\"installation\" data-row=\"0\">\u2014</b> links are under installation, totalling <b data-source=\"hv_kpis\" data-field=\"installationMW\" data-row=\"0\">\u2014</b> MW. <b data-source=\"hv_kpis\" data-field=\"awarded\" data-row=\"0\">\u2014</b> link is awarded, <b data-source=\"hv_kpis\" data-field=\"tender\" data-row=\"0\">\u2014</b> is tendering, and <b data-source=\"hv_kpis\" data-field=\"planned\" data-row=\"0\">\u2014</b> project records are planned / announced targets.</p>\n    </div>\n\n    <div class=\"kx-tiles\">\n      <div class=\"kx-tile\"><span class=\"kx-tile-label\">Projects tracked</span><span class=\"kx-tile-num\" data-source=\"hv_kpis\" data-field=\"projects\" data-row=\"0\">\u2014</span><span class=\"kx-tile-sub\"><span data-source=\"hv_kpis\" data-field=\"domestic\" data-row=\"0\">\u2014</span> domestic \u00b7 <span data-source=\"hv_kpis\" data-field=\"international\" data-row=\"0\">\u2014</span> international</span></div>\n      <div class=\"kx-tile\"><span class=\"kx-tile-label\">In Operation</span><span class=\"kx-tile-num\"><span data-source=\"hv_kpis\" data-field=\"operatingMW\" data-row=\"0\">\u2014</span> MW</span><span class=\"kx-tile-sub\"><span data-source=\"hv_kpis\" data-field=\"operating\" data-row=\"0\">\u2014</span> links</span></div>\n      <div class=\"kx-tile\"><span class=\"kx-tile-label\">Under Installation</span><span class=\"kx-tile-num\"><span data-source=\"hv_kpis\" data-field=\"installationMW\" data-row=\"0\">\u2014</span> MW</span><span class=\"kx-tile-sub\"><span data-source=\"hv_kpis\" data-field=\"installation\" data-row=\"0\">\u2014</span> links</span></div>\n      <div class=\"kx-tile\"><span class=\"kx-tile-label\">Awarded</span><span class=\"kx-tile-num\"><span data-source=\"hv_kpis\" data-field=\"awardedMW\" data-row=\"0\">\u2014</span> MW</span><span class=\"kx-tile-sub\"><span data-source=\"hv_kpis\" data-field=\"awarded\" data-row=\"0\">\u2014</span> links</span></div>\n      <div class=\"kx-tile\"><span class=\"kx-tile-label\">Tendering</span><span class=\"kx-tile-num\"><span data-source=\"hv_kpis\" data-field=\"tenderMW\" data-row=\"0\">\u2014</span> MW</span><span class=\"kx-tile-sub\"><span data-source=\"hv_kpis\" data-field=\"tender\" data-row=\"0\">\u2014</span> links</span></div>\n      <div class=\"kx-tile\"><span class=\"kx-tile-label\">Planned / Announced</span><span class=\"kx-tile-num\"><span data-source=\"hv_kpis\" data-field=\"plannedMW\" data-row=\"0\">\u2014</span> MW</span><span class=\"kx-tile-sub\"><span data-source=\"hv_kpis\" data-field=\"planned\" data-row=\"0\">\u2014</span> project records \u00b7 Target; stated MW only</span></div>\n    </div>\n\n    <div class=\"kx-grid\">\n      <div class=\"kx-card\" id=\"hv-pipeline\">\n        <h2>Pipeline by stage</h2>\n        <p class=\"kx-note\">Bar length is capacity in MW. Planned / Announced capacity includes only stated numeric figures; reservation-stage upper limits and undisclosed capacities are excluded.</p>\n        <div class=\"kx-chart dash-skeleton\" data-source=\"hv_status\"></div>\n      </div>\n      <div class=\"kx-card\" id=\"hv-epc\">\n        <h2>Main EPC</h2>\n        <p class=\"kx-note\">Capacity of links by named main EPC. Separate overhead-line EPC packages remain in the project data; unnamed EPCs are excluded.</p>\n        <div class=\"kx-chart dash-skeleton\" data-source=\"hv_epc\"></div>\n      </div>\n      <div class=\"kx-card\" id=\"hv-mix\">\n        <h2>Valve manufacturer</h2>\n        <p class=\"kx-note\">Link capacity in MW by disclosed valve manufacturer, using the workbook and the user-provided Hitachi award. Counts each link once; awarded capacity is not a delivery claim.</p>\n        <div class=\"kx-chart dash-skeleton\" data-source=\"hv_mix\"></div>\n      </div>\n    </div>\n\n    <div class=\"kx-card\" id=\"hv-projects\">\n      <div class=\"kx-row\"><h2>All HVDC projects</h2><span class=\"kx-note\">Click a column to sort</span></div>\n      <div class=\"kx-tablewrap\">\n        <table class=\"kx-table\" data-source=\"hvdc\" data-row-key=\"id\" data-table=\"hv\">\n          <thead><tr>\n            <th data-field=\"name\"><button>Project</button></th>\n            <th data-field=\"status\"><button>Stage</button></th>\n            <th data-field=\"mw\"><button>MW</button></th>\n            <th data-field=\"epc\"><button>Main EPC</button></th>\n            <th data-field=\"valve\"><button>Valve maker</button></th>\n            <th data-field=\"tech\"><button>Tech</button></th>\n            <th data-field=\"dc\"><button>DC kV</button></th>\n            <th data-field=\"yearText\"><button>Award</button></th>\n            <th data-field=\"ends\"><button>Endpoints</button></th>\n          </tr></thead>\n          <tbody></tbody>\n        </table>\n      </div>\n    </div>\n  </section>\n\n  <!-- ================= STATCOM ================= -->\n  <section class=\"kx-page\" id=\"page-statcom\">\n    <div class=\"kx-head\">\n      <h1 class=\"kx-title\">Saudi STATCOM market</h1>\n      <p class=\"kx-take\"><b class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"containerized\">\u2014</b> of <b class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"projects\">\u2014</b> projects are containerized; recent awards are mostly small distribution-level units. <b class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"open\">\u2014</b> projects are planned, worth <b class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"openMVAr\">\u2014</b> MVAr.</p>\n    </div>\n\n    <div class=\"kx-tiles\">\n      <div class=\"kx-tile\"><span class=\"kx-tile-label\">Projects tracked</span><span class=\"kx-tile-num kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"projects\">\u2014</span><span class=\"kx-tile-sub\"><span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"awarded\">\u2014</span> awarded \u00b7 <span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"delivered\">\u2014</span> delivered</span></div>\n      <div class=\"kx-tile\"><span class=\"kx-tile-label\">Containerized share</span><span class=\"kx-tile-num kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"containerizedShare\">\u2014</span><span class=\"kx-tile-sub\"><span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"containerized\">\u2014</span> projects</span></div>\n      <div class=\"kx-tile\"><span class=\"kx-tile-label\">Planned</span><span class=\"kx-tile-num kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"open\">\u2014</span><span class=\"kx-tile-sub\">EPC and OEM not available</span></div>\n      <div class=\"kx-tile\"><span class=\"kx-tile-label\">Planned capacity</span><span class=\"kx-tile-num\"><span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"openMVAr\">\u2014</span> MVAr</span><span class=\"kx-tile-sub\">capacitive rating, summed</span></div>\n      <div class=\"kx-tile\"><span class=\"kx-tile-label\">Alfanar involved</span><span class=\"kx-tile-num kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"alfanar\">\u2014</span><span class=\"kx-tile-sub\"><span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"alfanarEpc\">\u2014</span> EPC \u00b7 <span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"alfanarOem\">\u2014</span> Alfanar Electrical / OEM partner<br><span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"alfanarBoth\">\u2014</span> in both roles; OEM includes 1 to be confirmed</span></div>\n<div class=\"kx-tile\"><span class=\"kx-tile-label\">Completed available cost \u00b7 USD</span><span class=\"kx-tile-num\"><span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"completedCost\">\u2014</span></span><span class=\"kx-tile-sub\">Partial total \u00b7 <span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"completedPriced\">\u2014</span> priced; <span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"completedMissing\">\u2014</span> unavailable<br>Recorded: <span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"completedRecorded\">\u2014</span> \u00b7 Estimated: <span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"completedEstimated\">\u2014</span></span></div>\n<div class=\"kx-tile\"><span class=\"kx-tile-label\">Planned available cost \u00b7 USD</span><span class=\"kx-tile-num\"><span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"plannedCost\">\u2014</span></span><span class=\"kx-tile-sub\"><span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"plannedPriced\">\u2014</span> priced; <span class=\"kx-v\" data-source=\"st_kpis\" data-where=\"view=current\" data-field=\"plannedMissing\">\u2014</span> unavailable \u00b7 excludes missing costs</span></div>\n    </div>\n\n    <div class=\"kx-card\" id=\"st-trend\">\n      <h2>Projects by year and type</h2>\n      <p class=\"kx-note\">Year of award, or the first recorded milestone where no award date exists. Each segment label is its percentage of all projects in that year (year total = 100%).</p>\n      <div class=\"kx-legend\" id=\"st-trend-legend\"></div>\n      <div class=\"kx-chart dash-skeleton\" data-source=\"st_year\" style=\"min-height:240px\"></div>\n    </div>\n\n    <div class=\"kx-grid\">\n      <div class=\"kx-card\" id=\"st-oem\">\n        <h2>OEM share</h2>\n        <p class=\"kx-note\">Projects per equipment maker. NR Electric and NARI are separate companies. Lighter bars rest on unconfirmed team data.</p>\n        <div class=\"kx-legend\"><span><i class=\"kx-sw\" id=\"sw-conf\"></i>Public source</span><span><i class=\"kx-sw\" id=\"sw-team\"></i>Team reference</span></div>\n        <div class=\"kx-chart dash-skeleton\" data-source=\"st_oem\"></div>\n      </div>\n      <div class=\"kx-card\" id=\"st-epc\">\n        <h2>EPC share</h2>\n        <p class=\"kx-note\">Projects per EPC contractor. CEPCO and Al Gihaz lead the awarded work.</p>\n        <div class=\"kx-chart dash-skeleton\" data-source=\"st_epc\"></div>\n      </div>\n      <div class=\"kx-card\" id=\"st-volt\">\n        <h2>Voltage level analysis</h2>\n        <p class=\"kx-note\">STATCOM bus voltage follows the corrected Excel. Unknown bus voltages are shown as Not available.</p>\n        <div class=\"kx-chart dash-skeleton\" data-source=\"st_volt\"></div>\n      </div>\n</div><div class=\"kx-grid cost-analysis-row\"><div class=\"kx-card\" id=\"st-price\"><h2>Price level analysis</h2><p class=\"kx-note\">USD totals by STATCOM bus voltage; brackets show total equivalent MVAr. Totals include recorded costs and eligible estimates. Missing prices are excluded; coverage is shown.</p><div class=\"kx-chart\"></div></div><div class=\"kx-card\" id=\"st-cost-reference\"><h2>Cost reference per MVAr</h2><div class=\"kx-tablewrap\"><table class=\"kx-table\"><thead><tr><th>FACT Type</th><th>kV</th><th>Qty</th><th>Actual mVAR</th><th>Equivalent mVAR</th><th>Mvar</th><th>SalesCost (USD)</th><th>SalesCost/mVAR ($)</th><th>SalesCost/mVAR (SAR)</th><th>Source</th><th>Remarks</th></tr></thead><tbody><tr><td>STATCOM</td><td>33</td><td>3</td><td>\u00b120</td><td>40</td><td>120</td><td>9,333,333.33</td><td>77,777.78</td><td>291,666.67</td><td>Based on NARI</td><td></td></tr><tr><td>STATCOM</td><td>33</td><td>1</td><td>+450, -150</td><td>600</td><td>600</td><td>36,990,827.00</td><td>61,651.38</td><td>231,192.67</td><td>Gulf projects</td><td></td></tr><tr><td>E-STATCOM</td><td>33</td><td>8</td><td>+40&#x27;-25</td><td>65</td><td>520</td><td>64,000,000.00</td><td>123,076.92</td><td>461,538.46</td><td>Based on NARI</td><td>Because additional supercapacitors</td></tr><tr><td>STATCOM</td><td>13.8</td><td>1</td><td>\u00b110</td><td>20</td><td>20</td><td>5,333,333.33</td><td>266,666.67</td><td>1,000,000.00</td><td>Based on NARI</td><td>has studies, FSS, Ctrl etc..</td></tr><tr><td>STATCOM</td><td>132</td><td>1</td><td>\u00b1300</td><td>600</td><td>600</td><td>37,573,333.00</td><td>62,622.22</td><td>234,833.33</td><td>Gulf projects</td><td></td></tr><tr><td>STATCOM</td><td>132</td><td>1</td><td>+600, -200</td><td>800</td><td>800</td><td>41,457,487.00</td><td>51,821.86</td><td>194,331.97</td><td>Gulf projects</td><td></td></tr><tr><td>SVC</td><td>110</td><td>1</td><td>+300, -150</td><td>450</td><td>450</td><td>51,700,000.00</td><td>114,888.89</td><td>430,833.33</td><td>Gulf projects</td><td></td></tr><tr><td>SVC</td><td>380</td><td>3</td><td>+450, -150</td><td>600</td><td>1800</td><td>123,000,000.00</td><td>68,333.33</td><td>256,250.00</td><td>Gulf projects</td><td></td></tr></tbody></table></div><p class=\"kx-note\">Rates use the unrounded values in the Statcom Cost sheet. Equivalent MVAr = positive range + absolute negative range, multiplied by explicit unit count once. E-STATCOM costs are allocated equally across eight projects. Unclear unit totals remain unavailable.</p></div>\n    </div>\n\n    <div class=\"kx-card\" id=\"st-open\">\n      <div class=\"kx-row\"><h2>Planned</h2><span class=\"kx-note\">Not yet awarded. EPC and OEM not available.</span></div>\n      <div class=\"kx-tablewrap\">\n        <table class=\"kx-table\" data-source=\"statcom\" data-row-key=\"id\" data-table=\"open\">\n          <thead><tr>\n            <th data-field=\"name\"><button>Project</button></th>\n            <th data-field=\"type\"><button>Type</button></th>\n            <th data-field=\"mvar\"><button>MVAr</button></th>\n            <th data-field=\"rating\"><button>Rating</button></th>\n            <th data-field=\"voltage\"><button>STATCOM bus voltage (kV)</button></th>\n            <th data-field=\"geo\"><button>Location</button></th>\n            <th data-field=\"award\"><button>Tender</button></th><th data-field=\"costValue\"><button>Project cost (USD)</button></th>\n          </tr></thead>\n          <tbody></tbody>\n        </table>\n      </div>\n    </div>\n\n    <div class=\"kx-card\" id=\"st-projects\">\n      <div class=\"kx-row\"><h2>All STATCOM projects</h2><select id=\"st-type-filter\" aria-label=\"Filter type\"><option value=\"\">All types</option></select><select id=\"st-voltage-filter\" aria-label=\"Filter bus voltage\"><option value=\"\">All voltages</option></select><button id=\"st-export\">Export filtered Excel</button><input class=\"kx-search\" id=\"kx-st-search\" type=\"search\" placeholder=\"Search name, EPC, OEM, location\" aria-label=\"Search STATCOM projects\"></div>\n      <p class=\"kx-note\">Cost basis: recorded costs are retained. Missing costs use equivalent MVAr and voltage-specific rates from the reference table; the listed 33 kV projects use the NARI rate. Eight E-STATCOM projects receive USD 8m each. Unclear quantities, missing voltage/MVAr and unsupported rates remain Not available. Totals exclude unavailable costs.</p>\n      <div class=\"kx-tablewrap\">\n        <table class=\"kx-table\" data-source=\"statcom\" data-row-key=\"id\" data-table=\"st\">\n          <thead><tr>\n            <th data-field=\"name\"><button>Project</button></th>\n            <th data-field=\"status\"><button>Status</button></th>\n            <th data-field=\"type\"><button>Type</button></th>\n            <th data-field=\"epc\"><button>EPC</button></th>\n            <th data-field=\"oem\"><button>OEM</button></th>\n            <th data-field=\"mvar\"><button>MVAr</button></th>\n            <th data-field=\"vclass\"><button>STATCOM bus voltage</button></th>\n            <th data-field=\"region\"><button>Region</button></th>\n            <th data-field=\"year\"><button>Year</button></th><th data-field=\"costValue\"><button>Project cost (USD)</button></th>\n          </tr></thead>\n          <tbody></tbody>\n        </table>\n      </div>\n    </div>\n  </section>\n</div>\n\n\n</div>\n<p class=\"foot\">Source: PowerInsights project database (imported from the corrected reports) (12 HVDC and 61 STATCOM/SVC records), with live saved updates. \"Team reference\" values are Alfanar internal data not confirmed by a public source. MVAr totals use the capacitive rating multiplied by the unit count.</p>\n</div>\n\n\n</div>";
 const KX_DATA=dashboardData(M);
const dash = (() => {
  const css = getComputedStyle(host.querySelector(".classic-shell"));
  const colors = ['--c1','--c2','--c3','--c4','--c5','--c6','--c7','--c8'].map((v) => css.getPropertyValue(v).trim());
  const calcs = {}, cache = {}, subs = [];
  let params = state.params || { legacy: false };
  const data = (id) => {
    if (id in KX_DATA) return { status: 'ok', data: KX_DATA[id], meta: [] };
    if (calcs[id]) {
      if (!(id in cache)) { const c = calcs[id]; cache[id] = c.fn(...c.inputs.map((i) => data(i).data)); }
      return { status: 'ok', data: cache[id], meta: [] };
    }
    return { status: 'missing', data: [] };
  };
  const run = () => subs.forEach((fn) => fn());
  let t; const resize=()=>{clearTimeout(t);t=setTimeout(run,120);};window.addEventListener('resize',resize);cleanups.push(()=>{clearTimeout(t);window.removeEventListener('resize',resize);});
  return {
    colors, data,
    calc: (id, def) => { calcs[id] = def; },
    onData: (fn) => { subs.push(fn); fn(); },
    params: () => ({ ...params }),
    setParams: (p) => { params = { ...params, ...p }; state.params=params; run(); },
    resetParams: () => { params = { legacy: false }; run(); },
    setLink: (name) => { state.tab=name; },
    refresh: () => {}, loader: () => {},
  };
})();

/* ---------- calculations (readers see these) ---------- */
dash.calc('hv_kpis', {
  inputs: ['hvdc'], title: 'HVDC headline figures',
  description: 'Counts and summed MW by stage, from the HVDC project list.',
  fn: (hvdc) => {
    const at = (s) => hvdc.filter((r) => r.status === s);
    const mw = (rows) => rows.reduce((t, r) => t + (Number(r.mw) || 0), 0);
    return [{
      projects: hvdc.length,
      installation: at('Under Installation').length, installationMW: mw(at('Under Installation')),
      awarded: at('Awarded').length, awardedMW: mw(at('Awarded')),
      tender: at('Tendering').length, tenderMW: mw(at('Tendering')),
      planned: at('Planned / Announced').length, plannedMW: mw(at('Planned / Announced')),
      operating: at('In Operation').length, operatingMW: mw(at('In Operation')),
      domestic: hvdc.filter((r) => r.scope === 'Domestic').length,
      international: hvdc.filter((r) => r.scope === 'International').length,
    }];
  },
});
dash.calc('hv_status', {
  inputs: ['hvdc'], title: 'HVDC by stage',
  description: 'Projects and summed MW per stage; links without a stated MW add 0.',
  fn: (hvdc) => ['In Operation', 'Under Installation', 'Awarded', 'Tendering', 'Planned / Announced'].map((status) => {
    const rows = hvdc.filter((r) => r.status === status);
    return { status, projects: rows.length, mw: rows.reduce((t, r) => t + (Number(r.mw) || 0), 0) };
  }),
});
dash.calc('hv_epc', {
  inputs: ['hvdc'], title: 'HVDC main EPC',
  description: 'Links and summed MW per named main EPC; separate line packages are not double-counted.',
  fn: (hvdc) => {
    const out = {};
    hvdc.filter((r) => r.epc !== 'Not available').forEach((r) => {
      const epc = r.epc === 'Hitachi' ? 'Hitachi Energy' : r.epc;
      out[epc] = out[epc] || { epc, projects: 0, mw: 0 };
      out[epc].projects += 1; out[epc].mw += Number(r.mw) || 0;
    });
    return Object.values(out).sort((a, b) => b.mw - a.mw);
  },
});
dash.calc('hv_mix', {
  inputs: ['hvdc'], title: 'HVDC valve manufacturer capacity',
  description: 'Link MW associated with each named valve manufacturer; each link counted once, not per station. Excludes undisclosed manufacturers.',
  fn: (hvdc) => {
    const out = {};
    hvdc.filter(r => r.valve !== 'Not available').forEach(r => {
      const maker = r.valve === 'Hitachi' ? 'Hitachi Energy' : r.valve;
      out[maker] = out[maker] || { maker, mw: 0, projects: 0 };
      out[maker].mw += Number(r.mw) || 0; out[maker].projects += 1;
    });
    return Object.values(out).sort((a,b) => b.mw-a.mw);
  },
});

dash.calc('st_kpis', {
  inputs: ['statcom'], title: 'STATCOM headline figures',
  description: 'Counts, containerized share and open MVAr, without (current) and with (all) the legacy SVCs.',
  fn: (statcom) => {
    const views = [['current', statcom.filter((r) => String(r.legacy) !== 'true')], ['all', statcom]];
    return views.map(([view, rows]) => {
      const open = rows.filter((r) => r.status === 'Planned');
      const completed=rows.filter(r=>r.status==='Delivered'), priced=rs=>rs.filter(r=>r.costValue!=null), sum=rs=>priced(rs).length?priced(rs).reduce((t,r)=>t+r.costValue,0):null;
      const cont = rows.filter((r) => /Containerized$/.test(r.type)).length;
      return {
        view, projects: rows.length, awarded: rows.filter(r => r.status === 'Awarded').length, delivered: rows.filter(r => r.status === 'Delivered').length,
        containerized: cont, containerizedShare: cont / rows.length,
        open: open.length, openMVAr: open.reduce((t, r) => t + (Number(r.mvar) || 0), 0),
        alfanarEpc: rows.filter(r=>/alfanar/i.test(r.epcFull)).length,
        alfanarOem: rows.filter(r=>/alfanar/i.test(r.oemFull)).length,
        alfanarBoth: rows.filter(r=>/alfanar/i.test(r.epcFull)&&/alfanar/i.test(r.oemFull)).length,
        completedPriced: priced(completed).length, completedMissing: completed.length-priced(completed).length, plannedPriced: priced(open).length, plannedMissing: open.length-priced(open).length,
        completedCost: sum(completed),
        completedRecorded: rows.filter(r=>r.status==='Delivered'&&!r.costEstimated).reduce((t,r)=>t+r.costValue,0),
        completedEstimated: rows.filter(r=>r.status==='Delivered'&&r.costEstimated).reduce((t,r)=>t+r.costValue,0),
        plannedCost: sum(open),
        alfanar: rows.filter((r) => /alfanar/i.test(r.epcFull + ' ' + r.oemFull)).length,
      };
    });
  },
});
dash.calc('st_year', {
  inputs: ['statcom'], title: 'STATCOM projects by year and type',
  description: 'Projects per year (award or first recorded milestone) and project type.',
  fn: (statcom) => {
    const views = [['current', statcom.filter((r) => String(r.legacy) !== 'true')], ['all', statcom]];
    const out = [];
    views.forEach(([view, rows]) => {
      const m = {};
      rows.filter((r) => r.year).forEach((r) => { const k = r.year + '|' + r.type; m[k] = (m[k] || 0) + 1; });
      Object.entries(m).forEach(([k, projects]) => { const [year, type] = k.split('|'); out.push({ view, year: Number(year), type, projects }); });
    });
    return out;
  },
});
dash.calc('st_oem', {
  inputs: ['statcom'], title: 'STATCOM OEM share',
  description: 'Projects per OEM, split into public-source and team-reference records.',
  fn: (statcom) => {
    const views = [['current', statcom.filter((r) => String(r.legacy) !== 'true')], ['all', statcom]];
    const out = [];
    views.forEach(([view, rows]) => {
      const m = {};
      rows.forEach((r) => {
        m[r.oem] = m[r.oem] || { view, oem: r.oem, projects: 0, teamRef: 0 };
        m[r.oem].projects += 1;
        if (String(r.teamRef) === 'true') m[r.oem].teamRef += 1;
      });
      out.push(...Object.values(m));
    });
    return out;
  },
});
dash.calc('st_epc', {
  inputs: ['statcom'], title: 'STATCOM EPC share',
  description: 'Projects per EPC contractor.',
  fn: (statcom) => {
    const views = [['current', statcom.filter((r) => String(r.legacy) !== 'true')], ['all', statcom]];
    const out = [];
    views.forEach(([view, rows]) => {
      const m = {};
      rows.forEach((r) => { m[r.epc] = (m[r.epc] || 0) + 1; });
      Object.entries(m).forEach(([epc, projects]) => out.push({ view, epc, projects }));
    });
    return out;
  },
});
dash.calc('st_volt', {
  inputs: ['statcom'], title: 'STATCOM voltage level',
  description: 'Projects per voltage class.',
  fn: (statcom) => {
    const views = [['current', statcom.filter((r) => String(r.legacy) !== 'true')], ['all', statcom]];
    const out = [];
    views.forEach(([view, rows]) => {
      const m = {};
      rows.forEach((r) => { m[r.vclass] = (m[r.vclass] || 0) + 1; });
      Object.entries(m).forEach(([vclass, projects]) => out.push({ view, vclass, projects }));
    });
    return out;
  },
});

/* ---------- helpers ---------- */
(() => {
  const root = document.querySelector('#dash-root .kx');
  const fmt = d3.format(',');
  const pct = d3.format('.0%');
  const MUTED = new Set(['Not available', 'Not specified']);
  const sortState = {};

  const tip = (() => { let el; return (box) => { if (!el || !box.contains(el)) { el = document.createElement('div'); el.className = 'kx-tip'; el.hidden = true; box.appendChild(el); } return el; }; })();
  const showTip = (box, ev, head, line) => {
    const t = tip(box); t.replaceChildren();
    const h = document.createElement('div'); h.className = 'kx-tip-h'; h.textContent = head; t.appendChild(h);
    const l = document.createElement('div'); l.textContent = line; t.appendChild(l);
    t.hidden = false;
    const b = box.getBoundingClientRect();
    let x = ev.clientX - b.left + 12, y = ev.clientY - b.top + 12;
    const w = t.offsetWidth; if (x + w > b.width) x = Math.max(0, ev.clientX - b.left - w - 12);
    t.style.left = x + 'px'; t.style.top = y + 'px';
  };
  const hideTip = (box) => { const t = box.querySelector('.kx-tip'); if (t) t.hidden = true; };

  const failed = (el) => { el.replaceChildren(); const f = document.createElement('div'); f.className = 'kx-fail'; f.textContent = 'Failed to load'; el.appendChild(f); };
  const pending = (el, id) => {
    const s = dash.data(id).status;
    if (s === 'ok') { el.classList.remove('dash-skeleton'); return false; }
    if (s === 'error') { el.classList.remove('dash-skeleton'); failed(el); } else { el.classList.add('dash-skeleton'); el.replaceChildren(); }
    return true;
  };

  /* horizontal bars: rows [{label, segs:[{v, color, name}], valueText, muted}] */
  const hbars = (box, rows, unit) => {
    box.replaceChildren();
    const g = document.createElement('div'); g.className = 'kx-hb'; box.appendChild(g);
    const max = d3.max(rows, (r) => d3.sum(r.segs, (s) => s.v)) || 1;
    rows.forEach((r) => {
      const row = document.createElement('div'); row.className = 'kx-hb-row' + (r.muted ? ' kx-muted' : '');
      const lab = document.createElement('span'); lab.className = 'kx-hb-label'; lab.textContent = r.label;
      const tr = document.createElement('span'); tr.className = 'kx-hb-track';
      r.segs.filter((s) => s.v > 0).forEach((s) => {
        const seg = document.createElement('span'); seg.className = 'kx-hb-seg';
        seg.style.width = (s.v / max * 100) + '%'; seg.style.background = s.color; if (s.opacity) seg.style.opacity = s.opacity;
        seg.addEventListener('mousemove', (ev) => showTip(box, ev, r.label, (s.name ? s.name + ': ' : '') + fmt(s.v) + ' ' + unit));
        seg.addEventListener('mouseleave', () => hideTip(box));
        tr.appendChild(seg);
      });
      const val = document.createElement('span'); val.className = 'kx-hb-val'; val.textContent = r.valueText;
      row.append(lab, tr, val); g.appendChild(row);
    });
  };

  const fillMarks = (selector, id, view, formats) => {
    const d = dash.data(id);
    root.querySelectorAll(selector).forEach((el) => {
      if (el.dataset.source !== id || !el.dataset.field) return;
      if (view) el.dataset.where = 'view=' + view;
      if (d.status !== 'ok') { el.textContent = '—'; return; }
      const row = view ? d.data.find((r) => r.view === view) : d.data[Number(el.dataset.row || 0)];
      const v = row ? row[el.dataset.field] : null;
      el.textContent = v == null ? (['completedCost','plannedCost'].includes(el.dataset.field)?'Not available':'—') : (formats[el.dataset.field] || fmt)(Number(v));
    });
  };

  const sortable = (table, rows) => {
    const key = table.dataset.table, st = sortState[key];
    if (!st) return rows;
    const num = (v) => (v === null || v === '' || isNaN(Number(v)) ? null : Number(v));
    return rows.slice().sort((a, b) => {
      const x = a[st.f], y = b[st.f];
      const nx = num(x), ny = num(y);
      let c = (nx !== null && ny !== null) ? nx - ny : (nx === null && ny !== null ? 1 : nx !== null && ny === null ? -1 : String(x ?? '').localeCompare(String(y ?? '')));
      return st.dir * c;
    });
  };
  root.querySelectorAll('.kx-table th button').forEach((btn) => btn.addEventListener('click', () => {
    const th = btn.parentElement, table = th.closest('table'), key = table.dataset.table, f = th.dataset.field;
    const cur = sortState[key];
    sortState[key] = { f, dir: cur && cur.f === f ? -cur.dir : 1 };
    table.querySelectorAll('th').forEach((h) => h.removeAttribute('aria-sort'));
    th.setAttribute('aria-sort', sortState[key].dir === 1 ? 'ascending' : 'descending');
    draw();
  }));

  const fillTable = (table, rows, cols) => {
    const tb = table.querySelector('tbody'); tb.replaceChildren();
    sortable(table, rows).forEach((r) => {
      const tr = document.createElement('tr'); tr.dataset.key = r.id; tr.onclick=event=>{if(!event.target.closest('a')&&onEdit)onEdit(r.id);};
      cols.forEach((c) => {
        const td = document.createElement('td');
        const v = r[c.f];
        if (c.pill) { const p = document.createElement('span'); p.className = 'kx-pill'; p.dataset.s = v; p.textContent = v; td.appendChild(p); }
        else if (c.num) { td.className = 'kx-num'; td.textContent = v == null || v === '' ? '—' : fmt(Number(v)); }
        else td.textContent = v == null ? '—' : String(v);
        if(c.f==='name'&&r.sourceLinks){r.sourceLinks.forEach(url=>{const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener';link.textContent=' Source';td.appendChild(link);});}
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  };

  /* ---------- HVDC ---------- */
  const STAGE_COLOR = { 'In Operation': () => dash.colors[2], 'Under Installation': () => dash.colors[0], Awarded: () => dash.colors[3], Tendering: () => dash.colors[1], 'Planned / Announced': () => 'var(--cds-chart-muted)' };
  const drawHVDC = () => {
    fillMarks('[data-source="hv_kpis"][data-field]', 'hv_kpis', null, {});
    const st = root.querySelector('#hv-pipeline .kx-chart');
    if (!pending(st, 'hv_status')) hbars(st, dash.data('hv_status').data.map((r) => ({
      label: r.status, segs: [{ v: Number(r.mw), color: STAGE_COLOR[r.status]() }],
      valueText: fmt(Number(r.mw)) + ' MW · ' + r.projects + (Number(r.projects) === 1 ? ' link' : ' links'),
    })), 'MW');
    const ep = root.querySelector('#hv-epc .kx-chart');
    if (!pending(ep, 'hv_epc')) hbars(ep, dash.data('hv_epc').data.map((r, i) => ({
      label: r.epc, segs: [{ v: Number(r.mw), color: /alfanar/i.test(r.epc) ? dash.colors[0] : 'var(--cds-chart-muted)' }],
      valueText: fmt(Number(r.mw)) + ' MW · ' + r.projects,
    })), 'MW');
    const mx = root.querySelector('#hv-mix .kx-chart');
    if (!pending(mx, 'hv_mix')) hbars(mx, dash.data('hv_mix').data.map((r, i) => ({
      label: r.maker, segs: [{ v: Number(r.mw), color: dash.colors[i % dash.colors.length] }],
      valueText: fmt(Number(r.mw)) + ' MW · ' + r.projects,
    })), 'MW');
    const t = root.querySelector('table[data-table="hv"]');
    const d = dash.data('hvdc');
    if (d.status === 'ok') {
      const order = { 'In Operation': 0, 'Under Installation': 1, Awarded: 2, Tendering: 3, 'Planned / Announced': 4 };
      const rows = d.data.slice().sort((a, b) => order[a.status] - order[b.status]);
      fillTable(t, rows, [{ f: 'name' }, { f: 'status', pill: true }, { f: 'mw', num: true }, { f: 'epc' }, { f: 'valve' }, { f: 'tech' }, { f: 'dc' }, { f: 'yearText' }, { f: 'ends' }]);
    } else t.querySelector('tbody').replaceChildren();
  };

  /* ---------- STATCOM ---------- */
  const TYPES = ["Containerized", "Conventional", "E-STATCOM Containerized", "E-STATCOM Conventional", "Mobile/Containerized", "Mobile/Conventional", "Not available"];
  const typeColor = (t) => t==='Not available'?'var(--cds-chart-muted)':dash.colors[TYPES.indexOf(t)%dash.colors.length];
  let animated = false;

  const drawYear = (box, rows) => {
    box.replaceChildren();
    const w = Math.max(280, box.clientWidth), h = 240, m = { t: 10, r: 8, b: 26, l: 28 };
    const years = Array.from(new Set(rows.map((r) => Number(r.year)))).sort((a, b) => a - b);
    const byYear = years.map((y) => { const o = { year: y }; TYPES.forEach((t) => { o[t] = d3.sum(rows.filter((r) => Number(r.year) === y && r.type === t), (r) => Number(r.projects)); }); return o; });
    const stack = d3.stack().keys(TYPES)(byYear);
    const x = d3.scaleBand(years, [m.l, w - m.r]).padding(0.28);
    const ymax = d3.max(byYear, (o) => d3.sum(TYPES, (t) => o[t])) || 1;
    const y = d3.scaleLinear([0, ymax], [h - m.b, m.t]).nice();
    const svg = d3.select(box).append('svg').attr('class', 'kx-svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${h}`).attr('role', 'img').attr('aria-label', 'Projects by year and type');
    svg.append('g').selectAll('line').data(y.ticks(4)).join('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y).attr('y2', y).attr('stroke', 'var(--cds-chart-grid)');
    svg.append('g').attr('transform', `translate(0,${h - m.b})`).call(d3.axisBottom(x).tickSizeOuter(0).tickValues(x.domain().filter((d, i) => x.bandwidth() > 18 || i % 2 === 0))).attr('font-size', null).attr('font-family', null).call((g) => g.select('.domain').attr('stroke', 'var(--cds-chart-axis)')).call((g) => g.selectAll('.tick line').remove());
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickFormat(d3.format('d')).tickSize(0)).attr('font-size', null).attr('font-family', null).call((g) => g.select('.domain').remove());
    stack.forEach((layer) => {
      svg.append('g').attr('fill', typeColor(layer.key)).selectAll('rect').data(layer).join('rect')
        .attr('x', (d) => x(d.data.year)).attr('width', x.bandwidth())
        .attr('y', (d) => y(d[1])).attr('height', (d) => Math.max(0, y(d[0]) - y(d[1]) - (d[1] > d[0] ? 1 : 0)))
        .attr('rx', 3)
        .on('mousemove', (ev, d) => showTip(box, ev, String(d.data.year), layer.key + ': ' + (d[1] - d[0]) + ' projects · ' + ((d[1]-d[0])/d3.sum(TYPES,t=>d.data[t])*100).toFixed(1) + '% of year total'))
        .on('mouseleave', () => hideTip(box));
      svg.append('g').selectAll('text').data(layer.filter(d=>d[1]>d[0])).join('text')
        .attr('x',d=>x(d.data.year)+x.bandwidth()/2).attr('y',d=>(y(d[0])+y(d[1]))/2)
        .attr('text-anchor','middle').attr('dominant-baseline','middle').attr('font-size',9)
        .style('fill','#fff','important').style('stroke','#000','important').attr('stroke-width',2.5).attr('paint-order','stroke').attr('pointer-events','none')
        .text(d=>((d[1]-d[0])/d3.sum(TYPES,t=>d.data[t])*100).toFixed(1)+'%');
    });
    const lg = root.querySelector('#st-trend-legend'); lg.replaceChildren();
    TYPES.forEach((t) => { const s = document.createElement('span'); const i = document.createElement('i'); i.className = 'kx-sw'; i.style.background = typeColor(t); s.append(i, document.createTextNode(t)); lg.appendChild(s); });
  };

  const drawSTATCOM = () => {
    const view = dash.params().legacy ? 'all' : 'current';
    fillMarks('.kx-v', 'st_kpis', view, { containerizedShare: pct, completedCost:v=>(v/1e6).toFixed(2)+'m', completedRecorded:v=>(v/1e6).toFixed(2)+'m', completedEstimated:v=>(v/1e6).toFixed(2)+'m', plannedCost:v=>(v/1e6).toFixed(2)+'m' });

    const yr = root.querySelector('#st-trend .kx-chart');
    if (!pending(yr, 'st_year')) drawYear(yr, dash.data('st_year').data.filter((r) => r.view === view));

    root.querySelector('#sw-conf').style.background = dash.colors[0];
    const swt = root.querySelector('#sw-team'); swt.style.background = dash.colors[0]; swt.style.opacity = .4;
    const oe = root.querySelector('#st-oem .kx-chart');
    if (!pending(oe, 'st_oem')) {
      const rows = dash.data('st_oem').data.filter((r) => r.view === view)
        .sort((a, b) => (MUTED.has(a.oem) - MUTED.has(b.oem)) || b.projects - a.projects);
      hbars(oe, rows.map((r) => {
        const m = MUTED.has(r.oem), team = Number(r.teamRef), all = Number(r.projects);
        return { label: r.oem, muted: m, valueText: String(all),
          segs: m ? [{ v: all, color: 'var(--cds-chart-muted)' }]
                  : [{ v: all - team, color: dash.colors[0], name: 'Public source' }, { v: team, color: dash.colors[0], opacity: .4, name: 'Team reference' }] };
      }), 'projects');
    }
    const ec = root.querySelector('#st-epc .kx-chart');
    if (!pending(ec, 'st_epc')) {
      const rows = dash.data('st_epc').data.filter((r) => r.view === view)
        .sort((a, b) => (MUTED.has(a.epc) - MUTED.has(b.epc)) || b.projects - a.projects || a.epc.localeCompare(b.epc));
      const top = rows.filter((r) => !MUTED.has(r.epc)).slice(0, 8);
      const restN = d3.sum(rows.filter((r) => !MUTED.has(r.epc)).slice(8), (r) => Number(r.projects));
      const list = top.map((r) => ({ label: r.epc, v: Number(r.projects) }));
      if (restN) list.push({ label: 'Others (1 project each)', v: restN, muted: true });
      rows.filter((r) => MUTED.has(r.epc)).forEach((r) => list.push({ label: r.epc, v: Number(r.projects), muted: true }));
      hbars(ec, list.map((r) => ({ label: r.label, muted: r.muted, valueText: String(r.v),
        segs: [{ v: r.v, color: r.muted ? 'var(--cds-chart-muted)' : (/alfanar/i.test(r.label) ? dash.colors[1] : dash.colors[0]) }] })), 'projects');
    }
    const vo = root.querySelector('#st-volt .kx-chart');
    if (!pending(vo, 'st_volt')) {
      const order = ['380 kV', '110–132 kV', '33 / 13.8 kV', '33 kV', '13.8 kV', 'Not available'];
      const rows = dash.data('st_volt').data.filter((r) => r.view === view).sort((a, b) => order.indexOf(a.vclass) - order.indexOf(b.vclass));
      hbars(vo, rows.map((r) => ({ label: r.vclass, muted: MUTED.has(r.vclass), valueText: String(r.projects),
        segs: [{ v: Number(r.projects), color: MUTED.has(r.vclass) ? 'var(--cds-chart-muted)' : dash.colors[2] }] })), 'projects');
    }

    const priceData=dash.data('statcom').data||[];
    hbars(root.querySelector('#st-price .kx-chart'),['132','115','33','13.8'].map(v=>{const rs=priceData.filter(r=>(dash.params().legacy||!r.legacy)&&r.voltage===v),known=rs.filter(r=>r.costValue!=null),mw=rs.reduce((t,r)=>t+(Number(r.equivalentMvar)||0),0),total=known.reduce((t,r)=>t+r.costValue,0);return {label:v+' kV ('+fmt(mw)+' MVAr)',segs:[{v:total,color:dash.colors[0]}],valueText:(known.length?'USD '+(total/1e6).toFixed(2)+'m':'Not available')+' · '+known.length+'/'+rs.length+' priced'};}),'USD');
    const d = dash.data('statcom');
    const ot = root.querySelector('table[data-table="open"]'), at = root.querySelector('table[data-table="st"]');
    if (d.status === 'ok') {
      const open = d.data.filter((r) => r.status === 'Planned').sort((a, b) => Number(b.mvar) - Number(a.mvar));
      fillTable(ot, open, [{ f: 'name' }, { f: 'type' }, { f: 'mvar', num: true }, { f: 'rating' }, { f: 'voltage' }, { f: 'geo' }, { f: 'award' }, { f: 'costDisplay' }]);
      const q = root.querySelector('#kx-st-search').value.trim().toLowerCase();
      const rows = d.data.filter((r) => dash.params().legacy || String(r.legacy) !== 'true')
        .filter(r=>(!root.querySelector('#st-type-filter').value||r.type===root.querySelector('#st-type-filter').value)&&(!root.querySelector('#st-voltage-filter').value||r.voltage===root.querySelector('#st-voltage-filter').value))
        .filter((r) => !q || [r.name, r.epc, r.oem, r.epcFull, r.oemFull, r.geo, r.region, r.type].join(' ').toLowerCase().includes(q))
        .sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
      filteredRows=rows;
      fillTable(at, rows, [{ f: 'name' }, { f: 'status', pill: true }, { f: 'type' }, { f: 'epc' }, { f: 'oem' }, { f: 'mvar', num: true }, { f: 'vclass' }, { f: 'region' }, { f: 'year' }, { f: 'costDisplay' }]);
    } else { ot.querySelector('tbody').replaceChildren(); at.querySelector('tbody').replaceChildren(); }
  };


  for(const [id,key] of [['st-type-filter','type'],['st-voltage-filter','voltage']]){const el=root.querySelector('#'+id);[...new Set(KX_DATA.statcom.map(r=>r[key]))].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;el.appendChild(o);});el.value=state[key]||'';el.addEventListener('change',()=>{state[key]=el.value;draw();});}
  root.querySelector('#st-export').onclick=()=>{
    const rows=filteredRows||[],cols=[['Project','name'],['Status','status'],['Type','type'],['EPC','epcFull'],['OEM','oemFull'],['MVAr','mvar'],['Bus voltage (kV)','voltage'],['Cost (USD)','costValue'],['Cost basis','costDisplay']];
    const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const matrix=[cols.map(c=>c[0]),...rows.map(r=>cols.map(c=>r[c[1]]??'Not available'))];
    const sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+matrix.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,j)=>{const ref=String.fromCharCode(65+j)+(i+1);return typeof v==='number'?'<c r="'+ref+'"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t>'+esc(v)+'</t></is></c>';}).join('')+'</row>').join('')+'</sheetData></worksheet>';
    const parts={'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>','xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Filtered STATCOM" sheetId="1" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':sheet};
    const enc=new TextEncoder(),chunks=[],central=[];let offset=0;const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
    for(const [path,text] of Object.entries(parts)){const name=enc.encode(path),body=enc.encode(text),sum=crc(body),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,sum,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,name.length,true);h.set(name,30);chunks.push(h,body);const ch=new Uint8Array(46+name.length),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,sum,true);cv.setUint32(20,body.length,true);cv.setUint32(24,body.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);ch.set(name,46);central.push(ch);offset+=h.length+body.length;}
    const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,central.reduce((t,c)=>t+c.length,0),true);ev.setUint32(16,offset,true);const url=URL.createObjectURL(new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const link=document.createElement('a');link.href=url;link.download='Filtered_STATCOM.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };

  /* ---------- tabs, filter, redraw ---------- */
  let tab = 'all';
  const showTab = (t) => {
    tab = t;
    root.querySelectorAll('.kx-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
    root.querySelector('#page-hvdc').hidden = t === 'statcom';
    root.querySelector('#page-statcom').hidden = t === 'hvdc';
    root.querySelector('#legacy-toggle').hidden = t === 'hvdc';
    dash.setLink(t);
    draw();
  };
  root.querySelectorAll('.kx-tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  const leg = root.querySelector('#kx-legacy');
  leg.addEventListener('change', () => dash.setParams({ legacy: leg.checked }));
  root.querySelector('#kx-st-search').value=state.query||'';root.querySelector('#kx-st-search').addEventListener('input',e=>{state.query=e.target.value;draw();});

  function draw() {
    leg.checked = !!dash.params().legacy;
    if (tab !== 'statcom') drawHVDC();
    if (tab !== 'hvdc') drawSTATCOM();
  }
  dash.onData(draw);
  {const h=state.tab;showTab(h==='statcom'||h==='hvdc'?h:'all');}
})();

(()=>{const price=document.getElementById('st-price'),reference=document.getElementById('st-cost-reference');if(!price||!reference)return;const sync=()=>{const h=price.getBoundingClientRect().height;if(h>0)reference.style.setProperty('--price-card-height',Math.ceil(h)+'px');};if(window.ResizeObserver){const observer=new ResizeObserver(sync);observer.observe(price);cleanups.push(()=>observer.disconnect());}requestAnimationFrame(sync);})();

return ()=>cleanups.forEach(f=>f());
}
