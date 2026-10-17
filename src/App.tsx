import {useEffect,useMemo,useState} from 'react';
import {Activity,ArrowDownRight,ArrowUpRight,BarChart3,BookOpen,BriefcaseBusiness,CalendarDays,Check,ChevronDown,ChevronRight,Clock3,Download,ExternalLink,Filter,Info,LayoutDashboard,Plus,RefreshCw,Search,ShieldAlert,ShieldCheck,SlidersHorizontal,Target,Trash2,TrendingUp,Upload,X} from 'lucide-react';
import PriceChart from './PriceChart';
import {money,percentage,positionsFromTrades,readLocal,saveLocal,shortDate,sourceLinks,statusColor,tickers,validTicker} from './market';
import type {Asset,Snapshot,Trade} from './market';
import './style.css';

type Page='radar'|'analysis'|'portfolio'|'daily';
const navigation: {key:Page;label:string;icon:typeof Activity}[]=[
 {key:'radar',label:'Radar',icon:LayoutDashboard},{key:'analysis',label:'Análisis',icon:BarChart3},
 {key:'portfolio',label:'Cartera',icon:BriefcaseBusiness},{key:'daily',label:'Daily',icon:BookOpen}
];
const signalOrder:Record<string,number>={'Oportunidad detectada':0,'Cerca de activarse':1,'En seguimiento':2,'Riesgo creciente':3,'Sin ventaja identificada':4,'Insuficiente':5};
const external=(ticker:string)=>'https://finance.yahoo.com/quote/'+encodeURIComponent(ticker.replace('.','-'));
function getTrades():Trade[]{const saved=readLocal<Trade[]>('market-radar-trades-v2',[]);return Array.isArray(saved)?saved.filter(t=>t&&typeof t.id==='string'&&validTicker(t.ticker)&&['buy','sell'].includes(t.side)&&Number.isFinite(t.quantity)&&t.quantity>0&&Number.isFinite(t.price)&&t.price>=0&&Number.isFinite(t.fees)&&t.fees>=0):[]}
function getWatch():string[]{const saved=readLocal<string[]>('market-radar-watch-v1',tickers);return Array.isArray(saved)?Array.from(new Set(saved.filter(s=>typeof s==='string'&&validTicker(s)))).slice(0,100):tickers}
function Pill({status}:{status:string}){return <span className={'pill '+statusColor(status)}><i/>{status}</span>}
function IconLink({href,label}:{href:string;label:string}){return <a href={href} target="_blank" rel="noopener noreferrer" className="external">{label}<ExternalLink size={13}/></a>}
function Stat({label,value,hint,tone}:{label:string;value:string;hint:string;tone?:string}){return <div className="stat"><div className="stat-label">{label}</div><strong className={tone||''}>{value}</strong><div className="stat-hint">{hint}</div></div>}
function App(){
 const [page,setPage]=useState<Page>('radar');
 const [watch,setWatch]=useState<string[]>(getWatch);
 const [trades,setTrades]=useState<Trade[]>(getTrades);
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [loading,setLoading]=useState(true);
 const [dataError,setDataError]=useState('');
 const [selected,setSelected]=useState('SPY');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState('Todos');
 const [sort,setSort]=useState('Señal');
 const [chartPeriod,setChartPeriod]=useState(126);
 const [showForm,setShowForm]=useState(false);
 const [notice,setNotice]=useState('');
 const [tickerInput,setTickerInput]=useState('');
 const [side,setSide]=useState<'buy'|'sell'>('buy');
 const [qty,setQty]=useState('');
 const [price,setPrice]=useState('');
 const [fees,setFees]=useState('0');
 const [tradeDate,setTradeDate]=useState(new Date().toISOString().slice(0,10));
 const [mobile,setMobile]=useState(false);

 function loadData(){
  setLoading(true);
  fetch(import.meta.env.BASE_URL+'data/market.json?t='+Date.now(),{cache:'no-cache'})
   .then(r=>{if(!r.ok)throw new Error('No existe todavía un snapshot de precios publicado.');return r.json()})
   .then((raw:Snapshot)=>{if(raw.schema!==2||!raw.assets||!Object.keys(raw.assets).length)throw new Error('Archivo de precios incompleto.');setSnapshot(raw);setDataError('')})
   .catch(e=>{setDataError(e instanceof Error?e.message:'Error cargando mercado');setSnapshot(null)})
   .finally(()=>setLoading(false));
 }
 useEffect(()=>{loadData()},[]);
 useEffect(()=>saveLocal('market-radar-watch-v1',watch),[watch]);
 useEffect(()=>saveLocal('market-radar-trades-v2',trades),[trades]);

 const assets=snapshot?.assets||{};
 const selectedAsset=assets[selected];
 const positions=useMemo(()=>positionsFromTrades(trades),[trades]);
 const invested=positions.reduce((s,p)=>s+p.cost,0);
 const valuation=positions.reduce((s,p)=>s+p.quantity*(assets[p.ticker]?.price||p.avgCost),0);
 const priced=positions.filter(p=>!!assets[p.ticker]);
 const fullCoverage=positions.length>0&&priced.length===positions.length;
 const opportunities=watch.map(t=>assets[t]).filter((x):x is Asset=>!!x&&x.signal.status==='Oportunidad detectada');
 const watchOnly=watch.map(t=>assets[t]).filter((x):x is Asset=>!!x&&x.signal.status==='Cerca de activarse');
 const risk=watch.map(t=>assets[t]).filter((x):x is Asset=>!!x&&x.signal.status==='Riesgo creciente');
 const sorted=useMemo(()=>{
  let names=watch.filter(t=>t.toLowerCase().includes(query.toLowerCase())||(assets[t]?.company||'').toLowerCase().includes(query.toLowerCase()));
  if(filter!=='Todos')names=names.filter(t=>assets[t]?.signal.status===filter);
  if(sort==='Señal')names=[...names].sort((a,b)=>(signalOrder[assets[a]?.signal.status]??9)-(signalOrder[assets[b]?.signal.status]??9)||(assets[b]?.signal.score||0)-(assets[a]?.signal.score||0));
  if(sort==='Variación')names=[...names].sort((a,b)=>(assets[b]?.changePct??-Infinity)-(assets[a]?.changePct??-Infinity));
  if(sort==='Ticker')names=[...names].sort();
  return names;
 },[watch,query,filter,sort,snapshot]);
 const generated=snapshot?.generatedAt?new Date(snapshot.generatedAt):null;
 const snapshotAge=generated?Math.floor((Date.now()-generated.getTime())/(3600*1000)):null;
 const isStale=snapshotAge!==null&&snapshotAge>36;
 const statusLabel=loading?'ACTUALIZANDO':snapshot?isStale?'SNAPSHOT ANTIGUO':'DATOS DE CIERRE':'SIN FEED VERIFICADO';

 function openAsset(t:string){setSelected(t);setPage('analysis');setMobile(false);setChartPeriod(126)}
 function addWatch(e:React.FormEvent){e.preventDefault();const t=tickerInput.trim().toUpperCase();if(!validTicker(t)){setNotice('Ingresá un ticker válido.');return}setWatch(old=>[...new Set([...old,t])]);setTickerInput('');setNotice('Activo agregado al Radar. Si aún no hay datos, aparecerá sin cobertura.')}
 function addTrade(e:React.FormEvent){
  e.preventDefault();const t=tickerInput.trim().toUpperCase(),q=Number(qty),p=Number(price),f=Number(fees);
  if(!validTicker(t)||!Number.isFinite(q)||q<=0||!Number.isFinite(p)||p<0||!Number.isFinite(f)||f<0||!tradeDate){setNotice('Revisá ticker, cantidad, precio, comisión y fecha.');return}
  if(side==='sell'&&(!positions.some(pos=>pos.ticker===t&&pos.quantity>=q))){setNotice('No podés vender más unidades de las registradas.');return}
  setTrades(ts=>[...ts,{id:crypto.randomUUID(),ticker:t,side,quantity:q,price:p,fees:f,date:tradeDate}]);
  setShowForm(false);setTickerInput('');setQty('');setPrice('');setFees('0');setNotice('Operación guardada en este navegador.');
 }
 function exportTrades(){const data={schema:2,trades,watch,exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='market-radar-private-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 async function importTrades(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];if(!file)return;
  try{
   if(file.size>1e6)throw new Error('Archivo demasiado grande.');
   const data=JSON.parse(await file.text());
   if(data.schema!==2||!Array.isArray(data.trades)||!Array.isArray(data.watch)||data.trades.some((t:Trade)=>!t||!validTicker(t.ticker)||!['buy','sell'].includes(t.side)||!Number.isFinite(t.quantity)||t.quantity<=0||!Number.isFinite(t.price)||t.price<0||!Number.isFinite(t.fees)||t.fees<0))throw new Error('Respaldo incompatible o inválido.');
   if(!window.confirm('Esto reemplaza tus operaciones y el Radar guardado localmente. ¿Continuar?'))return;
   setTrades(data.trades);setWatch(data.watch.filter((t:unknown)=>typeof t==='string'&&validTicker(t)).slice(0,100));setNotice('Respaldo importado.');
  }catch(e){setNotice(e instanceof Error?e.message:'Error de importación')}
  event.target.value='';
 }
 function sectionHeading(eyebrow:string,title:string,description:string){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}<span>.</span></h1><p>{description}</p></div><div className="heading-actions"><span className="asof"><Clock3 size={14}/>{generated?'Datos al '+shortDate(snapshot!.generatedAt):'Sin snapshot publicado'}</span><button title="Consultar última publicación" className="icon-btn boxed" onClick={loadData}><RefreshCw size={16}/></button></div></div>}
 return <div className="app-shell">
 <aside className={'sidebar '+(mobile?'open':'')}>
  <div className="logo"><div className="logo-mark"><Activity size={24} strokeWidth={2.5}/></div><div><strong>MARKET<span>RADAR</span></strong><small>RESEARCH TERMINAL</small></div></div>
  <div className="nav-group-label">WORKSPACE</div>
  <nav>{navigation.map(n=><button key={n.key} className={'nav '+(page===n.key?'active':'')} onClick={()=>{setPage(n.key);setMobile(false)}}><n.icon size={18}/><span>{n.label}</span>{page===n.key&&<i/>}</button>)}</nav>
  <div className="side-divider"/>
  <div className="sidebar-label">INTELLIGENCE</div>
  <div className="sidebar-insight"><span>Oportunidades observadas</span><strong>{snapshot?opportunities.length:'—'}</strong><small>Clasificación exploratoria</small></div>
  <div className="sidebar-footer"><span className="online-dot"/> MARKET DATA <span className="side-footer-sub">{snapshot?'HISTÓRICO DISPONIBLE':'PENDIENTE'}</span><p>Sin operaciones automáticas. Datos para investigación personal.</p></div>
 </aside>
 <div className="workspace">
  <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu" onClick={()=>setMobile(!mobile)} aria-label="Menú"><SlidersHorizontal size={20}/></button><span>MARKET RADAR</span><ChevronRight size={14}/><strong>{navigation.find(n=>n.key===page)?.label.toUpperCase()}</strong></div><div className="top-status"><span className={'market-status '+(snapshot&&!isStale?'connected':'disconnected')}><span/>{statusLabel}</span><span className="top-date">{new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}</span></div></header>
  <main className="main-content">
   {notice&&<div className="toast" role="status"><Info size={15}/>{notice}<button onClick={()=>setNotice('')} aria-label="Cerrar"><X size={14}/></button></div>}
   {dataError&&<div className="notice notice-amber"><ShieldAlert size={18}/><p><strong>Datos pendientes.</strong> {dataError} El sistema no muestra cotizaciones inventadas. Podés continuar usando tu lista y cartera local.</p></div>}
   {page==='radar'&&<>
    {sectionHeading('01 / SIGNAL DISCOVERY','Radar de oportunidades','Ideas de inversión detectadas mediante reglas técnicas transparentes.')}
    <div className="hero-strip"><div className="hero-copy"><span className="overline"><span className="live-square"/> SIGNAL INTELLIGENCE</span><h2>Encontrá la señal.<br/><em>Entendé el contexto.</em></h2><p>Un universo de activos, condiciones reproducibles y una lectura clara de cuándo conviene prestar atención.</p><div className="mini-foot">METODOLOGÍA EXPERIMENTAL <span>·</span> NO CONSTITUYE RECOMENDACIÓN DE INVERSIÓN</div></div><div className="hero-aside"><div className="orbital"><div className="orbital-outer"/><div className="orbital-mid"/><div className="orbital-core"><Target size={33}/></div><span className="signal-pulse p1"/><span className="signal-pulse p2"/><span className="signal-pulse p3"/></div></div></div>
    <div className="stats-grid"><Stat label="OPORTUNIDADES DETECTADAS" value={snapshot?String(opportunities.length).padStart(2,'0'):'—'} hint="Setups técnicos completos" tone="mint"/><Stat label="CERCA DE ACTIVARSE" value={snapshot?String(watchOnly.length).padStart(2,'0'):'—'} hint="En zona de observación" tone="gold"/><Stat label="RIESGO CRECIENTE" value={snapshot?String(risk.length).padStart(2,'0'):'—'} hint="Requieren revisión" tone="coral"/><Stat label="UNIVERSO BAJO RADAR" value={String(watch.length).padStart(2,'0')} hint={snapshot?String(Object.keys(assets).length)+' con cobertura':'Esperando datos'}/></div>
    <div className="section-heading"><div><div className="overline">SIGNALS / FOCUS</div><h2>En el radar <span className="muted-text">— Prioridad</span></h2></div><span className="section-hint">Última evaluación · {generated?shortDate(snapshot!.generatedAt):'sin publicar'}</span></div>
    <div className="signal-cards">
     {opportunities.concat(watchOnly).slice(0,3).length?opportunities.concat(watchOnly).slice(0,3).map(a=><button key={a.ticker} className="signal-card" onClick={()=>openAsset(a.ticker)}><div className="signal-card-top"><span className="ticker-symbol">{a.ticker}</span><ArrowUpRight size={17}/></div><div className="card-status"><Pill status={a.signal.status}/></div><strong>{money(a.price,a.currency)}</strong><p>{a.signal.reason}</p><div className="card-bottom"><span>{a.lastSession}</span><span>VER ANÁLISIS <ChevronRight size={13}/></span></div></button>):
     <div className="no-signals"><Target size={23}/><strong>Sin señales verificables por ahora</strong><p>{loading?'Obteniendo el último archivo...':'Todavía no hay oportunidades que cumplan las condiciones o el feed está pendiente.'}</p></div>}
    </div>
    <div className="section-heading table-title"><div><div className="overline">UNIVERSE / SCREENER</div><h2>Explorador de activos</h2></div><span className="section-hint">{sorted.length} activos visibles</span></div>
    <div className="toolbar"><div className="toolbar-left"><div className="input-search"><Search size={16}/><input aria-label="Buscar activos" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar ticker o compañía"/></div><div className="filter-wrap"><Filter size={15}/><select aria-label="Filtrar señal" value={filter} onChange={e=>setFilter(e.target.value)}>{['Todos','Oportunidad detectada','Cerca de activarse','En seguimiento','Riesgo creciente','Sin ventaja identificada'].map(v=><option key={v}>{v}</option>)}</select><ChevronDown size={13}/></div><div className="filter-wrap"><select aria-label="Ordenar" value={sort} onChange={e=>setSort(e.target.value)}>{['Señal','Variación','Ticker'].map(v=><option key={v}>{v}</option>)}</select><ChevronDown size={13}/></div></div><form className="add-form" onSubmit={addWatch}><input value={tickerInput} onChange={e=>setTickerInput(e.target.value)} aria-label="Nuevo ticker" placeholder="Ej. PLTR" maxLength={16}/><button type="submit"><Plus size={15}/> Añadir</button></form></div>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>ACTIVO</th><th>ÚLTIMO CIERRE</th><th>VAR. DIARIA</th><th>SMA 200</th><th>RSI 14</th><th>MOM. 63D</th><th>SEÑAL</th><th>VIGENCIA</th><th></th></tr></thead><tbody>{sorted.map(t=>{const a=assets[t],s=a?.signal;return <tr key={t}><td><button className="ticker-cell" onClick={()=>openAsset(t)}><strong>{t}</strong><small>{a?.company||'Sin cobertura'}</small></button></td><td className="mono bold">{a?money(a.price,a.currency):'—'}</td><td className={'mono '+((a?.changePct||0)>=0?'mint':'coral')}>{a?percentage(a.changePct,true):'—'}</td><td className="mono">{s?.sma200?money(s.sma200,a.currency):'—'}</td><td className="mono">{s?.rsi14?.toFixed(1)||'—'}</td><td className={'mono '+((s?.momentum63||0)>=0?'mint':'coral')}>{percentage(s?.momentum63,true)}</td><td>{s?<Pill status={s.status}/>:<span className="pill muted">Sin datos</span>}</td><td><span className="session-date">{a?.lastSession||'—'}</span></td><td><button className="arrow-link" title={'Analizar '+t} onClick={()=>openAsset(t)}><ChevronRight size={18}/></button></td></tr>})}</tbody></table>{!sorted.length&&<div className="table-empty">No hay activos con este filtro.</div>}</div>
    <div className="data-disclosure"><ShieldCheck size={15}/><span>Las señales son reglas exploratorias, no están validadas mediante backtesting fuera de muestra. Precios al cierre o snapshot con sello temporal.</span></div>
   </>}
   {page==='analysis'&&<>
    {sectionHeading('02 / EQUITY RESEARCH','Análisis de activos','Precio, estructura técnica, criterios cumplidos y riesgos de invalidación.')}
    <div className="asset-heading"><div><div className="overline">SÍMBOLO ACTIVO</div><div className="asset-name"><h2>{selected}</h2><span>{selectedAsset?.company||'Sin cobertura de históricos'}</span></div></div><div className="asset-picker"><select aria-label="Seleccionar ticker" value={selected} onChange={e=>setSelected(e.target.value)}>{[...new Set([selected,...watch])].map(t=><option key={t}>{t}</option>)}</select><ChevronDown size={15}/></div></div>
    {selectedAsset?<><div className="asset-strip"><div className="asset-quote"><strong>{money(selectedAsset.price,selectedAsset.currency)}</strong><span className={selectedAsset.changePct>=0?'mint':'coral'}>{selectedAsset.changePct>=0?<ArrowUpRight size={16}/>:<ArrowDownRight size={16}/>} {percentage(selectedAsset.changePct,true)}</span></div><div className="asset-meta"><Pill status={selectedAsset.signal.status}/><span>Sesión {selectedAsset.lastSession} · {selectedAsset.dataStatus}</span></div></div>
     <div className="research-grid"><section className="chart-panel"><div className="panel-top"><div><div className="overline">PRICE ACTION</div><h3>{selected} / USD</h3></div><div className="periods">{[['3M',63],['6M',126],['1A',252],['3A',756]].map(([name,n])=><button className={chartPeriod===n?'chosen':''} onClick={()=>setChartPeriod(Number(n))} key={name}>{name}</button>)}</div></div><PriceChart candles={selectedAsset.candles} period={chartPeriod}/></section>
     <section className="evaluation"><div className="overline">SIGNAL BREAKDOWN</div><h3>Lectura de señal</h3><Pill status={selectedAsset.signal.status}/><p>{selectedAsset.signal.reason}</p><div className="evaluation-divider"/><div className="overline">CRITERIOS</div><div className="criteria">{Object.entries(selectedAsset.signal.criteria||{}).map(([name,okay])=><div className="criterion" key={name}><span className={okay?'criterion-yes':'criterion-no'}>{okay?<Check size={13}/>:<X size={13}/>}</span><span>{name}</span></div>)}</div><div className="evaluation-divider"/><div className="risk-note"><ShieldAlert size={16}/><p>{selectedAsset.signal.invalidation||'No hay una condición de invalidación calculada.'}</p></div><small className="experimental">METODOLOGÍA EXPERIMENTAL / NO VALIDADA</small></section></div>
     <div className="metrics-grid"><Stat label="MEDIA 50 SESIONES" value={money(selectedAsset.signal.sma50,selectedAsset.currency)} hint={'Distancia: '+percentage(selectedAsset.signal.distanceSma50,true)}/><Stat label="MEDIA 200 SESIONES" value={money(selectedAsset.signal.sma200,selectedAsset.currency)} hint={'Distancia: '+percentage(selectedAsset.signal.distanceSma200,true)}/><Stat label="RSI (14)" value={selectedAsset.signal.rsi14?.toFixed(1)||'—'} hint="Índice de fuerza relativa"/><Stat label="FORTALEZA VS SPY 63D" value={percentage(selectedAsset.signal.relative63,true)} hint="Diferencia de retornos"/></div>
     <div className="research-links"><div><h3>Investigación externa</h3><p>Contrastar señales técnicas con fundamentales y documentación oficial.</p></div><div><IconLink href={external(selected)} label="Yahoo Finance"/><IconLink href="https://www.sec.gov/edgar/search/" label="SEC EDGAR"/><IconLink href="https://www.tradingview.com/" label="TradingView"/></div></div>
    </>:<div className="empty-panel"><Info size={24}/><h3>No hay históricos para {selected}</h3><p>Agregá este ticker al universo y esperá una actualización válida de datos. No se muestran cifras simuladas.</p><IconLink href={external(selected)} label="Consultar Yahoo Finance"/></div>}
   </>}
   {page==='portfolio'&&<>
    {sectionHeading('03 / PERSONAL HOLDINGS','Mi cartera','Transacciones privadas en este navegador, conectadas con las señales del Radar.')}
    <div className="stats-grid portfolio-stats"><Stat label="CAPITAL AL COSTO" value={money(invested)} hint="Compras netas de ventas"/><Stat label="VALUACIÓN DE REFERENCIA" value={fullCoverage?money(valuation):'—'} hint={fullCoverage?'Basada en últimos cierres':'Requiere cobertura de todas las posiciones'}/><Stat label="POSICIONES ABIERTAS" value={String(positions.length).padStart(2,'0')} hint="Activos con saldo"/><Stat label="ALERTAS DE RIESGO" value={String(positions.filter(p=>assets[p.ticker]?.signal.status==='Riesgo creciente').length).padStart(2,'0')} hint="Clasificación experimental" tone="coral"/></div>
    <div className="notice notice-privacy"><ShieldCheck size={18}/><p><strong>Privacidad local:</strong> operaciones y watchlist se guardan en el navegador, sin sincronización ni cifrado. Exportá un respaldo; borrar datos del navegador puede eliminarlos.</p></div>
    <div className="section-heading"><div><div className="overline">PORTFOLIO / POSITIONS</div><h2>Posiciones abiertas</h2></div><div className="portfolio-actions"><button className="secondary" onClick={exportTrades}><Download size={15}/> Exportar</button><label className="secondary upload-label"><Upload size={15}/> Importar<input type="file" accept=".json,application/json" onChange={importTrades}/></label><button className="primary" onClick={()=>{setShowForm(!showForm);setTickerInput('')}}><Plus size={15}/> Operación</button></div></div>
    {showForm&&<form className="trade-form" onSubmit={addTrade}><div className="trade-form-head"><h3>Nueva operación</h3><button type="button" onClick={()=>setShowForm(false)}><X size={18}/></button></div><div className="trade-fields"><label>TIPO<select value={side} onChange={e=>setSide(e.target.value as 'buy'|'sell')}><option value="buy">Compra</option><option value="sell">Venta</option></select></label><label>TICKER<input required value={tickerInput} onChange={e=>setTickerInput(e.target.value)} placeholder="SPY"/></label><label>UNIDADES<input type="number" required min="0.000001" step="any" value={qty} onChange={e=>setQty(e.target.value)}/></label><label>PRECIO USD<input type="number" required min="0" step="any" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>COMISIÓN USD<input type="number" required min="0" step="any" value={fees} onChange={e=>setFees(e.target.value)}/></label><label>FECHA<input type="date" required value={tradeDate} onChange={e=>setTradeDate(e.target.value)}/></label></div><button className="primary" type="submit">Guardar operación</button></form>}
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>ACTIVO</th><th>UNIDADES</th><th>COSTO PROMEDIO</th><th>PRECIO REFERENCIA</th><th>VALOR REFERENCIA</th><th>SEÑAL</th></tr></thead><tbody>{positions.map(p=><tr key={p.ticker}><td><button className="ticker-cell" onClick={()=>openAsset(p.ticker)}><strong>{p.ticker}</strong><small>{assets[p.ticker]?.company||'En cartera'}</small></button></td><td className="mono">{p.quantity.toFixed(4)}</td><td className="mono">{money(p.avgCost)}</td><td className="mono">{money(assets[p.ticker]?.price)}</td><td className="mono bold">{assets[p.ticker]?money(p.quantity*assets[p.ticker].price):'—'}</td><td>{assets[p.ticker]?<Pill status={assets[p.ticker].signal.status}/>:<span className="pill muted">Sin cobertura</span>}</td></tr>)}</tbody></table>{!positions.length&&<div className="table-empty"><BriefcaseBusiness size={20}/> Todavía no registraste posiciones. Incorporá una operación para comenzar.</div>}</div>
    <div className="section-heading trade-history"><div><div className="overline">LEDGER</div><h2>Historial de operaciones</h2></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>FECHA</th><th>ACTIVO</th><th>OPERACIÓN</th><th>CANTIDAD</th><th>PRECIO</th><th>COMISIÓN</th><th></th></tr></thead><tbody>{[...trades].reverse().map(t=><tr key={t.id}><td>{t.date}</td><td className="bold">{t.ticker}</td><td className={t.side==='buy'?'mint':'coral'}>{t.side==='buy'?'Compra':'Venta'}</td><td>{t.quantity}</td><td>{money(t.price)}</td><td>{money(t.fees)}</td><td><button className="arrow-link" title="Eliminar operación" onClick={()=>{if(confirm('¿Borrar esta operación del registro local?'))setTrades(v=>v.filter(x=>x.id!==t.id))}}><Trash2 size={15}/></button></td></tr>)}</tbody></table>{!trades.length&&<div className="table-empty">Sin transacciones registradas.</div>}</div>
    <p className="data-disclosure">El costo promedio se calcula sobre compras y ventas registradas. No incluye dividendos, impuestos ni ajustes fiscales; las cotizaciones pueden estar desactualizadas.</p>
   </>}
   {page==='daily'&&<>
    {sectionHeading('04 / MARKET CONTEXT','Market Daily','Lectura de mercados y fuentes primarias para contextualizar las señales.')}
    <div className="daily-feature"><div><div className="overline"><CalendarDays size={14}/> DAILY BRIEF / FUENTES VERIFICADAS</div><h2>El contexto también<br/><em>mueve las decisiones.</em></h2><p>Un panel editorial para seguir tasas, actividad económica, empresas y riesgo. No reemplaza el motor cuantitativo.</p><span>La generación automática de un briefing con noticias verificadas está pendiente de integrar.</span></div><div className="daily-graphic"><TrendingUp size={92} strokeWidth={1}/></div></div>
    <div className="section-heading"><div><div className="overline">MARKET SNAPSHOT</div><h2>Referencia internacional</h2></div><span className="section-hint">Datos de cierre · {snapshot?.generatedAt?shortDate(snapshot.generatedAt):'pendientes'}</span></div>
    <div className="stats-grid daily-stats">{['SPY','QQQ'].map(t=><Stat key={t} label={t==='SPY'?'S&P 500 / SPY':'NASDAQ 100 / QQQ'} value={money(assets[t]?.price)} hint={assets[t]?percentage(assets[t].changePct,true)+' · '+assets[t].lastSession:'Sin cotización'}/>)}<Stat label="DÓLAR MEP" value="—" hint="Sin fuente argentina conectada"/><Stat label="RIESGO PAÍS" value="—" hint="Sin fuente argentina conectada"/></div>
    <div className="section-heading"><div><div className="overline">RESEARCH DESK</div><h2>Fuentes para investigar</h2></div></div>
    <div className="source-grid">{sourceLinks.map(s=><a key={s.label} href={s.url} rel="noopener noreferrer" target="_blank" className="source-card"><div><span className="source-symbol">{s.label.charAt(0)}</span><ExternalLink size={15}/></div><h3>{s.label}</h3><p>{s.description}</p></a>)}</div>
    <div className="english-card"><div className="overline">MARKET ENGLISH / B1</div><h3>Understanding market trends</h3><p>“A strong trend does not guarantee higher prices. Investors need to understand the risks before making a decision.”</p><p className="translation">Una tendencia fuerte no garantiza precios más altos. Los inversores necesitan comprender los riesgos antes de tomar una decisión.</p></div>
   </>}
  </main>
 </div></div>
}
export default App;
