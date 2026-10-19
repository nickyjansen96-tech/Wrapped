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
const APP_VERSION="23";
const TABS=["overzicht","vergelijk","vermogen","transacties","regels","importeren","gebruikers"];

/* ---------- toestand ---------- */
const S={ready:false,tx:[],months:{},rules:[],overrides:{},budgets:{},wealth:{},
  tab:"overzicht",year:null,month:0,fCat:"",fText:"",fUnk:false,shown:50,ruleFor:null,rFilter:"",importMsg:"",backupMsg:"",ai:{text:"",sugg:null,msg:""}};
const $=s=>document.querySelector(s);
const el=(tag,attrs={},...kids)=>{const e=document.createElement(tag);
  for(const[k,v]of Object.entries(attrs)){ if(k==="class")e.className=v; else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);
    else if(k.startsWith("aria-"))e.setAttribute(k,String(v)); else if(v===true)e.setAttribute(k,""); else if(v!==false&&v!=null)e.setAttribute(k,v);}
  for(const k of kids.flat()){ if(k==null||k===false)continue; e.append(k.nodeType?k:document.createTextNode(String(k)));} return e;};
const eur0=new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const eur2=new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"});
const f0=n=>Math.abs(n)<0.5?"–":eur0.format(n);
const nTx=n=>n+(n===1?" transactie":" transacties");
const CATSET=new Set(ALLCATS);

/* ---------- categoriseren ---------- */
const strip=s=>String(s).replace(/\s+/g,"").toLowerCase();
let compiled=[];
function compileOne(r){ const k=strip(r.k);
  return k.includes("*")?{re:new RegExp(k.split("*").map(p=>p.replace(/[.+?^${}()|[\]\\]/g,"\\$&")).join(".*")),c:r.c,r}:{k,c:r.c,r}; }
const matches=(c,t)=>{ const s=t.s||(t.s=strip(t.t)); return c.re?c.re.test(s):s.includes(c.k); };
function compileRules(){ compiled=S.rules.filter(r=>r.k&&r.k.trim()&&CATSET.has(r.c)).map(compileOne);
  for(const t of S.tx)t.auto=undefined; }
function autoCat(t){ if(t.auto!==undefined)return t.auto; const s=t.s||(t.s=strip(t.t)); t.hit=null;
  for(const c of compiled){ if(c.re?c.re.test(s):s.includes(c.k)){t.hit=c.r;return t.auto=c.c;} } return t.auto=UNK; }
const catOf=t=>{ const o=S.overrides[t.i]; return o&&CATSET.has(o)?o:autoCat(t); };
function who(d){ let m=/\/NAME\/([^/]*)/.exec(d)||/Naam: (.*?)(\s{2,}|Omschrijving|$)/.exec(d);
  if(m){ const o=/(?:Omschrijving: |\/REMI\/)(.*?)(?:\s{2,}|\/|Kenmerk:|$)/.exec(d); return [m[1].trim(),o?o[1].trim():""]; }
  if(/^(BEA|GEA|eCom)/.test(d)){ const rest=d.slice(33); const i=rest.indexOf(",PAS"); return [(i>0?rest.slice(0,i):rest.slice(0,30)).trim(),""]; }
  return [d.replace(/\s+/g," ").slice(0,40),""]; }

/* ---------- profielen ---------- */
// Gebruikers staan in de lijst hieronder; ieder heeft eigen gegevens onder "hhb:<id>:…". Nicky en Heleen zijn de beginlijst.
const USERS_KEY="hhb-gebruikers", LAST_PROFILE="hhb-profiel";
let PROFILES=(()=>{ try{ const v=JSON.parse(localStorage.getItem(USERS_KEY)||"null"); if(Array.isArray(v)&&v.length&&v.every(u=>u&&typeof u.id==="string"&&typeof u.name==="string"))return v; }catch(e){} return [{id:"nicky",name:"Nicky"},{id:"heleen",name:"Heleen"}]; })();
function saveUsers(){ try{ localStorage.setItem(USERS_KEY,JSON.stringify(PROFILES)); }catch(e){ setSave("Gebruikers niet opgeslagen.",true); } }
const nameTaken=(name,exceptId)=>PROFILES.some(p=>p.id!==exceptId&&p.name.trim().toLowerCase()===name.trim().toLowerCase());
function addUser(name){ const id="u"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); PROFILES.push({id,name:name.trim()}); saveUsers(); return id; }
function userKeys(id){ const P="hhb:"+id+":", out=[]; try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.startsWith(P))out.push(k); } }catch(e){} return out; }
function deleteUser(id){ if(PROFILES.length<2)return; if(id===profile){ dropSaves(); }
  for(const k of userKeys(id)){ try{ localStorage.removeItem(k); }catch(e){} }
  PROFILES=PROFILES.filter(p=>p.id!==id); saveUsers(); if(id===profile)setProfileQuiet(PROFILES[0].id); }
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
  Object.assign(S,{year:null,month:0,fCat:"",fText:"",fUnk:false,shown:50,ruleFor:null,rFilter:"",importMsg:"",backupMsg:"",ai:{text:"",sugg:null,msg:""},editBudget:false,showEmpty:false,txOpen:null,txMsg:""}); }
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
const actual=(g,v)=>g.kind==="in"?v:-v;

/* ---------- weergave ---------- */
function render(){
  for(const b of document.querySelectorAll("#tabs button"))b.setAttribute("aria-selected",b.dataset.tab===(S.tab==="vergelijk"?"overzicht":S.tab));
  const cur=document.querySelector('#tabs button[aria-selected="true"]'); if(cur&&cur.scrollIntoView)cur.scrollIntoView({block:"nearest",inline:"nearest"});
  $("#back").hidden=!(history.state&&history.state.n>0);
  // De budgettabel krijgt de volle schermbreedte, zodat alle maanden ernaast passen.
  for(const w of document.querySelectorAll(".wrap"))w.classList.toggle("wide",(S.tab==="overzicht"&&!!S.editBudget)||S.tab==="vergelijk");
  renderProfiles(); renderRail(); const main=$("#main"); main.replaceChildren();
  if(!S.ready){main.append(el("div",{class:"empty"},"Gegevens laden…"));return;}
  ({overzicht:viewOverview,vermogen:viewWealth,transacties:viewTx,regels:viewRules,importeren:viewImport,gebruikers:viewUsers,vergelijk:viewCompare})[S.tab](main);
}
function renderProfiles(){ const box=$("#profiles"); box.replaceChildren(el("div",{class:"users"},...PROFILES.map(p=>el("button",{class:"seg","aria-pressed":p.id===profile,title:p.name,onclick:()=>switchProfile(p.id)},p.name))),
  el("button",{class:"seg add","aria-pressed":S.tab==="gebruikers","aria-label":"Gebruikers beheren",title:"Gebruikers beheren",onclick:()=>{ if(S.tab!=="gebruikers"){S.tab="gebruikers";go();} }},"+")); }
// Jaren als knoppen naast elkaar (oudste links), zodat je met één tik wisselt.
function yearSwitch(ys,pick){ return el("div",{class:"yearseg",role:"group","aria-label":"Jaar"},ys.map(y=>el("button",{class:"seg","aria-pressed":y===S.year,onclick:()=>{ if(y!==S.year)pick(y); }},y))); }
function renderRail(){ const rail=$("#rail"); rail.replaceChildren();
  const ov=S.tab==="overzicht"||S.tab==="vergelijk";
  rail.hidden=S.tab==="regels"||S.tab==="importeren"||S.tab==="gebruikers"||(!ov&&!S.tx.length); if(rail.hidden)return;
  // Op het overzicht kun je ook jaren zonder transacties kiezen (bijv. volgend jaar), om alvast te begroten.
  const ys=ov?budgetYears():years().slice().reverse(); if(!ys.includes(S.year))S.year=ov?(years()[0]||new Date().getFullYear()):ys[ys.length-1];
  rail.append(yearSwitch(ys,y=>{S.year=y;S.shown=50;render();})); if(ov&&(S.editBudget||S.tab==="vergelijk"))return; if(S.tab==="vermogen")return; const {cnt}=totals(S.year);
  rail.append(el("button",{class:"chip","aria-pressed":S.month===0,onclick:()=>{S.month=0;S.shown=50;render();}},"Heel jaar"));
  MONTHS.forEach((n,i)=>rail.append(el("button",{class:"chip"+(cnt[i+1]?"":" off"),"aria-pressed":S.month===i+1,onclick:()=>{S.month=i+1;S.shown=50;render();}},n)));
}

function catSelect(value,onchange,opts={}){ const s=el("select",{class:"cat"+(opts.cls?" "+opts.cls:""),"aria-label":"Categorie",onchange:e=>onchange(e.target.value)});
  if(opts.auto)s.append(el("option",{value:"",title:"Automatisch via een regel"},opts.auto===UNK?"Kies categorie":opts.auto));
  for(const g of GROUPS){ const og=el("optgroup",{label:g.name}); for(const c of g.cats)og.append(el("option",{value:c,selected:c===value},c)); s.append(og); }
  if(opts.auto&&!value)s.value=""; return s; }

// Alles wat er uit de bankomschrijving te halen is, voor de transactielijst en het detailpaneel.
const WD=["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"];
const titleCase=s=>s.toLowerCase().replace(/(^|[\s\-'(])\p{L}/gu,m=>m.toUpperCase());
function txInfo(t){ const raw=t.t, s=raw.replace(/\s+/g," ").trim(), [name,desc]=who(raw);
  const f=re=>{ const m=re.exec(raw); return m?m[1].trim():""; };
  const iban=f(/\/IBAN\/([^/]+)/)||f(/IBAN:\s*([A-Z]{2}\d{2}[A-Z0-9]+)/);
  const kenmerk=f(/\/EREF\/([^/]+)/)||f(/Kenmerk:\s*(.+?)(?:\s{2,}|$)/);
  let time="",place="";
  const m=/\d{2}\.\d{2}\.\d{2}\/(\d{2})[.:](\d{2})\s*(.*)$/.exec(s); if(m){ time=m[1]+":"+m[2]; place=titleCase(m[3].replace(/,?\s*Land:.*$/i,"").trim()); }
  let type=txType(raw); if(/Apple Pay/i.test(raw))type+=" (Apple Pay)"; else if(/Google Pay/i.test(raw))type+=" (Google Pay)";
  const y=Math.floor(t.d/10000), mo=Math.floor(t.d/100)%100, d=t.d%100, wd=new Date(y,mo-1,d).getDay();
  return {name,desc,iban,kenmerk,time,place,type,full:s,wd,d,mo,y}; }
function catSource(t){ if(S.overrides[t.i]&&CATSET.has(S.overrides[t.i]))return "zelf gekozen"; const a=autoCat(t); return a===UNK?"nog geen categorie":"via regel “"+t.hit.k+"”"; }
function ruleForm(t,info){ let rc=catOf(t)===UNK?"":catOf(t);
  const cnt=el("div",{class:"of",id:"rule-hits"});
  const kin=el("input",{class:"txt",id:"newrule-k",value:info.name.replace(/\s+\d{1,5}$/,""),"aria-label":"Trefwoord",autocomplete:"off"});
  const upd=()=>{ const k=kin.value.trim(); if(strip(k).length<2){ cnt.textContent=""; return; } const c=compileOne({k,c:""}); let n=0,u=0; for(const x of S.tx) if(matches(c,x)){ n++; if(catOf(x)===UNK)u++; }
    cnt.textContent="Raakt "+nTx(n)+(u?", waarvan "+u+" nu zonder categorie":"")+"."; };
  kin.addEventListener("input",upd); upd();
  const save=()=>{ const k=kin.value.trim(); if(!k)return; if(!rc){ alert("Kies eerst een categorie."); return; }
    const before=S.tx.filter(x=>catOf(x)===UNK).length; S.rules.unshift({k,c:rc}); compileRules(); saveRules();
    S.txMsg="Regel “"+k+"” → "+rc+" opgeslagen; "+nTx(before-S.tx.filter(x=>catOf(x)===UNK).length)+" ingedeeld."; S.ruleFor=null; render(); };
  kin.addEventListener("keydown",e=>{ if(e.key==="Enter")save(); });
  return el("div",{class:"mk"},el("div",{class:"mkhead"},"Regel maken"),
    el("p",{class:"prose"},"Alle transacties waarvan de omschrijving dit woord bevat, krijgen voortaan automatisch deze categorie, ook transacties die je later inleest."),
    el("div",{class:"mkrow"},el("label",{},"Als de omschrijving bevat",kin),el("label",{},"dan categorie",catSelect(rc,v=>{rc=v;},{auto:UNK}))),
    cnt,el("div",{class:"mkbtns"},el("button",{class:"btn sm",onclick:()=>{S.ruleFor=null;render();}},"Annuleren"),el("button",{class:"btn sm pri",onclick:save},"Regel opslaan"))); }
function txDetails(t,info){ const row=(k,v)=>v?[el("dt",{},k),el("dd",{},v)]:[];
  return el("dl",{class:"txdet"},
    ...row("Datum",WD[info.wd]+" "+info.d+" "+MONTHS_LONG[info.mo-1]+" "+info.y+(info.time?" om "+info.time:"")),
    ...row("Soort",info.type.charAt(0).toUpperCase()+info.type.slice(1)), ...row("Plaats",info.place),
    ...row("Tegenrekening",info.iban), ...row("Omschrijving",info.desc), ...row("Kenmerk",info.kenmerk),
    ...row("Categorie",catOf(t)===UNK?"Nog geen categorie":catOf(t)+" ("+catSource(t)+")"),
    el("dt",{},"Bankomschrijving"),el("dd",{class:"raw"},info.full)); }
function txRow(t){ const info=txInfo(t), auto=autoCat(t), man=S.overrides[t.i]&&CATSET.has(S.overrides[t.i])?S.overrides[t.i]:"", open=S.txOpen===t.i;
  const sel=catSelect(man,v=>{ if(v)S.overrides[t.i]=v; else delete S.overrides[t.i]; saveOverrides(); render(); },{auto,cls:man?"man":auto===UNK?"unk":""});
  const sub=[info.type.charAt(0).toUpperCase()+info.type.slice(1),info.place,info.time,info.place?"":info.desc].filter(Boolean).join(" · ");
  const row=el("div",{class:"tx"+(open?" open":"")},
    el("button",{class:"txmain","aria-expanded":open,title:"Details tonen",onclick:()=>{S.txOpen=open?null:t.i;render();}},
      el("span",{class:"date"},el("b",{},String(info.d)),el("span",{},MONTHS[info.mo-1].toLowerCase()),el("span",{class:"wd"},WD[info.wd].slice(0,2))),
      el("span",{class:"txt"},el("span",{class:"who"},info.name),el("span",{class:"det"},sub)),
      el("span",{class:"num amt "+(t.a<0?"":"pos")},eur2.format(t.a))),
    el("div",{class:"txcat"},sel,el("span",{class:"src"},catSource(t))),
    el("button",{class:"rulebtn","aria-expanded":S.ruleFor===t.i,"aria-label":"Regel maken voor "+info.name,title:"Regel maken: vergelijkbare transacties krijgen voortaan automatisch deze categorie",onclick:()=>{S.ruleFor=S.ruleFor===t.i?null:t.i;render();}},"＋ Regel"));
  if(open)row.append(txDetails(t,info));
  if(S.ruleFor===t.i)row.append(ruleForm(t,info));
  return row; }
function viewTx(main){
  const m=S.month,q=strip(S.fText);
  const inPeriod=S.tx.filter(t=>Math.floor(t.d/10000)===S.year&&(!m||Math.floor(t.d/100)%100===m));
  const unkCount=inPeriod.filter(t=>catOf(t)===UNK).length;
  const list=inPeriod.filter(t=>(!S.fUnk||catOf(t)===UNK)&&(!S.fCat||(S.fCat.startsWith("grp:")?GROUPS.find(g=>"grp:"+g.name===S.fCat)?.cats.includes(catOf(t)):catOf(t)===S.fCat))&&(!q||(t.s||(t.s=strip(t.t))).includes(q)));
  const fsel=el("select",{id:"fcat","aria-label":"Filter op categorie",onchange:e=>{S.fCat=e.target.value;S.shown=50;render();}},el("option",{value:""},"Alle categorieën"),
    GROUPS.map(g=>el("optgroup",{label:g.name},el("option",{value:"grp:"+g.name,selected:S.fCat==="grp:"+g.name},"Alle "+g.name.toLowerCase()),g.cats.map(c=>el("option",{value:c,selected:c===S.fCat},c)))));
  main.append(el("div",{class:"tools field"},
    el("input",{id:"ftext",class:"grow",type:"search",placeholder:"Zoek op naam, plaats of omschrijving",value:S.fText,oninput:e=>{S.fText=e.target.value;S.shown=50;clearTimeout(viewTx.t);viewTx.t=setTimeout(()=>{render();const i=$("#ftext");i.focus();i.setSelectionRange(i.value.length,i.value.length);},250);}}),
    fsel, (unkCount||S.fUnk)?el("button",{class:"chip toggle",id:"funk","aria-pressed":S.fUnk,onclick:()=>{S.fUnk=!S.fUnk;S.shown=50;render();}},"Zonder categorie ("+unkCount+")"):null));
  if(S.txMsg){ main.append(el("div",{class:"note info",role:"status"},el("span",{},S.txMsg),el("button",{class:"btn sm",onclick:()=>{S.txMsg="";render();}},"OK"))); }
  const allUnk=S.tx.filter(t=>catOf(t)===UNK).length;
  if(allUnk)main.append(el("div",{class:"note"},el("span",{},"In totaal "+nTx(allUnk)+" zonder categorie. Laat een AI-chat zoals Claude of ChatGPT regels maken, of kies hieronder zelf."),aiButton()));
  const sum=list.reduce((s,t)=>s+t.a,0), uit=list.filter(t=>t.a<0).reduce((s,t)=>s+t.a,0), bij=list.filter(t=>t.a>0).reduce((s,t)=>s+t.a,0);
  if(!list.length){main.append(el("div",{class:"empty"},"Geen transacties voor deze selectie."));return;}
  const sec=el("section",{class:"group"});
  sec.append(el("div",{class:"ghead txhead"},el("span",{},nTx(list.length)),el("span",{class:"num"},el("span",{class:"of"},"bij "+eur0.format(bij)+" · af "+eur0.format(-uit)+" · netto "),eur2.format(sum))),
    el("p",{class:"prose txtip"},"Tik op een transactie voor alle details. Met ",el("b",{},"＋ Regel")," krijgen vergelijkbare transacties voortaan vanzelf dezelfde categorie."));
  for(const t of list.slice(0,S.shown))sec.append(txRow(t));
  main.append(sec);
  if(list.length>S.shown)main.append(el("button",{class:"linkbtn",onclick:()=>{S.shown+=200;render();}},"Meer tonen ("+(list.length-S.shown)+")"));
}

/* ---------- regels laten maken door een AI-chat (Claude, ChatGPT, …) ---------- */
// De app maakt een vraag met de tegenpartijen zonder categorie; die plak je in een AI-chat naar keuze en het antwoord
// plak je terug. Rekeningnummers, pasnummers en kenmerken worden eerst uit de omschrijvingen gehaald.
function txType(t){ const s=t.replace(/\s+/g," ");
  if(/^BEA\b/.test(s))return "betaalpas"; if(/^GEA\b/.test(s))return "geldautomaat"; if(/^eCom\b/.test(s))return "online met betaalpas";
  if(/iDEAL/i.test(s))return "iDEAL"; if(/Tikkie/i.test(s))return "Tikkie"; if(/SEPA Incasso|\/TRTP\/SEPA Incasso|Incasso/i.test(s))return "automatische incasso";
  if(/Periodieke overb/i.test(s))return "periodieke overboeking"; if(/Overboeking|\/TRTP\/SEPA OVERBOEKING/i.test(s))return "overboeking"; if(/^ABN AMRO|Kosten|Rente/i.test(s))return "bankkosten of rente"; return "overig"; }
function cleanDesc(t){ return t.replace(/\/TRTP\/[^/]*|\/IBAN\/[^/]*|\/BIC\/[^/]*|\/EREF\/[^/]*|\/MARF\/[^/]*|\/CSID\/[^/]*/g," ")
  .replace(/\b[A-Z]{2}\d{2}[A-Z]{4}\d{6,}\b/g,"").replace(/\b(IBAN|BIC|Kenmerk|Machtiging|Incassant|Betalingskenm\.?|ID debiteur|EREF|MARF|CSID)\s*:\s*\S+/gi," ")
  .replace(/,?PAS\d+/g," ").replace(/\bNR:\S+/g," ").replace(/\d{2}\.\d{2}\.\d{2}\/\d{2}[.:]\d{2}/g," ").replace(/\/(NAME|REMI)\//g," ").replace(/\//g," ")
  .replace(/\s+/g," ").replace(/\s,/g,",").trim().slice(0,160); }
const nlAmt=v=>(v<0?"-":"")+Math.abs(v).toFixed(2).replace(".",",");
function aiPrompt(max=150){
  const groups=new Map();
  // Filialen samen nemen: "Jumbo 55" en "Jumbo 12" worden één tegenpartij "Jumbo".
  for(const t of S.tx){ if(catOf(t)!==UNK)continue; const [full]=who(t.t); const name=full.replace(/\s+\d{1,5}$/,"")||full, key=strip(name);
    const g=groups.get(key)||{name,type:txType(t.t),n:0,sum:0,min:t.d,max:t.d,ex:new Set()}; g.n++; g.sum+=t.a; g.min=Math.min(g.min,t.d); g.max=Math.max(g.max,t.d);
    if(g.ex.size<3)g.ex.add(cleanDesc(t.t)); groups.set(key,g); }
  const all=[...groups.values()].sort((a,b)=>b.n-a.n||Math.abs(b.sum)-Math.abs(a.sum)), list=all.slice(0,max);
  if(!list.length)return null;
  const per=g=>{ const f=d=>MONTHS[Math.floor(d/100)%100-1].toLowerCase()+" "+Math.floor(d/10000); return g.min===g.max||f(g.min)===f(g.max)?f(g.min):f(g.min)+"–"+f(g.max); };
  const lines=list.map((g,i)=>(i+1)+". "+g.name+" | "+g.type+" | "+g.n+"× | gemiddeld € "+nlAmt(g.sum/g.n)+" | totaal € "+nlAmt(g.sum)+" | "+per(g)+"\n   omschrijving: "+[...g.ex].map(e=>"\""+e+"\"").join(" ; "));
  const cats=GROUPS.map(g=>"- "+g.name+": "+g.cats.join(" · ")).join("\n");
  const have=S.rules.length?S.rules.slice(0,100).map(r=>r.k+" | "+r.c).join("\n"):"(nog geen)";
  return ["Ik houd een huishoudboekje bij voor mijn Nederlandse bankrekening (ABN AMRO). Help me regels te maken die mijn transacties automatisch in een categorie zetten.",
    "","Zo werkt een regel: als het trefwoord ergens in de omschrijving van een transactie staat, krijgt die transactie de categorie. Hoofdletters en spaties tellen niet mee; * is een joker (bijv. Albert*Heijn).",
    "- Kies trefwoorden die de partij herkennen, ook bij toekomstige betalingen: laat filiaalnummers, plaatsen, datums en bedragen weg (dus \"Albert Heijn\", niet \"Albert Heijn 1234\").",
    "- Maak ze niet zo kort dat ze andere partijen raken (dus niet \"AH\" of \"Shell\" als dat ook in andere namen voorkomt).",
    "- Min is geld eruit, plus is geld erin. Overboekingen naar mijn eigen spaarrekening horen bij Buffer of Spaardoelen; terugbetalingen (bijv. Tikkie) bij de categorie van de uitgave.",
    "- Weet je echt niet wat iets is? Sla het dan over en noem het kort onder je antwoord.",
    "","Gebruik alleen deze categorieën, precies zo geschreven:",cats,
    "","Regels die ik al heb (trefwoord | categorie):",have,
    "","Tegenpartijen zonder categorie"+(all.length>max?" (de "+max+" meest voorkomende van "+all.length+")":"")+" — naam | soort betaling | aantal | gemiddeld bedrag | totaal | periode, met voorbeelden van de omschrijving:",...lines,
    "","Geef je antwoord als één codeblok met één regel per trefwoord, in deze vorm:",
    "```\nAlbert Heijn | Boodschappen\nNetflix | Abonnementen\n```"].join("\n"); }

// Leest het antwoord van een AI-chat. Werkt met de gevraagde vorm (trefwoord | categorie), maar ook met JSON (ook met
// kleine fouten), tabellen en lijstjes met pijlen, en met categorieën die net iets anders gespeld zijn.
const normCat=s=>String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const CATNORM=new Map(ALLCATS.map(c=>[normCat(c),c]));
function matchCat(s){ const n=normCat(s); if(!n)return null; if(CATNORM.has(n))return CATNORM.get(n);
  const hits=ALLCATS.filter(c=>{ const m=normCat(c); return m.startsWith(n)||n.startsWith(m)||(n.length>=5&&m.includes(n)); }); return hits.length===1?hits[0]:null; }
function aiPairs(text){
  const t=String(text).replace(/[“”„″]/g,"\"").replace(/[‘’‚′]/g,"'").replace(/\r/g,"");
  const tryJson=src=>{ const i=src.search(/[[{]/); if(i<0)return null; const j=Math.max(src.lastIndexOf("}"),src.lastIndexOf("]")); if(j<i)return null;
    try{ return JSON.parse(src.slice(i,j+1).replace(/,\s*([}\]])/g,"$1")); }catch(e){ return null; } };
  const fromJson=v=>{ const out=[]; const walk=x=>{ if(Array.isArray(x)){ for(const y of x){ if(Array.isArray(y)&&y.length>=2&&typeof y[0]==="string")out.push([y[0],String(y[1])]); else if(y&&typeof y==="object"){ const k=y.trefwoord??y.keyword??y.k??y.zoekterm??y.term; const c=y.categorie??y.category??y.c; if(k!=null&&c!=null)out.push([String(k),String(c)]); else walk(y); } } return; }
      if(x&&typeof x==="object")for(const [k,v] of Object.entries(x)){ if(/^(regels|rules|items|data)$/i.test(k)){ walk(v); continue; }
        if(Array.isArray(v)&&v.every(e=>typeof e==="string")&&matchCat(k)){ for(const e of v)out.push([e,k]); }
        else if(typeof v==="string")out.push(matchCat(v)||!matchCat(k)?[k,v]:[v,k]); else walk(v); } };
    walk(v); return out; };
  const blocks=[...t.matchAll(/```[a-zA-Z]*\s*([\s\S]*?)```/g)].map(m=>m[1]);
  for(const src of [...blocks,t]){ const v=tryJson(src); if(v){ const r=fromJson(v); if(r.length)return r; } }
  const out=[];
  for(const src of blocks.length?blocks:[t]){ for(let line of src.split("\n")){ line=line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,"").replace(/`|\*\*/g,"").trim(); if(!line)continue;
      if(/^\|?\s*:?-{2,}/.test(line))continue;
      let parts=line.includes("|")?line.replace(/^\||\|$/g,"").split("|"):line.split(/\s*(?:→|->|=>|\t|;)\s*/), loose=false;
      if(parts.length<2){ const m=/^(.+?):\s+(.+)$/.exec(line); if(m){ parts=[m[1],m[2]]; loose=true; } }
      parts=parts.map(x=>x.trim().replace(/^["']|["']$/g,"")).filter(Boolean); if(parts.length<2)continue;
      if(/^(trefwoord|keyword|zoekterm)$/i.test(parts[0])&&/^(categorie|category)$/i.test(parts[1]))continue;
      if(loose&&!blocks.length&&!matchCat(parts[parts.length-1]))continue;   // "x: y" in lopende tekst alleen met een echte categorie
      out.push([parts[0],parts[parts.length-1]]); } }
  return out; }
function parseAI(text){ const pairs=aiPairs(text); if(!pairs.length)return null;
  const have=new Set(S.rules.map(r=>strip(r.k))), seen=new Set(), out=[];
  for(const [k0,c0] of pairs){ const k=k0.trim(), c=matchCat(c0), sk=strip(k); if(sk.length<2||seen.has(sk))continue; seen.add(sk);
    out.push({k,c:c||ALLCATS[0],ok:!!c&&!have.has(sk),known:have.has(sk),badCat:!c,raw:c0}); }
  return out.length?out:null; }
function suggestionHits(sg){ const c=compileOne(sg); let n=0; for(const t of S.tx) if(catOf(t)===UNK&&matches(c,t))n++; return n; }
async function copyText(text){ try{ await navigator.clipboard.writeText(text); return true; }catch(e){}
  try{ const ta=el("textarea",{style:"position:fixed;opacity:0"},text); document.body.append(ta); ta.select(); const ok=document.execCommand("copy"); ta.remove(); return ok; }catch(e){ return false; } }
function readAnswer(text){ const r=parseAI(text);
  if(!r){ S.ai.msg="Hierin vond de app geen regels. Kopieer het hele antwoord van de AI-chat, of vraag om een codeblok met één regel per trefwoord: trefwoord | categorie."; }
  else{ for(const x of r)x.hits=suggestionHits(x); S.ai.sugg=r; S.ai.msg=""; } render(); }
const AI_CHATS=[{name:"Claude",url:"https://claude.ai/new"},{name:"ChatGPT",url:"https://chatgpt.com/"}];
// Knop die vanaf elk scherm naar "Laat AI indelen" gaat.
function goAI(){ S.tab="regels"; S.ai.msg=""; go(); }
const aiButton=(label="Laat AI indelen",cls="btn sm pri")=>el("button",{class:cls,onclick:goAI},"✨ "+label);
function viewAI(main){
  const unk=S.tx.filter(t=>catOf(t)===UNK).length, prompt=unk?aiPrompt():null, sg=S.ai.sugg;
  const card=el("div",{class:"card ai",id:"ai-card"},el("div",{class:"aihead"},el("span",{class:"aiicon","aria-hidden":"true"},"✨"),el("div",{},el("h2",{},"Transacties laten indelen door AI"),
    el("div",{class:"prose"},!S.tx.length?"Lees eerst je bankexport in; daarna kan een AI-chat zoals Claude of ChatGPT regels voor je maken.":
      unk?nTx(unk)+(unk===1?" heeft":" hebben")+" nog geen categorie. Een AI-chat zoals Claude of ChatGPT maakt er regels voor, in drie stappen.":"Alle transacties hebben een categorie. Lees je nieuwe transacties in; daarna kun je hier weer regels laten maken."))));
  if(S.ai.msg)card.append(el("div",{class:"note info",role:"status"},S.ai.msg));
  if(prompt&&!sg){
    const step=(n,title,...body)=>el("div",{class:"aistep"},el("span",{class:"aino"},n),el("div",{class:"aibody"},el("div",{class:"aititle"},title),...body));
    card.append(step(1,"Kopieer de vraag",el("div",{class:"tools"},
        el("button",{class:"btn pri",onclick:async()=>{ const ok=await copyText(prompt); S.ai.msg=ok?"Gekopieerd! Ga nu naar stap 2.":"Kopiëren lukte niet; selecteer de vraag hieronder en kopieer hem zelf."; S.ai.showPrompt=!ok; render(); }},"Vraag kopiëren"),
        navigator.share?el("button",{class:"btn",onclick:async()=>{ try{ await navigator.share({text:prompt}); }catch(e){} }},"Delen"):null,
        el("button",{class:"linkbtn",onclick:()=>{S.ai.showPrompt=!S.ai.showPrompt;render();}},S.ai.showPrompt?"Vraag verbergen":"Wat wordt gedeeld?")),
        S.ai.showPrompt?el("p",{class:"prose"},"Per tegenpartij: naam, soort betaling, aantal, bedragen, periode en voorbeelden van de omschrijving. Rekeningnummers, pasnummers en kenmerken worden weggelaten."):null,
        S.ai.showPrompt?el("textarea",{class:"txt area",readonly:true,rows:10,"aria-label":"Vraag voor de AI-chat",onfocus:e=>e.target.select()},prompt):null),
      step(2,"Plak hem in een nieuw gesprek met een AI-chat en kopieer het antwoord",el("div",{class:"tools"},...AI_CHATS.map(c=>el("a",{class:"btn",href:c.url,target:"_blank",rel:"noopener"},c.name+" openen ↗")))),
      step(3,"Plak het antwoord hier",
        el("textarea",{class:"txt area",id:"ai-answer",rows:3,placeholder:"Plak hier het antwoord van de AI-chat","aria-label":"Antwoord van de AI-chat",oninput:e=>{S.ai.text=e.target.value;}},S.ai.text),
        el("div",{class:"tools"},navigator.clipboard&&navigator.clipboard.readText?el("button",{class:"btn pri",onclick:async()=>{ try{ const t=await navigator.clipboard.readText(); if(t){ S.ai.text=t; readAnswer(t); return; } }catch(e){} S.ai.msg="Plakken lukte niet; houd het vak ingedrukt, kies Plakken en tik op Antwoord inlezen."; render(); }},"Plakken en inlezen"):null,
          el("button",{class:"btn",onclick:()=>readAnswer(S.ai.text)},"Antwoord inlezen")))); }
  if(sg){ const sec=el("section",{class:"group sugg"});
    for(const x of sg){ sec.append(el("div",{class:"rule"},
      el("label",{class:"pick"},el("input",{type:"checkbox",checked:x.ok,"aria-label":"Regel gebruiken",onchange:e=>{x.ok=e.target.checked;render();}}),
        el("input",{class:"txt",value:x.k,"aria-label":"Trefwoord",onchange:e=>{x.k=e.target.value;x.hits=suggestionHits(x);render();}})),
      catSelect(x.badCat?"":x.c,v=>{ x.c=v; if(x.badCat){ x.badCat=false; x.ok=!x.known; } render(); },x.badCat?{auto:UNK}:{}),
      el("span",{class:"num muted",title:x.known?"Bestaat al":x.badCat?"Onbekende categorie: "+x.raw:"Aantal transacties zonder categorie dat deze regel raakt"},x.known?"bestaat":x.badCat?"?":x.hits+"×"))); }
    const n=sg.filter(x=>x.ok&&x.k.trim()&&!x.badCat).length, bad=sg.filter(x=>x.badCat).length;
    card.append(el("div",{class:"prose"},sg.length+(sg.length===1?" voorstel":" voorstellen")+(bad?"; bij "+bad+" moet je zelf een categorie kiezen.":". Vink uit wat je niet wilt.")),sec,
      el("div",{class:"tools"},el("button",{class:"btn pri",disabled:!n,onclick:()=>{
      const add=sg.filter(x=>x.ok&&x.k.trim()&&!x.badCat).map(x=>({k:x.k.trim(),c:x.c})); const before=S.tx.filter(t=>catOf(t)===UNK).length;
      S.rules.push(...add); compileRules(); saveRules(); const after=S.tx.filter(t=>catOf(t)===UNK).length;
      S.ai={text:"",sugg:null,msg:add.length+(add.length===1?" regel":" regels")+" toegevoegd; "+nTx(before-after)+" ingedeeld"+(after?", "+after+" nog niet. Herhaal de stappen voor de rest.":".")}; render(); }},
      n+(n===1?" regel":" regels")+" toevoegen"),el("button",{class:"btn",onclick:()=>{S.ai={text:"",sugg:null,msg:""};render();}},"Annuleren")));
  }
  main.append(card); }

function viewRules(main){
  viewAI(main);
  for(const t of S.tx)autoCat(t); const hits=new Map(); for(const t of S.tx)if(t.hit)hits.set(t.hit,(hits.get(t.hit)||0)+1);
  let nc=""; const nk=el("input",{class:"txt grow",id:"addrule-k",placeholder:"Trefwoord, bijv. Albert Heijn"});
  const add=()=>{const k=nk.value.trim();if(!k)return; if(!nc){alert("Kies eerst een categorie.");return;}S.rules.unshift({k,c:nc});compileRules();saveRules();render();};
  nk.addEventListener("keydown",e=>{if(e.key==="Enter")add();});
  main.append(el("div",{class:"addrule"},nk,catSelect(nc,v=>{nc=v;},{auto:UNK}),el("button",{class:"btn pri",onclick:add},"Toevoegen")));
  if(S.rules.length>15||S.rFilter)main.append(el("div",{class:"tools field"},el("input",{id:"rfilter",class:"grow",type:"search",placeholder:"Zoek in "+S.rules.length+" regels",value:S.rFilter,oninput:e=>{S.rFilter=e.target.value;clearTimeout(viewRules.t);viewRules.t=setTimeout(()=>{render();const i=$("#rfilter");i.focus();i.setSelectionRange(i.value.length,i.value.length);},250);}})));
  const q=S.rFilter.toLowerCase(); const sec=el("section",{class:"group"});
  if(S.rules.length)sec.append(el("div",{class:"ghead"},el("span",{},S.rules.length+(S.rules.length===1?" regel":" regels")),el("span",{class:"of"},"bovenste regel gaat voor")));
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
function setMonthBudget(year,cat,m,val){ const y=S.budgets[year]||(S.budgets[year]={}); const b=y[cat]||(y[cat]={base:0,m:{}}); if(!b.m)b.m={};
  if(Math.abs(val-(b.base||0))<0.005)delete b.m[m]; else b.m[m]=val; if(!b.base&&!Object.keys(b.m).length)delete y[cat]; saveBudgets(); }
/* ---------- overzicht en budget ---------- */
// Twee standen: "bekijken" (hoe sta ik ervoor) en "budget bewerken" (bedragen invullen). Zo staat er nooit alles tegelijk op het scherm.
function ovCtx(){ const Y=S.year,m=S.month,{T,unkN,unkSum,cnt}=totals(Y); let upto=0,from=0; for(let k=12;k>=1;k--) if(cnt[k]){upto=k;break;} for(let k=1;k<=12;k++) if(cnt[k]){from=k;break;}
  return {Y,m,T,unkN,unkSum,from,upto,ref:budgetRef(Y)}; }
// Budget om mee te vergelijken: de gekozen maand, of bij heel jaar alleen de maanden waarover transacties zijn ingelezen.
function cmpBudget(x,c){ if(x.m)return budgetOf(x.Y,c,x.m); if(!x.upto)return budgetOf(x.Y,c,0); let s=0; for(let k=x.from;k<=x.upto;k++)s+=budgetOf(x.Y,c,k); return s; }
const actOf=(x,grp,c)=>actual(grp,(x.T[c]||[])[x.m]||0);
const groupSum=(grp,fn)=>grp.cats.reduce((s,c)=>s+fn(c),0);
const kinds=fn=>({inc:groupSum(GROUPS[0],fn),uit:groupSum(GROUPS[1],fn)+groupSum(GROUPS[2],fn)+groupSum(GROUPS[3],fn),sp:groupSum(GROUPS[4],fn)});
const anyBudget=Y=>ALLCATS.some(c=>budgetOf(Y,c,0)>0);
function viewOverview(main){ if(S.editBudget)viewBudgetEdit(main); else viewStatus(main); }

function viewStatus(main){
  const x=ovCtx(), hasB=anyBudget(x.Y);
  const A=kinds(c=>{ const g=GROUPS.find(g=>g.cats.includes(c)); return actOf(x,g,c); }), B=kinds(c=>cmpBudget(x,c)), rest=A.inc-A.uit-A.sp+x.unkSum[x.m];
  const per=S.month?MONTHS_LONG[S.month-1]+" "+S.year:String(S.year);
  const stat=(l,v,b)=>el("div",{class:"stat"},el("div",{class:"l"},l),el("div",{class:"v"},eur0.format(v)),el("div",{class:"s"},hasB?"van "+eur0.format(b):" "));
  main.append(el("div",{class:"card hero"},
    el("div",{class:"herotop"},el("div",{},el("div",{class:"l"},"Over in "+per),el("div",{class:"big "+(rest<-0.5?"neg":"pos")},eur0.format(rest))),
      el("div",{class:"herobtns"},el("button",{class:"btn"+(hasB?"":" pri"),id:"budget-btn",onclick:()=>{S.editBudget=true;render();window.scrollTo(0,0);}},hasB?"Budget bewerken":"Budget invullen"),
        hasB?el("button",{class:"btn",id:"compare-btn",onclick:goCompare},"Vergelijk per maand"):null)),
    el("div",{class:"stats"},stat("Inkomsten",A.inc,B.inc),stat("Uitgaven",A.uit,B.uit),stat("Gespaard",A.sp,B.sp))));
  if(!S.tx.length){ main.append(el("div",{class:"note info"},"Nog geen transacties ingelezen.",el("button",{class:"btn sm",onclick:()=>{S.tab="importeren";go();}},"Importeren"))); return; }
  if(x.unkN[x.m])main.append(el("div",{class:"note"},el("span",{},nTx(x.unkN[x.m])+" zonder categorie (wel meegeteld in Over)"),el("span",{class:"tools"},aiButton(),el("button",{class:"btn sm",onclick:()=>{S.tab="transacties";S.fUnk=true;S.fCat="";S.shown=50;go();}},"Zelf toewijzen"))));
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
    b>0?el("span",{class:"pbar"+(over?" over":""),role:"img","aria-label":Math.round(a/b*100)+"% van budget"},el("i",{style:"width:"+(p*100)+"%"})):null); }

/* budget bewerken: een tabel met een rij per categorie en een kolom per maand */
// Kolom 0 is "Elke maand": daar vul je één bedrag in voor alle maanden. Kolommen 1–12 zijn de maanden zelf.
function setAllMonths(Y,c,v){ const y=S.budgets[Y]||(S.budgets[Y]={}); if(v>0)y[c]={base:v,m:{}}; else delete y[c]; saveBudgets(); }
const cellId=(i,k)=>"g-"+i+"-"+k;
const monthSum=(grp,Y,k)=>grp.cats.reduce((s,c)=>s+budgetOf(Y,c,k),0);
function overOf(Y,k){ const f=gi=>monthSum(GROUPS[gi],Y,k); return f(0)-f(1)-f(2)-f(3)-f(4); }
const gridNum=v=>Math.abs(v)<0.5?"":eur0.format(v).replace("€","").trim();
// Na een wijziging alleen de getallen bijwerken, zodat cursor en toetsenbord in het volgende vak blijven.
function gridRefresh(Y,c){ const i=ALLCATS.indexOf(c), gi=GROUPS.findIndex(g=>g.cats.includes(c)), b=(S.budgets[Y]||{})[c], act=document.activeElement;
  const all=$("#"+cellId(i,0)); if(all&&all!==act)all.value=fmtIn(b?b.base||0:0);
  for(let k=1;k<=12;k++){ const e=$("#"+cellId(i,k)); if(!e)continue; if(e!==act)e.value=fmtIn(budgetOf(Y,c,k)); e.classList.toggle("diff",!!(b&&b.base&&b.m&&b.m[k]!=null)); }
  const t=$("#gy-"+i); if(t)t.textContent=gridNum(budgetOf(Y,c,0));
  for(let k=0;k<=12;k++){ const g=$("#gs-"+gi+"-"+k); if(g)g.textContent=gridNum(monthSum(GROUPS[gi],Y,k));
    const o=$("#ov-"+k); if(o){ const v=overOf(Y,k); o.textContent=Math.abs(v)<0.5?"":eur0.format(v); o.className="num "+(v<-0.5?"neg":"pos"); } } }
// Pijltjes en Enter verplaatsen je door de tabel, zoals in een spreadsheet.
function gridKey(e){ const [,i,k]=e.target.id.split("-").map(Number); let ni=i,nk=k;
  if(e.key==="Enter"||e.key==="ArrowDown")ni=i+1; else if(e.key==="ArrowUp")ni=i-1;
  else if(e.key==="ArrowRight"&&e.target.selectionEnd===e.target.value.length)nk=k+1; else if(e.key==="ArrowLeft"&&e.target.selectionStart===0)nk=k-1; else return;
  const n=$("#"+cellId(ni,nk)); if(!n){ if(e.key==="Enter")e.preventDefault(); return; } e.preventDefault(); n.focus(); n.select(); }
// Plakken uit Excel of Numbers: meerdere getallen (tabs en regels) vullen de tabel vanaf dit vak.
function gridPaste(e,Y){ const txt=(e.clipboardData||window.clipboardData)?.getData("text")||""; if(!/[\t\n]/.test(txt.trim()))return; e.preventDefault();
  const [,i0,k0]=e.target.id.split("-").map(Number);
  txt.replace(/\r/g,"").split("\n").filter((l,j,a)=>l!==""||j<a.length-1).forEach((line,r)=>{ const c=ALLCATS[i0+r]; if(!c)return;
    line.split("\t").forEach((val,j)=>{ const k=k0+j; if(k>12)return; const v=parseAmount(val); if(k===0)setAllMonths(Y,c,v); else setMonthBudget(Y,c,k,v); }); });
  render(); }
function viewBudgetEdit(main){
  const Y=S.year, ref=budgetRef(Y), yb=S.budgets[Y]||{};
  const more=[];
  if(ref.year!=null)more.push(el("button",{class:"btn sm",onclick:()=>{ for(const grp of GROUPS)for(const c of grp.cats){ if(budgetOf(Y,c,0))continue; const a=ref.avg(grp,c); if(a>=1)setAllMonths(Y,c,roundBudget(a)); } render(); }},"Lege rijen vullen met gemiddelde "+ref.year));
  if(S.budgets[Y-1]&&Object.keys(S.budgets[Y-1]).length)more.push(el("button",{class:"btn sm",onclick:()=>{ if(Object.keys(yb).length&&!confirm("Het budget van "+Y+" wordt vervangen door dat van "+(Y-1)+". Doorgaan?"))return; S.budgets[Y]=JSON.parse(JSON.stringify(S.budgets[Y-1])); saveBudgets(); render(); }},"Neem "+(Y-1)+" over"));
  if(Object.keys(yb).length)more.push(el("button",{class:"btn sm",onclick:()=>{ if(!confirm("Alle budgetten van "+Y+" wissen?"))return; delete S.budgets[Y]; saveBudgets(); render(); }},"Wissen"));
  main.append(el("div",{class:"card"},el("div",{class:"herotop"},el("div",{},el("h2",{},"Budget "+Y),el("div",{class:"prose"},"Vul bij ",el("b",{},"Elke maand")," één bedrag in voor het hele jaar, of per maand een eigen bedrag.")),
    el("button",{class:"btn pri",onclick:()=>{S.editBudget=false;render();window.scrollTo(0,0);}},"Klaar")),el("div",{class:"tools"},...more,el("button",{class:"btn sm",onclick:()=>{S.editBudget=false;goCompare();}},"Vergelijk per maand"))));
  const head=el("tr",{},el("th",{class:"cat"},""),el("th",{class:"all"},"Elke maand"),...MONTHS.map(m=>el("th",{},m)),el("th",{class:"yr"},"Jaar"));
  const body=el("tbody");
  GROUPS.forEach((grp,gi)=>{
    body.append(el("tr",{class:"grp"},el("th",{class:"cat"},grp.name),el("td",{colspan:14})));
    for(const c of grp.cats){ const i=ALLCATS.indexOf(c), b=yb[c];
      const cellIn=(k,val,label,on,cls)=>el("td",{class:cls||""},el("input",{id:cellId(i,k),type:"text",inputmode:"decimal",enterkeyhint:"next",autocomplete:"off",value:fmtIn(val),"aria-label":label,
        class:(k&&b&&b.base&&b.m&&b.m[k]!=null)?"diff":"",onkeydown:gridKey,onpaste:e=>gridPaste(e,Y),onfocus:e=>e.target.select(),onchange:on}));
      body.append(el("tr",{},el("th",{class:"cat",scope:"row"},c),
        cellIn(0,b?b.base||0:0,c+" elke maand",e=>{ setAllMonths(Y,c,parseAmount(e.target.value)); e.target.value=fmtIn(parseAmount(e.target.value)); gridRefresh(Y,c); },"all"),
        ...MONTHS.map((m,j)=>cellIn(j+1,budgetOf(Y,c,j+1),c+" "+MONTHS_LONG[j],e=>{ setMonthBudget(Y,c,j+1,parseAmount(e.target.value)); e.target.value=fmtIn(budgetOf(Y,c,j+1)); gridRefresh(Y,c); })),
        el("td",{class:"yr num",id:"gy-"+i},gridNum(budgetOf(Y,c,0))))); }
    body.append(el("tr",{class:"sum"},el("th",{class:"cat"},"Totaal"),el("td",{class:"all"}),...MONTHS.map((m,j)=>el("td",{class:"num",id:"gs-"+gi+"-"+(j+1)},gridNum(monthSum(grp,Y,j+1)))),
      el("td",{class:"yr num",id:"gs-"+gi+"-0"},gridNum(monthSum(grp,Y,0))))); });
  const ov=k=>{ const v=overOf(Y,k); return el("td",{class:"num "+(v<-0.5?"neg":"pos")+(k?"":" yr"),id:"ov-"+k},Math.abs(v)<0.5?"":eur0.format(v)); };
  const foot=el("tfoot",{},el("tr",{class:"over"},el("th",{class:"cat"},"Over"),el("td",{class:"all"}),...MONTHS.map((m,j)=>ov(j+1)),ov(0)));
  main.append(el("div",{class:"bgridwrap"},el("table",{class:"bgrid"},el("thead",{},head),body,foot)));
  main.append(el("p",{class:"prose"},"Enter en de pijltjes verplaatsen je door de tabel. Je kunt ook een blok getallen uit Excel of Numbers plakken. Over = inkomsten min uitgaven en sparen."));
}

/* budget vs werkelijk: dezelfde tabel als het budget, maar alleen om te bekijken */
// Eén tabel: per categorie vier regels (budget, werkelijk, verschil, resultaat) met de maanden als kolommen.
// Verschil is gunstig (+) als je minder uitgaf of meer ontving/spaarde dan begroot. Resultaat is het opgebouwde
// verschil tot en met die maand. Maanden zonder ingelezen transacties worden niet vergeleken (·).
const fmtCell=(v,signed)=>{ const n=eur0.format(Math.abs(v)).replace("€","").trim(); return signed?(v>0.5?"+":v<-0.5?"−":"")+n:(v<-0.5?"−":"")+n; };
function goCompare(){ S.tab="vergelijk"; go(); }
function viewCompare(main){
  const Y=S.year, {T,cnt,unkN}=totals(Y);
  let from=0,upto=0; for(let k=1;k<=12;k++) if(cnt[k]){ if(!from)from=k; upto=k; }
  const has=k=>cnt[k]>0;
  const net=Array(13).fill(0); for(const t of S.tx) if(Math.floor(t.d/10000)===Y)net[Math.floor(t.d/100)%100]+=t.a;
  const KINDS=["Budget","Werkelijk","Verschil","Resultaat"];
  // a(k)/b(k): werkelijk en budget in maand k; good: +1 als meer werkelijk gunstig is (inkomsten, sparen), −1 bij uitgaven.
  const block=(label,a,b,good,toTx,cls)=>{
    const rows=KINDS.map(()=>[]); let cum=0, sa=0, sb=0;
    for(let k=1;k<=12;k++){ const B=b(k), on=has(k), A=on?a(k):0, d=good*(A-B);
      if(on){ cum+=d; sa+=A; sb+=B; }
      rows[0].push({v:B,show:B>=0.5||(on&&Math.abs(A)>=0.5)});
      rows[1].push({v:A,show:on,go:toTx&&toTx(k)});
      rows[2].push({v:d,show:on,signed:true});
      rows[3].push({v:cum,show:on,signed:true,res:true}); }
    const dy=good*(sa-sb), any=!!upto;
    rows[0].push({v:sb,show:any}); rows[1].push({v:sa,show:any,go:toTx&&toTx(0)}); rows[2].push({v:dy,show:any,signed:true}); rows[3].push({v:dy,show:any,signed:true,res:true});
    return rows.map((cells,ri)=>el("tr",{class:"k"+ri+(ri===0?" first":"")+(cls?" "+cls:"")},
      ri===0?el("th",{class:"cat",rowspan:4,scope:"rowgroup"},label):null, el("th",{class:"kind",scope:"row"},KINDS[ri]),
      ...cells.map((c,j)=>{ const yr=j===12, tone=c.signed&&c.show?(c.v>0.5?" pos":c.v<-0.5?" neg":" even"):"";
        const txt=c.show?fmtCell(c.v,!!c.signed):(ri>0&&!yr?"·":"");
        const tip=label+", "+(yr?"jaar":MONTHS_LONG[j])+": "+KINDS[ri].toLowerCase()+" "+(c.show?eur0.format(c.v):"nog geen gegevens");
        return el("td",{class:"c"+tone+(yr?" yr":"")+(c.show?"":" empty")},c.go&&c.show?el("button",{title:tip+" — tik voor de transacties","aria-label":tip,onclick:c.go},txt):el("span",{title:tip},txt)); }))); };
  // Alleen de hoofdcategorieën (Inkomsten, Vaste lasten, …); de losse posten staan op het overzicht en bij Transacties.
  const toTx=f=>k=>()=>{ S.tab="transacties"; S.fCat=f; S.fUnk=false; S.month=k; S.shown=50; go(); };
  const body=[];
  GROUPS.forEach(grp=>{ const good=grp.kind==="uit"?-1:1;
    if(!grp.cats.some(c=>budgetOf(Y,c,0)>=0.5||(T[c]||[]).some(v=>Math.abs(v)>=0.5)))return;
    body.push(...block(grp.name,k=>grp.cats.reduce((s,c)=>s+actual(grp,(T[c]||[])[k]||0),0),k=>grp.cats.reduce((s,c)=>s+budgetOf(Y,c,k),0),good,toTx("grp:"+grp.name))); });
  main.append(el("div",{class:"card"},el("div",{class:"herotop"},el("div",{},el("h2",{},"Budget vs werkelijk "+Y),
      el("div",{class:"prose"},"Per hoofdcategorie en maand: wat je begrootte, wat het werkelijk was, het verschil en het resultaat (het opgebouwde verschil tot en met die maand). Groen is gunstig: minder uitgegeven, of meer ontvangen of gespaard dan begroot.")),
      el("button",{class:"btn",onclick:()=>{ S.tab="overzicht"; S.editBudget=true; go(); }},"Budget bewerken")),
    el("div",{class:"of"},"Tik op een werkelijk bedrag voor de transacties."+(upto&&upto<12?" · = nog geen transacties ingelezen.":""))));
  if(!body.length){ main.append(el("div",{class:"empty"},"Nog geen budget of transacties in "+Y+".")); return; }
  body.push(...block("Over",k=>net[k],k=>overOf(Y,k),1,null,"over"));
  const yrLabel="Jaar"+(upto&&(from>1||upto<12)?" ("+MONTHS[from-1].toLowerCase()+"–"+MONTHS[upto-1].toLowerCase()+")":"");
  const head=el("tr",{},el("th",{class:"cat"},""),el("th",{class:"kind"},""),...MONTHS.map((m,j)=>el("th",{class:has(j+1)?"":"nodata"},m)),el("th",{class:"yr"},yrLabel));
  main.append(el("div",{class:"bgridwrap"},el("table",{class:"bgrid cmp"},el("thead",{},head),el("tbody",{},...body))));
  if(unkN[0])main.append(el("p",{class:"prose"},"Over telt ook de "+nTx(unkN[0])+" zonder categorie mee. ",aiButton("Laat AI ze indelen","linkbtn")));
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
// Bedrag uit een bestand: "1.234,56" (ABN AMRO), maar ook "1234.56" uit een CSV.
function toNum(v){ if(typeof v==="number")return v; let s=String(v??"").replace(/[\s€]/g,"");
  if(s.includes(","))s=s.replace(/\./g,"").replace(",","."); else if(/\.\d{3}(\.|$)/.test(s)&&!/\.\d{1,2}$/.test(s))s=s.replace(/\./g,"");
  return s===""?NaN:Number(s); }
function toDate(v){ if(v instanceof Date)return v.getFullYear()*10000+(v.getMonth()+1)*100+v.getDate(); const n=parseInt(String(v).replace(/\D/g,""),10); return n>19000000&&n<21000000?n:NaN; }
function parseRows(rows){ const out=[]; if(!rows.length)return out; let ci={d:2,b:3,a:6,t:7},start=0;
  const head=rows[0].map(x=>String(x).trim().toLowerCase());
  if(head.includes("transactiedatum")){ ci={d:head.indexOf("transactiedatum"),b:head.indexOf("beginsaldo"),a:head.indexOf("transactiebedrag"),t:head.indexOf("omschrijving")}; start=1; }
  else if(head.includes("transactiondate")){ ci={d:head.indexOf("transactiondate"),b:head.indexOf("startsaldo"),a:head.indexOf("amount"),t:head.indexOf("description")}; start=1; }
  else if(rows[0].length>=8&&isNaN(toDate(rows[0][3])))ci={d:2,b:3,a:6,t:7}; else ci={d:2,b:4,a:6,t:7};
  if(ci.d<0||ci.a<0||ci.t<0)return null;
  for(let r=start;r<rows.length;r++){ const R=rows[r]; if(!R||R.length<4)continue; const d=toDate(R[ci.d]),a=toNum(R[ci.a]),b=ci.b>=0?toNum(R[ci.b]):0,t=String(R[ci.t]??"");
    if(isNaN(d)||isNaN(a))continue; out.push({i:txId(d,a,isNaN(b)?0:b,t),d,a,t}); }
  return out; }
// TXT-exports zijn niet altijd UTF-8; dan lezen als Windows-1252 zodat é en ë goed blijven.
function decodeText(buf){ try{ return new TextDecoder("utf-8",{fatal:true}).decode(buf); }catch(e){ return new TextDecoder("windows-1252").decode(buf); } }
async function importFile(file){
  if(/\.json$/i.test(file.name))return restoreBackup(file);
  S.importMsg="Bezig met inlezen…"; render();
  try{ const buf=await file.arrayBuffer(); let rows;
    if(/\.(txt|tab|tsv)$/i.test(file.name))rows=decodeText(buf).split(/\r?\n/).filter(Boolean).map(l=>l.split("\t"));
    else{ const wb=XLSX.read(buf,{type:"array",cellDates:true}); rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:""}); }
    const parsed=parseRows(rows);
    if(!parsed||!parsed.length){S.importMsg="In "+file.name+" staan geen transacties in het ABN AMRO-formaat. Download je mutaties als Excel (XLS) of TXT en probeer het opnieuw.";render();return;}
    const have=new Set(S.tx.map(t=>t.i)); let added=0,dup=0; const touched=new Set();
    for(const t of parsed){ if(have.has(t.i)){dup++;continue;} have.add(t.i); const s=String(t.d),key=s.slice(0,4)+"-"+s.slice(4,6); (S.months[key]||(S.months[key]=[])).push(t); touched.add(key); added++; }
    indexTx(); for(const k of touched)saveMonth(k);
    const y0=S.year; pickDefaults(); if(years().includes(y0)&&!added)S.year=y0;
    S.importMsg=(added?nTx(added).replace(/ transactie/," nieuwe transactie")+" toegevoegd":"Geen nieuwe transacties")+" uit "+file.name+(dup?"; "+dup+(dup===1?" stond":" stonden")+" er al in en "+(dup===1?"is":"zijn")+" overgeslagen.":".");
    if(added&&!store.ok)S.importMsg+=" Let op: opslaan is in deze browser niet beschikbaar.";
  }catch(e){ S.importMsg="Het bestand kon niet worden gelezen. Controleer of het een export van de bank is."; }
  render(); }

/* ---------- back-up ---------- */
function backupData(){ return {app:"huishoudboek",version:1,profile:profileName(),exported:new Date().toISOString(),
  rules:S.rules.map(r=>({k:r.k,c:r.c})),overrides:S.overrides,budgets:S.budgets,wealth:S.wealth,
  months:Object.fromEntries(Object.entries(S.months).map(([k,rows])=>[k,rows.map(t=>({i:t.i,d:t.d,a:t.a,t:t.t}))]))}; }
async function exportBackup(){
  flushSaves(); const slug=profileName().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"gebruiker";
  const name="huishoudboek-"+slug+"-"+new Date().toISOString().slice(0,10)+".json";
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
  const from=v.profile&&v.profile!==profileName()?" Let op: deze back-up is van "+v.profile+".":"";
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
  if(S.importMsg){ const u=S.tx.filter(t=>catOf(t)===UNK).length;
    main.append(el("div",{class:"note info",role:"status"},el("span",{},S.importMsg+(u?" "+nTx(u)+(u===1?" heeft":" hebben")+" nog geen categorie.":"")),
      S.tx.length?el("span",{class:"tools"},u?aiButton():null,el("button",{class:"btn sm",onclick:()=>{S.tab="overzicht";go();}},"Naar overzicht")):null)); }
  const binp=el("input",{type:"file",id:"bfile",accept:".json,application/json",hidden:true,onchange:e=>{if(e.target.files[0])restoreBackup(e.target.files[0]);e.target.value="";}});
  main.append(el("div",{class:"card",id:"backup-card"},el("h2",{},"Back-up van "+profileName()),
    el("p",{class:"prose"},"Je gegevens staan alleen op dit toestel. Maak af en toe een back-up."),
    el("div",{class:"tools"},el("button",{class:"btn",disabled:!S.tx.length&&!S.rules.length,onclick:exportBackup},"Back-up maken"),el("button",{class:"btn",onclick:()=>binp.click()},"Terugzetten"),binp),
    S.backupMsg?el("div",{class:"note info",role:"status"},S.backupMsg):null));
  const keys=Object.keys(S.months).filter(k=>S.months[k].length).sort().reverse();
  if(keys.length){ const lab=k=>MONTHS[+k.slice(5)-1].toLowerCase()+" "+k.slice(0,4);
    main.append(el("details",{class:"group fold"},el("summary",{},"Ingelezen",el("span",{class:"of"},keys.length===1?lab(keys[0]):lab(keys[keys.length-1])+" – "+lab(keys[0]))),
      ...keys.map(k=>el("div",{class:"frow"},el("span",{},MONTHS_LONG[+k.slice(5)-1]+" "+k.slice(0,4)),el("span",{class:"num muted"},S.months[k].length))))); }
  main.append(el("p",{class:"prose foot"},"Versie "+APP_VERSION+" · ",el("button",{class:"linkbtn small",onclick:startTour},"Rondleiding bekijken")));
}
/* ---------- gebruikers ---------- */
function viewUsers(main){
  const nin=el("input",{class:"txt grow",id:"newuser",placeholder:"Naam",autocomplete:"off","aria-label":"Naam nieuwe gebruiker"});
  const add=()=>{ const n=nin.value.trim(); if(!n)return; if(nameTaken(n)){ S.userMsg="Er is al een gebruiker met de naam "+n+"."; render(); return; }
    const id=addUser(n); S.userMsg=""; switchProfile(id); };
  nin.addEventListener("keydown",e=>{if(e.key==="Enter")add();});
  main.append(el("div",{class:"card"},el("h2",{},"Gebruiker toevoegen"),el("p",{class:"prose"},"Iedere gebruiker heeft eigen transacties, regels, budgetten en vermogen."),
    el("div",{class:"addrule"},nin,el("button",{class:"btn pri",onclick:add},"Toevoegen"))));
  if(S.userMsg)main.append(el("div",{class:"note",role:"status"},S.userMsg));
  const sec=el("section",{class:"group"},el("div",{class:"ghead"},el("span",{},PROFILES.length+(PROFILES.length===1?" gebruiker":" gebruikers")),el("span",{class:"of"},"op dit toestel")));
  for(const p of PROFILES){ const cur=p.id===profile, n=userKeys(p.id).filter(k=>k.includes(":tx-")).length;
    const name=el("input",{class:"txt",value:p.name,"aria-label":"Naam van "+p.name,onchange:e=>{ const v=e.target.value.trim();
      if(!v||nameTaken(v,p.id)){ S.userMsg=v?"Er is al een gebruiker met de naam "+v+".":"Een naam mag niet leeg zijn."; render(); return; }
      p.name=v; saveUsers(); S.userMsg=""; if(cur)document.title="Huishoudboek · "+v; render(); }});
    sec.append(el("div",{class:"urow"},name,el("span",{class:"of"},cur?"actief":n?n+(n===1?" maand":" maanden")+" ingelezen":"nog leeg"),
      el("span",{class:"acts"},cur?el("span",{class:"icon-sp"}):el("button",{class:"btn sm",onclick:()=>{ S.userMsg=""; S.tab="overzicht"; switchProfile(p.id); }},"Openen"),
        PROFILES.length>1?el("button",{class:"icon",title:"Verwijderen","aria-label":"Gebruiker "+p.name+" verwijderen",onclick:()=>{
          if(!confirm("Gebruiker "+p.name+" en al diens gegevens van dit toestel verwijderen? Maak eerst een back-up als je die nog wilt bewaren."))return;
          deleteUser(p.id); S.userMsg=p.name+" is verwijderd."; render(); }},"×"):null))); }
  main.append(sec);
}

/* ---------- rondleiding ---------- */
// Een rondleiding met tooltips voor wie de app voor het eerst opent. Elke stap kan een tabblad openen en wijst een
// onderdeel aan; ontbreekt dat onderdeel, dan staat de uitleg midden in beeld. Bij "?" start hij opnieuw.
const TOUR_KEY="hhb-rondleiding-gezien";
const TOUR=[
  {title:"Welkom bij je Huishoudboek",text:"In een paar stappen laten we zien hoe het werkt. Alles wat je invult blijft op dit toestel; er gaat niets naar een server."},
  {target:"#profiles",title:"Wie ben jij?",text:"Kies hier je naam. Iedere gebruiker heeft eigen transacties, budgetten en regels. Met + voeg je gebruikers toe of pas je ze aan."},
  {target:"#tabs",title:"De onderdelen",text:"Met deze tabbladen ga je naar je overzicht en budget, je vermogen, je transacties, je regels en het inlezen van bankbestanden."},
  {tab:"importeren",target:".drop .btn.pri",title:"1. Lees je bankexport in",text:"Download bij ABN AMRO je mutaties als Excel of TXT en kies dat bestand hier. Je mag overlappende periodes inlezen; dubbele transacties worden overgeslagen."},
  {tab:"transacties",target:"#tabs [data-tab=transacties]",title:"2. Controleer je transacties",text:"Hier zie je alles wat je hebt ingelezen, met soort betaling, plaats en omschrijving. Tik op een transactie voor alle details. Kies een categorie, of tik op ＋ Regel zodat vergelijkbare transacties voortaan vanzelf goed gaan."},
  {tab:"regels",target:"#ai-card",title:"3. Laat AI je transacties indelen",text:"In het tabblad Regels en AI maakt een AI-chat zoals Claude of ChatGPT regels voor je, in drie stappen: vraag kopiëren, in de chat plakken, antwoord terugplakken. De knop ✨ Laat AI indelen brengt je hier vanaf elk scherm."},
  {tab:"overzicht",target:"#budget-btn",title:"4. Vul je budget in",text:"In een tabel met een rij per categorie en een kolom per maand. Bij Elke maand vul je één bedrag in voor het hele jaar."},
  {tab:"overzicht",target:".hero",title:"5. Zie hoe je ervoor staat",text:"Bovenaan staat wat er over is in de gekozen maand of het jaar. Daaronder per categorie wat je uitgaf ten opzichte van je budget; rood betekent erover. Met Vergelijk per maand zie je per post en per maand hoe je op budget zit."},
  {tab:"importeren",target:"#backup-card",title:"Maak af en toe een back-up",text:"Je gegevens staan alleen op dit toestel. Met een back-up raak je niets kwijt en kun je overstappen naar een ander toestel."},
  {target:"#help",title:"Klaar!",text:"Begin met het inlezen van je bankexport. Deze rondleiding kun je altijd opnieuw bekijken met de ?-knop."}
];
let tourIdx=-1, tourBack=null, tourEls=null;
function startTour(){ if(tourIdx>=0)return; tourBack=S.tab; tourIdx=0;
  const shade=el("div",{class:"tour-shade","aria-hidden":"true"}), spot=el("div",{class:"tour-spot","aria-hidden":"true"});
  const tip=el("div",{class:"tour-tip",role:"dialog","aria-modal":"true","aria-labelledby":"tour-title","aria-describedby":"tour-text"});
  document.body.append(shade,spot,tip); tourEls={shade,spot,tip};
  addEventListener("resize",placeTour); addEventListener("scroll",placeTour,true); document.addEventListener("keydown",tourKey,true);
  showTourStep(); }
function endTour(){ if(tourIdx<0)return; tourIdx=-1; for(const e of Object.values(tourEls))e.remove(); tourEls=null;
  removeEventListener("resize",placeTour); removeEventListener("scroll",placeTour,true); document.removeEventListener("keydown",tourKey,true);
  try{ localStorage.setItem(TOUR_KEY,"1"); }catch(e){}
  const back=S.tx.length?tourBack:"importeren"; if(back&&S.tab!==back){ S.tab=back; tourNav(); } $("#help")?.focus(); }
// Wisselt van tabblad zonder extra stappen in de terug-geschiedenis.
function tourNav(){ try{ history.replaceState({...(history.state||viewState(0)),tab:S.tab},"","#"+S.tab); }catch(e){} render(); }
function tourKey(e){ if(e.key==="Escape"){ e.preventDefault(); endTour(); } else if(e.key==="ArrowRight"){ e.preventDefault(); tourStep(1); } else if(e.key==="ArrowLeft"){ e.preventDefault(); tourStep(-1); }
  else if(e.key==="Tab"){ const f=[...tourEls.tip.querySelectorAll("button")]; const i=f.indexOf(document.activeElement); e.preventDefault(); f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus(); } }
function tourStep(d){ const n=tourIdx+d; if(n<0)return; if(n>=TOUR.length){ endTour(); return; } tourIdx=n; showTourStep(); }
function showTourStep(){ const st=TOUR[tourIdx], last=tourIdx===TOUR.length-1;
  if(st.tab&&S.tab!==st.tab){ S.tab=st.tab; if(st.tab==="overzicht")S.editBudget=false; tourNav(); }
  const t=st.target&&document.querySelector(st.target); if(t)t.scrollIntoView({block:"center",inline:"nearest"});
  const {tip}=tourEls;
  tip.replaceChildren(el("div",{class:"tour-count"},(tourIdx+1)+" van "+TOUR.length),el("h2",{id:"tour-title"},st.title),el("p",{id:"tour-text"},st.text),
    el("div",{class:"tour-btns"},last?el("span"):el("button",{class:"linkbtn",onclick:endTour},"Overslaan"),
      el("span",{class:"tour-nav"},tourIdx?el("button",{class:"btn",onclick:()=>tourStep(-1)},"Vorige"):null,
        el("button",{class:"btn pri",id:"tour-next",onclick:()=>tourStep(1)},last?"Aan de slag":tourIdx?"Volgende":"Rondleiding starten"))));
  placeTour(); $("#tour-next").focus({preventScroll:true}); }
function placeTour(){ if(tourIdx<0)return; const st=TOUR[tourIdx], {spot,tip,shade}=tourEls, t=st.target&&document.querySelector(st.target);
  const vw=innerWidth, vh=innerHeight, pad=6, gap=12, tw=Math.min(360,vw-32);
  tip.style.width=tw+"px";
  const r=t&&t.getClientRects().length?t.getBoundingClientRect():null;
  if(!r){ spot.hidden=true; shade.hidden=false; tip.classList.add("center"); tip.style.left=Math.round((vw-tw)/2)+"px"; tip.style.top=Math.round(Math.max(16,(vh-tip.offsetHeight)/2))+"px"; return; }
  shade.hidden=true; spot.hidden=false; tip.classList.remove("center");
  Object.assign(spot.style,{left:(r.left-pad)+"px",top:(r.top-pad)+"px",width:(r.width+pad*2)+"px",height:(r.height+pad*2)+"px"});
  const th=tip.offsetHeight, below=r.bottom+pad+gap+th<=vh-8, top=below?r.bottom+pad+gap:Math.max(8,r.top-pad-gap-th);
  const left=Math.min(vw-tw-16,Math.max(16,r.left+r.width/2-tw/2));
  tip.style.top=Math.round(top)+"px"; tip.style.left=Math.round(left)+"px";
  tip.dataset.side=below?"below":"above"; tip.style.setProperty("--arrow",Math.round(Math.min(tw-24,Math.max(24,r.left+r.width/2-left)))+"px"); }

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
$("#help").addEventListener("click",startTour);
$("#tabs").addEventListener("click",e=>{const b=e.target.closest("button[data-tab]"); if(b&&b.dataset.tab!==S.tab){S.tab=b.dataset.tab;go();}});
addEventListener("pagehide",flushSaves); document.addEventListener("visibilitychange",()=>{if(document.hidden)flushSaves();});
if("serviceWorker" in navigator&&location.protocol!=="file:")navigator.serviceWorker.register("sw.js",{updateViaCache:"none"}).then(r=>r.update()).catch(()=>{});
boot();
// Eerste keer: rondleiding starten (niet als er al gegevens zijn van vóór deze versie).
try{ if(!localStorage.getItem(TOUR_KEY)){ if(S.tx.length||S.rules.length)localStorage.setItem(TOUR_KEY,"1"); else setTimeout(startTour,300); } }catch(e){}
