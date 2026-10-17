import {useMemo,useState} from 'react';
import type {Candle} from './market';
import {percentage} from './market';
type Props={candles:Candle[];period:number;showVolume?:boolean};
function moving(values:number[],period:number){return values.map((_,i)=>i+1<period?null:values.slice(i-period+1,i+1).reduce((a,b)=>a+b,0)/period)}
export default function PriceChart({candles,period,showVolume=true}:Props){
 const [hover,setHover]=useState<number|null>(null);
 const data=useMemo(()=>candles.slice(-period),[candles,period]);
 if(data.length<2)return <div className="chart-empty">No hay suficientes sesiones para graficar.</div>;
 const width=1000,plotHeight=286,totalHeight=showVolume?370:320,top=22,left=24,right=16;
 const highest=Math.max(...data.map(x=>x.h))*1.016,lowest=Math.min(...data.map(x=>x.l))*.984;
 const x=(i:number)=>left+(i+.5)*(width-left-right)/data.length;
 const y=(price:number)=>top+(highest-price)/(highest-lowest)*(plotHeight-top);
 const stride=(width-left-right)/data.length,bodyW=Math.max(1,Math.min(10,stride*.67));
 const volumeMax=Math.max(...data.map(d=>d.v),1);
 const active=hover!==null?data[hover]:data[data.length-1];
 const allSma50=moving(candles.map(c=>c.c),50).slice(-data.length);
 const allSma200=moving(candles.map(c=>c.c),200).slice(-data.length);
 const path=(points:(number|null)[])=>(points.reduce((acc:string,v,i)=>v===null?acc:acc+(acc?' L':'M')+x(i).toFixed(2)+','+y(v).toFixed(2),''));
 const grid=[0,.25,.5,.75,1];
 return <div className="pricechart">
  <div className="chart-toolbar"><span><i className="keyline sma50"/> SMA 50</span><span><i className="keyline sma200"/> SMA 200</span><span className="toolbar-right">{active.d} &nbsp; O {active.o.toFixed(2)} &nbsp; H {active.h.toFixed(2)} &nbsp; L {active.l.toFixed(2)} &nbsp; C {active.c.toFixed(2)}</span></div>
  <svg role="img" aria-label="Gráfico histórico OHLC, con SMA 50 y SMA 200" viewBox={'0 0 '+width+' '+totalHeight} preserveAspectRatio="none" onMouseLeave={()=>setHover(null)}>
   {grid.map(f=><g key={f}><line x1={left} y1={top+(plotHeight-top)*f} x2={width-right} y2={top+(plotHeight-top)*f} stroke="#24313a" strokeDasharray="2 5" /><text fill="#78909b" fontSize="13" x={width-right-4} y={top+(plotHeight-top)*f-6} textAnchor="end">{(highest-(highest-lowest)*f).toFixed(0)}</text></g>)}
   {data.map((d,i)=>{const up=d.c>=d.o,col=up?'#21c8ac':'#e06f6c';return <g key={d.d}><line x1={x(i)} x2={x(i)} y1={y(d.h)} y2={y(d.l)} stroke={col} strokeWidth={Math.max(1,bodyW*.18)}/><rect x={x(i)-bodyW/2} y={Math.min(y(d.o),y(d.c))} width={bodyW} height={Math.max(1.5,Math.abs(y(d.c)-y(d.o)))} fill={col} rx=".5" />{showVolume&&<rect x={x(i)-bodyW/2} y={totalHeight-16-d.v/volumeMax*53} width={bodyW} height={d.v/volumeMax*53} fill={col} opacity=".32"/>}<rect x={x(i)-stride/2} y={0} width={stride} height={totalHeight} fill="transparent" onMouseEnter={()=>setHover(i)}/></g>})}
   <path d={path(allSma50)} fill="none" stroke="#dfb66d" strokeWidth="1.8" vectorEffect="non-scaling-stroke"/>
   <path d={path(allSma200)} fill="none" stroke="#8ca6ed" strokeWidth="1.8" vectorEffect="non-scaling-stroke"/>
   {hover!==null&&<line x1={x(hover)} x2={x(hover)} y1={top} y2={totalHeight-13} stroke="#e0e6ef" strokeWidth="1" strokeDasharray="4 4" opacity=".6"/>}
   {[0,Math.floor(data.length/4),Math.floor(data.length/2),Math.floor(data.length*3/4),data.length-1].map(i=><text key={i} fill="#8194a0" fontSize="12" x={x(i)} y={totalHeight-2} textAnchor="middle">{data[i].d.slice(5)}</text>)}
  </svg>
  <div className="chart-foot">Intervalo diario · Cierres, OHLC y volumen de proveedor externo · Variación del tramo {percentage((data[data.length-1].c/data[0].c-1)*100,true)}</div>
 </div>;
}
