import {mountClassicDashboard} from './classic-dashboard.js';
export function mountReport(data, onEdit, onAdd, state = {}) {
  state.cleanup?.(); state.cleanup=null;
  const KC=window.KC; const M=KC.build(structuredClone(data));
  document.getElementById("btns").replaceChildren();

  M.projects=M.projects.filter(project=>project.group!=='SYNCOND'); M.byTech.SYNCOND=[];
  const F=KC.facts(M), D=M.DATA, esc=KC.esc, fmt=KC.fmt, open=p=>onEdit(p.id);
  const sc=k=>KC.STAGE_COLOR[k];
  document.getElementById('meta').textContent='Data version '+(D.meta.version||'')+' · generated '+(D.meta.generated||'')+' · click any chart element to filter';
  const btns=document.getElementById('btns'); KC.themeButton(btns);

  const TABS=[
    {key:'ALL',label:'All grid'},
    {key:'DASHBOARD',label:'Dashboard'},
    {key:'STATCOM',label:'STATCOM',color:KC.techColor('STATCOM'),count:F.S.length},
    {key:'HVDC',label:'HVDC',color:KC.techColor('HVDC'),count:F.H.length},
    {key:'SPECS',label:'General Specs'}
  ];
  const BASE={ALL:F.grid,STATCOM:F.S,HVDC:F.H,SYNCOND:F.Y};
  const fresh=()=>({stages:new Set(),owner:'',conf:'',from:'',to:'',q:'',company:'',status:'',supplier:'',epc:'',link:'',type:''});
  const ST=state.filters ||= {}; TABS.forEach(t=>ST[t.key] ||= fresh());
  let tab='ALL';
  const main=document.getElementById('main');

  const select=KC.tabs(document.getElementById('tabbar'),TABS,k=>{tab=k; history.replaceState(null,'','#'+k); render(); window.scrollTo({top:0});});

  /* ---------- filter widgets ---------- */
  const el=(h)=>{const d=document.createElement('div'); d.innerHTML=h.trim(); return d.firstChild;};
  function selectG(label,opts,val,onch){const g=el(`<div class="fg"><label>${esc(label)}</label><select></select></div>`);const s=g.querySelector('select');s.innerHTML='<option value="">All</option>'+opts.map(o=>`<option value="${esc(o)}"${o===val?' selected':''}>${esc(o)}</option>`).join('');s.onchange=()=>onch(s.value);return g;}
  function chipsG(label,opts,set,onch){const g=el(`<div class="fg"><label>${esc(label)}</label><div class="chips"></div></div>`);const c=g.querySelector('.chips');opts.forEach(o=>{const b=el(`<button type="button" class="chip" aria-pressed="${set.has(o)}">${esc(o)}</button>`);b.onclick=()=>{set.has(o)?set.delete(o):set.add(o);onch();};c.appendChild(b);});return g;}
  function searchG(val,onch){const g=el(`<div class="fg"><label>Search</label><input type="search" placeholder="Name, owner, contractor..." value="${esc(val)}"></div>`);const i=g.querySelector('input');let t;i.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{onch(i.value);},250);};return g;}

  /* ---------- filtering ---------- */
  const owners=Array.from(new Set(F.grid.map(p=>KC.ownerGroup(p.owner)))).sort();
  const years=Array.from(new Set(F.grid.filter(p=>p.year).map(p=>p.year))).sort().map(String);
  const hay=p=>(p.name+' '+(p.aliases||[]).join(' ')+' '+p.owner+' '+p.epc.join(' ')+' '+p.oem.join(' ')+' '+(p.locations||[]).map(l=>l.name).join(' ')).toLowerCase();
  function filt(list,s){
    return list.filter(p=>
      (!s.stages.size||s.stages.has(p.stage)) && (!s.owner||KC.ownerGroup(p.owner)===s.owner) && (!s.conf||p.confidence===s.conf) &&
      (!s.from||(p.year!=null&&p.year>=+s.from)) && (!s.to||(p.year!=null&&p.year<=+s.to)) &&
      (!s.company||p.epc.includes(s.company)||p.oem.includes(s.company)) && (!s.q||hay(p).includes(s.q.toLowerCase())));
  }
  const filtDC=(list,s)=>list.filter(x=>(!s.status||x.status===s.status)&&(!s.supplier||KC.dcSupplier(x.supplier)===s.supplier)&&(!s.epc||KC.dcEpc(x.epc)===s.epc)&&(!s.q||(x.project_name+' '+x.epc+' '+x.supplier).toLowerCase().includes(s.q.toLowerCase())));
  const filtREN=(list,s)=>list.filter(x=>(!s.link||KC.renLinkage(x)===s.link)&&(!s.type||x.type===s.type)&&(!s.from||(x.year!=null&&x.year>=+s.from))&&(!s.to||(x.year!=null&&x.year<=+s.to))&&(!s.q||(x.name+' '+(x.developer||'')).toLowerCase().includes(s.q.toLowerCase())));

  function active(s,tabKey){
    const a=[]; const add=(l,fn)=>a.push({l,fn});
    s.stages.forEach(x=>add('Stage: '+x,()=>s.stages.delete(x)));
    if(s.owner)add('Owner: '+s.owner,()=>s.owner=''); if(s.conf)add('Confidence: '+s.conf,()=>s.conf='');
    if(s.from)add('From '+s.from,()=>s.from=''); if(s.to)add('To '+s.to,()=>s.to='');
    if(s.company)add('Company: '+s.company,()=>s.company=''); if(s.q)add('Search: '+s.q,()=>s.q='');
    if(s.status)add('Status: '+s.status,()=>s.status=''); if(s.supplier)add('Supplier: '+s.supplier,()=>s.supplier='');
    if(s.epc)add('EPC: '+s.epc,()=>s.epc=''); if(s.link)add('Link: '+s.link,()=>s.link=''); if(s.type)add('Type: '+s.type,()=>s.type='');
    return a;
  }

  function bar(panel,s,kind,total,shown){
    const fb=document.createElement('div'); fb.className='fbar'; const row=document.createElement('div'); row.className='frow'; fb.appendChild(row);
    const re=()=>render();
    if(kind==='grid'){
      row.appendChild(chipsG('Stage',KC.STAGES.filter(k=>BASE[tab].some(p=>p.stage===k)),s.stages,re));
      row.appendChild(selectG('Owner',owners,s.owner,v=>{s.owner=v;re();}));
      row.appendChild(selectG('Confidence',['High','Medium','Low'],s.conf,v=>{s.conf=v;re();}));
      row.appendChild(selectG('From year',years,s.from,v=>{s.from=v;re();}));
      row.appendChild(selectG('To year',years,s.to,v=>{s.to=v;re();}));
    } else if(kind==='dc'){
      row.appendChild(selectG('Status',['Approved','Design stage'],s.status,v=>{s.status=v;re();}));
      row.appendChild(selectG('Supplier',['IBR','STATRON','ERAM','Not specified'],s.supplier,v=>{s.supplier=v;re();}));
      row.appendChild(selectG('EPC',Array.from(new Set(F.D.map(x=>KC.dcEpc(x.epc)))).sort(),s.epc,v=>{s.epc=v;re();}));
    } else {
      row.appendChild(selectG('Reactive-support link',KC.REN_LINK_ORDER,s.link,v=>{s.link=v;re();}));
      row.appendChild(selectG('Type',Array.from(new Set(F.R.map(x=>x.type))).sort(),s.type,v=>{s.type=v;re();}));
      row.appendChild(selectG('From year',Array.from(new Set(F.R.filter(x=>x.year).map(x=>x.year))).sort().map(String),s.from,v=>{s.from=v;re();}));
      row.appendChild(selectG('To year',Array.from(new Set(F.R.filter(x=>x.year).map(x=>x.year))).sort().map(String),s.to,v=>{s.to=v;re();}));
    }
    row.appendChild(searchG(s.q,v=>{s.q=v;re();}));
    const st=document.createElement('div'); st.className='fstat';
    st.innerHTML='Showing <b>'+shown+'</b> of '+total+' records';
    active(s).forEach(a=>{const x=el(`<span class="act">${esc(a.l)}<button type="button" aria-label="Remove filter">&times;</button></span>`);x.querySelector('button').onclick=()=>{a.fn();re();};st.appendChild(x);});
    if(active(s).length){const c=el('<button type="button" class="linkbtn">Clear all</button>');c.onclick=()=>{ST[tab]=fresh();re();};st.appendChild(c);}
    fb.appendChild(st);
    const download=document.createElement('button'); download.className='chip'; download.textContent='Export filtered Excel';
    download.onclick=()=>exportDashboardRows(filt(BASE[tab]||F.grid,s).map(p=>({name:p.name,status:p.status,type:p.specs.project_type||p.technology_category,epcFull:p.specs.epc_contractor,oemFull:p.specs.manufacturer||p.specs.converter_valve,mvar:p.specs.rating_mvar||p.specs.capacity_mw,voltage:p.specs.connection_voltage_kv||p.specs.dc_voltage_kv,costValue:p.cost_value_usd,costDisplay:p.specs.cost||p.total_value})));
    fb.appendChild(download); panel.appendChild(fb);
  }
  const grid=(p,c)=>{const g=document.createElement('div');g.className='grid '+(c||'g2');p.appendChild(g);return g;};
  const hint=(p,t)=>{const d=document.createElement('div');d.className='hint';d.textContent=t;p.appendChild(d);};
  const toggle=(set,v)=>{set.has(v)?set.delete(v):set.add(v);};

  /* ---------- registers ---------- */
  const projCols=[{key:'name',label:'Project',get:p=>p.name},{key:'tech',label:'Tech',get:p=>KC.techLabel(p.group)},{key:'stage',label:'Stage',get:p=>p.stage},{key:'year',label:'Year of award',cls:'r',get:p=>p.year},{key:'cap',label:'Capacity (as stated)',get:p=>p.capacity},{key:'owner',label:'Owner',get:p=>p.owner},{key:'epc',label:'EPC named',get:p=>p.epc.join(', ')||(p.group==='STATCOM'?'Not available':'not stated')},{key:'oem',label:'OEM named',get:p=>p.oem.join(', ')||(p.group==='STATCOM'?'Not available':'not stated')},{key:'conf',label:'Confidence',get:p=>p.confidence}];

  function gridCharts(panel,s,list,key,afterKpis){
    const base=BASE[key], techs=key==='ALL'?['STATCOM','HVDC']:[key];
    const st=F.stage(list);
    const preN=(st['Pre-award']||0)+(st['Tendering']||0)+(st['Planned / Announced']||0);
    const doneN=(st['Completed']||0)+(st['Delivered']||0)+(st['In Operation']||0);
    const kpis=key==='HVDC' ? [{value:list.length,label:'Records in view'}, ...['In Operation','Under Installation','Awarded','Tendering','Planned / Announced'].map(k=>({value:st[k]||0,label:k==='Planned / Announced'?k+' · Target':k}))] : key==='STATCOM' ? [
      {value:list.length,label:'Records in view'}, {value:st['Awarded']||0,label:'Awarded'}, {value:st['Delivered']||0,label:'Delivered'}, {value:st['Tendering']||0,label:'Tendering / open'},
      {value:list.filter(p=>p.epc.length).length+' / '+list.length,label:'EPC named'}, {value:list.filter(p=>p.oem.length).length+' / '+list.length,label:'OEM named'}
    ] : [
      {value:list.length,label:'Records in view'}, {value:preN,label:'Pre-award / planned'},
      {value:(st['Awarded']||0)+(st['Under execution']||0)+(st['Under Installation']||0),label:'Awarded / in execution'}, {value:doneN,label:'Delivered / operating'},
      {value:list.filter(p=>p.epc.length).length+' / '+list.length,label:'EPC named'}, {value:list.filter(p=>p.oem.length).length+' / '+list.length,label:'OEM named'}
    ];
    const statCosts=key==='STATCOM'?(()=>{const sums=rs=>{const known=rs.filter(p=>p.cost_value_usd!=null);return {value:known.length?'USD '+(known.reduce((t,p)=>t+p.cost_value_usd,0)/1e6).toFixed(2)+'m':'Not available',coverage:known.length+'/'+rs.length+' priced; missing costs excluded'};};const done=sums(list.filter(p=>p.stage==='Delivered')),plan=sums(list.filter(p=>p.stage==='Tendering'));return [{value:done.value,label:'Completed available cost · '+done.coverage},{value:plan.value,label:'Planned available cost · '+plan.coverage}];})():[];
    KC.kpis(panel,kpis.concat(statCosts));
    if(afterKpis)afterKpis();
    const g=grid(panel,'g2');
    KC.card(g,{title:'Project Status Analysis', sub:'Click a segment to filter by stage', render:b=>{
      techs.forEach(t=>{const l=list.filter(p=>p.group===t); if(key==='ALL'){const h=document.createElement('div');h.style.cssText='font-weight:650;margin:8px 0 4px;font-size:13px';h.className='kc-ch';h.innerHTML='<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:'+KC.techColor(t)+';margin-right:6px"></span>'+esc(KC.techLabel(t))+' <span class="muted">('+l.length+')</span>';b.appendChild(h);}
        if(l.length){const w=document.createElement('div');w.className='kc-ch';b.appendChild(w);KC.stagebar(w,F.stage(l),{onClick:k=>{toggle(s.stages,k);render();}});}});
    },desc:'Segments show how far records have progressed. Pre-award means tender, RFQ, bid or planning with no contract.',
      so:list.length?'In this view '+preN+' of '+list.length+' records are tendering / planned and '+doneN+' are delivered / operating.':'No records match the current filters.'});
    const typeKeys=["Containerized", "Conventional", "E-STATCOM Containerized", "E-STATCOM Conventional", "Mobile/Containerized", "Mobile/Conventional", "Not available"];
    const tl=key==='STATCOM'?KC.timeline(list,p=>p.specs.project_type,typeKeys.map((t,i)=>({key:t,label:t,color:i===6?'var(--ink-3)':'var(--c'+(i+1)+')'}))):KC.timeline(list,p=>p.group,techs.map(t=>({key:t,label:KC.techLabel(t),color:KC.techColor(t)})));
    KC.card(g,{title:key==='STATCOM'?'Projects by year and type':'Timeline Analysis', sub:'Click a column to filter to that year', render:b=>{
      if(!tl.cats.length){b.innerHTML='<div class="notice">No dated records in this view.</div>';return;}
      if(techs.length>1||key==='STATCOM')KC.legend(b,tl.series.map(x=>({label:x.label,color:x.color})));
      KC.columns(b,tl.cats,tl.series,{totals:true,percentPerColumn:key==='STATCOM',height:230,onClick:(cat)=>{s.from=String(cat);s.to=String(cat);render();}});
    },table:{cols:[{key:'y',label:'Year',get:r=>r.y}].concat(tl.series.map(x=>({key:x.key,label:x.label,cls:'r',get:r=>r[x.key]}))),rows:tl.cats.map((y,i)=>Object.assign({y},...tl.series.map(x=>({[x.key]:x.values[i]})))),opts:{sort:'y',dir:1}},
      desc:'Year of award, tender issue (from the PTS number) or, for a few records, a supplier-log order date (a proxy for award). '+(tl.undated?tl.undated+' record(s) in view have no usable date.':''),
      so:(function(){if(!tl.cats.length)return 'No dated records.';const tot=tl.cats.map((y,i)=>tl.series.reduce((a,x)=>a+x.values[i],0));const m=Math.max.apply(null,tot);return 'Busiest year in view: '+tl.cats[tot.indexOf(m)]+' ('+m+' records).';})()});
    const lg=(role)=>KC.league(list,role).slice(0,10);
    const mk=(role,color)=>lg(role).map(x=>({label:x.name,value:x.n,color,onClick:()=>{s.company=x.name;render();},tip:()=>'<b>'+esc(x.name)+'</b><br>'+x.n+' record(s)<br><span class="m">'+esc(x.projects.slice(0,4).map(q=>q.name).join('; '))+(x.projects.length>4?' ...':'')+'</span>'}));
    KC.card(g,{title:key==='HVDC'?'Main EPC':'EPC contractors named', sub:'Click a bar to filter to that company', render:b=>KC.hbars(b,mk('epc','var(--c1)'),{lw:150}),
      desc:'Counted once per project where the company is the EPC (construction / turnkey) party. Only contractors a source names are counted.',
      so:(function(){const L=KC.league(list,'epc');return L.length?L[0].name+' is named on the most records in view ('+L[0].n+').':'No EPC contractor is named in this view.';})()});
    KC.card(g,{title:key==='HVDC'?'Valve manufacturer capacity (MW)':'Equipment OEMs named', sub:'Click a bar to filter to that company', render:b=>KC.hbars(b,key==='HVDC'?KC.league(list,'oem').map(x=>({label:x.name,value:x.projects.reduce((t,p)=>t+(Number(p.specs&&(p.specs.analysis_capacity_mw ?? p.specs.capacity_mw))||0),0),color:'var(--c3)',onClick:()=>{s.company=x.name;render();},tip:()=>'<b>'+esc(x.name)+'</b><br>'+fmt(x.projects.reduce((t,p)=>t+(Number(p.specs&&(p.specs.analysis_capacity_mw ?? p.specs.capacity_mw))||0),0))+' MW · '+x.n+' links'})).sort((a,b)=>b.value-a.value):mk('oem','var(--c3)'),{lw:150}),
      desc:key==='HVDC'?'Link capacity in MW by converter valve manufacturer stated in General Specs; each link counted once, including awarded links. This is not a delivery claim.':'Equipment makers only where a source names them.',
      so:(function(){const L=KC.league(list,'oem');return L.length?L[0].name+' is named on the most records in view ('+L[0].n+').':'No equipment OEM is named in this view.';})()});
    if(key==='STATCOM'||key==='ALL'){
      const rated=list.filter(p=>p.group==='STATCOM'&&p.rating.unit!=null),bands=KC.SIZE_BANDS;
      KC.card(g,{title:'STATCOM unit size by stage', sub:rated.length+' records with a stated MVAr rating', render:b=>{
        if(!rated.length){b.innerHTML='<div class="notice">No rated STATCOM records in view.</div>';return;}
        KC.legend(b,KC.STAGES.map(x=>({label:x,color:sc(x)})));
        KC.columns(b,bands.map(x=>x.label.replace(' MVAr','')),KC.STAGES.map(x=>({key:x,label:x,color:sc(x),values:bands.map(bd=>rated.filter(p=>p.stage===x&&bd.test(p.rating.unit)).length)})),{height:220,totals:true});
      },desc:'Capacitive rating of one unit or site as written in the source (MVAr). Records without a stated rating are left out.'});
    }
    return g;
  }

  function register(panel,list,onRow){
    KC.card(panel,{title:'Records', sub:list.length+' in view - click a row for details and sources', render:b=>{
      if(!list.length){b.innerHTML='<div class="empty">No records match the current filters.</div>';return;}
      KC.table(b,projCols.map(c=>c.key==='oem'&&list.length&&list.every(p=>p.group==='HVDC')?Object.assign({},c,{label:'Converter valve'}):c),list,{onRow,sort:'year',dir:-1});}});
  }

  /* ---------- General Specs page ---------- */
  const NOINFO='No info';
  const sv=(p,k)=>{const v=p.specs&&p.specs[k]; return (v==null||v===''||/^(not publicly disclosed|not stated|n\/a|no info)$/i.test(String(v).trim()))?null:String(v);};
  const cl=v=>(v==null||v===''||/^(not publicly disclosed|not stated|n\/a|no info|not specified)$/i.test(String(v).trim()))?null:v;
  const yearTxt=p=>p.completion_target||p.award_date||null;
  const SPEC_DEF={
    HVDC:{label:'HVDC',list:()=>F.H,groups:[
      {g:'1. Project identification & ownership',cols:[
        {k:'status',l:'Status',get:p=>p.status},
        {k:'yoa',l:'Year of award',get:p=>p.year!=null?String(p.year):null},
        {k:'year',l:'Commissioning / target',get:p=>yearTxt(p)},
        {k:'epcc',l:'EPC Contractor',get:p=>sv(p,'epc_contractor')||(p.epc.length?p.epc.join(', '):null)},
        {k:'owner',l:'Utility / owner',get:p=>p.owner},
        {k:'mat',l:'Maturity',get:p=>p.maturity||null},{k:'conf',l:'Confidence',get:p=>p.confidence||null}]},
      {g:'2. Link endpoints (converter stations)',cols:[
        {k:'ta',l:'Converter Station 1',get:p=>sv(p,'terminal_a')},{k:'tb',l:'Converter Station 2',get:p=>sv(p,'terminal_b')},
        {k:'prog',l:'Programme / related records',get:p=>{const r=(p.related_ids||[]).map(i=>{const q=F.H.find(x=>x.id===i);return q?q.name:i;});const g=sv(p,'link_programme');return g?g+(r.length?' | Related: '+r.join('; '):''):null;}}]},
      {g:'3. Geography',cols:[
        {k:'c1',l:'Country 1',get:p=>sv(p,'country_1')},{k:'c2',l:'Country 2',get:p=>sv(p,'country_2')},
        {k:'reg',l:'Region',get:p=>sv(p,'region')},{k:'onoff',l:'Onshore / offshore',get:p=>sv(p,'onshore_offshore')}]},
      {g:'4. Technical parameters (electrical ratings)',cols:[
        {k:'mw',l:'Capacity (MW)',get:p=>sv(p,'capacity_mw')},{k:'dcv',l:'DC voltage (kV)',get:p=>sv(p,'dc_voltage_kv')},
        {k:'acv',l:'AC voltage, stations (kV)',get:p=>sv(p,'ac_voltage_kv')},{k:'hz',l:'Frequency (Hz)',get:p=>sv(p,'frequency_hz')}]},
      {g:'5. System configuration & transmission assets',cols:[
        {k:'tech',l:'Converter technology',get:p=>sv(p,'converter_technology')},
        {k:'valve',l:'Converter Valve',get:p=>sv(p,'converter_valve')},
        {k:'cool',l:'Cooling System',get:p=>sv(p,'cooling_system')},
        {k:'rea',l:'Reactors',get:p=>sv(p,'reactors')||(p.components&&sv({specs:{x:p.components.reactor}},'x'))},
        {k:'gis',l:'GIS',get:p=>sv(p,'gis')||(p.components&&sv({specs:{x:p.components.gis}},'x'))},
        {k:'xf',l:'Interface Transformer',get:p=>sv(p,'interface_transformer')},
        {k:'axf',l:'Auxiliary Transformer',get:p=>sv(p,'auxiliary_transformer')},
        {k:'ctv',l:'CT and CVT',get:p=>sv(p,'ct_cvt')},
        {k:'dccp',l:'DC Control and Protection equipment',get:p=>sv(p,'dc_control_protection')},
        {k:'sa',l:'DC Surge Arrester',get:p=>sv(p,'dc_surge_arrester')},
        {k:'conn',l:'Network connection',get:p=>sv(p,'network_connection')},
        {k:'nt',l:'No. of terminals',get:p=>sv(p,'number_of_terminals')},{k:'tt',l:'Terminal type',get:p=>sv(p,'terminal_type')},
        {k:'sub',l:'Subsea cable (km)',get:p=>sv(p,'subsea_cable_km')},{k:'ug',l:'Underground cable (km)',get:p=>sv(p,'underground_cable_km')},
        {k:'oh',l:'Overhead line (km)',get:p=>sv(p,'overhead_line_km')},{k:'cm',l:'Cable manufacturer',get:p=>sv(p,'cable_manufacturer')},
        {k:'oth',l:'Other sub-parts / notes',get:p=>sv(p,'other_notes')||(p.components&&sv({specs:{x:p.components.other_subparts}},'x'))}]}]},
    STATCOM:{label:'STATCOM',list:()=>F.S,groups:[
      {g:'1. Project identification & ownership',cols:[
        {k:'var',l:'Type',get:p=>p.isSVC?'SVC':'STATCOM'},
        {k:'ptype',l:'Project type',get:p=>(p.specs&&p.specs.project_type)||'Not available'},
        {k:'status',l:'Status',get:p=>p.status},{k:'yoa',l:'Year of award',get:p=>p.year!=null?String(p.year):null},
        {k:'year',l:'Award / commissioning',get:p=>sv(p,'commissioning_date')||p.award_date||null},
        {k:'oem',l:'Equipment maker (OEM)',get:p=>sv(p,'manufacturer')||(p.oem.length?p.oem.join(', '):null)},
        {k:'epc',l:'EPC contractor',get:p=>sv(p,'epc_contractor')||(p.epc.length?p.epc.join(', '):null)},
        {k:'owner',l:'Owner / utility',get:p=>p.owner},{k:'conf',l:'Confidence',get:p=>p.confidence||null}]},
      {g:'2. Geography',cols:[
        {k:'ctry',l:'Country',get:p=>'Saudi Arabia'},{k:'reg',l:'Region (indicative)',get:p=>sv(p,'region')||p.region},
        {k:'site',l:'Site',get:p=>(p.locations||[]).map(l=>l.name).join(', ')||null}]},
      {g:'3. Technical parameters (electrical ratings)',cols:[
        {k:'mvar',l:'Rating (MVAr)',get:p=>sv(p,'rating_mvar')||(p.capacity&&/mvar/i.test(p.capacity)?p.capacity:null)},
        {k:'kv',l:'STATCOM bus voltage (kV)',get:p=>sv(p,'connection_voltage_kv')||'Not available'},
        {k:'nu',l:'No. of units',get:p=>sv(p,'number_of_units')||(p.capacity&&(p.capacity.match(/^(\d+)\s*x\s*\(/i)||[])[1])||null}]},
      {g:'4. System configuration & sub-parts',cols:[
        {k:'topo',l:'Topology',get:p=>sv(p,'topology')},{k:'valve',l:'Valve info',get:p=>sv(p,'valve_info')},
        {k:'cool',l:'Cooling',get:p=>sv(p,'cooling')},{k:'xf',l:'Step-up transformer',get:p=>sv(p,'step_up_transformer')||(p.components&&sv({specs:{x:p.components.transformer}},'x'))},
        {k:'ctl',l:'Controls',get:p=>sv(p,'controls_oem')},{k:'gis',l:'GIS',get:p=>p.components&&sv({specs:{x:p.components.gis}},'x')},
        {k:'oth',l:'Other sub-parts / notes',get:p=>sv(p,'other_notes')||(p.components&&sv({specs:{x:p.components.other_subparts}},'x'))}]},
      {g:'5. Cost and scope',cols:[
        {k:'cost',l:'Cost',cls:'costc',get:p=>p.group==='STATCOM'?(p.specs.cost||''):sv(p,'cost')},
        {k:'scope',l:'Scope',cls:'scopec',get:p=>(p.specs_scope&&p.specs_scope.length)?p.specs_scope.join('; '):null,rh:p=>'<ul>'+p.specs_scope.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'}]}]}
  };
  const SPS=state.specs ||= {sub:'HVDC',q:'',status:'',conf:'',mat:'',view:'table',type:'',ptype:''};
  const MATS=['In Operation','Under Installation','Awarded','Tendering','Planned / Announced','Delivered'], COMMIT='Committed (operating, awarded or tender)';
  function renderSpecs(){
    const def=SPEC_DEF[SPS.sub], all=def.list(), cols=[].concat.apply([],def.groups.map(g=>g.cols));
    const panel=document.createElement('section'); panel.className='panel'; main.appendChild(panel);
    const fb=document.createElement('div'); fb.className='fbar'; const row=document.createElement('div'); row.className='frow'; fb.appendChild(row);
    const sg=el('<div class="fg"><label>Technology</label><div class="chips"></div></div>');
    Object.keys(SPEC_DEF).forEach(k=>{const b=el('<button type="button" class="chip" aria-pressed="'+(SPS.sub===k)+'">'+esc(SPEC_DEF[k].label)+' <span class="muted">('+SPEC_DEF[k].list().length+')</span></button>');b.onclick=()=>{SPS.sub=k;SPS.status='';SPS.mat='';SPS.type='';SPS.ptype='';SPS.view='table';render();};sg.querySelector('.chips').appendChild(b);});
    row.appendChild(sg);
    const stages=Array.from(new Set(all.map(p=>p.stage))).sort((a,b)=>KC.STAGES.indexOf(a)-KC.STAGES.indexOf(b));
    row.appendChild(selectG('Project status',stages,SPS.status,v=>{SPS.status=v;render();}));
    row.appendChild(selectG('Confidence',['High','Medium','Low'],SPS.conf,v=>{SPS.conf=v;render();}));
    if(SPS.sub==='STATCOM')row.appendChild(selectG('Type',['STATCOM','SVC'],SPS.type,v=>{SPS.type=v;render();}));
    if(SPS.sub==='STATCOM')row.appendChild(selectG('Project type',Array.from(new Set(all.map(p=>p.specs.project_type||'Not available'))).sort(),SPS.ptype,v=>{SPS.ptype=v;render();}));
    if(SPS.sub==='HVDC')row.appendChild(selectG('Maturity',[COMMIT].concat(MATS),SPS.mat,v=>{SPS.mat=v;render();}));
    if(SPS.sub==='HVDC'){const vg=el('<div class="fg"><label>View</label><div class="chips"></div></div>');[['table','Table'],['links','Connections']].forEach(([k,l])=>{const b=el('<button type="button" class="chip" aria-pressed="'+(SPS.view===k)+'">'+l+'</button>');b.onclick=()=>{SPS.view=k;render();};vg.querySelector('.chips').appendChild(b);});row.appendChild(vg);}
    row.appendChild(searchG(SPS.q,v=>{SPS.q=v;render();}));
    const add=el('<div class="fg"><label>&nbsp;</label><button type="button" class="primary add-project">+ Add project</button></div>');row.appendChild(add);
    add.querySelector('button').onclick=()=>onAdd(SPS.sub);
    const ex=el('<div class="fg"><label>&nbsp;</label><button type="button" class="chip">Download CSV</button></div>'); row.appendChild(ex);
    const list=all.filter(p=>(!SPS.status||p.stage===SPS.status)&&(!SPS.conf||p.confidence===SPS.conf)&&(!SPS.type||(p.isSVC?'SVC':'STATCOM')===SPS.type)&&(!SPS.ptype||((p.specs&&p.specs.project_type)||'Not available')===SPS.ptype)&&(!SPS.mat||(SPS.mat===COMMIT?(p.maturity&&p.maturity!=='Planned / Announced'):p.maturity===SPS.mat))&&(!SPS.q||hay(p).includes(SPS.q.toLowerCase())));
    const known=p=>cols.filter(c=>cl(c.get(p))!=null).length;
    const st=document.createElement('div'); st.className='fstat'; st.innerHTML='Showing <b>'+list.length+'</b> of '+all.length+' '+esc(def.label)+' records &middot; cells with no available information read "'+NOINFO+'"'; fb.appendChild(st); panel.appendChild(fb);
    ex.querySelector('button').onclick=()=>{
      const q=v=>'"'+String(v==null?NOINFO:v).replace(/"/g,'""')+'"';
      const lines=[['Project'].concat(cols.map(c=>c.l)).map(q).join(',')].concat(list.map(p=>[p.name].concat(cols.map(c=>c.k==='cost'&&p.group==='STATCOM'&&p.specs.cost===''?'':cl(c.get(p)))).map(q).join(',')));
      const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'})); a.download='ksa_'+SPS.sub.toLowerCase()+'_general_specs.csv'; document.body.appendChild(a); a.click(); a.remove();};
    const tot=cols.length*list.length, kn=list.reduce((a,p)=>a+known(p),0);
    KC.kpis(panel,[{value:list.length,label:'Records'},{value:cols.length,label:'Spec columns'},{value:tot?Math.round(100*kn/tot)+'%':'-',label:'Cells with available information'}]);
    const card=document.createElement('div'); card.className='card'; panel.appendChild(card);
    if(!list.length){card.innerHTML='<div class="empty">No records match the current filters.</div>';return;}
    if(SPS.sub==='HVDC'&&SPS.view==='links'){ linksView(card,list,def,cols); return; }
    let sortK=null,dir=1;
    const wrap=document.createElement('div'); wrap.className='tscroll specs-wrap'; card.appendChild(wrap);
    function draw(){
      const r=list.slice(); if(sortK){const c=cols.find(x=>x.k===sortK);r.sort((a,b)=>{const x=cl(c.get(a)),y=cl(c.get(b));return (x==null?1:y==null?-1:String(x).localeCompare(String(y),undefined,{numeric:true}))*dir;});}
      let h='<table class="dt specs"><thead><tr><th class="sticky" rowspan="2">Project</th>'+def.groups.map(g=>'<th class="grp" colspan="'+g.cols.length+'">'+esc(g.g)+'</th>').join('')+'</tr><tr>'+cols.map(c=>'<th data-k="'+c.k+'">'+esc(c.l)+(sortK===c.k?(dir>0?' ▲':' ▼'):'')+'</th>').join('')+'</tr></thead><tbody>';
      r.forEach((p,i)=>{h+='<tr class="click" data-i="'+i+'"><td class="sticky"><b>'+esc(p.name)+'</b><br><span class="edit-label">View / edit specs →</span></td>'+cols.map(c=>{const v=cl(c.get(p));if(c.k==='cost'&&p.group==='STATCOM'&&p.specs.cost==='')return '<td></td>';if(v==null)return '<td class="ni">'+NOINFO+'</td>';if(c.rh)return '<td class="'+(c.cls||'')+'">'+c.rh(p)+'</td>';const t=String(v);return t.length>90?'<td title="'+esc(t)+'">'+esc(t.slice(0,88).replace(/[\s,;(]+$/,''))+'&hellip;</td>':'<td>'+esc(t)+'</td>';}).join('')+'</tr>';});
      wrap.innerHTML=h+'</tbody></table>';
      wrap.querySelectorAll('thead tr:nth-child(2) th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(sortK===k)dir=-dir;else{sortK=k;dir=1;}draw();});
      wrap.querySelectorAll('tbody tr').forEach(tr=>tr.onclick=()=>specDetail(r[+tr.dataset.i],def,cols));
    }
    draw();
  }
  function linksView(card,list,def,cols){
    const short=(v,n)=>{v=cl(v);if(v==null)return null;v=String(v);return v.length>n?v.slice(0,n-1).replace(/[\s,;(]+$/,'')+'\u2026':v;};
    const order=p=>MATS.indexOf(p.maturity); const L=list.slice().sort((a,b)=>order(a)-order(b)||a.name.localeCompare(b.name));
    const mcol=MATS.map(k=>KC.STAGE_COLOR[k]||'var(--ink-3)');
    let h='<div class="muted" style="font-size:12.5px;margin-bottom:10px">Each card is one HVDC link, read from converter station 1 to converter station 2. Links that belong to the same programme are tagged. Click a card for all specs and sources.</div><div class="lgrid">';
    L.forEach((p,i)=>{
      const mi=Math.max(0,order(p)); const g=sv(p,'link_programme'); const rel=(p.related_ids||[]).map(id=>{const q=F.H.find(x=>x.id===id);return q?q.name:id;});
      const num=(v,u)=>{if(v==null)return null;const m=String(v).match(/(\+\/-|\u00b1)?\s?\d[\d,.]*/);return m?m[0].replace('+/-','\u00b1').trim()+' '+u:null;};
      const parts=[num(sv(p,'dc_voltage_kv'),'kV DC'),num(sv(p,'capacity_mw'),'MW'),num(sv(p,'overhead_line_km')||sv(p,'subsea_cable_km'),'km')].filter(Boolean);
      h+='<div class="lcard" data-i="'+i+'"><div class="lh"><b>'+esc(p.name)+'</b></div><div class="lpills"><span class="pill" style="border-color:'+mcol[mi]+'">'+esc(p.maturity||'No info')+'</span><span class="pill">'+esc(p.confidence||'')+' confidence</span></div>'+
        '<div class="lroute"><div class="lnode"><small>STATION 1</small>'+esc(cl(sv(p,'terminal_a'))||NOINFO)+'</div><div class="lline"><span>'+esc(parts.join(' \u00b7 ')||'')+'</span></div><div class="lnode"><small>STATION 2</small>'+esc(cl(sv(p,'terminal_b'))||NOINFO)+'</div></div>'+
        (sv(p,'terminal_other')?'<div class="lmeta"><b>Other terminal:</b> '+esc(sv(p,'terminal_other'))+'</div>':'')+
        '<div class="lmeta"><b>Programme:</b> '+esc(g||NOINFO)+(rel.length?' &middot; <b>Related:</b> '+esc(rel.join('; ')):'')+'</div>'+
        '<div class="lmeta"><b>Status:</b> '+esc(p.status)+'</div></div>';
    });
    card.innerHTML=h+'</div>';
    card.querySelectorAll('.lcard').forEach(c=>c.onclick=()=>specDetail(L[+c.dataset.i],def,cols));
  }
  function specDetail(p,def,cols){
    onEdit(p.id); return;

    const ss=p.specs_sources||{}, S=D.sources;
    const rows=cols.map(c=>{const v=cl(c.get(p));if(c.rh&&v!=null)return [c.l,c.rh(p)];return [c.l,v==null?'No info':esc(v)];});
    if(sv(p,'terminal_other'))rows.push(['Other terminal(s)',esc(sv(p,'terminal_other'))]);
    Object.keys(p.specs_extra||{}).forEach(k=>{const v=cl(p.specs_extra[k]);rows.push([k,v==null?'No info':esc(v)]);});
    rows.push(['Status date source',(p.status_source_ids||[]).map(i=>S[i]).filter(Boolean).map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+'</a> ('+esc(s.date||'')+')').join('<br>')||'No info']);
    const ids=Array.from(new Set([].concat(p.source_ids||[],p.status_source_ids||[],...Object.values(ss)))).filter(i=>S[i]);
    const lab=k=>k.replace(/_/g,' ').replace(/\bkv\b/i,'kV').replace(/\bmw\b/i,'MW').replace(/\bkm\b/i,'km');
    const per=Object.keys(ss).map(k=>'<div style="margin:3px 0;font-size:12.5px"><span class="muted">'+esc(lab(k))+':</span> '+ss[k].map(i=>S[i]?'<a class="src" href="'+esc(S[i].url)+'" target="_blank" rel="noopener">'+esc(S[i].publisher)+' ('+esc(S[i].tier)+')</a>':'').join(' ')+'</div>').join('');
    const nf=(p.specs_not_found||[]).length?'<h4>Searched, not found</h4><div class="muted" style="font-size:12.5px">'+esc(p.specs_not_found.join('; '))+'</div>':'';
    KC.openRecord({badges:'<span class="pill">General specs</span>',title:p.name,rows:rows,extra:(per?'<h4>Source for each spec value</h4>'+per:'')+nf,notes:p.notes||'',sources:ids.map(i=>S[i])});
  }

  /* ---------- tab renderers ---------- */
  const DASHBOARD_REFERENCE_TABLE="<table class=\"dt\"><thead><tr><th>FACT Type</th><th>kV</th><th>Qty</th><th>Actual mVAR</th><th>Equivalent mVAR</th><th>Mvar</th><th>SalesCost (USD)</th><th>SalesCost/mVAR ($)</th><th>SalesCost/mVAR (SAR)</th><th>Source</th><th>Remarks</th></tr></thead><tbody><tr><td>STATCOM</td><td>33</td><td>3</td><td>\u00b120</td><td>40</td><td>120</td><td>9,333,333.33</td><td>77,777.78</td><td>291,666.67</td><td>Based on NARI</td><td></td></tr><tr><td>STATCOM</td><td>33</td><td>1</td><td>+450, -150</td><td>600</td><td>600</td><td>36,990,827.00</td><td>61,651.38</td><td>231,192.67</td><td>Gulf projects</td><td></td></tr><tr><td>E-STATCOM</td><td>33</td><td>8</td><td>+40&#x27;-25</td><td>65</td><td>520</td><td>64,000,000.00</td><td>123,076.92</td><td>461,538.46</td><td>Based on NARI</td><td>Because additional supercapacitors</td></tr><tr><td>STATCOM</td><td>13.8</td><td>1</td><td>\u00b110</td><td>20</td><td>20</td><td>5,333,333.33</td><td>266,666.67</td><td>1,000,000.00</td><td>Based on NARI</td><td>has studies, FSS, Ctrl etc..</td></tr><tr><td>STATCOM</td><td>132</td><td>1</td><td>\u00b1300</td><td>600</td><td>600</td><td>37,573,333.00</td><td>62,622.22</td><td>234,833.33</td><td>Gulf projects</td><td></td></tr><tr><td>STATCOM</td><td>132</td><td>1</td><td>+600, -200</td><td>800</td><td>800</td><td>41,457,487.00</td><td>51,821.86</td><td>194,331.97</td><td>Gulf projects</td><td></td></tr><tr><td>SVC</td><td>110</td><td>1</td><td>+300, -150</td><td>450</td><td>450</td><td>51,700,000.00</td><td>114,888.89</td><td>430,833.33</td><td>Gulf projects</td><td></td></tr><tr><td>SVC</td><td>380</td><td>3</td><td>+450, -150</td><td>600</td><td>1800</td><td>123,000,000.00</td><td>68,333.33</td><td>256,250.00</td><td>Gulf projects</td><td></td></tr></tbody></table>";
  const dashboardState = state.dashboard ||= { section: 'All', legacy: false, type: '', voltage: '', query: '' };

  function renderDashboard() {
    main.replaceChildren();
    const panel = document.createElement('section');
    panel.className = 'panel';
    main.appendChild(panel);
    const controls = document.createElement('div');
    controls.className = 'fbar';
    const controlRow = document.createElement('div');
    controlRow.className = 'frow';
    controls.appendChild(controlRow);
    const sectionSet = new Set([dashboardState.section]);
    controlRow.appendChild(chipsG('Dashboard view', ['All', 'HVDC', 'STATCOM'], sectionSet, () => {
      dashboardState.section = [...sectionSet].filter(value => value !== dashboardState.section).pop() || dashboardState.section;
      render();
    }));
    const legacyLabel = document.createElement('label');
    legacyLabel.className = 'chip';
    const legacy = document.createElement('input');
    legacy.type = 'checkbox';
    legacy.checked = dashboardState.legacy;
    legacy.onchange = () => { dashboardState.legacy = legacy.checked; render(); };
    legacyLabel.append(legacy, document.createTextNode(' Include legacy SVCs'));
    controlRow.appendChild(legacyLabel);
    panel.appendChild(controls);

    function heading(text) {
      const title = document.createElement('h2');
      title.className = 'dashboard-section-title';
      title.textContent = text;
      panel.appendChild(title);
    }

    function leagueCard(parent, list, role, title) {
      const league = KC.league(list, role);
      KC.card(parent, {
        title,
        sub: 'Projects with a named company',
        render: body => KC.hbars(body, league.map(item => ({
          label: item.name, value: item.n, color: 'var(--c1)',
          onClick: () => open(item.projects[0])
        })), { lw: 145 })
      });
    }

    if (dashboardState.section !== 'STATCOM') {
      heading('Saudi HVDC pipeline');
      const links = F.H;
      const stages = ['In Operation', 'Under Installation', 'Awarded', 'Tendering', 'Planned / Announced'];
      KC.kpis(panel, [{ value: links.length, label: 'Projects tracked' }, ...stages.map(stage => ({
        value: links.filter(project => project.stage === stage).length, label: stage
      }))]);
      const charts = grid(panel, 'g2');
      KC.card(charts, {
        title: 'Pipeline by stage', sub: 'Available link capacity in MW',
        render: body => KC.hbars(body, stages.map(stage => ({
          label: stage,
          value: links.filter(project => project.stage === stage).reduce((total, project) => total + (Number(project.specs.capacity_mw) || 0), 0),
          color: KC.STAGE_COLOR[stage], suffix: ' MW'
        })), { lw: 155 })
      });
      leagueCard(charts, links, 'epc', 'Main EPC');
      KC.card(charts, {
        title: 'Valve manufacturer capacity', sub: 'Available link capacity in MW',
        render: body => KC.hbars(body, KC.league(links, 'oem').map(item => ({
          label: item.name,
          value: item.projects.reduce((total, project) => total + (Number(project.specs.capacity_mw) || 0), 0),
          color: 'var(--c3)', suffix: ' MW'
        })), { lw: 155 })
      });
      register(panel, links, open);
    }

    if (dashboardState.section === 'HVDC') return;
    heading('Saudi STATCOM market');
    const projects = F.S.filter(project => dashboardState.legacy || !project.isSVC);
    const planned = projects.filter(project => project.stage === 'Tendering');
    const completed = projects.filter(project => project.stage === 'Delivered');
    const alfanarEpc = projects.filter(project => /alfanar/i.test(project.specs.epc_contractor || ''));
    const alfanarOem = projects.filter(project => /alfanar/i.test(project.specs.manufacturer || ''));
    function costSummary(list) {
      const priced = list.filter(project => project.cost_value_usd != null);
      const value = priced.reduce((total, project) => total + project.cost_value_usd, 0);
      return { value: priced.length ? 'USD ' + (value / 1e6).toFixed(2) + 'm' : 'Not available', coverage: priced.length + '/' + list.length + ' priced' };
    }
    const doneCost = costSummary(completed);
    const plannedCost = costSummary(planned);
    KC.kpis(panel, [
      { value: projects.length, label: 'Projects tracked' },
      { value: projects.filter(project => /Containerized$/.test(project.specs.project_type)).length, label: 'Containerized projects' },
      { value: planned.length, label: 'Planned' },
      { value: doneCost.value, label: 'Completed cost · ' + doneCost.coverage },
      { value: plannedCost.value, label: 'Planned cost · ' + plannedCost.coverage },
      { value: alfanarEpc.length + ' EPC / ' + alfanarOem.length + ' OEM', label: 'Alfanar involvement · roles may overlap' }
    ]);
    const types = [...new Set(projects.map(project => project.specs.project_type || 'Not available'))].sort();
    const timeline = KC.timeline(projects, project => project.specs.project_type || 'Not available', types.map((type, index) => ({
      key: type, label: type, color: 'var(--c' + (index % 8 + 1) + ')'
    })));
    KC.card(panel, {
      title: 'Projects by year and type', sub: 'Each year is 100% for the percentage labels',
      render: body => {
        KC.legend(body, timeline.series);
        KC.columns(body, timeline.cats, timeline.series, { totals: true, percentPerColumn: true, height: 250 });
      }
    });
    const shares = grid(panel, 'g3 dashboard-shares');
    leagueCard(shares, projects, 'oem', 'OEM share');
    leagueCard(shares, projects, 'epc', 'EPC share');
    const voltages = [...new Set(projects.map(project => project.specs.connection_voltage_kv || 'Not available'))].sort((a, b) => parseFloat(b) - parseFloat(a));
    KC.card(shares, {
      title: 'Voltage level analysis', sub: 'STATCOM bus voltage',
      render: body => KC.hbars(body, voltages.map(voltage => ({
        label: voltage === 'Not available' ? voltage : voltage + ' kV',
        value: projects.filter(project => project.specs.connection_voltage_kv === voltage).length,
        color: 'var(--c3)'
      })), { lw: 105 })
    });
    const costRow = grid(panel, 'g2 dashboard-cost-row');
    KC.card(costRow, {
      title: 'Price level analysis', sub: 'Recorded and estimated costs with pricing coverage',
      render: body => {
        for (const voltage of [...new Set(['132', '115', '33', '13.8', ...voltages.filter(v=>/^\d/.test(v))])]) {
          const group = projects.filter(project => project.specs.connection_voltage_kv === voltage);
          const summary = costSummary(group);
          const equivalent = group.reduce((total, project) => total + (project.equivalent_mvar || 0), 0);
          const block = document.createElement('div');
          block.className = 'dashboard-price-item';
          const text = document.createElement('div');
          text.className = 'dashboard-price-label';
          text.textContent = voltage + ' kV (' + fmt(equivalent) + ' MVAr) · ' + summary.value + ' · ' + summary.coverage;
          block.appendChild(text);
          const track = document.createElement('div');
          track.className = 'dashboard-price-track';
          const bar = document.createElement('div');
          bar.className = 'dashboard-price-bar';
          const total = group.reduce((value, project) => value + (project.cost_value_usd || 0), 0);
          const max = Math.max(1, ...voltages.map(v => projects.filter(project => project.specs.connection_voltage_kv === v).reduce((value, project) => value + (project.cost_value_usd || 0), 0)));
          bar.style.width = total / max * 100 + '%';
          track.appendChild(bar);
          block.appendChild(track);
          body.appendChild(block);
        }
      }
    });
    KC.card(costRow, {
      title: 'Cost reference per MVAr',
      render: body => { body.classList.add('dashboard-reference'); body.innerHTML = DASHBOARD_REFERENCE_TABLE; }
    });
    const filters = document.createElement('div');
    filters.className = 'fbar';
    const filterRow = document.createElement('div');
    filterRow.className = 'frow';
    filters.appendChild(filterRow);
    filterRow.appendChild(selectG('Type', types, dashboardState.type, value => { dashboardState.type = value; render(); }));
    filterRow.appendChild(selectG('Bus voltage (kV)', voltages, dashboardState.voltage, value => { dashboardState.voltage = value; render(); }));
    filterRow.appendChild(searchG(dashboardState.query, value => { dashboardState.query = value; render(); }));
    panel.appendChild(filters);
    const filtered = projects.filter(project => (!dashboardState.type || project.specs.project_type === dashboardState.type)
      && (!dashboardState.voltage || project.specs.connection_voltage_kv === dashboardState.voltage)
      && (!dashboardState.query || hay(project).includes(dashboardState.query.toLowerCase())));
    const exportButton=document.createElement('button');
    exportButton.className='chip';
    exportButton.textContent='Export filtered Excel';
    exportButton.onclick=()=>exportDashboardRows(filtered.map(project=>({name:project.name,status:project.stage,type:project.specs.project_type,epcFull:project.specs.epc_contractor,oemFull:project.specs.manufacturer,mvar:project.rating.total||project.rating.unit,voltage:project.specs.connection_voltage_kv,costValue:project.cost_value_usd,costDisplay:project.specs.cost})));
    filterRow.appendChild(exportButton);
    KC.card(panel, {
      title: 'All STATCOM projects', sub: filtered.length + ' projects · click a row for details and sources',
      render: body => KC.table(body, [
        { key: 'name', label: 'Project', get: project => project.name },
        { key: 'stage', label: 'Status', get: project => project.stage },
        { key: 'type', label: 'Type', get: project => project.specs.project_type },
        { key: 'epc', label: 'EPC', get: project => project.epc.join(', ') || 'Not available' },
        { key: 'oem', label: 'OEM', get: project => project.oem.join(', ') || 'Not available' },
        { key: 'voltage', label: 'Bus voltage (kV)', get: project => project.specs.connection_voltage_kv },
        { key: 'rating', label: 'Rating (MVAr)', get: project => project.specs.rating_mvar },
        { key: 'cost', label: 'Report cost (USD)', get: project => project.specs.cost || 'Not available' }
      ], filtered, { onRow: open, sort: 'name', dir: 1 })
    });
  }

  function exportDashboardRows(rows) {

    const cols=[['Project','name'],['Status','status'],['Type','type'],['EPC','epcFull'],['OEM','oemFull'],['MVAr','mvar'],['Bus voltage (kV)','voltage'],['Cost (USD)','costValue'],['Cost basis','costDisplay']];
    const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const matrix=[cols.map(c=>c[0]),...rows.map(r=>cols.map(c=>r[c[1]]??'Not available'))];
    const sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+matrix.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,j)=>{const ref=String.fromCharCode(65+j)+(i+1);return typeof v==='number'?'<c r="'+ref+'"><v>'+v+'</v></c>':'<c r="'+ref+'" t="inlineStr"><is><t>'+esc(v)+'</t></is></c>';}).join('')+'</row>').join('')+'</sheetData></worksheet>';
    const parts={'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>','xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Filtered STATCOM" sheetId="1" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':sheet};
    const enc=new TextEncoder(),chunks=[],central=[];let offset=0;const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
    for(const [path,text] of Object.entries(parts)){const name=enc.encode(path),body=enc.encode(text),sum=crc(body),h=new Uint8Array(30+name.length),v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,sum,true);v.setUint32(18,body.length,true);v.setUint32(22,body.length,true);v.setUint16(26,name.length,true);h.set(name,30);chunks.push(h,body);const ch=new Uint8Array(46+name.length),cv=new DataView(ch.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint32(16,sum,true);cv.setUint32(20,body.length,true);cv.setUint32(24,body.length,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);ch.set(name,46);central.push(ch);offset+=h.length+body.length;}
    const end=new Uint8Array(22),ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,central.reduce((t,c)=>t+c.length,0),true);ev.setUint32(16,offset,true);const url=URL.createObjectURL(new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const link=document.createElement('a');link.href=url;link.download='PowerInsights_filtered_projects.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function render(){
    if(tab==='DASHBOARD'){state.cleanup?.();state.cleanup=mountClassicDashboard(main,M,state.classic ||= {},onEdit);return;}
    state.cleanup?.();state.cleanup=null;
    if(tab==='SPECS'){main.innerHTML='';renderSpecs();return;}
    const s=ST[tab]; main.innerHTML='';
    const panel=document.createElement('section'); panel.className='panel'; main.appendChild(panel);
    if(BASE[tab]){
      const list=filt(BASE[tab],s); bar(panel,s,'grid',BASE[tab].length,list.length);
      if(tab==='SYNCOND'&&F.Y.length<4) hint(panel,'Only '+F.Y.length+' synchronous condenser record(s) are tracked, so most comparison charts are thin by nature.');
      gridCharts(panel,s,list,tab,()=>{register(panel,list,open);const sp=document.createElement('div');sp.style.height='14px';panel.appendChild(sp);});
    }
  }
  document.getElementById('foot').innerHTML='Figures are computed live from the PowerInsights project database. Values are only those disclosed in public sources or internal trackers; "Not available" means the source is silent, not zero. Regions and some dates are indicative.';
  
  const start=(location.hash||'#ALL').slice(1); select(TABS.some(t=>t.key===start)?start:'ALL');
}
