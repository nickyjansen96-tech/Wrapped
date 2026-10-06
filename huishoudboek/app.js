"use strict";
/* ---------- vaste indeling ---------- */
const GROUPS=[
 {name:"Inkomsten",kind:"in",cats:["Salaris of uitkering","Toeslagen","Overige inkomsten"]},
 {name:"Vaste lasten",kind:"uit",cats:["Wonen","Energie en water","Gemeentelijke en waterschapsbelastingen","Verzekeringen","Abonnementen","Vervoer","Kinderopvang en schoolkosten","Aflossingen","Bijdrage vastelastenrekening"]},
 {name:"Variabele uitgaven",kind:"uit",cats:["Boodschappen","Brandstof, parkeren en OV","Kleding en schoenen","Persoonlijke verzorging","Uit eten, uitgaan en hobby's","Cadeaus en donaties","Huisdieren"]},
 {name:"Reserveringen",kind:"uit",cats:["Onderhoud huis, tuin en auto","Vervanging inventaris en apparaten","Eigen risico en zorgkosten","Vakantie"]},
 {name:"Sparen en beleggen",kind:"spaar",cats:["Buffer","Spaardoelen","Pensioen of beleggingen"]}
];
const UNK="Onbekend";
const ALLCATS=GROUPS.flatMap(g=>g.cats);
const MONTHS=["Jan","Feb","Mrt","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];
const MONTHS_LONG=["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
const APP_VERSION="10";
const TABS=["overzicht","vermogen","transacties","regels","importeren"];

/* ---------- toestand ---------- */
const S={ready:false,tx:[],months:{},rules:[],overrides:{},budgets:{},wealth:{},
  tab:"overzicht",year:null,month:0,fCat:"",fText:"",fUnk:false,shown:50,onlyMonth:false,ruleFor:null,rFilter:"",importMsg:"",backupMsg:"",ai:{text:"",sugg:null,msg:""}};
const $=s=>document.querySelector(s);
const el=(tag,attrs={},...kids)=>{const e=document.createElement(tag);
  for(const[k,v]of Object.entries(attrs)){ if(k==="class")e.className=v; else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);
    else if(k.startsWith("aria-"))e.setAttribute(k,String(v)); else if(v===true)e.setAttribute(k,""); else if(v!==false&&v!=null)e.setAttribute(k,v);}
  for(const k of kids.flat()){ if(k==null||k===false)continue; e.append(k.nodeType?k:document.createTextNode(String(k)));} return e;};
const eur0=new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const eur2=new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"});
const f0=n=>Math.abs(n)<0.5?"–":eur0.format(n);

/* ---------- categoriseren ---------- */
const strip=s=>String(s).replace(/\s+/g,"").toLowerCase();
let compiled=[];
function compileOne(r){ const k=strip(r.k);
  return k.includes("*")?{re:new RegExp(k.split("*").map(p=>p.replace(/[.+?^${}()|[\]\\]/g,"\\$&")).join(".*")),c:r.c,r}:{k,c:r.c,r}; }
const matches=(c,t)=>{ const s=t.s||(t.s=strip(t.t)); return c.re?c.re.test(s):s.includes(c.k); };
function compileRules(){ compiled=S.rules.filter(r=>r.k&&r.k.trim()).map(compileOne);
  for(const t of S.tx)t.auto=undefined; }
function autoCat(t){ if(t.auto!==undefined)return t.auto; const s=t.s||(t.s=strip(t.t)); t.hit=null;
  for(const c of compiled){ if(c.re?c.re.test(s):s.includes(c.k)){t.hit=c.r;return t.auto=c.c;} } return t.auto=UNK; }
const catOf=t=>S.overrides[t.i]||autoCat(t);
function who(d){ let m=/\/NAME\/([^/]*)/.exec(d)||/Naam: (.*?)(\s{2,}|Omschrijving|$)/.exec(d);
  if(m){ const o=/(?:Omschrijving: |\/REMI\/)(.*?)(?:\s{2,}|\/|Kenmerk:|$)/.exec(d); return [m[1].trim(),o?o[1].trim():""]; }
  if(/^(BEA|GEA|eCom)/.test(d)){ const rest=d.slice(33); const i=rest.indexOf(",PAS"); return [(i>0?rest.slice(0,i):rest.slice(0,30)).trim(),""]; }
  return [d.replace(/\s+/g," ").slice(0,40),""]; }

/* ---------- profielen ---------- */
const PROFILES=[{id:"nicky",name:"Nicky"},{id:"heleen",name:"Heleen"}];
const LAST_PROFILE="hhb-profiel";
let profile=(()=>{ try{ const p=localStorage.getItem(LAST_PROFILE); if(PROFILES.some(x=>x.id===p))return p; }catch(e){} return PROFILES[0].id; })();
const profileName=()=>PROFILES.find(p=>p.id===profile).name;

/* ---------- opslag (lokaal op dit toestel, per profiel) ---------- */
const prefix=()=>"hhb:"+profile+":";
const store={
  ok:(()=>{ try{ localStorage.setItem("hhb-probe","1"); localStorage.removeItem("hhb-probe"); return true; }catch(e){ return false; } })(),
  get(id){ try{ const v=localStorage.getItem(prefix()+id); return v?JSON.parse(v):null; }catch(e){ return null; } },
  set(id,data){ localStorage.setItem(prefix()+id,JSON.stringify(data)); },
  del(id){ try{ localStorage.removeItem(prefix()+id); }catch(e){} },
  keys(){ const out=[],P=prefix(); try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith(P))out.push(k.slice(P.length)); } }catch(e){} return out; }
};
// Gegevens van vóór de profielen (sleutels "hhb:rules", "hhb:tx-…") gaan naar het eerste profiel.
function migrateLegacy(){ try{ const old=[]; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith("hhb:")&&!k.slice(4).includes(":"))old.push(k); }
  for(const k of old){ const to="hhb:"+PROFILES[0].id+":"+k.slice(4); if(localStorage.getItem(to)==null)localStorage.setItem(to,localStorage.getItem(k)); localStorage.removeItem(k); } }catch(e){} }
// Wijzigingen worden kort gebundeld en dan weggeschreven; bij wisselen van profiel of sluiten van de app direct.
const pend={}; let saveTimer=0;
function setSave(msg,err){const s=$("#save"); s.textContent=msg; s.classList.toggle("err",!!err);}
function save(docId,getData){ if(!store.ok)return; pend[docId]=getData; clearTimeout(saveTimer); saveTimer=setTimeout(flushSaves,300); setSave("Opslaan…"); }
function flushSaves(){ clearTimeout(saveTimer); const ids=Object.keys(pend); if(!ids.length)return;
  try{ for(const id of ids){ store.set(id,pend[id]()); delete pend[id]; } setSave("Opgeslagen"); }
  catch(e){ setSave(e&&e.name==="QuotaExceededError"?"Opslag is vol; maak een back-up en verwijder oude maanden.":"Niet opgeslagen. Probeer het opnieuw.",true); } }
function dropSaves(){ clearTimeout(saveTimer); for(const id of Object.keys(pend))delete pend[id]; }
const saveOverrides=()=>save("overrides",()=>({map:S.overrides}));
const saveRules=()=>save("rules",()=>({list:S.rules.map(r=>({k:r.k,c:r.c}))}));
const saveWealth=()=>save("wealth",()=>({years:S.wealth}));
const saveBudgets=()=>save("budgets",()=>({years:S.budgets}));
const saveMonth=key=>save("tx-"+key,()=>({rows:S.months[key].map(t=>({i:t.i,d:t.d,a:t.a,t:t.t}))}));
const saveAll=()=>{ saveOverrides(); saveRules(); saveWealth(); saveBudgets(); for(const k of Object.keys(S.months))saveMonth(k); };

function loadDoc(id,v){ v=v||{};
  if(id==="rules")S.rules=(v.list||[]).map(r=>({k:String(r.k??""),c:String(r.c??ALLCATS[0])}));
  else if(id==="overrides")S.overrides=Object.assign({},v.map||{});
  else if(id==="wealth")S.wealth=JSON.parse(JSON.stringify(v.years||{}));
  else if(id==="budgets")S.budgets=JSON.parse(JSON.stringify(v.years||{}));
  else if(id.startsWith("tx-"))S.months[id.slice(3)]=(v.rows||[]).map(r=>({i:String(r.i),d:+r.d,a:+r.a,t:String(r.t??"")})); }
function indexTx(){ S.tx=Object.values(S.months).flat().sort((a,b)=>b.d-a.d); }
function resetData(){ S.months={}; S.rules=[]; S.overrides={}; S.budgets={}; S.wealth={}; S.tx=[];
  Object.assign(S,{year:null,month:0,fCat:"",fText:"",fUnk:false,shown:50,onlyMonth:false,ruleFor:null,rFilter:"",importMsg:"",backupMsg:"",ai:{text:"",sugg:null,msg:""},editBudget:false,showEmpty:false,bOpen:null}); }
function loadProfile(){ resetData();
  if(store.ok){ for(const id of store.keys())loadDoc(id,store.get(id)); }
  indexTx(); compileRules(); pickDefaults();
  document.title="Huishoudboek · "+profileName(); }
function switchProfile(id){ if(id===profile)return; flushSaves(); profile=id;
  try{ localStorage.setItem(LAST_PROFILE,id); }catch(e){}
  loadProfile(); if(!S.tx.length)S.tab="importeren"; setSave(""); go(); }
function setProfileQuiet(id){ flushSaves(); profile=id; try{ localStorage.setItem(LAST_PROFILE,id); }catch(e){} loadProfile(); setSave(""); }
function boot(){
  migrateLegacy(); loadProfile();
  if(!store.ok)setSave("Opslaan is in deze browser niet beschikbaar; wijzigingen blijven niet bewaard.",true);
  try{ navigator.storage?.persist?.(); }catch(e){}
  S.ready=true;
  const h=location.hash.slice(1)==="budgetten"?"overzicht":location.hash.slice(1); if(TABS.includes(h))S.tab=h; else if(!S.tx.length)S.tab="importeren";
  const st=history.state; if(st&&st.profile===profile&&(TABS.includes(st.tab)||st.tab==="budgetten"))restoreView(st);
  try{ history.replaceState(viewState(st&&st.n||0),"","#"+S.tab); }catch(e){}
  render();
}
function years(){ return [...new Set(S.tx.map(t=>Math.floor(t.d/10000)))].sort((a,b)=>b-a); }
function pickDefaults(){ const ys=years(); if(!ys.length){S.year=new Date().getFullYear();S.month=0;return;}
  if(!ys.includes(S.year))S.year=ys[0];
  const cnt=Array(13).fill(0); for(const t of S.tx) if(Math.floor(t.d/10000)===S.year)cnt[Math.floor(t.d/100)%100]++;
  let m=0; for(let i=12;i>=1;i--) if(cnt[i]>=10){m=i;break;} S.month=m; }

/* ---------- rekenen ---------- */
function totals(year){ const T={}; let unkN=Array(13).fill(0),unkSum=Array(13).fill(0),min=0,max=0,cnt=Array(13).fill(0);
  for(const t of S.tx){ if(Math.floor(t.d/10000)!==year)continue; const m=Math.floor(t.d/100)%100,c=catOf(t); cnt[m]++;
    if(!min||t.d<min)min=t.d; if(t.d>max)max=t.d;
    if(c===UNK){unkN[m]++;unkN[0]++;unkSum[m]+=t.a;unkSum[0]+=t.a;continue;}
    const a=T[c]||(T[c]=Array(13).fill(0)); a[m]+=t.a; a[0]+=t.a; }
  const dt=n=>Date.UTC(Math.floor(n/10000),Math.floor(n/100)%100-1,n%100);
  const span=min?Math.max(1,((dt(max)-dt(min))/864e5+1)/30.4375):1;
  return {T,unkN,unkSum,cnt,span}; }
function budgetOf(year,cat,m){ const b=(S.budgets[year]||{})[cat]; if(!b)return 0;
  if(m===0){let s=0;for(let i=1;i<=12;i++)s+=budgetOf(year,cat,i);return s;}
  const o=b.m&&b.m[m]; return o!=null?o:(b.base||0); }
function setBudget(year,cat,m,val,onlyMonth){ const y=S.budgets[year]||(S.budgets[year]={}); const b=y[cat]||(y[cat]={base:0,m:{}}); if(!b.m)b.m={};
  if(onlyMonth)b.m[m]=val; else{ b.base=val; delete b.m[m]; } saveBudgets(); }
const actual=(g,v)=>g.kind==="in"?v:-v;

/* ---------- weergave ---------- */
function render(){
  for(const b of document.querySelectorAll("#tabs button"))b.setAttribute("aria-selected",b.dataset.tab===S.tab);
  const cur=document.querySelector('#tabs button[aria-selected="true"]'); if(cur&&cur.scrollIntoView)cur.scrollIntoView({block:"nearest",inline:"nearest"});
  $("#back").hidden=!(history.state&&history.state.n>0);
  renderProfiles(); renderRail(); const main=$("#main"); main.replaceChildren();
  if(!S.ready){main.append(el("div",{class:"empty"},"Gegevens laden…"));return;}
  ({overzicht:viewOverview,vermogen:viewWealth,transacties:viewTx,regels:viewRules,importeren:viewImport})[S.tab](main);
}
function renderProfiles(){ const box=$("#profiles"); box.replaceChildren(...PROFILES.map(p=>el("button",{class:"seg","aria-pressed":p.id===profile,onclick:()=>switchProfile(p.id)},p.name))); }
// Jaren als knoppen naast elkaar (oudste links), zodat je met één tik wisselt.
function yearSwitch(ys,pick){ return el("div",{class:"yearseg",role:"group","aria-label":"Jaar"},ys.map(y=>el("button",{class:"seg","aria-pressed":y===S.year,onclick:()=>{ if(y!==S.year)pick(y); }},y))); }
function renderRail(){ const rail=$("#rail"); rail.replaceChildren();
  const ov=S.tab==="overzicht";
  rail.hidden=S.tab==="regels"||S.tab==="importeren"||(!ov&&!S.tx.length); if(rail.hidden)return;
  // Op het overzicht kun je ook jaren zonder transacties kiezen (bijv. volgend jaar), om alvast te begroten.
  const ys=ov?budgetYears():years().slice().reverse(); if(!ys.includes(S.year))S.year=ov?(years()[0]||new Date().getFullYear()):ys[ys.length-1];
  rail.append(yearSwitch(ys,y=>{S.year=y;S.shown=50;render();})); if(ov&&S.editBudget)return; if(S.tab==="vermogen")return; const {cnt}=totals(S.year);
  rail.append(el("button",{class:"chip","aria-pressed":S.month===0,onclick:()=>{S.month=0;S.shown=50;render();}},"Heel jaar"));
  MONTHS.forEach((n,i)=>rail.append(el("button",{class:"chip"+(cnt[i+1]?"":" off"),"aria-pressed":S.month===i+1,onclick:()=>{S.month=i+1;S.shown=50;render();}},n)));
}
function periodLabel(){ return S.month?MONTHS_LONG[S.month-1]+" "+S.year:"heel "+S.year; }

/* overzicht staat verderop, bij de budgetfuncties */
function diffCell(grp,a,b){ const d=grp.kind==="uit"?b-a:a-b; if(!b&&Math.abs(a)<0.5)return el("span",{class:"num"},"–");
  return el("span",{class:"num "+(d<-0.5?"neg":d>0.5?"pos":"")},(d>0.5?"+":"")+eur0.format(d)); }
function meter(grp,a,b){ if(!b)return el("div",{class:"meter none",role:"img","aria-label":"Geen budget"},el("i",{style:"width:"+(a>0.5?100:0)+"%"}));
  const p=Math.max(0,a/b), over=grp.kind==="uit"?p>1.005:false;
  return el("div",{class:"meter"+(over?" over":""),role:"img","aria-label":Math.round(p*100)+"% van budget"},el("i",{style:"width:"+Math.min(100,p*100)+"%"})); }

function catSelect(value,onchange,opts={}){ const s=el("select",{class:"cat"+(opts.cls?" "+opts.cls:""),"aria-label":"Categorie",onchange:e=>onchange(e.target.value)});
  if(opts.auto)s.append(el("option",{value:"",title:"Automatisch via een regel"},opts.auto===UNK?"Kies categorie":opts.auto));
  for(const g of GROUPS){ const og=el("optgroup",{label:g.name}); for(const c of g.cats)og.append(el("option",{value:c,selected:c===value},c)); s.append(og); }
  if(opts.auto&&!value)s.value=""; return s; }

function viewTx(main){
  const m=S.month,q=strip(S.fText);
  const inPeriod=S.tx.filter(t=>Math.floor(t.d/10000)===S.year&&(!m||Math.floor(t.d/100)%100===m));
  const unkCount=inPeriod.filter(t=>catOf(t)===UNK).length;
  const list=inPeriod.filter(t=>(!S.fUnk||catOf(t)===UNK)&&(!S.fCat||catOf(t)===S.fCat)&&(!q||(t.s||(t.s=strip(t.t))).includes(q)));
  const fsel=el("select",{id:"fcat","aria-label":"Filter op categorie",onchange:e=>{S.fCat=e.target.value;S.shown=50;render();}},el("option",{value:""},"Alle categorieën"),
    GROUPS.map(g=>el("optgroup",{label:g.name},g.cats.map(c=>el("option",{value:c,selected:c===S.fCat},c)))));
  main.append(el("div",{class:"tools field"},
    el("input",{id:"ftext",class:"grow",type:"search",placeholder:"Zoeken",value:S.fText,oninput:e=>{S.fText=e.target.value;S.shown=50;clearTimeout(viewTx.t);viewTx.t=setTimeout(()=>{render();const i=$("#ftext");i.focus();i.setSelectionRange(i.value.length,i.value.length);},250);}}),
    fsel, (unkCount||S.fUnk)?el("button",{class:"chip toggle",id:"funk","aria-pressed":S.fUnk,onclick:()=>{S.fUnk=!S.fUnk;S.shown=50;render();}},"Zonder categorie ("+unkCount+")"):null));
  const sum=list.reduce((s,t)=>s+t.a,0);
  if(!list.length){main.append(el("div",{class:"empty"},"Geen transacties voor deze selectie."));return;}
  const sec=el("section",{class:"group"});
  sec.append(el("div",{class:"ghead"},el("span",{},list.length+" transacties"),el("span",{class:"num"},eur2.format(sum))));
  for(const t of list.slice(0,S.shown)){ const [name,det]=who(t.t); const auto=autoCat(t),man=S.overrides[t.i]||"";
    const sel=catSelect(man,v=>{ if(v)S.overrides[t.i]=v; else delete S.overrides[t.i]; saveOverrides(); render(); },{auto,cls:man?"man":auto===UNK?"unk":""});
    const d=String(t.d); const row=el("div",{class:"tx"},
      el("span",{class:"date"},d.slice(6)+"-"+d.slice(4,6)),
      el("div",{class:"txt"},el("div",{class:"who"},name),det?el("div",{class:"det"},det):null),
      el("span",{class:"num amt "+(t.a<0?"":"pos")},eur2.format(t.a)), sel,
      el("button",{class:"icon","aria-label":"Regel maken voor "+name,title:"Regel maken: voortaan automatisch deze categorie","aria-expanded":S.ruleFor===t.i,onclick:()=>{S.ruleFor=S.ruleFor===t.i?null:t.i;render();}},"+"));
    if(S.ruleFor===t.i){ const kin=el("input",{class:"txt grow",id:"newrule-k",value:name,"aria-label":"Trefwoord"}); let rc=catOf(t)===UNK?"":catOf(t);
      row.append(el("div",{class:"mk"},"Altijd",catSelect(rc,v=>{rc=v;},{auto:UNK}),"als de omschrijving bevat:",kin,
        el("button",{class:"btn sm pri",onclick:()=>{ const k=kin.value.trim(); if(!k||!rc){ if(!rc)alert("Kies eerst een categorie."); return; } S.rules.unshift({k,c:rc}); compileRules(); saveRules(); S.ruleFor=null; render(); }},"Opslaan")));
    }
    sec.append(row); }
  main.append(sec);
  if(list.length>S.shown)main.append(el("button",{class:"linkbtn",onclick:()=>{S.shown+=200;render();}},"Meer tonen ("+(list.length-S.shown)+")"));
}

/* ---------- regels laten maken door Claude ---------- */
// Bouwt een vraag voor Claude met de tegenpartijen zonder categorie. Alleen naam, korte omschrijving,
// aantal en bedragen gaan mee; geen rekeningnummers.
function claudePrompt(){
  const groups=new Map();
  for(const t of S.tx){ if(catOf(t)!==UNK)continue; const [name,det]=who(t.t); const key=name.toLowerCase();
    const g=groups.get(key)||{name,det:det.slice(0,60),n:0,sum:0,last:0}; g.n++; g.sum+=t.a; g.last=Math.max(g.last,t.d); groups.set(key,g); }
  const list=[...groups.values()].sort((a,b)=>b.n-a.n||Math.abs(b.sum)-Math.abs(a.sum)).slice(0,200);
  if(!list.length)return null;
  const lines=list.map(g=>"- "+g.name+(g.det?" | "+g.det:"")+" | "+g.n+"× | totaal "+g.sum.toFixed(2).replace(".",","));
  const cats=GROUPS.map(g=>g.name+": "+g.cats.join("; ")).join("\n");
  const have=S.rules.length?S.rules.slice(0,150).map(r=>"- "+r.k+" → "+r.c).join("\n"):"(nog geen)";
  return ["Ik gebruik een huishoudboekje-app voor mijn ABN AMRO-rekening. Wil je regels maken die mijn transacties automatisch in een categorie zetten?",
    "","Zo werken regels: als het trefwoord in de omschrijving van een transactie staat, krijgt die transactie de categorie. Hoofdletters en spaties tellen niet mee; * is een joker (bijv. \"Albert*Heijn\"). Maak trefwoorden specifiek genoeg dat ze geen andere winkels raken, maar algemeen genoeg dat ze ook toekomstige transacties van dezelfde partij vangen (laat filiaalnummers en datums weg).",
    "","Gebruik alleen deze categorieën, precies zo geschreven:",cats,
    "","Bij de bedragen: min is geld eruit, plus is geld erin. Overboekingen naar eigen spaarrekeningen horen bij Buffer of Spaardoelen. Als je echt niet weet wat iets is, sla het dan over en noem het onder de JSON-code.",
    "","Regels die ik al heb:",have,
    "","Tegenpartijen zonder categorie (naam | omschrijving | aantal | totaal in euro):",...lines,
    "","Geef je antwoord als één JSON-codeblok in deze vorm, zodat ik het in de app kan plakken:",
    '```json\n{"regels":[{"trefwoord":"Albert Heijn","categorie":"Boodschappen"}]}\n```'].join("\n"); }
function parseClaude(text){
  const m=/```(?:json)?\s*([\s\S]*?)```/.exec(text); const raw=(m?m[1]:text).trim();
  const from=raw.search(/[[{]/); if(from<0)return null;
  let v; try{ v=JSON.parse(raw.slice(from)); }catch(e){ const end=Math.max(raw.lastIndexOf("}"),raw.lastIndexOf("]")); try{ v=JSON.parse(raw.slice(from,end+1)); }catch(e2){ return null; } }
  const arr=Array.isArray(v)?v:(v.regels||v.rules||[]); if(!Array.isArray(arr))return null;
  const byLower=new Map(ALLCATS.map(c=>[c.toLowerCase(),c])); const have=new Set(S.rules.map(r=>strip(r.k))); const seen=new Set(); const out=[];
  for(const x of arr){ const k=String(x?.trefwoord??x?.k??x?.keyword??"").trim(), c=byLower.get(String(x?.categorie??x?.c??x?.category??"").trim().toLowerCase());
    if(!k||strip(k).length<2)continue; const sk=strip(k); if(seen.has(sk))continue; seen.add(sk);
    out.push({k,c:c||ALLCATS[0],ok:!!c&&!have.has(sk),known:have.has(sk),badCat:!c}); }
  return out; }
function suggestionHits(sg){ const c=compileOne(sg); let n=0; for(const t of S.tx) if(catOf(t)===UNK&&matches(c,t))n++; return n; }
async function copyText(text){ try{ await navigator.clipboard.writeText(text); return true; }catch(e){ return false; } }
function viewClaude(main){
  const unk=S.tx.filter(t=>catOf(t)===UNK).length, prompt=unk?claudePrompt():null, sg=S.ai.sugg;
  const card=el("div",{class:"card"},el("div",{class:"herotop"},el("div",{},el("h2",{},"Laat Claude regels maken"),
    el("div",{class:"prose"},unk?unk+" transacties hebben nog geen categorie.":"Alle transacties hebben een categorie."))));
  if(prompt||S.ai.open){ const tools=el("div",{class:"tools"});
    if(prompt)tools.append(el("button",{class:"btn pri",onclick:async()=>{ const ok=await copyText(prompt); S.ai.msg=ok?"Gekopieerd. Plak de vraag in een nieuwe chat in de Claude-app en kopieer het antwoord.":"Kopiëren lukte niet; kopieer de vraag hieronder zelf."; S.ai.showPrompt=!ok; S.ai.open=true; render(); }},"1. Vraag kopiëren"));
    tools.append(el("button",{class:"btn"+(S.ai.open?" on":""),onclick:()=>{S.ai.open=!S.ai.open;render();}},"2. Antwoord plakken"));
    if(prompt)tools.append(el("button",{class:"linkbtn",onclick:()=>{S.ai.showPrompt=!S.ai.showPrompt;render();}},S.ai.showPrompt?"Vraag verbergen":"Wat wordt gedeeld?"));
    card.append(tools); }
  if(S.ai.showPrompt&&prompt)card.append(el("p",{class:"prose"},"Alleen namen, korte omschrijvingen en bedragen; geen rekeningnummers."),el("textarea",{class:"txt area",readonly:true,rows:8,"aria-label":"Vraag voor Claude",onfocus:e=>e.target.select()},prompt));
  if(S.ai.msg)card.append(el("div",{class:"note info",role:"status"},S.ai.msg));
  if(S.ai.open&&!sg){ card.append(el("textarea",{class:"txt area",id:"ai-answer",rows:4,placeholder:"Plak hier het antwoord van Claude","aria-label":"Antwoord van Claude",oninput:e=>{S.ai.text=e.target.value;}},S.ai.text),
    el("div",{class:"tools"},el("button",{class:"btn pri",onclick:()=>{ const r=parseClaude(S.ai.text);
      if(!r||!r.length){ S.ai.msg="Hierin staan geen regels die de app kan lezen. Vraag Claude om het antwoord als JSON-codeblok."; }
      else{ for(const x of r)x.hits=suggestionHits(x); S.ai.sugg=r; S.ai.msg=""; } render(); }},"Inlezen"))); }
  if(sg){ const sec=el("section",{class:"group sugg"});
    for(const x of sg){ sec.append(el("div",{class:"rule"},
      el("label",{class:"pick"},el("input",{type:"checkbox",checked:x.ok,"aria-label":"Regel gebruiken",onchange:e=>{x.ok=e.target.checked;render();}}),
        el("input",{class:"txt",value:x.k,"aria-label":"Trefwoord",onchange:e=>{x.k=e.target.value;x.hits=suggestionHits(x);render();}})),
      catSelect(x.c,v=>{x.c=v;x.badCat=false;}),
      el("span",{class:"num muted",title:x.known?"Bestaat al":x.badCat?"Kies een categorie":"Aantal transacties zonder categorie dat deze regel raakt"},x.known?"bestaat":x.badCat?"?":x.hits+"×"))); }
    const n=sg.filter(x=>x.ok&&x.k.trim()).length;
    card.append(sec,el("div",{class:"tools"},el("button",{class:"btn pri",disabled:!n,onclick:()=>{
      const add=sg.filter(x=>x.ok&&x.k.trim()).map(x=>({k:x.k.trim(),c:x.c})); const before=S.tx.filter(t=>catOf(t)===UNK).length;
      S.rules.push(...add); compileRules(); saveRules(); const after=S.tx.filter(t=>catOf(t)===UNK).length;
      S.ai={text:"",sugg:null,msg:add.length+(add.length===1?" regel":" regels")+" toegevoegd; "+(before-after)+" transacties ingedeeld"+(after?", "+after+" nog niet.":".")}; render(); }},
      n+(n===1?" regel":" regels")+" toevoegen"),el("button",{class:"btn",onclick:()=>{S.ai={text:"",sugg:null,msg:"",open:true};render();}},"Annuleren")));
  }
  main.append(card); }

function viewRules(main){
  viewClaude(main);
  for(const t of S.tx)autoCat(t); const hits=new Map(); for(const t of S.tx)if(t.hit)hits.set(t.hit,(hits.get(t.hit)||0)+1);
  let nc=""; const nk=el("input",{class:"txt grow",id:"addrule-k",placeholder:"Trefwoord, bijv. Albert Heijn"});
  const add=()=>{const k=nk.value.trim();if(!k)return; if(!nc){alert("Kies eerst een categorie.");return;}S.rules.unshift({k,c:nc});compileRules();saveRules();render();};
  nk.addEventListener("keydown",e=>{if(e.key==="Enter")add();});
  main.append(el("div",{class:"addrule"},nk,catSelect(nc,v=>{nc=v;},{auto:UNK}),el("button",{class:"btn pri",onclick:add},"Toevoegen")));
  if(S.rules.length>15||S.rFilter)main.append(el("div",{class:"tools field"},el("input",{id:"rfilter",class:"grow",type:"search",placeholder:"Zoek in "+S.rules.length+" regels",value:S.rFilter,oninput:e=>{S.rFilter=e.target.value;clearTimeout(viewRules.t);viewRules.t=setTimeout(()=>{render();const i=$("#rfilter");i.focus();i.setSelectionRange(i.value.length,i.value.length);},250);}})));
  const q=S.rFilter.toLowerCase(); const sec=el("section",{class:"group"});
  if(S.rules.length)sec.append(el("div",{class:"ghead"},el("span",{},S.rules.length+" regels"),el("span",{class:"of"},"bovenste regel gaat voor")));
  S.rules.forEach((r,idx)=>{ if(q&&!(r.k.toLowerCase().includes(q)||r.c.toLowerCase().includes(q)))return;
    sec.append(el("div",{class:"rule"},
      el("input",{class:"txt",value:r.k,"aria-label":"Trefwoord",onchange:e=>{r.k=e.target.value;compileRules();saveRules();render();}}),
      catSelect(r.c,v=>{r.c=v;compileRules();saveRules();render();}),
      el("span",{class:"num muted",title:"Aantal transacties dat deze regel raakt"},(hits.get(r)||0)+"×"),
      el("span",{class:"acts"},idx>0?el("button",{class:"icon",title:"Naar boven (voorrang)","aria-label":"Regel naar boven",onclick:()=>{S.rules.splice(idx,1);S.rules.unshift(r);compileRules();saveRules();render();}},"↑"):el("span",{class:"icon-sp"}),
        el("button",{class:"icon",title:"Verwijderen","aria-label":"Regel verwijderen",onclick:()=>{S.rules.splice(idx,1);compileRules();saveRules();render();}},"×")))); });
  if(!S.rules.length)sec.append(el("div",{class:"empty"},"Nog geen regels."));
  else if(sec.children.length===1)sec.append(el("div",{class:"empty"},"Geen regels gevonden."));
  main.append(sec);
}

/* ---------- budgetten voor het hele jaar ---------- */
const parseAmount=v=>Math.max(0,parseFloat(String(v).replace(/\s|€/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",","."))||0);
const fmtIn=v=>!v?"":(Math.abs(v-Math.round(v))<0.005?String(Math.round(v)):v.toFixed(2).replace(".",","));
function budgetYears(){ const now=new Date().getFullYear(), ys=new Set([...years(),now,now+1,...Object.keys(S.budgets).map(Number)]); return [...ys].filter(Boolean).sort((a,b)=>a-b); }
// Referentie: het gemiddelde per maand in het gekozen jaar, of in het jaar ervoor als het gekozen jaar nog geen transacties heeft.
function budgetRef(year){ const has=y=>S.tx.some(t=>Math.floor(t.d/10000)===y); const ry=has(year)?year:has(year-1)?year-1:null;
  if(ry==null)return {year:null,avg:()=>0}; const {T,span}=totals(ry);
  return {year:ry,avg:(grp,c)=>actual(grp,(T[c]||[])[0]||0)/span}; }
const roundBudget=v=>v>=50?Math.round(v/5)*5:Math.round(v);
function setYearBudget(year,cat,{month,yearTotal}){ const y=S.budgets[year]||(S.budgets[year]={}); const b=y[cat]||(y[cat]={base:0,m:{}});
  if(yearTotal!=null){ b.base=yearTotal/12; b.m={}; } else b.base=month;
  if(!b.base&&!Object.keys(b.m||{}).length)delete y[cat]; saveBudgets(); }
function setMonthBudget(year,cat,m,val){ const y=S.budgets[year]||(S.budgets[year]={}); const b=y[cat]||(y[cat]={base:0,m:{}}); if(!b.m)b.m={};
  if(Math.abs(val-(b.base||0))<0.005)delete b.m[m]; else b.m[m]=val; saveBudgets(); }
function nextOnEnter(e){ if(e.key!=="Enter")return; e.preventDefault(); const col=e.target.dataset.col; const all=[...document.querySelectorAll('#main input.bin[data-col="'+col+'"]')]; const i=all.indexOf(e.target); (all[i+1]||e.target).focus(); }
/* ---------- overzicht en budget ---------- */
// Twee standen: "bekijken" (hoe sta ik ervoor) en "budget bewerken" (bedragen invullen). Zo staat er nooit alles tegelijk op het scherm.
function ovCtx(){ const Y=S.year,m=S.month,{T,unkN,unkSum,cnt}=totals(Y); let upto=0,from=0; for(let k=12;k>=1;k--) if(cnt[k]){upto=k;break;} for(let k=1;k<=12;k++) if(cnt[k]){from=k;break;}
  return {Y,m,T,unkN,unkSum,from,upto,ref:budgetRef(Y)}; }
// Budget om mee te vergelijken: de gekozen maand, of bij heel jaar alleen de maanden waarover transacties zijn ingelezen.
function cmpBudget(x,c){ if(x.m)return budgetOf(x.Y,c,x.m); if(!x.upto)return budgetOf(x.Y,c,0); let s=0; for(let k=x.from;k<=x.upto;k++)s+=budgetOf(x.Y,c,k); return s; }
const actOf=(x,grp,c)=>actual(grp,(x.T[c]||[])[x.m]||0);
const hasOwnMonths=(Y,c)=>{ const b=(S.budgets[Y]||{})[c]; return !!(b&&b.m&&Object.keys(b.m).length); };
const groupSum=(grp,fn)=>grp.cats.reduce((s,c)=>s+fn(c),0);
const kinds=fn=>({inc:groupSum(GROUPS[0],fn),uit:groupSum(GROUPS[1],fn)+groupSum(GROUPS[2],fn)+groupSum(GROUPS[3],fn),sp:groupSum(GROUPS[4],fn)});
const anyBudget=Y=>ALLCATS.some(c=>budgetOf(Y,c,0)>0);
function viewOverview(main){ if(S.editBudget)viewBudgetEdit(main); else viewStatus(main); }

function viewStatus(main){
  const x=ovCtx(), hasB=anyBudget(x.Y);
  const A=kinds(c=>{ const g=GROUPS.find(g=>g.cats.includes(c)); return actOf(x,g,c); }), B=kinds(c=>cmpBudget(x,c)), rest=A.inc-A.uit-A.sp;
  const per=S.month?MONTHS_LONG[S.month-1]+" "+S.year:String(S.year);
  const stat=(l,v,b)=>el("div",{class:"stat"},el("div",{class:"l"},l),el("div",{class:"v"},eur0.format(v)),el("div",{class:"s"},hasB?"van "+eur0.format(b):" "));
  main.append(el("div",{class:"card hero"},
    el("div",{class:"herotop"},el("div",{},el("div",{class:"l"},"Over in "+per),el("div",{class:"big "+(rest<-0.5?"neg":"pos")},eur0.format(rest))),
      el("button",{class:"btn"+(hasB?"":" pri"),onclick:()=>{S.editBudget=true;render();window.scrollTo(0,0);}},hasB?"Budget bewerken":"Budget invullen")),
    el("div",{class:"stats"},stat("Inkomsten",A.inc,B.inc),stat("Uitgaven",A.uit,B.uit),stat("Gespaard",A.sp,B.sp))));
  if(!S.tx.length){ main.append(el("div",{class:"note info"},"Nog geen transacties ingelezen.",el("button",{class:"btn sm",onclick:()=>{S.tab="importeren";go();}},"Importeren"))); return; }
  if(x.unkN[x.m])main.append(el("div",{class:"note"},x.unkN[x.m]+" transacties zonder categorie",el("button",{class:"btn sm",onclick:()=>{S.tab="transacties";S.fUnk=true;S.fCat="";S.shown=50;go();}},"Toewijzen")));
  let hidden=0;
  GROUPS.forEach(grp=>{ const rows=[]; let ga=0,gb=0;
    for(const c of grp.cats){ const a=actOf(x,grp,c), b=cmpBudget(x,c); ga+=a; gb+=b;
      if(!S.showEmpty&&Math.abs(a)<0.5&&b<0.5){hidden++;continue;} rows.push(catLine(grp,c,a,b)); }
    if(!rows.length)return;
    main.append(el("section",{class:"group"},el("div",{class:"ghead"},el("span",{},grp.name),el("span",{class:"num"},eur0.format(ga),gb?el("span",{class:"of"}," van "+eur0.format(gb)):null)),...rows)); });
  if(hidden||S.showEmpty)main.append(el("button",{class:"linkbtn",onclick:()=>{S.showEmpty=!S.showEmpty;render();}},S.showEmpty?"Lege categorieën verbergen":"Lege categorieën tonen ("+hidden+")"));
}
function catLine(grp,c,a,b){ const over=grp.kind==="uit"&&b>0&&a>b+0.5, p=b>0?Math.max(0,Math.min(1,a/b)):0;
  return el("button",{class:"cline",onclick:()=>{S.tab="transacties";S.fCat=c;S.fUnk=false;S.shown=50;go();}},
    el("span",{class:"cn"},c),
    el("span",{class:"cv"},el("span",{class:"num"+(over?" neg":"")},f0(a)),el("span",{class:"of"},b>0?"van "+eur0.format(b):"geen budget")),
    b>0?el("span",{class:"bar"+(over?" over":"")},el("i",{style:"width:"+(p*100)+"%"})):null); }

/* budget bewerken */
function budgetSummary(Y){ const P=kinds(c=>budgetOf(Y,c,0)/12), rest=P.inc-P.uit-P.sp;
  return el("div",{class:"bsum",id:"bsum"},el("span",{},"Per maand: in ",el("b",{},eur0.format(P.inc))),el("span",{},"uit ",el("b",{},eur0.format(P.uit))),el("span",{},"sparen ",el("b",{},eur0.format(P.sp))),
    el("span",{},"over ",el("b",{class:rest<-0.5?"neg":"pos"},eur0.format(rest)))); }
function editName(Y,ref,grp,c){ const i=ALLCATS.indexOf(c), a=ref.avg(grp,c);
  return el("div",{class:"en",id:"en-"+i},el("span",{},c),el("span",{class:"sub"},
    ref.year!=null&&a>=0.5?el("button",{class:"refbtn",title:"Overnemen als budget per maand",onclick:()=>{ setYearBudget(Y,c,{month:roundBudget(a)}); render(); }},"gem. "+eur0.format(a)):null,
    hasOwnMonths(Y,c)?el("span",{class:"tag"},"per maand anders"):null)); }
function editRow(Y,ref,grp,c){ const i=ALLCATS.indexOf(c), b=(S.budgets[Y]||{})[c], open=S.bOpen===c;
  const inp=(id,col,val,label,on)=>el("input",{class:"bin",id,"data-col":col,type:"text",inputmode:"decimal",enterkeyhint:"next",placeholder:"",value:fmtIn(val),"aria-label":label,onkeydown:nextOnEnter,onchange:on});
  const pm=inp("bm-"+i,"m",b?b.base||0:0,c+" per maand",e=>{ setYearBudget(Y,c,{month:parseAmount(e.target.value)}); e.target.value=fmtIn(parseAmount(e.target.value)); editRefresh(Y,ref,grp,c); });
  const pj=inp("by-"+i,"y",budgetOf(Y,c,0),c+" per jaar",e=>{ if(hasOwnMonths(Y,c)&&!confirm("De afwijkende maanden van "+c+" worden gelijk verdeeld. Doorgaan?")){e.target.value=fmtIn(budgetOf(Y,c,0));return;}
    setYearBudget(Y,c,{yearTotal:parseAmount(e.target.value)}); e.target.value=fmtIn(budgetOf(Y,c,0)); editRefresh(Y,ref,grp,c); });
  const wrap=el("div",{class:"erw"},el("div",{class:"erow"},editName(Y,ref,grp,c),pm,pj,
    el("button",{class:"btn sm exp","aria-expanded":open,"aria-label":"Per maand anders voor "+c,title:"Per maand anders",onclick:()=>{S.bOpen=open?null:c;render();}},open?"⌄":"›")));
  if(open){ const grid=el("div",{class:"bmonths"});
    MONTHS.forEach((mn,k)=>{ const own=b&&b.m&&b.m[k+1]!=null;
      grid.append(el("label",{class:own?"diff":""},mn,inp("bmm-"+i+"-"+(k+1),"mm"+i,budgetOf(Y,c,k+1),c+" "+MONTHS_LONG[k],e=>{ setMonthBudget(Y,c,k+1,parseAmount(e.target.value)); e.target.value=fmtIn(budgetOf(Y,c,k+1)); editRefresh(Y,ref,grp,c); }))); });
    wrap.append(el("div",{class:"bmwrap"},grid,el("button",{class:"btn sm",onclick:()=>{ const cur=(S.budgets[Y]||{})[c]; if(cur){cur.m={};saveBudgets();} render(); }},"Alle maanden gelijk"))); }
  return wrap; }
// Werkt na een wijziging alleen de bedragen bij, zonder de pagina opnieuw op te bouwen: zo blijven cursor en toetsenbord in het volgende veld.
function editRefresh(Y,ref,grp,c){ const i=ALLCATS.indexOf(c), act=document.activeElement, b=(S.budgets[Y]||{})[c];
  const pm=$("#bm-"+i), pj=$("#by-"+i); if(pm&&pm!==act)pm.value=fmtIn(b?b.base||0:0); if(pj&&pj!==act)pj.value=fmtIn(budgetOf(Y,c,0));
  for(let k=1;k<=12;k++){ const e=$("#bmm-"+i+"-"+k); if(!e)break; if(e!==act)e.value=fmtIn(budgetOf(Y,c,k)); e.parentNode.classList.toggle("diff",b?.m?.[k]!=null); }
  $("#en-"+i)?.replaceWith(editName(Y,ref,grp,c)); $("#bsum")?.replaceWith(budgetSummary(Y)); }
function viewBudgetEdit(main){
  const Y=S.year, ref=budgetRef(Y), yb=S.budgets[Y]||{};
  const more=[];
  if(ref.year!=null)more.push(el("button",{class:"btn sm",onclick:()=>{ for(const grp of GROUPS)for(const c of grp.cats){ if(budgetOf(Y,c,0))continue; const a=ref.avg(grp,c); if(a>=1)setYearBudget(Y,c,{month:roundBudget(a)}); } render(); }},"Lege vullen met gemiddelde"));
  if(S.budgets[Y-1]&&Object.keys(S.budgets[Y-1]).length)more.push(el("button",{class:"btn sm",onclick:()=>{ if(Object.keys(yb).length&&!confirm("Het budget van "+Y+" wordt vervangen door dat van "+(Y-1)+". Doorgaan?"))return; S.budgets[Y]=JSON.parse(JSON.stringify(S.budgets[Y-1])); saveBudgets(); render(); }},"Neem "+(Y-1)+" over"));
  if(Object.keys(yb).length)more.push(el("button",{class:"btn sm",onclick:()=>{ if(!confirm("Alle budgetten van "+Y+" wissen?"))return; delete S.budgets[Y]; saveBudgets(); render(); }},"Wissen"));
  main.append(el("div",{class:"card"},el("div",{class:"herotop"},el("h2",{},"Budget "+Y),el("button",{class:"btn pri",onclick:()=>{S.editBudget=false;S.bOpen=null;render();window.scrollTo(0,0);}},"Klaar")),
    budgetSummary(Y),more.length?el("div",{class:"tools"},...more):null));
  GROUPS.forEach(grp=>{ main.append(el("section",{class:"group"},
    el("div",{class:"erow head"},el("span",{class:"en"},grp.name),el("span",{class:"h"},"Per maand"),el("span",{class:"h"},"Per jaar"),el("span",{})),
    ...grp.cats.map(c=>editRow(Y,ref,grp,c)))); });
}

/* ---------- vermogen ---------- */
const WSER=[{k:"Betaalrekening",c:"var(--s1)"},{k:"Buffer",c:"var(--s2)"},{k:"Spaardoelen",c:"var(--s3)"},{k:"Pensioen of beleggingen",c:"var(--s4)",short:"Beleggingen"}];
function wealthData(year){ const {T,cnt,span}=totals(year); const net=Array(13).fill(0);
  for(const t of S.tx) if(Math.floor(t.d/10000)===year)net[Math.floor(t.d/100)%100]+=t.a;
  let last=0; for(let m=12;m>=1;m--) if(cnt[m]){last=m;break;}
  const start=S.wealth[year]||{}; const flow=m=>WSER.map(s=>s.k==="Betaalrekening"?net[m]:-((T[s.k]||[])[m]||0));
  const rows=[]; let bal=WSER.map(s=>+start[s.k]||0); const begin=bal.reduce((a,b)=>a+b,0);
  for(let m=1;m<=last;m++){ const f=flow(m); bal=bal.map((b,i)=>b+f[i]); rows.push({m,flow:f,bal:bal.slice(),total:bal.reduce((a,b)=>a+b,0)}); }
  const inc=GROUPS[0].cats.reduce((s,c)=>s+((T[c]||[])[0]||0),0);
  return {rows,begin,last,inc,span}; }
function niceStep(range,n){ const raw=range/n,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p; return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p; }
const kfmt=v=>Math.abs(v)>=1000?"€ "+(v/1000).toLocaleString("nl-NL",{maximumFractionDigits:1})+"k":"€ "+Math.round(v);
function svg(tag,attrs,...kids){ const e=document.createElementNS("http://www.w3.org/2000/svg",tag); for(const[k,v]of Object.entries(attrs||{}))e.setAttribute(k,v); for(const k of kids)e.append(k); return e; }
function wealthChart(D){ const W=720,H=300,L=52,R=14,Tp=22,B=26,pw=W-L-R,ph=H-Tp-B;
  let hi=0,lo=0; for(const r of D.rows){ let p=0,n=0; r.bal.forEach(v=>{if(v>=0)p+=v;else n+=v;}); hi=Math.max(hi,p); lo=Math.min(lo,n); }
  if(hi-lo<1)hi=1000; const step=niceStep(hi-lo,4); hi=Math.ceil(hi/step)*step; lo=Math.floor(lo/step)*step;
  const y=v=>Tp+ph*(1-(v-lo)/(hi-lo)), slot=pw/12, bw=Math.min(34,slot*0.62);
  const root=svg("svg",{viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Vermogen per maand, gestapeld per onderdeel. De tabel hieronder bevat dezelfde cijfers."});
  for(let v=lo;v<=hi+1e-6;v+=step){ root.append(svg("line",{class:Math.abs(v)<1e-6?"zero":"grid",x1:L,x2:W-R,y1:y(v),y2:y(v)})); const t=svg("text",{x:L-8,y:y(v)+4,"text-anchor":"end"}); t.textContent=kfmt(v); root.append(t); }
  MONTHS.forEach((n,i)=>{ const t=svg("text",{x:L+slot*(i+.5),y:H-8,"text-anchor":"middle"}); t.textContent=n; root.append(t); });
  const wrap=el("div",{class:"chart"}); const tip=el("div",{class:"tip",hidden:true});
  const show=(r,hit)=>{ tip.replaceChildren(el("b",{},MONTHS_LONG[r.m-1]+" "+S.year),...WSER.map((s,i)=>el("div",{},el("span",{},el("i",{style:"background:"+s.c}),s.short||s.k),el("span",{},eur0.format(r.bal[i])))).reverse(),el("div",{class:"t"},el("span",{},"Totaal"),el("span",{},eur0.format(r.total))));
    tip.hidden=false; const cx=(L+slot*(r.m-.5))/W*wrap.clientWidth, tw=tip.offsetWidth; tip.style.left=Math.max(0,Math.min(wrap.clientWidth-tw,cx>wrap.clientWidth/2?cx-tw-14:cx+14))+"px"; tip.style.top="8px";
    root.querySelectorAll(".hit.on").forEach(h=>h.classList.remove("on")); hit.classList.add("on"); };
  const hide=()=>{tip.hidden=true;root.querySelectorAll(".hit.on").forEach(h=>h.classList.remove("on"));};
  for(const r of D.rows){ const x=L+slot*(r.m-.5)-bw/2; let up=0,dn=0; const topIdx=r.bal.reduce((a,v,i)=>v>0.5?i:a,-1);
    r.bal.forEach((v,i)=>{ if(Math.abs(v)<0.5)return; let y0,y1; if(v>0){y0=y(up);up+=v;y1=y(up);}else{y0=y(dn);dn+=v;y1=y(dn);}
      const top=Math.min(y0,y1),h=Math.max(1,Math.abs(y1-y0)-2), rr=i===topIdx?Math.min(4,h):0;
      const d=rr?`M${x},${top+h}V${top+rr}a${rr},${rr} 0 0 1 ${rr},${-rr}H${x+bw-rr}a${rr},${rr} 0 0 1 ${rr},${rr}V${top+h}Z`:`M${x},${top+h}V${top}H${x+bw}V${top+h}Z`;
      root.append(svg("path",{d,fill:WSER[i].c})); });
    if(r.m===D.last){ const t=svg("text",{class:"tot",x:x+bw/2,y:y(up)-7,"text-anchor":"middle"}); t.textContent=eur0.format(r.total); root.append(t); }
    const hit=svg("rect",{class:"hit",x:L+slot*(r.m-1),y:Tp-10,width:slot,height:ph+10,rx:6,tabindex:0,"aria-label":MONTHS_LONG[r.m-1]+": totaal "+eur0.format(r.total)});
    hit.addEventListener("pointerenter",()=>show(r,hit)); hit.addEventListener("focus",()=>show(r,hit)); hit.addEventListener("click",()=>show(r,hit)); hit.addEventListener("blur",hide); root.append(hit); }
  root.addEventListener("pointerleave",hide); wrap.append(root,tip); return wrap; }
function viewWealth(main){
  if(!S.tx.length){main.append(el("div",{class:"empty"},"Nog geen transacties. Lees eerst je bankexport in bij Importeren."));return;}
  const D=wealthData(S.year); if(!D.rows.length){main.append(el("div",{class:"empty"},"Geen transacties in "+S.year+"."));return;}
  const end=D.rows[D.rows.length-1], built=end.total-D.begin, saved=D.rows.reduce((s,r)=>s+r.flow[1]+r.flow[2]+r.flow[3],0);
  const stat=(l,v,cls,sub)=>el("div",{class:"stat"},el("div",{class:"l"},l),el("div",{class:"v "+(cls||"")},v),sub?el("div",{class:"s"},sub):null);
  main.append(el("div",{class:"card hero"},el("div",{class:"l"},"Vermogen eind "+MONTHS_LONG[end.m-1]),el("div",{class:"big"},eur0.format(end.total)),
    el("div",{class:"stats"},stat("Opgebouwd in "+S.year,(built>0?"+":"")+eur0.format(built),built<0?"neg":"pos"),stat("Per maand",eur0.format(built/D.span)),
      stat("Spaarquote",D.inc>0?Math.round(saved/D.inc*100)+"%":"–"))));
  main.append(el("div",{class:"card"},el("div",{class:"legend"},WSER.slice().reverse().map(s=>el("span",{},el("i",{style:"background:"+s.c}),s.short||s.k))),wealthChart(D)));
  const tw=el("div",{class:"tablewrap"});
  tw.append(el("div",{class:"row head w5"},el("span",{},""),...WSER.map(s=>el("span",{class:"h"},s.short||s.k)),el("span",{class:"h"},"Stand")));
  for(const r of D.rows)tw.append(el("div",{class:"row w5"},el("span",{class:"name"},MONTHS_LONG[r.m-1]),...r.flow.map(v=>el("span",{class:"num "+(v<-0.5?"neg":"")},Math.abs(v)<0.5?"–":(v>0?"+":"")+eur0.format(v))),el("span",{class:"num"},eur0.format(r.total))));
  main.append(el("details",{class:"group fold"},el("summary",{},"Per maand"),tw));
  const st=S.wealth[S.year]||{};
  main.append(el("details",{class:"group fold"},el("summary",{},"Beginstand 1 januari "+S.year,el("span",{class:"of"},D.begin?eur0.format(D.begin):"niet ingevuld")),
    el("div",{class:"foldbody"},el("p",{class:"prose"},"Wat stond er op 1 januari op je rekeningen? Dan toont de grafiek je hele vermogen, niet alleen de opbouw van dit jaar."),
      el("div",{class:"starts"},WSER.map((s,i)=>el("label",{},s.short||s.k,el("input",{id:"start-"+i,type:"text",inputmode:"decimal",placeholder:"0",value:st[s.k]?String(st[s.k]).replace(".",","):"",
        onchange:e=>{ (S.wealth[S.year]||(S.wealth[S.year]={}))[s.k]=parseAmount(e.target.value); saveWealth(); render(); }}))))))); }

/* ---------- importeren ---------- */
function h32(str,seed){ let h=seed>>>0; for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)>>>0;} return h.toString(16).padStart(8,"0"); }
const cents=x=>Math.floor(x*100+0.5);
function txId(d,a,begin,text){ const s=d+"|"+cents(a)+"|"+cents(begin)+"|"+text.replace(/\s+/g," ").trim(); return h32(s,2166136261)+h32(s,340282366); }
const toNum=v=>typeof v==="number"?v:parseFloat(String(v).replace(/\./g,"").replace(",","."));
function toDate(v){ if(v instanceof Date)return v.getFullYear()*10000+(v.getMonth()+1)*100+v.getDate(); const n=parseInt(String(v).replace(/\D/g,""),10); return n>19000000&&n<21000000?n:NaN; }
function parseRows(rows){ const out=[]; if(!rows.length)return out; let ci={d:2,b:3,a:6,t:7},start=0;
  const head=rows[0].map(x=>String(x).trim().toLowerCase());
  if(head.includes("transactiedatum")){ ci={d:head.indexOf("transactiedatum"),b:head.indexOf("beginsaldo"),a:head.indexOf("transactiebedrag"),t:head.indexOf("omschrijving")}; start=1; }
  else if(rows[0].length>=8&&isNaN(toDate(rows[0][3])))ci={d:2,b:3,a:6,t:7}; else ci={d:2,b:4,a:6,t:7};
  if(ci.d<0||ci.a<0||ci.t<0)return null;
  for(let r=start;r<rows.length;r++){ const R=rows[r]; if(!R||R.length<4)continue; const d=toDate(R[ci.d]),a=toNum(R[ci.a]),b=ci.b>=0?toNum(R[ci.b]):0,t=String(R[ci.t]??"");
    if(isNaN(d)||isNaN(a))continue; out.push({i:txId(d,a,isNaN(b)?0:b,t),d,a,t}); }
  return out; }
async function importFile(file){
  if(/\.json$/i.test(file.name))return restoreBackup(file);
  S.importMsg="Bezig met inlezen…"; render();
  try{ const buf=await file.arrayBuffer(); let rows;
    if(/\.(txt|tab|tsv)$/i.test(file.name))rows=new TextDecoder().decode(buf).split(/\r?\n/).filter(Boolean).map(l=>l.split("\t"));
    else{ const wb=XLSX.read(buf,{type:"array"}); rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:""}); }
    const parsed=parseRows(rows);
    if(!parsed||!parsed.length){S.importMsg="In "+file.name+" staan geen transacties in het ABN AMRO-formaat. Download je mutaties als Excel (XLS) of TXT en probeer het opnieuw.";render();return;}
    const have=new Set(S.tx.map(t=>t.i)); let added=0,dup=0; const touched=new Set();
    for(const t of parsed){ if(have.has(t.i)){dup++;continue;} have.add(t.i); const s=String(t.d),key=s.slice(0,4)+"-"+s.slice(4,6); (S.months[key]||(S.months[key]=[])).push(t); touched.add(key); added++; }
    indexTx(); for(const k of touched)saveMonth(k);
    const y0=S.year; pickDefaults(); if(years().includes(y0)&&!added)S.year=y0;
    S.importMsg=added+" nieuwe transacties toegevoegd uit "+file.name+(dup?"; "+dup+" stonden er al in en zijn overgeslagen.":".");
    if(added&&!store.ok)S.importMsg+=" Let op: opslaan is in deze browser niet beschikbaar.";
  }catch(e){ S.importMsg="Het bestand kon niet worden gelezen. Controleer of het een export van de bank is."; }
  render(); }

/* ---------- back-up ---------- */
function backupData(){ return {app:"huishoudboek",version:1,profile:profileName(),exported:new Date().toISOString(),
  rules:S.rules.map(r=>({k:r.k,c:r.c})),overrides:S.overrides,budgets:S.budgets,wealth:S.wealth,
  months:Object.fromEntries(Object.entries(S.months).map(([k,rows])=>[k,rows.map(t=>({i:t.i,d:t.d,a:t.a,t:t.t}))]))}; }
async function exportBackup(){
  flushSaves(); const name="huishoudboek-"+profile+"-"+new Date().toISOString().slice(0,10)+".json";
  const blob=new Blob([JSON.stringify(backupData())],{type:"application/json"});
  try{ const file=new File([blob],name,{type:"application/json"});
    if(navigator.canShare&&navigator.canShare({files:[file]})&&matchMedia("(pointer:coarse)").matches){ await navigator.share({files:[file],title:"Huishoudboek back-up "+profileName()}); S.backupMsg="Back-up gedeeld."; render(); return; }
  }catch(e){ if(e&&e.name==="AbortError")return; }
  const a=el("a",{href:URL.createObjectURL(blob),download:name}); document.body.append(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  S.backupMsg="Back-up opgeslagen als "+name+"."; render(); }
async function restoreBackup(file){
  let v; try{ v=JSON.parse(await file.text()); }catch(e){ S.backupMsg="Dit is geen geldige back-up."; render(); return; }
  if(!v||typeof v!=="object"||!v.months||typeof v.months!=="object"){ S.backupMsg="Dit bestand is geen Huishoudboek-back-up."; render(); return; }
  const n=Object.values(v.months).reduce((s,r)=>s+(Array.isArray(r)?r.length:0),0);
  const from=v.profile&&v.profile!==profileName()?" Let op: deze back-up is gemaakt in het profiel "+v.profile+".":"";
  if((S.tx.length||from)&&!confirm("De gegevens van "+profileName()+" ("+S.tx.length+" transacties) worden vervangen door de back-up ("+n+" transacties)."+from+" Doorgaan?"))return;
  dropSaves(); for(const id of store.keys())store.del(id);
  resetData();
  loadDoc("rules",{list:v.rules||[]}); loadDoc("overrides",{map:v.overrides||{}}); loadDoc("budgets",{years:v.budgets||{}}); loadDoc("wealth",{years:v.wealth||{}});
  for(const [k,rows] of Object.entries(v.months)) if(/^\d{4}-\d{2}$/.test(k)&&Array.isArray(rows))loadDoc("tx-"+k,{rows});
  indexTx(); compileRules(); pickDefaults(); saveAll();
  S.backupMsg="Back-up teruggezet in "+profileName()+": "+S.tx.length+" transacties en "+S.rules.length+" regels."; render(); }

function viewImport(main){
  const inp=el("input",{type:"file",id:"file",accept:".xls,.xlsx,.csv,.txt,.tab",hidden:true,onchange:e=>{if(e.target.files[0])importFile(e.target.files[0]);e.target.value="";}});
  const drop=el("div",{class:"drop",ondragover:e=>{e.preventDefault();drop.classList.add("over");},ondragleave:()=>drop.classList.remove("over"),
    ondrop:e=>{e.preventDefault();drop.classList.remove("over");if(e.dataTransfer.files[0])importFile(e.dataTransfer.files[0]);}},
    el("h2",{},"Bankexport inlezen"),el("div",{class:"prose"},"ABN AMRO, Excel of TXT. Dubbele transacties worden overgeslagen."),
    el("button",{class:"btn pri",onclick:()=>inp.click()},"Bestand kiezen"),inp);
  main.append(drop);
  if(S.importMsg)main.append(el("div",{class:"note info",role:"status"},S.importMsg, S.tx.length?el("button",{class:"btn sm",onclick:()=>{S.tab="overzicht";go();}},"Naar overzicht"):null));
  const binp=el("input",{type:"file",id:"bfile",accept:".json,application/json",hidden:true,onchange:e=>{if(e.target.files[0])restoreBackup(e.target.files[0]);e.target.value="";}});
  main.append(el("div",{class:"card"},el("h2",{},"Back-up van "+profileName()),
    el("p",{class:"prose"},"Je gegevens staan alleen op dit toestel. Maak af en toe een back-up."),
    el("div",{class:"tools"},el("button",{class:"btn",disabled:!S.tx.length&&!S.rules.length,onclick:exportBackup},"Back-up maken"),el("button",{class:"btn",onclick:()=>binp.click()},"Terugzetten"),binp),
    S.backupMsg?el("div",{class:"note info",role:"status"},S.backupMsg):null));
  const keys=Object.keys(S.months).filter(k=>S.months[k].length).sort().reverse();
  if(keys.length){ const lab=k=>MONTHS[+k.slice(5)-1].toLowerCase()+" "+k.slice(0,4);
    main.append(el("details",{class:"group fold"},el("summary",{},"Ingelezen",el("span",{class:"of"},keys.length===1?lab(keys[0]):lab(keys[keys.length-1])+" – "+lab(keys[0]))),
      ...keys.map(k=>el("div",{class:"frow"},el("span",{},MONTHS_LONG[+k.slice(5)-1]+" "+k.slice(0,4)),el("span",{class:"num muted"},S.months[k].length))))); }
  main.append(el("p",{class:"prose foot"},"Versie "+APP_VERSION));
}
/* ---------- navigatie en terug ---------- */
// Elke paginawissel komt in de browsergeschiedenis, zodat Terug (knop of veeggebaar) naar de vorige pagina gaat,
// inclusief profiel, gekozen periode, filters en scrollpositie.
function viewState(n){ return {n,profile,tab:S.tab,year:S.year,month:S.month,fCat:S.fCat,fUnk:S.fUnk,fText:S.fText,scroll:0}; }
function restoreView(st){ Object.assign(S,{tab:st.tab==="budgetten"?"overzicht":st.tab,fCat:st.fCat||"",fUnk:!!st.fUnk,fText:st.fText||"",shown:50,ruleFor:null});
  if(st.year!=null)S.year=st.year; if(st.month!=null)S.month=st.month; }
function go(){ try{ const prev=history.state||viewState(0); history.replaceState({...prev,scroll:window.scrollY},"");
    history.pushState(viewState((prev.n||0)+1),"","#"+S.tab); }catch(e){} render(); window.scrollTo(0,0); }
addEventListener("popstate",e=>{ const st=e.state; if(!st||!(TABS.includes(st.tab)||st.tab==="budgetten")){ const h=location.hash.slice(1); if(TABS.includes(h)){S.tab=h;render();} return; }
  if(st.profile&&st.profile!==profile&&PROFILES.some(p=>p.id===st.profile))setProfileQuiet(st.profile);
  restoreView(st); render(); window.scrollTo(0,st.scroll||0); });
$("#back").addEventListener("click",()=>history.back());
$("#tabs").addEventListener("click",e=>{const b=e.target.closest("button[data-tab]"); if(b&&b.dataset.tab!==S.tab){S.tab=b.dataset.tab;go();}});
addEventListener("pagehide",flushSaves); document.addEventListener("visibilitychange",()=>{if(document.hidden)flushSaves();});
if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>r.update()).catch(()=>{});
boot();
