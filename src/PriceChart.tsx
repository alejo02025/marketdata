import {useEffect,useMemo,useRef,useState} from 'react';
import type {Candle} from './market';
import {percentage} from './market';
import {ChevronDown,ExternalLink,Info} from 'lucide-react';

type Frame={label:string;code:string;group:string;tv:boolean};
const frames:Frame[]=[
 ...['2','3','5','10','15','30','45'].map(s=>({label:s+' minutos',code:s,group:'MINUTOS',tv:true})),
 ...['60','120','180','240'].map((s,i)=>({label:(i+1)+' hora'+(i?'s':''),code:s,group:'HORAS',tv:true})),
 {label:'1 día',code:'1D',group:'DÍAS',tv:false},{label:'1 semana',code:'1W',group:'DÍAS',tv:false},
 {label:'1 mes',code:'1M',group:'MESES',tv:false},{label:'3 meses',code:'3M',group:'MESES',tv:false},
 {label:'6 meses',code:'6M',group:'MESES',tv:false},{label:'12 meses',code:'12M',group:'MESES',tv:false}
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
 const [hover,setHover]=useState<number|null>(null);
 const all=useMemo(()=>aggregateCandles(candles,frame),[candles,frame]);
 const span=range==='MAX'?all.length:range==='1M'?22:range==='3M'?65:range==='6M'?130:range==='1A'?260:all.length;
 const multiplier=frame==='1W'?5:frame==='1M'?21:frame==='3M'?63:frame==='6M'?126:frame==='12M'?252:1;
 const visibleCount=Math.max(5,Math.ceil(span/multiplier));
 const data=all.slice(-visibleCount),v=all.map(x=>x.c);
 const averages=[20,50,100,200].map(n=>({n,values:all.length>=n?ema(v,n).slice(-visibleCount):[]}));
 const m=macd(v).slice(-visibleCount);
 if(data.length<2)return <div className="chart-message">No hay suficientes velas reales para este rango. Ampliá el período.</div>;
 const W=1100,H=655,left=18,right=75,top=25,pH=390,vBase=480,vTop=412,macTop=500,macBottom=621;
 const minimum=Math.min(...data.map(x=>x.l),...averages.flatMap(x=>x.values))*0.982;
 const maximum=Math.max(...data.map(x=>x.h),...averages.flatMap(x=>x.values))*1.018;
 const X=(i:number)=>left+(i+.5)*(W-left-right)/data.length;
 const Y=(p:number)=>top+(maximum-p)/(maximum-minimum)*(pH-top);
 const cw=Math.min(12,Math.max(1,(W-left-right)/data.length*.72));
 const volMax=Math.max(...data.map(d=>d.v),1);
 const maxMacd=Math.max(...m.flatMap(x=>[Math.abs(x.macd),Math.abs(x.signal),Math.abs(x.hist)]),.01)*1.14;
 const Ymac=(x:number)=>macTop+(maxMacd-x)/(maxMacd*2)*(macBottom-macTop);
 const path=(values:number[],f:(x:number)=>number)=>values.map((val,i)=>(i?'L':'M')+X(i).toFixed(2)+' '+f(val).toFixed(2)).join(' ');
 const tip=data[hover===null?data.length-1:hover];
 const visibleLines=[averages[0],averages[1],averages[2],averages[3]];
 return <div className="terminal-chart">
  <div className="chart-topline"><strong>OHLCV <span>· {frame} · mercado de cierre</span></strong><div><span>O {tip.o.toFixed(2)}</span><span>H {tip.h.toFixed(2)}</span><span>L {tip.l.toFixed(2)}</span><span className={tip.c>=tip.o?'chart-rise':'chart-fall'}>C {tip.c.toFixed(2)}</span></div></div>
  <div className="chart-legend">{visibleLines.map(({n,values},i)=><span key={n}><i style={{background:Object.values(colors)[i+2]}}/>EMA {n}: <b>{values.length?values[values.length-1].toFixed(2):'—'}</b></span>)}<span className="legend-right">{tip.d}</span></div>
  <svg viewBox={'0 0 '+W+' '+H} preserveAspectRatio="none" role="img" aria-label={'Gráfico de velas '+frame+' con volumen y MACD'} onMouseLeave={()=>setHover(null)}>
   {Array.from({length:5},(_,i)=>{const yy=top+(pH-top)*i/4;return <g key={i}><line x1={left} y1={yy} x2={W-right} y2={yy} stroke="#26313e" strokeDasharray="3 6"/><text x={W-right+6} y={yy+4} fill="#8794a9" fontSize="13">{(maximum-(maximum-minimum)*i/4).toFixed(1)}</text></g>})}
   <line x1={left} y1={vBase+6} x2={W-right} y2={vBase+6} stroke="#33404d"/>
   <text x={left+3} y={vTop+10} fill="#99a6ba" fontSize="14">VOL {tip.v.toLocaleString('es-AR')}</text>
   {data.map((d,i)=>{const fill=d.c>=d.o?colors.up:colors.down;return <g key={d.d}>
    <line x1={X(i)} x2={X(i)} y1={Y(d.h)} y2={Y(d.l)} stroke={fill} strokeWidth={Math.max(1,cw*.19)}/>
    <rect x={X(i)-cw/2} y={Math.min(Y(d.o),Y(d.c))} width={cw} height={Math.max(1.3,Math.abs(Y(d.o)-Y(d.c)))} fill={fill}/>
    <rect x={X(i)-cw/2} y={vBase-(d.v/volMax)*55} width={cw} height={(d.v/volMax)*55} fill={fill} opacity=".85"/>
    <rect x={X(i)-Math.max(2,cw)/2} y={macTop-5} width={Math.max(2,cw)} height="0" fill="transparent"/>
    <rect x={X(i)-(W-left-right)/data.length/2} y={0} width={(W-left-right)/data.length} height={H} fill="transparent" onMouseEnter={()=>setHover(i)}/>
   </g>})}
   {visibleLines.map(({n,values},i)=><path key={n} d={path(values,Y)} stroke={[colors.e20,colors.e50,colors.e100,colors.e200][i]} strokeWidth={2.1} fill="none" vectorEffect="non-scaling-stroke"/>)}
   <rect x="0" y={macTop-4} width={W} height={H-macTop+4} fill="#080e17" opacity=".8"/>
   <text x={left} y={macTop+7} fill="#c4c9d5" fontSize="15">MACD 12 / 26 / 9</text>
   <line x1={left} y1={Ymac(0)} x2={W-right} y2={Ymac(0)} stroke="#647087" strokeDasharray="3 5" opacity=".6"/>
   {m.map((a,i)=>{const yy=Ymac(a.hist);return <rect key={i} x={X(i)-cw/2} y={Math.min(Ymac(0),yy)} width={cw} height={Math.max(1,Math.abs(Ymac(0)-yy))} fill={a.hist>=0?'#4bd3cf':'#ef677b'} opacity=".94"/>})}
   <path d={path(m.map(x=>x.macd),Ymac)} fill="none" stroke="#4b8fff" strokeWidth={2} vectorEffect="non-scaling-stroke"/>
   <path d={path(m.map(x=>x.signal),Ymac)} fill="none" stroke="#faac4e" strokeWidth={2} vectorEffect="non-scaling-stroke"/>
   {hover!==null&&<line x1={X(hover)} x2={X(hover)} y1={top} y2={macBottom} stroke="#cdd9ec" strokeDasharray="4 5" opacity=".55"/>}
   {[0,.25,.5,.75,1].map((s,i)=>{const index=Math.min(data.length-1,Math.floor((data.length-1)*s));return <text key={i} x={X(index)} y={H-10} textAnchor="middle" fill="#8292a4" fontSize="14">{data[index].d.slice(0,7)}</text>})}
  </svg>
  <div className="chart-footer"><span>Velas verificadas · {data.length} períodos</span><span>Variación del tramo: {percentage((data[data.length-1].c/data[0].c-1)*100,true)}</span></div>
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
  const prefix=symbol==='SPY'||symbol==='QQQ'?'AMEX:':symbol==='BRK.B'?'NYSE:':'NASDAQ:';
  script.innerHTML=JSON.stringify({autosize:true,symbol:prefix+symbol,interval:code,timezone:'exchange',theme:'dark',style:'1',locale:'es',backgroundColor:'#080d16',gridColor:'rgba(100,112,142,.12)',hide_top_toolbar:false,hide_side_toolbar:false,allow_symbol_change:false,withdateranges:true,hide_volume:false,studies:['MACD@tv-basicstudies'],support_host:'https://www.tradingview.com'});
  container.appendChild(script);
  return ()=>container.replaceChildren();
 },[symbol,code]);
 return <div className="intraday-chart"><div ref={ref} className="tradingview-widget-container"/><div className="data-external"><Info size={14}/> Cotizaciones y disponibilidad de intervalos gestionadas por TradingView. Algunos marcos exigen iniciar sesión o una suscripción del proveedor. <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">Abrir TradingView <ExternalLink size={13}/></a></div></div>;
}
export default function PriceChart({candles,ticker}:{candles:Candle[];ticker:string}){
 const [frame,setFrame]=useState<Frame>(frames[11]);
 const [open,setOpen]=useState(false);
 const [range,setRange]=useState('1A');
 useEffect(()=>{setFrame(frames[11]);setRange('1A');setOpen(false)},[ticker]);
 return <div className="chart-terminal">
  <div className="terminal-toolbar"><div className="time-selector"><button className="time-trigger" aria-expanded={open} aria-haspopup="listbox" onClick={()=>setOpen(v=>!v)}>{frame.label}<ChevronDown size={16}/></button>
   {open&&<div className="time-menu" role="listbox" aria-label="Intervalos de tiempo">{['MINUTOS','HORAS','DÍAS','MESES'].map(group=><div key={group}><span className="time-group">{group}</span>{frames.filter(f=>f.group===group).map(f=><button type="button" role="option" aria-selected={frame.code===f.code} key={f.code} className={frame.code===f.code?'is-selected':''} onClick={()=>{setFrame(f);setRange(f.code==='1D'?'1A':'MAX');setOpen(false)}}>{f.label}{f.tv&&<small>TV</small>}</button>)}</div>)}</div>}
  </div>
  {!frame.tv&&<div className="range-selector">{['1M','3M','6M','1A','MAX'].map(v=><button key={v} className={range===v?'active':''} onClick={()=>setRange(v)}>{v}</button>)}</div>}
  <span className="terminal-source">{frame.tv?'INTRADÍA · TRADINGVIEW':'HISTÓRICOS DIARIOS · YAHOO'}</span>
  </div>
  {frame.tv?<TradingViewChart symbol={ticker} code={frame.code}/>:<NativeChart candles={candles} frame={frame.code} range={range}/>}
 </div>
}