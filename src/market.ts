export type Status = 'Oportunidad de Entrada'|'Ruptura Confirmada'|'En Seguimiento / Precaución'|'Riesgo Creciente / Deterioro'|'Sin Ventaja Identificada'|'Insuficiente';
export type Candle = { d:string; o:number; h:number; l:number; c:number; v:number };
export type Signal = {status:Status;setup?:string;setups?:{code:string;label:string;stage:string;reason:string;invalidation:string}[];setupStage?:string|null;dollarVolume20?:number|null;ema20Touched?:boolean;goldenCross?:boolean;experimental?:boolean;score:number|null;reason:string;criteria?:Record<string,boolean>;bullish?:string[];bearish?:string[];neutral?:string[];continuation?:string;fakeout?:string;invalidation?:string;sma50?:number|null;sma200?:number|null;ema20?:number|null;ema50?:number|null;ema100?:number|null;rsi14?:number|null;rsiPrev?:number|null;macd?:number|null;macdSignal?:number|null;macdHistogram?:number|null;macdImproving?:boolean;relativeVolume?:number|null;cmf20?:number|null;obvPressure20?:number|null;institutionalProxy?:string;institutionalOwnership?:number|null;institutionalTransactions?:number|null;high52?:number|null;low52?:number|null;distance52High?:number|null;distanceSma50?:number|null;distanceSma200?:number|null;momentum63?:number|null;relative63?:number|null;dataDefinition?:string};
export type Metrics={spyReturnPct?:number|null;from?:string;to?:string;trades:number;winRate:number|null;profitFactor:number|null;totalReturnPct:number;annualizedReturnPct:number;buyHoldReturnPct:number|null;maxDrawdownPct:number;sharpe:number|null;sortino:number|null;avgTradePct:number|null;evidence:string};
export type Backtest={strategies?:Record<string,{full:Metrics|null;early:Metrics|null;outOfSample:Metrics|null;higherCost:Metrics|null}>;period:{from:string;to:string;outOfSampleStart:string};full:Metrics|null;outOfSample:Metrics|null;feeAndSlippagePerSidePct:number;method:string;warnings:string[]};
export type Daily={schema:number;date:string;title:string;bodyMarkdown:string;status:'published'|'awaiting';generatedAt?:string;sourceLinks?:{title:string;url:string}[]};
export type Asset = { ticker:string; company:string; currency:string; exchange:string; candles:Candle[]; price:number; changePct:number; lastSession:string; retrievedAt:string; dataStatus:string; source:string; signal:Signal; backtest?:Backtest; recentSignals?:{date:string;price:number;status:string;score:number;reason:string;setupCode?:string;setupLabel?:string;stage?:string}[];lastHistoricalSignal?:{date:string;price:number;status:string;score:number;reason:string;setupCode?:string;setupLabel?:string;stage?:string}|null };
export type Snapshot = { schema:number; generatedAt:string; provider:string; methodology:string; fetchedCount:number; coverageCount:number; assets:Record<string,Asset> };
export const tickers=['SPY','QQQ','AAPL','MSFT','GOOGL','AMZN','META','NVDA','AVGO','AMD','TSLA','UBER','NFLX','JPM','V','MA','BRK.B','COST'];
export const validTicker=(t:string)=>/^[A-Z0-9.^-]{1,16}$/.test(t);
export function readLocal<T>(key:string,fallback:T):T { try{const v=localStorage.getItem(key);return v?JSON.parse(v) as T:fallback}catch{return fallback} }
export function saveLocal(key:string,val:unknown){try{localStorage.setItem(key,JSON.stringify(val))}catch{/* private browsing quota */}}
export function money(v:number|null|undefined,currency='USD'){return v==null||!Number.isFinite(v)?'—':new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(v)}
export function percentage(v:number|null|undefined,signed=false){return v==null||!Number.isFinite(v)?'—':(signed&&v>0?'+':'')+v.toFixed(2)+'%'}
export function shortDate(iso:string){const d=new Date(iso.length===10?iso+'T12:00:00Z':iso);return Number.isNaN(d.getTime())?iso:d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}
export const statusColor=(s:string)=>s==='Oportunidad de Entrada'?'positive':s==='Ruptura Confirmada'?'breakout':s.startsWith('Riesgo')?'danger':s.startsWith('En Seguimiento')?'amber':'muted';
export const sourceLinks=[
 {label:'Finviz',description:'Screener e interés institucional (fuente externa)',url:'https://finviz.com/'},
 {label:'Yahoo Finance',description:'Acciones y cotizaciones',url:'https://finance.yahoo.com/'},
 {label:'TradingView',description:'Gráficos y tendencias',url:'https://www.tradingview.com/'},
 {label:'Balanz Research',description:'Research local',url:'https://balanz.com/reportes/research/daily/'},
 {label:'Portfolio Personal',description:'Mercados e informes',url:'https://www.portfoliopersonal.com/'},
 {label:'InvertirOnline',description:'Reportes de Argentina',url:'https://www.invertironline.com/'},
 {label:'Ámbito',description:'Economía y dólares',url:'https://www.ambito.com/'},
 {label:'BCRA',description:'Datos oficiales',url:'https://www.bcra.gob.ar/'},
 {label:'FRED',description:'Series macro',url:'https://fred.stlouisfed.org/'},
 {label:'SEC',description:'Presentaciones oficiales',url:'https://www.sec.gov/edgar/search/'}
];
