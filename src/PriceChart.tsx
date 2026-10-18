import {createChart,CandlestickSeries,HistogramSeries,LineSeries,ColorType} from 'lightweight-charts';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Candle} from './market';
import {percentage} from './market';
import {ChevronDown,ExternalLink,Info} from 'lucide-react';

type Frame={label:string;code:string;group:string;tv:boolean};
const frames:Frame[]=[
 {label:'1D',code:'1D',group:'HISTÓRICO',tv:false},
 {label:'1W',code:'1W',group:'HISTÓRICO',tv:false},
 {label:'1M',code:'1M',group:'HISTÓRICO',tv:false},
 ...['2','3','5','10','15','30','45'].map(s=>({label:s+' min',code:s,group:'INTRADÍA',tv:true})),
 ...['60','120','180','240'].map((s,i)=>({label:(i+1)+' h',code:s,group:'INTRADÍA',tv:true}))
];
function timeframeKey(date:string,code:string){
 const d=new Date(date+'T12:00:00Z'),year=d.getUTCFullYear(),month=d.getUTCMonth();
 if(code==='1W'){const delta=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-delta);return d.toISOString().slice(0,10)}
 if(code==='1M')return year+'-'+String(month+1).padStart(2,'0');
 const group=code==='3M'?3:code==='6M'?6:12;
 return year+'-'+String(Math.floor(month/group)*group+1).padStart(2,'0')
}
export function aggregateCandles(candles:Candle[],code:string):Candle[]{
 if(code==='1D')return candles;
 const groups:Candle[]=[];
 let key='';
 for(const candle of candles){
  const bucket=timeframeKey(candle.d,code);
  if(key!==bucket){groups.push({...candle});key=bucket}
  else{const last=groups[groups.length-1];last.h=Math.max(last.h,candle.h);last.l=Math.min(last.l,candle.l);last.c=candle.c;last.v+=candle.v;last.d=candle.d}
 }
 return groups;
}
function ema(v:number[],n:number){if(!v.length)return [];const k=2/(n+1),r=[v[0]];for(let i=1;i<v.length;i++)r.push(k*v[i]+(1-k)*r[i-1]);return r}
function macd(v:number[]){const a=ema(v,12),b=ema(v,26),line=a.map((x,i)=>x-b[i]),signal=ema(line,9);return line.map((x,i)=>({macd:x,signal:signal[i],hist:x-signal[i]}))}
const colors={up:'#37ca82',down:'#ef586f',e20:'#ffe94d',e50:'#18c7e5',e100:'#a3a2ff',e200:'#ff466c'};
function NativeChart({candles,frame,range}:{candles:Candle[];frame:string;range:string}){
 const ref=useRef<HTMLDivElement>(null);
 const all=useMemo(()=>aggregateCandles(candles,frame),[candles,frame]);
 const [tip,setTip]=useState<Candle|undefined>(all[all.length-1]);
 useEffect(()=>{
  if(!ref.current||all.length<2)return;
  setTip(all[all.length-1]);
  const chart=createChart(ref.current,{autoSize:true,layout:{background:{type:ColorType.Solid,color:'#0b1220'},textColor:'#b1c0d4',fontSize:12,attributionLogo:true},grid:{vertLines:{color:'#182335'},horzLines:{color:'#182335'}},rightPriceScale:{scaleMargins:{top:.08,bottom:.25}},timeScale:{borderColor:'#29374a'},localization:{locale:'es-AR'},handleScroll:{vertTouchDrag:false}});
  const price=chart.addSeries(CandlestickSeries,{upColor:'#43d6a2',downColor:'#f87888',borderVisible:false,wickUpColor:'#43d6a2',wickDownColor:'#f87888'});
  price.setData(all.map(c=>({time:c.d,open:c.o,high:c.h,low:c.l,close:c.c})));
  const volume=chart.addSeries(HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume',lastValueVisible:false,priceLineVisible:false});
  volume.priceScale().applyOptions({scaleMargins:{top:.82,bottom:0}});
  volume.setData(all.map(c=>({time:c.d,value:c.v,color:c.c>=c.o?'#43d6a255':'#f8788855'})));
  // Daily averages sampled at each aggregated candle's final session, identical to signal engine.
  const closes=candles.map(c=>c.c),e20=ema(closes,20),index=new Map(candles.map((c,i)=>[c.d,i]));
  [20,50,200].forEach((n,j)=>{
   const line=chart.addSeries(LineSeries,{color:['#f4d578','#71acff','#bb9aff'][j],lineWidth:2,lastValueVisible:false,priceLineVisible:false,crosshairMarkerVisible:false});
   line.setData(all.flatMap(c=>{const i=index.get(c.d)!;return i<n-1?[]:[{time:c.d,value:n===20?e20[i]:closes.slice(i-n+1,i+1).reduce((a,b)=>a+b,0)/n}]}));
  });
  const end=new Date(all[all.length-1].d+'T12:00:00Z'),cut=new Date(end);
  const months:Record<string,number>={'1M':1,'3M':3,'6M':6,'1A':12,'3A':36,'5A':60};
  cut.setUTCMonth(cut.getUTCMonth()-(months[range]||0));
  const first=range==='MAX'?all[0]:all.find(c=>c.d>=cut.toISOString().slice(0,10))||all[0];
  if(first.d!==all[all.length-1].d)chart.timeScale().setVisibleRange({from:first.d,to:all[all.length-1].d});else chart.timeScale().fitContent();
  chart.subscribeCrosshairMove(p=>{const c=all.find(c=>c.d===p.time);setTip(c||all[all.length-1])});
  return ()=>chart.remove();
 },[all,candles,range]);
 if(!tip)return <div className="chart-message">Sin velas disponibles.</div>;
 return <div className="terminal-chart">
  <div className="chart-topline"><strong>{tip.d} · {frame}</strong><div><span>O {tip.o.toFixed(2)}</span><span>H {tip.h.toFixed(2)}</span><span>L {tip.l.toFixed(2)}</span><span>C {tip.c.toFixed(2)}</span><span>Vol {tip.v.toLocaleString('es-AR')}</span></div></div>
  <div className="chart-legend"><span style={{color:'#f4d578'}}>EMA 20</span><span style={{color:'#71acff'}}>SMA 50</span><span style={{color:'#bb9aff'}}>SMA 200</span><span>Medias diarias · velas {frame}</span></div>
  <div ref={ref} className="financial-chart" role="img" aria-label={'Velas '+frame+' con volumen, EMA 20, SMA 50 y SMA 200 diarias'}/>
  <div className="chart-footer"><span>Histórico disponible: {candles[0]?.d} — {candles[candles.length-1]?.d}</span><a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts™ · Copyright (c) 2025 TradingView, Inc.</a></div>
  <details className="chart-data"><summary>Ver datos OHLCV accesibles</summary><div className="chart-data-scroll"><table><caption>Últimos 20 períodos · {frame}</caption><thead><tr>{['Fecha','Apertura','Máximo','Mínimo','Cierre','Volumen'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{all.slice(-20).map(c=><tr key={c.d}><td>{c.d}</td>{[c.o,c.h,c.l,c.c,c.v].map((v,i)=><td key={i}>{v.toLocaleString('es-AR')}</td>)}</tr>)}</tbody></table></div></details>
 </div>;
}
function TradingViewChart({symbol,code}:{symbol:string;code:string}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const container=ref.current;if(!container)return;
  container.replaceChildren();
  const inner=document.createElement('div');inner.className='tradingview-widget-container__widget';inner.style.cssText='height:650px;width:100%';
  container.appendChild(inner);
  const script=document.createElement('script');script.type='text/javascript';script.async=true;
  script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
  const prefix=symbol==='SPY'||symbol==='QQQ'?'AMEX:':['BRK.B','JPM','V','MA','UBER'].includes(symbol)?'NYSE:':'NASDAQ:';
  script.innerHTML=JSON.stringify({autosize:true,symbol:prefix+symbol,interval:code,timezone:'exchange',theme:'dark',style:'1',locale:'es',backgroundColor:'#080d16',gridColor:'rgba(100,112,142,.12)',hide_top_toolbar:false,hide_side_toolbar:false,allow_symbol_change:false,withdateranges:true,hide_volume:false,studies:['MACD@tv-basicstudies'],support_host:'https://www.tradingview.com'});
  container.appendChild(script);
  return ()=>container.replaceChildren();
 },[symbol,code]);
 return <div className="intraday-chart"><div ref={ref} className="tradingview-widget-container"/><div className="data-external"><Info size={14}/> Cotizaciones y disponibilidad de intervalos gestionadas por TradingView. Algunos marcos exigen iniciar sesión o una suscripción del proveedor. <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">Abrir TradingView <ExternalLink size={13}/></a></div></div>;
}
export default function PriceChart({candles,ticker}:{candles:Candle[];ticker:string}){
 const [frame,setFrame]=useState<Frame>(frames[0]);
 const [open,setOpen]=useState(false);
 const [range,setRange]=useState('1A');
 useEffect(()=>{setFrame(frames[0]);setRange('1A');setOpen(false)},[ticker]);
 return <div className="chart-terminal">
  <div className="terminal-toolbar simple-chart-toolbar">
   <div className="simple-time-group"><span>Vela</span>{frames.filter(f=>!f.tv).map(f=><button key={f.code} type="button" aria-pressed={frame.code===f.code} className={frame.code===f.code?'active':''} onClick={()=>{setFrame(f);setOpen(false)}}>{f.label}</button>)}
    <div className="time-selector"><button className={'time-trigger '+(frame.tv?'is-tv':'')} aria-expanded={open} aria-haspopup="listbox" onClick={()=>setOpen(v=>!v)}>{frame.tv?frame.label:'Intradía'}<ChevronDown size={13}/></button>
     {open&&<div className="time-menu" role="listbox" aria-label="Velas intradía"><span className="time-group">DATOS DE TRADINGVIEW</span>{frames.filter(f=>f.tv).map(f=><button type="button" role="option" aria-selected={frame.code===f.code} className={frame.code===f.code?'is-selected':''} key={f.code} onClick={()=>{setFrame(f);setOpen(false)}}>{f.label}</button>)}</div>}
    </div>
   </div>
   {!frame.tv&&<div className="simple-time-group simple-range-group" aria-label="Período visible"><span>Ver</span>{['1M','3M','6M','1A','3A','5A','MAX'].map(v=><button key={v} type="button" aria-pressed={range===v} className={range===v?'active':''} onClick={()=>setRange(v)}>{v}</button>)}</div>}
  </div>
  {frame.tv?<TradingViewChart symbol={ticker} code={frame.code}/>:<NativeChart candles={candles} frame={frame.code} range={range}/>}
 </div>;
}
