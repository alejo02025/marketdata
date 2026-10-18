import {useCallback,useEffect,useMemo,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Activity,ArrowDownRight,ArrowUpRight,BarChart3,BookOpen,Check,ChevronDown,ChevronRight,Clock3,Copy,ExternalLink,Filter,Info,Menu,Plus,RefreshCw,Search,ShieldAlert,ShieldCheck,Target,TrendingUp,X} from 'lucide-react';
import PriceChart from './PriceChart';
import {money,percentage,readLocal,saveLocal,shortDate,sourceLinks,statusColor,tickers,validTicker} from './market';
import type {Asset,Daily,Snapshot} from './market';
import './style.css';

type Page='radar'|'analysis'|'daily';
const names:Record<Page,string>={radar:'Radar',analysis:'Análisis',daily:'Daily'};
const filters=['Todos','Oportunidad de Entrada','Ruptura Confirmada','En Seguimiento / Precaución','Riesgo Creciente / Deterioro','Sin Ventaja Identificada'];
const order:Record<string,number>={'Oportunidad de Entrada':0,'Ruptura Confirmada':1,'En Seguimiento / Precaución':2,'Riesgo Creciente / Deterioro':3,'Sin Ventaja Identificada':4,'Insuficiente':5};
const finviz=(t:string)=>'https://finviz.com/quote.ashx?t='+encodeURIComponent(t.replace('.','-'));
const yahoo=(t:string)=>'https://finance.yahoo.com/quote/'+encodeURIComponent(t.replace('.','-'));
function shortStatus(status:string){return status==='Oportunidad de Entrada'?'Posible entrada':status==='Ruptura Confirmada'?'Ruptura':status==='En Seguimiento / Precaución'?'En seguimiento':status==='Riesgo Creciente / Deterioro'?'Precaución':'Sin señal'}
function strategyTitle(code:string){return code==='ema20_touch'?'Toque EMA 20':code==='golden_cross'?'Golden Cross':code==='breakout'?'Ruptura de máximos':'Señal técnica'}
function stageShort(stage:string){return stage==='Rebote confirmado'?'Confirmada':stage==='Alerta temprana'?'En observación':stage==='Confirmación de tendencia'?'Tendencia confirmada':stage==='Ruptura confirmada'?'Confirmada':'Histórica'}
function displayDate(date:string){const d=new Date(date+'T12:00:00Z');return Number.isNaN(d.getTime())?date:d.toLocaleDateString('es-AR',{timeZone:'UTC',day:'2-digit',month:'short'})}
function Status({name}:{name:string}){return <span className={'status-chip '+statusColor(name)}><span className="status-dot"/>{name}</span>}
function LinkOut({href,children}:{href:string;children:React.ReactNode}){return <a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={13}/></a>}
function MetaMetric({label,value,detail,variant}:{label:string;value:string;detail?:string;variant?:string}){return <div className="market-metric"><span>{label}</span><strong className={variant||''}>{value}</strong>{detail&&<small>{detail}</small>}</div>}
function PulseBackdrop(){return <div className="ambient-market" aria-hidden="true"><div className="aurora glow-a"/><div className="aurora glow-b"/><div className="grid-glow"/><div className="market-wave wave-one"/><div className="market-wave wave-two"/></div>}
function RatingGroup({title,tone,items}:{title:string;tone:string;items:string[]}){return <section className={'signal-points '+tone}><div className="points-title"><span className="point-icon"/>{title}<strong>{items.length}</strong></div>{items.length?<ul>{items.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p className="unavailable">Sin observaciones concluyentes.</p>}</section>}
function BacktestPanel({asset}:{asset:Asset}){
 const bt=asset.backtest,full=bt?.full,oos=bt?.outOfSample;
 const fmt=(v:number|null|undefined,unit='')=>v==null||!Number.isFinite(v)?'—':v.toFixed(2)+unit;
 return <section className="backtest-panel">
  <div className="module-header"><div><span className="eyebrow">RESEARCH / HISTORICAL SIMULATION</span><h3>Backtesting de la estrategia</h3></div><span className="warning-mark">RESULTADOS HISTÓRICOS · SESGADOS</span></div>
  {bt&&full&&oos?<><p className="panel-note">Período {bt.period.from} a {bt.period.to}. Validación cronológica desde {bt.period.outOfSampleStart}. Comisiones y deslizamiento: {bt.feeAndSlippagePerSidePct.toFixed(2)}% por operación.</p>
  <div className="backtest-grid"><div className="backtest-col"><h4>Período completo</h4><div><span>Operaciones</span><b>{full.trades}</b></div><div><span>Retorno estrategia</span><b>{fmt(full.totalReturnPct,'%')}</b></div><div><span>Buy & Hold</span><b>{fmt(full.buyHoldReturnPct,'%')}</b></div><div><span>Máximo drawdown</span><b>{fmt(full.maxDrawdownPct,'%')}</b></div><div><span>Win rate</span><b>{fmt(full.winRate,'%')}</b></div><div><span>Profit factor</span><b>{fmt(full.profitFactor)}</b></div></div>
  <div className="backtest-col"><h4>Último 40% cronológico</h4><div><span>Operaciones</span><b>{oos.trades}</b></div><div><span>Retorno estrategia</span><b>{fmt(oos.totalReturnPct,'%')}</b></div><div><span>Buy & Hold</span><b>{fmt(oos.buyHoldReturnPct,'%')}</b></div><div><span>Sharpe</span><b>{fmt(oos.sharpe)}</b></div><div><span>Sortino</span><b>{fmt(oos.sortino)}</b></div><div><span>Retorno medio/trade</span><b>{fmt(oos.avgTradePct,'%')}</b></div></div></div>
  <details className="backtest-method"><summary>Ver método y limitaciones</summary><p>{bt.method}</p><ul>{bt.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>
  <p className="method-warning"><ShieldAlert size={16}/> Muestra con sesgo de supervivencia, sin validación prospectiva. No es prueba de rentabilidad futura.</p>
  </>:<div className="empty-coverage"><Info size={18}/> No se realizó aún un backtest de este activo. No se publican estadísticas ficticias.</div>}
 </section>
}
export default function App(){
 const [page,setPage]=useState<Page>('radar');
 const [ticker,setTicker]=useState('GOOGL');
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [daily,setDaily]=useState<Daily|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState('Señal');
 const [filter,setFilter]=useState('Todos');
 const [watch,setWatch]=useState<string[]>(()=>{const data=readLocal<string[]>('market-radar-watch-v1',tickers);return Array.isArray(data)?data.filter((x):x is string=>typeof x==='string'&&validTicker(x)).slice(0,100):tickers});
 const [newTicker,setNewTicker]=useState('');
 const [toast,setToast]=useState('');
 const [navOpen,setNavOpen]=useState(false);
 const assets=snapshot?.assets||{};
 const fetchData=useCallback(async()=>{
  setLoading(true);
  try{
   const p=await fetch(import.meta.env.BASE_URL+'data/market.json?cache='+Date.now(),{cache:'no-store'});
   if(!p.ok)throw new Error('Todavía no se publicó un snapshot de mercado.');
   const data:Snapshot=await p.json();
   if(data.schema<3||!data.assets||!Object.keys(data.assets).length)throw new Error('Las señales avanzadas todavía están actualizándose.');
   setSnapshot(data);setError('');
  }catch(e){setError(e instanceof Error?e.message:'Error al leer datos.');setSnapshot(null)}
  finally{setLoading(false)}
 },[]);
 useEffect(()=>{fetchData()},[fetchData]);
 useEffect(()=>{saveLocal('market-radar-watch-v1',watch)},[watch]);
 useEffect(()=>{
  fetch(import.meta.env.BASE_URL+'data/daily.json?cache='+Date.now(),{cache:'no-store'})
   .then(r=>{if(!r.ok)throw new Error('Sin edición');return r.json()})
   .then((d:Daily)=>{if(d.schema===1&&typeof d.bodyMarkdown==='string')setDaily(d)})
   .catch(()=>setDaily(null));
 },[]);
 const current=assets[ticker];
 const runDate=snapshot?.generatedAt?shortDate(snapshot.generatedAt):null;
 const changedSince=snapshot?.generatedAt?Math.max(0,(Date.now()-new Date(snapshot.generatedAt).getTime())/3600000):null;
 const aged=changedSince!=null&&changedSince>40;
 const results=useMemo(()=>{
  let list=watch.filter(t=>t.toLowerCase().includes(query.toLowerCase())||(assets[t]?.company||'').toLowerCase().includes(query.toLowerCase()));
  if(filter!=='Todos')list=list.filter(t=>assets[t]?.signal.status===filter);
  if(sort==='Señal')list.sort((a,b)=>(order[assets[a]?.signal.status]??9)-(order[assets[b]?.signal.status]??9)||((assets[b]?.signal.score??-1)-(assets[a]?.signal.score??-1)));
  if(sort==='Score')list.sort((a,b)=>(assets[b]?.signal.score??-1)-(assets[a]?.signal.score??-1));
  if(sort==='RVOL')list.sort((a,b)=>(assets[b]?.signal.relativeVolume??-1)-(assets[a]?.signal.relativeVolume??-1));
  if(sort==='RSI')list.sort((a,b)=>(assets[b]?.signal.rsi14??-1)-(assets[a]?.signal.rsi14??-1));
  if(sort==='52W')list.sort((a,b)=>(assets[b]?.signal.distance52High??-999)-(assets[a]?.signal.distance52High??-999));
  if(sort==='Ticker')list.sort();
  return list;
 },[watch,query,filter,sort,snapshot]);
 const opportunities=watch.filter(t=>['Oportunidad de Entrada','Ruptura Confirmada'].includes(assets[t]?.signal.status)||(assets[t]?.signal.setups||[]).some(x=>x.code==='golden_cross'));
 const signalEvents=useMemo(()=>{
  const rows=watch.flatMap(t=>(assets[t]?.recentSignals||[]).map(h=>({...h,ticker:t,lastSession:assets[t].lastSession,currency:assets[t].currency}))).sort((a,b)=>b.date.localeCompare(a.date)||b.score-a.score);
  const seen=new Set<string>();
  return rows.filter(h=>{const key=h.ticker+'|'+(h.setupCode||h.status);if(seen.has(key))return false;seen.add(key);return true}).slice(0,9);
 },[snapshot,watch]);
 const todayEvents=watch.flatMap(t=>(assets[t]?.signal.setups||[]).map(h=>({...h,ticker:t,date:assets[t].lastSession,price:assets[t].price,currency:assets[t].currency}))).slice(0,6);
 const risks=watch.filter(t=>assets[t]?.signal.status==='Riesgo Creciente / Deterioro');
 const pending=watch.filter(t=>assets[t]?.signal.status==='En Seguimiento / Precaución');
 function go(which:Page){setPage(which);setNavOpen(false);setToast('')}
 function analyze(t:string){setTicker(t);go('analysis')}
 function addTicker(e:React.FormEvent){e.preventDefault();const s=newTicker.trim().toUpperCase();if(!validTicker(s)){setToast('El ticker no es válido.');return}setWatch(w=>Array.from(new Set([s,...w])));setNewTicker('');setToast('Ticker agregado. Aparecerá sin cobertura hasta el próximo refresh autorizado.')}
 async function copyDaily(){
  if(!daily?.bodyMarkdown)return;
  try{await navigator.clipboard.writeText(daily.bodyMarkdown);setToast('Briefing copiado, sin modificar el texto.')}catch{setToast('No se pudo copiar automáticamente desde el navegador.')}
 }
 return <div className="radar-app"><PulseBackdrop/>
 <header className="app-header"><div className="nav-inner">
  <button className="identity" onClick={()=>go('radar')}><span className="identity-mark"><img src={import.meta.env.BASE_URL+'logo.svg'} alt="Market Radar" width="39" height="39"/></span><span className="identity-label"><b>MARKET<span>RADAR</span></b><small>SIGNAL INTELLIGENCE</small></span></button>
  <nav className={'header-tabs '+(navOpen?'expanded':'')} aria-label="Secciones principales">{(['radar','analysis','daily'] as Page[]).map(p=><button key={p} className={page===p?'active':''} onClick={()=>go(p)}>{names[p]}</button>)}</nav>
  <div className="header-meta"><span className="market-pill"><i/> {snapshot?'COBERTURA '+snapshot.coverageCount:'SIN DATOS'}</span><span className="top-date">{runDate||'Esperando cierre'}</span><button className="header-refresh" onClick={fetchData} aria-label="Actualizar datos"><RefreshCw size={16}/></button></div>
  <button className="nav-toggle" onClick={()=>setNavOpen(!navOpen)} aria-label="Menú"><Menu size={21}/></button>
 </div></header>
 <main className="site-main">
 {toast&&<div className="toast-modern" role="status"><Info size={16}/>{toast}<button aria-label="Cerrar" onClick={()=>setToast('')}><X size={16}/></button></div>}
 {error&&<div className="source-warning"><ShieldAlert size={17}/>{error} No hay precios simulados.</div>}
 {aged&&<div className="source-warning"><Clock3 size={16}/> Snapshot desactualizado: último refresh {runDate}. No interpretarlo como señal intradía.</div>}

 {page==='radar'&&<>
  <div className="simple-heading"><div><h1>Radar<span className="title-pulse"/></h1><p>Oportunidades en acciones de EE. UU.</p></div><div className="simple-update"><span className="update-dot"/>{runDate?'Último cierre · '+runDate:'Sin datos verificados'}<button onClick={fetchData} aria-label="Actualizar datos"><RefreshCw size={15}/></button></div></div>
  <div className="simple-stats">
   <div className="simple-stat"><b>{snapshot?String(todayEvents.length).padStart(2,'0'):'—'}</b><span>Alertas del cierre</span></div>
   <div className="simple-stat"><b>{snapshot?String(signalEvents.length).padStart(2,'0'):'—'}</b><span>Señales recientes</span></div>
   <div className="simple-stat"><b>{snapshot?String(risks.length).padStart(2,'0'):'—'}</b><span>En precaución</span></div>
   <div className="simple-stat"><b>{snapshot?String(snapshot.coverageCount).padStart(2,'0'):'—'}</b><span>Activos con datos</span></div>
  </div>
  <div className="simple-section-title"><div><span className="mini-label">01 / DETECTOR</span><h2>Alertas del último cierre</h2></div><span className="section-count">{todayEvents.length} señales</span></div>
  {todayEvents.length?<div className="simple-cards">{todayEvents.map((h,i)=><button className="simple-signal-card" key={h.ticker+h.code+i} onClick={()=>analyze(h.ticker)}>
   <div className="simple-card-top"><strong>{h.ticker}</strong><span className={'simple-stage '+(h.stage==='Alerta temprana'?'watch':'active')}>{stageShort(h.stage)}</span></div>
   <div className="simple-card-main"><span>{strategyTitle(h.code)}</span><b>{money(h.price,h.currency)}</b></div>
   <div className="simple-card-foot"><span>{displayDate(h.date)}</span><span>Ver gráfico <ChevronRight size={15}/></span></div>
  </button>)}</div>:<div className="simple-empty"><Check size={19}/><div><b>Sin alertas nuevas</b><span>Podés revisar las últimas señales más abajo.</span></div></div>}
  <div className="simple-section-title"><div><span className="mini-label">02 / HISTORIAL</span><h2>Últimas oportunidades</h2></div><span className="section-count">Siempre visibles</span></div>
  {signalEvents.length?<div className="simple-cards history">
  {signalEvents.map((h,i)=><button className="simple-signal-card past" key={h.ticker+h.date+(h.setupCode||'')+i} onClick={()=>analyze(h.ticker)}>
   <div className="simple-card-top"><strong>{h.ticker}</strong><span className="simple-past-date">{displayDate(h.date)}</span></div>
   <div className="simple-card-main"><span>{h.setupLabel||strategyTitle(h.setupCode||'')}</span><b>{money(h.price,h.currency)}</b></div>
   <div className="simple-card-foot"><span>{stageShort(h.stage||'')}</span><span>Analizar <ChevronRight size={15}/></span></div>
  </button>)}
  </div>:<div className="simple-empty"><Clock3 size={19}/><div><b>Preparando historial</b><span>Se mostrarán señales reales cuando haya datos verificados.</span></div></div>}
  <div className="simple-section-title"><div><span className="mini-label">03 / MERCADO</span><h2>Explorar activos</h2></div><span className="section-count">{results.length} de {watch.length}</span></div>
  <div className="simple-filters"><div className="finder"><Search size={16}/><input aria-label="Buscar ticker" placeholder="Buscar acción..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="select-wrap"><Filter size={14}/><select aria-label="Filtrar señales" value={filter} onChange={e=>setFilter(e.target.value)}>{filters.map(f=><option key={f} value={f}>{f==='Oportunidad de Entrada'?'Posible entrada':f==='Ruptura Confirmada'?'Ruptura':f==='En Seguimiento / Precaución'?'En seguimiento':f==='Riesgo Creciente / Deterioro'?'Precaución':f==='Sin Ventaja Identificada'?'Sin señal':f}</option>)}</select><ChevronDown size={13}/></div><form className="ticker-add" onSubmit={addTicker}><input aria-label="Nuevo ticker" placeholder="Ticker" value={newTicker} onChange={e=>setNewTicker(e.target.value)}/><button type="submit" aria-label="Añadir ticker"><Plus size={16}/></button></form></div>
  <div className="simple-table-wrap"><table className="simple-table"><thead><tr><th>Activo</th><th>Último cierre</th><th>Cambio</th><th>RSI</th><th>Señal</th><th/></tr></thead><tbody>{results.map(t=>{const a=assets[t];return <tr key={t} tabIndex={0} role="button" onClick={()=>analyze(t)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();analyze(t)}}}><td><strong>{t}</strong><small>{a?.company||'Sin cobertura'}</small></td><td>{money(a?.price,a?.currency)}</td><td className={(a?.changePct||0)>=0?'up':'down'}>{percentage(a?.changePct,true)}</td><td>{a?.signal.rsi14?.toFixed(0)||'—'}</td><td><span className={'simple-status '+statusColor(a?.signal.status||'')}>{a?shortStatus(a.signal.status):'Sin datos'}</span></td><td><ChevronRight size={15}/></td></tr>})}</tbody></table>{results.length===0&&<div className="simple-empty">No hay activos para este filtro.</div>}</div>
  <details className="simple-disclosure"><summary>¿Cómo funcionan las señales?</summary><div><p><b>Toque EMA 20:</b> posible entrada cuando una vela toca la media móvil de 20 días en una tendencia alcista.</p><p><b>Golden Cross:</b> cruce SMA 50 / SMA 200 con volumen; confirma tendencia, no un precio óptimo de entrada.</p><p><b>Ruptura:</b> precio supera máximos previos con volumen.</p><p>Son alertas técnicas experimentales, no recomendaciones automáticas. Los scores no son probabilidades. Los datos son del último cierre verificado.</p></div></details>
 </>}

 {page==='analysis'&&<>
  <div className="simple-heading"><div><h1>Análisis<span className="title-pulse"/></h1><p>Precio, tendencia y señales</p></div><div className="asset-select"><select aria-label="Activo seleccionado" value={ticker} onChange={e=>setTicker(e.target.value)}>{[...new Set([ticker,...watch])].map(t=><option key={t}>{t}</option>)}</select><ChevronDown size={15}/></div></div>
  {current?<>
   <div className="simple-asset-header">
    <div><span className="mini-label">{current.company}</span><div className="simple-asset-quote"><b>{ticker}</b><strong>{money(current.price,current.currency)}</strong><span className={current.changePct>=0?'up':'down'}>{percentage(current.changePct,true)}</span></div></div>
    <div className="simple-asset-state"><span className={'simple-status '+statusColor(current.signal.status)}>{shortStatus(current.signal.status)}</span><small>{displayDate(current.lastSession)} · {current.dataStatus}</small></div>
   </div>
   <section className="chart-card"><PriceChart ticker={ticker} candles={current.candles}/></section>
   <div className="simple-indicators">
    <div><span>EMA 20</span><strong>{money(current.signal.ema20,current.currency)}</strong></div>
    <div><span>SMA 200</span><strong>{money(current.signal.sma200,current.currency)}</strong></div>
    <div><span>RSI</span><strong>{current.signal.rsi14?.toFixed(1)||'—'}</strong></div>
    <div><span>Volumen relativo</span><strong>{current.signal.relativeVolume?.toFixed(2)||'—'}x</strong></div>
   </div>
   <div className="simple-analysis-signal">
    <div className="simple-section-title"><div><span className="mini-label">SEÑAL TÉCNICA</span><h2>¿Qué está pasando?</h2></div><span className={'simple-status '+statusColor(current.signal.status)}>{shortStatus(current.signal.status)}</span></div>
    {current.signal.setups?.length?<div className="simple-active-strategies">{current.signal.setups.map(x=><div className="simple-strategy" key={x.code}><span>{strategyTitle(x.code)}</span><strong>{stageShort(x.stage)}</strong></div>)}</div>:<div className="simple-standby">Sin evento activo en el último cierre.</div>}
    <details className="simple-disclosure"><summary>Ver explicación y condiciones de riesgo</summary><p>{current.signal.reason}</p>{current.signal.setups?.map(x=><div key={x.code}><b>{x.label} — {x.stage}</b><p>{x.reason}</p><p><b>Invalidación:</b> {x.invalidation}</p></div>)}<p>Señales técnicas experimentales; no aseguran rentabilidad. Los datos son del último cierre.</p></details>
   </div>
   <details className="simple-disclosure advanced-report"><summary>Indicadores avanzados, contexto y backtesting</summary>
    <div className="advanced-inner">
     <div className="points-layout"><RatingGroup title="Alcistas" tone="bullish" items={current.signal.bullish||[]}/><RatingGroup title="Bajistas" tone="bearish" items={current.signal.bearish||[]}/><RatingGroup title="Neutrales" tone="neutral" items={current.signal.neutral||[]}/></div>
     <div className="interpretation"><div><h3>Continuación</h3><p>{current.signal.continuation||'Sin análisis.'}</p></div><div><h3>Ruptura fallida</h3><p>{current.signal.fakeout||'Sin análisis.'}</p></div><div><h3>Invalidación</h3><p>{current.signal.invalidation||'Sin análisis.'}</p></div></div>
     <BacktestPanel asset={current}/>
     <p className="advanced-note">CMF/OBV son indicadores indirectos; no confirman compras de fondos. <LinkOut href={finviz(ticker)}>Ver datos externos en Finviz</LinkOut> · <LinkOut href={yahoo(ticker)}>Yahoo Finance</LinkOut></p>
    </div>
   </details>
  </>:<div className="simple-empty"><Info size={20}/><div><b>Sin datos disponibles</b><span>Este ticker requiere un histórico verificado.</span></div></div>}
 </>}
 {page==='daily'&&<>
  <div className="page-title"><div><span className="eyebrow">DAILY RESEARCH / ARGENTINA & GLOBAL MARKETS</span><h1>Market Daily<span>.</span></h1><p>El mismo texto base del briefing matutino del chat, presentado en formato editorial.</p></div>{daily?.status==='published'&&<button className="copy-button" onClick={copyDaily}><Copy size={15}/> Copiar briefing exacto</button>}</div>
  <div className="daily-hero"><div><span className="eyebrow">MORNING BRIEF · NIVEL B1 + ESPAÑOL</span><h2>LO QUE NECESITÁS SABER<br/>PARA ARRANCAR LA JORNADA.</h2><p>Mercados internacionales, Argentina, tasas, dólares, bonos, riesgos y calendario.</p></div><div className="daily-date">{daily?.date||new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'})}</div></div>
  {daily?.status==='published'&&daily.bodyMarkdown.trim()?<article className="daily-article"><div className="daily-meta"><BookOpen size={17}/> Edición {daily.date} · contenido compartido con briefing de ChatGPT cuando la automatización pueda publicarlo</div><ReactMarkdown remarkPlugins={[remarkGfm]}>{daily.bodyMarkdown}</ReactMarkdown></article>:
    <section className="daily-pending"><BookOpen size={29}/><h3>No hay edición verificada publicada todavía</h3><p>La web está preparada para recibir el mismo texto Markdown del briefing diario. No se copian titulares ni cifras de jornadas anteriores bajo la fecha de hoy.</p><small>Archivo compartido: public/data/daily.json · la entrega por ChatGPT sigue siendo independiente hasta completar la sincronización.</small></section>}
  <div className="module-header"><div><span className="eyebrow">RESEARCH DESK</span><h2>Fuentes prioritarias</h2></div></div><div className="source-grid">{sourceLinks.map(s=><a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="source-tile"><span>{s.label.slice(0,1)}</span><h3>{s.label}</h3><p>{s.description}</p><ExternalLink size={15}/></a>)}</div>
 </>}
 </main></div>;
}
