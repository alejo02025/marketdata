export type Status = 'Oportunidad detectada'|'Cerca de activarse'|'En seguimiento'|'Sin ventaja identificada'|'Riesgo creciente'|'Insuficiente';
export type Candle = { d:string; o:number; h:number; l:number; c:number; v:number };
export type Signal = { status:Status; setup?:string; experimental?:boolean; score:number|null; reason:string; criteria?:Record<string,boolean>; invalidation?:string; sma50?:number|null; sma200?:number|null; rsi14?:number|null; momentum63?:number|null; relative63?:number|null; distanceSma50?:number|null; distanceSma200?:number|null; drawdown252?:number|null };
export type Asset = { ticker:string; company:string; currency:string; exchange:string; candles:Candle[]; price:number; changePct:number; lastSession:string; retrievedAt:string; dataStatus:string; source:string; signal:Signal };
export type Snapshot = { schema:number; generatedAt:string; provider:string; methodology:string; fetchedCount:number; coverageCount:number; assets:Record<string,Asset> };
export type Trade={id:string;ticker:string;side:'buy'|'sell';quantity:number;price:number;fees:number;date:string};
export type Position={ticker:string;quantity:number;avgCost:number;cost:number;realized:number;trades:number};
export const tickers=['SPY','QQQ','AAPL','MSFT','GOOGL','AMZN','META','NVDA','AVGO','AMD','TSLA','UBER','NFLX','JPM','V','MA','BRK.B','COST'];
export const validTicker=(t:string)=>/^[A-Z0-9.^-]{1,16}$/.test(t);
export function readLocal<T>(key:string,fallback:T):T { try{const v=localStorage.getItem(key);return v?JSON.parse(v) as T:fallback}catch{return fallback} }
export function saveLocal(key:string,val:unknown){try{localStorage.setItem(key,JSON.stringify(val))}catch{/* private browsing quota */}}
export function money(v:number|null|undefined,currency='USD'){return v==null||!Number.isFinite(v)?'—':new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(v)}
export function percentage(v:number|null|undefined,signed=false){return v==null||!Number.isFinite(v)?'—':(signed&&v>0?'+':'')+v.toFixed(2)+'%'}
export function shortDate(iso:string){const d=new Date(iso);return Number.isNaN(d.getTime())?iso:d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'})}
export function positionsFromTrades(operations:Trade[]):Position[]{
 const map=new Map<string,Position>();
 const entries=[...operations].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 for(const trade of entries){
  if(!validTicker(trade.ticker)||!Number.isFinite(trade.quantity)||trade.quantity<=0||!Number.isFinite(trade.price)||trade.price<0)continue;
  const p=map.get(trade.ticker)||{ticker:trade.ticker,quantity:0,avgCost:0,cost:0,realized:0,trades:0};
  if(trade.side==='buy'){p.cost+=trade.quantity*trade.price+trade.fees;p.quantity+=trade.quantity;p.avgCost=p.cost/p.quantity}
  else if(trade.quantity<=p.quantity+1e-8){p.realized+=trade.quantity*(trade.price-p.avgCost)-trade.fees;p.quantity=Math.max(0,p.quantity-trade.quantity);p.cost=p.quantity*p.avgCost;if(p.quantity<1e-8){p.quantity=0;p.cost=0;p.avgCost=0}}
  p.trades++;map.set(trade.ticker,p);
 }
 return [...map.values()].filter(p=>p.quantity>0).sort((a,b)=>b.cost-a.cost)
}
export const statusColor=(s:string)=>s==='Oportunidad detectada'?'positive':s==='Riesgo creciente'?'danger':s==='Cerca de activarse'?'amber':s==='En seguimiento'?'blue':'muted';
export const sourceLinks=[
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
