import {lazy,Suspense,useCallback,useEffect,useMemo,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Activity,ArrowDownRight,ArrowUpRight,BarChart3,BookOpen,Check,ChevronDown,ChevronRight,Clock3,Copy,ExternalLink,Filter,Info,Menu,Plus,RefreshCw,Search,ShieldAlert,ShieldCheck,Target,TrendingUp,X} from 'lucide-react';
const PriceChart=lazy(()=>import('./PriceChart'));
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
function strategyTitle(code:string){return code==='trend_pullback'?'Recuperación de tendencia':code==='trend_breakout'?'Ruptura con fortaleza':code==='ema20_touch'?'Toque EMA 20':code==='golden_cross'?'Golden Cross':code==='breakout'?'Ruptura de máximos':'Señal técnica'}
function stageShort(stage:string){return stage==='Confirmación'?'Confirmada':stage==='Observación'?'En estudio':stage==='Rebote confirmado'?'Rebote confirmado':stage==='Alerta temprana'?'Alerta temprana':stage==='Confirmación de tendencia'?'Tendencia confirmada':stage==='Ruptura confirmada'?'Ruptura confirmada':'Histórica'}
function assetStatus(a:Asset){return a.signal.decision?.state||shortStatus(a.signal.status)}
function displayDate(date:string){const d=new Date(date+'T12:00:00Z');return Number.isNaN(d.getTime())?date:d.toLocaleDateString('es-AR',{timeZone:'UTC',day:'2-digit',month:'short'})}
function Status({name}:{name:string}){return <span className={'status-chip '+statusColor(name)}><span className="status-dot"/>{name}</span>}
function LinkOut({href,children}:{href:string;children:React.ReactNode}){return <a href={href} target="_blank" rel="noopener noreferrer">{children}<ExternalLink size={13}/></a>}
function MetaMetric({label,value,detail,variant}:{label:string;value:string;detail?:string;variant?:string}){return <div className="market-metric"><span>{label}</span><strong className={variant||''}>{value}</strong>{detail&&<small>{detail}</small>}</div>}
function PulseBackdrop(){return <div className="ambient-market" aria-hidden="true"><div className="aurora glow-a"/><div className="aurora glow-b"/><div className="grid-glow"/><div className="market-wave wave-one"/><div className="market-wave wave-two"/></div>}
function focusTone(state:string){return state.includes('Entrada')||state.includes('Ruptura')?'entry':state.includes('Cerca')?'near':state.includes('Riesgo')||state.includes('Volatilidad')?'risk':state.includes('Tendencia')?'trend':'quiet'}
function Sparkline({asset}:{asset:Asset}){
 const rows=asset.candles.slice(-105);
 if(rows.length<2)return <div className="board-chart-empty">No hay histórico suficiente</div>;
 const values=rows.map(c=>c.c),lo=Math.min(...values)*.985,hi=Math.max(...values)*1.015;
 const X=(i:number)=>24+i*672/(rows.length-1),Y=(v:number)=>190-(v-lo)/(hi-lo)*157;
 const d=values.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
 const first=rows[0],last=rows[rows.length-1],positive=last.c>=first.c;
 const area=d+' L696 210 L24 210 Z';
 return <div className="board-spark">
  <div className="board-spark-title"><span>EVOLUCIÓN · ÚLTIMAS 105 RUEDAS</span><span className={positive?'up':'down'}>{percentage((last.c/first.c-1)*100,true)}</span></div>
  <svg viewBox="0 0 720 229" role="img" aria-label={'Evolución histórica de '+asset.ticker+' entre '+first.d+' y '+last.d} preserveAspectRatio="none">
   <defs><linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={positive?'#42dbb0':'#ff8f9a'} stopOpacity=".24"/><stop offset="1" stopColor={positive?'#42dbb0':'#ff8f9a'} stopOpacity="0"/></linearGradient></defs>
   {[.2,.5,.8].map(n=><line key={n} x1="24" x2="696" y1={25+n*180} y2={25+n*180} stroke="#2d3d54" strokeDasharray="3 7"/> )}
   <path d={area} fill="url(#spark-fill)"/><path d={d} fill="none" stroke={positive?'#55ddbd':'#fa8798'} strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
   <circle cx={X(values.length-1)} cy={Y(last.c)} r="5" fill={positive?'#55ddbd':'#fa8798'}/>
  </svg>
  <div className="board-spark-dates"><span>{displayDate(first.d)}</span><span>{displayDate(last.d)}</span></div>
 </div>
}
function RatingGroup({title,tone,items}:{title:string;tone:string;items:string[]}){return <section className={'signal-points '+tone}><div className="points-title"><span className="point-icon"/>{title}<strong>{items.length}</strong></div>{items.length?<ul>{items.map((x,i)=><li key={i}>{x}</li>)}</ul>:<p className="unavailable">Sin observaciones concluyentes.</p>}</section>}
function BacktestPanel({asset}:{asset:Asset}){
 const bt=asset.backtest;
 const fmt=(v:number|null|undefined)=>v==null?'—':v.toFixed(2)+'%';
 return <section className="backtest-panel"><h3>Pruebas históricas por estrategia</h3>
 {bt?.strategies?<><p className="panel-note">{bt.period.from} — {bt.period.to}. Costo por lado: {bt.feeAndSlippagePerSidePct}%. Resultados exploratorios, sin validación independiente.</p>
 {Object.entries(bt.strategies).map(([code,r])=><details className="simple-disclosure" key={code}><summary>{strategyTitle(code)} · {r.full?.trades||0} operaciones</summary><div className="chart-data-scroll"><table className="simple-table"><thead><tr><th>Período</th><th>Retorno</th><th>Buy & hold</th><th>SPY</th><th>Win rate</th><th>Drawdown</th><th>Trades</th></tr></thead><tbody>{[['Completo',r.full],['Primer 60%',r.early],['Último 40%*',r.outOfSample],['Costo 0,50%/lado',r.higherCost]].map(([label,value])=>{const m=value as typeof r.full;return <tr key={label as string}><td>{label as string}</td><td>{fmt(m?.totalReturnPct)}</td><td>{fmt(m?.buyHoldReturnPct)}</td><td>{fmt(m?.spyReturnPct)}</td><td>{fmt(m?.winRate)}</td><td>{fmt(m?.maxDrawdownPct)}</td><td>{m?.trades??'—'}</td></tr>})}</tbody></table><p>* Segmento retrospectivo; no equivale a resultados fuera de muestra independientes. Menos de 10 operaciones: evidencia insuficiente.</p></div></details>)}
 <details className="backtest-method"><summary>Método, fuentes y limitaciones</summary><p>{bt.method}</p><ul>{bt.warnings.map(w=><li key={w}>{w}</li>)}</ul><p><LinkOut href="https://www.tradingview.com/pine-script-docs/concepts/strategies/">Metodología de simulación</LinkOut> · <LinkOut href="https://www.aqr.com/-/media/AQR/Documents/Insights/Journal-Article/AQR-JPM-Fall-2017.pdf">Investigación sobre seguimiento de tendencia</LinkOut></p><p>La evidencia sobre seguimiento de tendencia no valida automáticamente las reglas específicas del detector.</p></details></>:<p>Sin prueba por estrategia disponible. No se muestran resultados del motor anterior.</p>}
 </section>
}

export default function App(){
 const [page,setPage]=useState<Page>('radar');
 const [ticker,setTicker]=useState('GOOGL');
 const [snapshot,setSnapshot]=useState<Snapshot|null>(()=>readLocal<Snapshot|null>('market-radar-snapshot-v3',null));
 const [daily,setDaily]=useState<Daily|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('Todas');
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
   setSnapshot(data);saveLocal('market-radar-snapshot-v3',data);setError('');
  }catch(e){setError(e instanceof Error?e.message:'Error al leer datos.')}
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
 const latestSession=Object.values(assets).map(a=>a.lastSession).sort().slice(-1)[0];
 const runDate=latestSession?displayDate(latestSession):null;
 const changedSince=snapshot?.generatedAt?Math.max(0,(Date.now()-new Date(snapshot.generatedAt).getTime())/3600000):null;
 const aged=changedSince!=null&&changedSince>40;
 const boardStocks=useMemo(()=>{
  const list=watch.filter(t=>t.toLowerCase().includes(query.trim().toLowerCase())||(assets[t]?.company||'').toLowerCase().includes(query.trim().toLowerCase()));
  const keep=(t:string)=>{const state=assets[t]?.signal.decision?.state||'Sin señal';
   if(filter==='Entradas')return state==='Entrada a estudiar'||state==='Ruptura a estudiar';
   if(filter==='Cerca')return state==='Cerca de entrada';
   if(filter==='Tendencia')return state==='Tendencia fuerte'||state==='Muy extendida';
   if(filter==='Riesgo')return state==='Riesgo elevado'||state==='Volatilidad alta';
   return true;
  };
  return list.filter(keep).sort((a,b)=>(assets[b]?.signal.decision?.priority??-1)-(assets[a]?.signal.decision?.priority??-1)||a.localeCompare(b));
 },[snapshot,watch,query,filter]);
 const focusAsset=assets[ticker]||boardStocks.map(t=>assets[t]).find(Boolean);
 const focusTicker=focusAsset?.ticker||ticker;
 const assetsCovered=watch.filter(t=>!!assets[t]);
 const entriesCount=assetsCovered.filter(t=>['Entrada a estudiar','Ruptura a estudiar'].includes(assets[t].signal.decision?.state||'')).length;
 const nearCount=assetsCovered.filter(t=>assets[t].signal.decision?.state==='Cerca de entrada').length;
 const trendCount=assetsCovered.filter(t=>assets[t].signal.decision?.state==='Tendencia fuerte').length;
 const riskCount=assetsCovered.filter(t=>['Riesgo elevado','Volatilidad alta'].includes(assets[t].signal.decision?.state||'')).length;
 const signalEvents=useMemo(()=>{
  const rows=watch.flatMap(t=>(assets[t]?.recentSignals||[]).map(h=>({...h,ticker:t,currency:assets[t].currency,lastSession:assets[t].lastSession}))).sort((a,b)=>b.date.localeCompare(a.date)||(b.score??0)-(a.score??0));
  const seen=new Set<string>();
  return rows.filter(h=>{const key=h.ticker+'|'+(h.setupCode||h.status);if(seen.has(key))return false;seen.add(key);return true}).slice(0,8);
 },[snapshot,watch]);
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
  <nav className={'header-tabs '+(navOpen?'expanded':'')} aria-label="Secciones principales">{(['radar','analysis','daily'] as Page[]).map(p=><button key={p} aria-current={page===p?'page':undefined} className={page===p?'active':''} onClick={()=>go(p)}>{names[p]}</button>)}</nav>
  <div className="header-meta"><span className="market-pill"><i/> {snapshot?'COBERTURA '+snapshot.coverageCount:'SIN DATOS'}</span><span className="top-date">{runDate||'Esperando cierre'}</span><button className="header-refresh" onClick={fetchData} aria-label="Actualizar datos"><RefreshCw size={16}/></button></div>
  <button className="nav-toggle" onClick={()=>setNavOpen(!navOpen)} aria-label="Menú" aria-expanded={navOpen}><Menu size={21}/></button>
 </div></header>
 <main className="site-main">
 {toast&&<div className="toast-modern" role="status"><Info size={16}/>{toast}<button aria-label="Cerrar" onClick={()=>setToast('')}><X size={16}/></button></div>}
 {error&&<div className="source-warning"><ShieldAlert size={17}/>{error} Se conserva el último dato disponible.</div>}
 {aged&&<div className="source-warning"><Clock3 size={16}/> Snapshot desactualizado: última descarga {snapshot?.generatedAt}. No interpretarlo como señal intradía.</div>}

 {page==='radar'&&<>
  <div className="simple-heading"><div><h1>Radar<span className="title-pulse"/></h1><p>Oportunidades en acciones de EE. UU.</p></div><div className="simple-update"><span className="update-dot"/>{runDate?'Cierre · '+runDate:'Sin datos verificados'}<button onClick={fetchData} aria-label="Actualizar datos"><RefreshCw size={15}/></button></div></div>
  <div className="simple-stats">
   <div className="simple-stat"><b>{snapshot?String(todayEvents.length).padStart(2,'0'):'—'}</b><span>Alertas del cierre</span></div>
   <div className="simple-stat"><b>{snapshot?String(signalEvents.length).padStart(2,'0'):'—'}</b><span>Señales recientes</span></div>
   <div className="simple-stat"><b>{snapshot?String(risks.length).padStart(2,'0'):'—'}</b><span>En precaución</span></div>
   <div className="simple-stat"><b>{snapshot?String(snapshot.coverageCount).padStart(2,'0'):'—'}</b><span>Activos con datos</span></div>
  </div>
  <div className="simple-section-title"><div><span className="mini-label">01 / DETECTOR</span><h2>Alertas del último cierre</h2></div><span className="section-count">{todayEvents.length} señales</span></div>
  {todayEvents.length?<div className="simple-cards">{todayEvents.map((h,i)=><button className={'simple-signal-card '+(h.stage==='Alerta temprana'?'early':'confirmed')} key={h.ticker+h.code+i} onClick={()=>analyze(h.ticker)}>
   <div className="simple-card-top"><strong>{h.ticker}</strong><span className={'simple-stage '+(h.stage==='Alerta temprana'?'watch':'active')}>{stageShort(h.stage)}</span></div>
   <div className="simple-card-main"><span>{strategyTitle(h.code)}</span><b>{money(h.price,h.currency)}</b></div>
   <div className="simple-card-foot"><span>{displayDate(h.date)} · Cierre</span><span>Ver gráfico <ChevronRight size={15}/></span></div>
  </button>)}</div>:<div className="simple-empty"><Check size={19}/><div><b>Sin alertas nuevas</b><span>Podés revisar las últimas señales más abajo.</span></div></div>}
  <div className="simple-section-title"><div><span className="mini-label">02 / HISTORIAL</span><h2>Señales anteriores</h2></div><span className="section-count">Históricas · precio de la señal</span></div>
  {signalEvents.length?<div className="simple-cards history">
  {signalEvents.map((h,i)=><button className="simple-signal-card past" key={h.ticker+h.date+(h.setupCode||'')+i} onClick={()=>analyze(h.ticker)}>
   <div className="simple-card-top"><strong>{h.ticker}</strong><span className="simple-past-date">{displayDate(h.date)}</span></div>
   <div className="simple-card-main"><span>{h.setupLabel||strategyTitle(h.setupCode||'')}</span><b>{money(h.price,h.currency)}</b></div>
   <div className="simple-card-foot"><span>{stageShort(h.stage||'')}</span><span>Analizar <ChevronRight size={15}/></span></div>
  </button>)}
  </div>:<div className="simple-empty"><Clock3 size={19}/><div><b>Preparando historial</b><span>Se mostrarán señales reales cuando haya datos verificados.</span></div></div>}
  <div className="simple-section-title"><div><span className="mini-label">03 / MERCADO</span><h2>Explorar activos</h2></div><span className="section-count">{results.length} de {watch.length}</span></div>
  <div className="simple-filters"><div className="finder"><Search size={16}/><input aria-label="Buscar ticker" placeholder="Buscar acción..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="select-wrap"><Filter size={14}/><select aria-label="Filtrar señales" value={filter} onChange={e=>setFilter(e.target.value)}>{filters.map(f=><option key={f} value={f}>{f==='Oportunidad de Entrada'?'Posible entrada':f==='Ruptura Confirmada'?'Ruptura':f==='En Seguimiento / Precaución'?'En seguimiento':f==='Riesgo Creciente / Deterioro'?'Precaución':f==='Sin Ventaja Identificada'?'Sin señal':f}</option>)}</select><ChevronDown size={13}/></div></div>
  <div className="simple-table-wrap"><table className="simple-table"><thead><tr><th>Activo</th><th>Último cierre</th><th>Cambio</th><th>RSI</th><th>Señal</th><th/></tr></thead><tbody>{results.map(t=>{const a=assets[t];return <tr key={t} tabIndex={0} role="button" onClick={()=>analyze(t)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();analyze(t)}}}><td><strong>{t}</strong><small>{a?.company||'Sin cobertura'}</small></td><td>{money(a?.price,a?.currency)}</td><td className={(a?.changePct||0)>=0?'up':'down'}>{percentage(a?.changePct,true)}</td><td>{a?.signal.rsi14?.toFixed(0)||'—'}</td><td><span className={'simple-status '+(a?.signal.setups?.[0]?.stage==='Alerta temprana'?'early':statusColor(a?.signal.status||''))}>{a?assetStatus(a):'Sin datos'}</span></td><td><ChevronRight size={15}/></td></tr>})}</tbody></table>{results.length===0&&<div className="simple-empty">No hay activos para este filtro.</div>}</div>
  <details className="simple-disclosure"><summary>¿Cómo funcionan las señales?</summary><div><p><b>Toque EMA 20:</b> posible entrada cuando una vela toca la media móvil de 20 días en una tendencia alcista.</p><p><b>Golden Cross:</b> cruce SMA 50 / SMA 200 con volumen; confirma tendencia, no un precio óptimo de entrada.</p><p><b>Ruptura:</b> precio supera máximos previos con volumen.</p><p>Son alertas técnicas experimentales, no recomendaciones automáticas. Los scores no son probabilidades. Los datos son del último cierre verificado.</p></div></details>
 </>}

 {page==='analysis'&&<>
  <div className="simple-heading"><div><h1>Análisis<span className="title-pulse"/></h1><p>Precio, tendencia y señales</p></div><div className="asset-select"><select aria-label="Activo seleccionado" value={ticker} onChange={e=>setTicker(e.target.value)}>{[...new Set([ticker,...watch])].map(t=><option key={t}>{t}</option>)}</select><ChevronDown size={15}/></div></div>
  {current?<>
   <div className="simple-asset-header">
    <div><span className="mini-label">{current.company}</span><div className="simple-asset-quote"><b>{ticker}</b><strong>{money(current.price,current.currency)}</strong><span className={current.changePct>=0?'up':'down'}>{percentage(current.changePct,true)}</span></div></div>
    <div className="simple-asset-state"><span className={'simple-status '+(current.signal.setups?.[0]?.stage==='Alerta temprana'?'early':statusColor(current.signal.status))}>{assetStatus(current)}</span><small>{displayDate(current.lastSession)} · {current.dataStatus}</small><small>Descarga: {current.retrievedAt}</small></div>
   </div>
   <section className="chart-card"><Suspense fallback={<div className="chart-message">Cargando gráfico…</div>}><PriceChart ticker={ticker} candles={current.candles}/></Suspense></section>
   <div className="simple-indicators">
    <div><span>EMA 20</span><strong>{money(current.signal.ema20,current.currency)}</strong></div>
    <div><span>SMA 200</span><strong>{money(current.signal.sma200,current.currency)}</strong></div>
    <div><span>RSI</span><strong>{current.signal.rsi14?.toFixed(1)||'—'}</strong></div>
    <div><span>Volumen relativo</span><strong>{current.signal.relativeVolume?.toFixed(2)||'—'}x</strong></div>
   </div>
   <div className="simple-analysis-signal">
    <div className="simple-section-title"><div><span className="mini-label">SEÑAL TÉCNICA</span><h2>¿Qué está pasando?</h2></div><span className={'simple-status '+(current.signal.setups?.[0]?.stage==='Alerta temprana'?'early':statusColor(current.signal.status))}>{assetStatus(current)}</span></div>
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
  <div className="page-title"><div><span className="eyebrow">DAILY RESEARCH / ARGENTINA & GLOBAL MARKETS</span><h1>Market Daily<span>.</span></h1><p>Briefings en español e inglés B1. Fecha y fuentes de cada edición.</p></div>{daily?.status==='published'&&<button className="copy-button" onClick={copyDaily}><Copy size={15}/> Copiar briefing exacto</button>}</div>
  <div className="daily-hero"><div><span className="eyebrow">MORNING BRIEF · NIVEL B1 + ESPAÑOL</span><h2>LO QUE NECESITÁS SABER<br/>PARA ARRANCAR LA JORNADA.</h2><p>Mercados internacionales, Argentina, tasas, dólares, bonos, riesgos y calendario.</p></div><div className="daily-date">{daily?.date||new Date().toLocaleDateString('en-CA',{timeZone:'America/Argentina/Buenos_Aires'})}</div></div>
  {daily?.status==='published'&&daily.bodyMarkdown.trim()?<article className="daily-article"><div className="daily-meta"><BookOpen size={17}/> Edición {daily.date} · edición publicada · sin sincronización automática con ChatGPT</div><ReactMarkdown remarkPlugins={[remarkGfm]}>{daily.bodyMarkdown}</ReactMarkdown></article>:
    <section className="daily-pending"><BookOpen size={29}/><h3>No hay edición verificada publicada todavía</h3><p>Todavía no se cargó un briefing en español e inglés B1. No se muestran noticias antiguas como actuales.</p><small>La entrega en ChatGPT es independiente. No hay sincronización automática verificada.</small></section>}
  <div className="module-header"><div><span className="eyebrow">RESEARCH DESK</span><h2>Fuentes prioritarias</h2></div></div><div className="source-grid">{sourceLinks.map(s=><a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" className="source-tile"><span>{s.label.slice(0,1)}</span><h3>{s.label}</h3><p>{s.description}</p><ExternalLink size={15}/></a>)}</div>
 </>}
 </main></div>;
}
