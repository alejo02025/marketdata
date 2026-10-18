"""Explainable EOD technical signals. Flow is a price/volume PROXY, never institutional ownership.
Methodology is exploratory; any backtest result is historical and not proof of future performance.
No future observations enter an individual signal evaluation.
"""
import math
from statistics import mean

def sma(v,n):
    return mean(v[-n:]) if len(v)>=n else None

def ema_series(v,period):
    if not v:return []
    k=2/(period+1);out=[float(v[0])]
    for p in v[1:]:out.append(p*k+out[-1]*(1-k))
    return out

def rsi_series(values,n=14):
    if len(values)<n+1:return []
    gains=[max(values[i]-values[i-1],0) for i in range(1,len(values))]
    losses=[max(values[i-1]-values[i],0) for i in range(1,len(values))]
    ag=mean(gains[:n]);al=mean(losses[:n])
    def result():
        if al==0:return 100. if ag>0 else 50.
        return 100-100/(1+ag/al)
    out=[None]*n+[result()]
    for i in range(n,len(gains)):
        ag=(ag*(n-1)+gains[i])/n;al=(al*(n-1)+losses[i])/n
        out.append(result())
    return out

def macd_series(v):
    e12=ema_series(v,12);e26=ema_series(v,26)
    line=[a-b for a,b in zip(e12,e26)]
    signal=ema_series(line,9)
    hist=[a-b for a,b in zip(line,signal)]
    return line,signal,hist

def cmf(candles,n=20):
    rows=candles[-n:]
    total=sum(max(0,x["v"]) for x in rows)
    if total<=0:return None
    mfv=0
    for row in rows:
        spread=row["h"]-row["l"]
        mult=((row["c"]-row["l"])-(row["h"]-row["c"]))/spread if spread>0 else 0
        mfv+=mult*max(0,row["v"])
    return mfv/total

def obv_slope(candles,n=20):
    if len(candles)<n+2:return None
    direction=0
    for i in range(len(candles)-n,len(candles)):
        direction+=candles[i]["v"]*(1 if candles[i]["c"]>candles[i-1]["c"] else -1 if candles[i]["c"]<candles[i-1]["c"] else 0)
    volume=sum(max(0,c["v"]) for c in candles[-n:])
    return direction/volume if volume else 0

def safe(v,n=2):
    return round(v,n) if v is not None and math.isfinite(v) else None

def pct(a,b):
    return (a/b-1)*100 if b not in (0,None) else None

def calculate(candles,spy=None):
    """Decision support for medium/long-term research; EOD, causal, experimental.

    Filters: tradable liquidity, primary 50/200-session trend and momentum vs SPY.
    Entry hypotheses: pullback/recovery or volume-backed 55-session breakout.
    A setup is not a trade order, win probability, or validated alpha.
    """
    if len(candles)<220:
        return {"status":"Insuficiente","reason":"Se requieren 220 cierres válidos.","score":None,
                "experimental":True,"setups":[],"decision":{"state":"Sin datos","priority":None}}
    v=[x["c"] for x in candles];c=candles[-1];last=v[-1]
    ema20=ema_series(v,20);ema50=ema_series(v,50);ema100=ema_series(v,100)
    s50=sma(v,50);s200=sma(v,200);prev200=sma(v[-220:-20],200)
    rsi=rsi_series(v);r=rsi[-1];pr=rsi[-2]
    macd_line,macd_signal_line,hist=macd_series(v)
    macd=macd_line[-1];macd_signal=macd_signal_line[-1];macd_hist=hist[-1]
    volume_base=mean(x["v"] for x in candles[-51:-1])
    rvol=c["v"]/volume_base if volume_base>0 else None
    dollar_volume20=mean(x["c"]*x["v"] for x in candles[-20:])
    liquid=dollar_volume20>=20_000_000

    # Wilder-free arithmetic ATR(14) is explicit, causal, and used only for distance/risk.
    ranges=[]
    for i in range(len(candles)-14,len(candles)):
        x=candles[i];p=candles[i-1]["c"]
        ranges.append(max(x["h"]-x["l"],abs(x["h"]-p),abs(x["l"]-p)))
    atr=mean(ranges)
    atr_pct=100*atr/last if last>0 else None
    high55=max(x["h"] for x in candles[-56:-1])
    high252=max(x["h"] for x in candles[-252:])
    low252=min(x["l"] for x in candles[-252:])
    cmf20=cmf(candles);obv20=obv_slope(candles)
    flow_positive=cmf20 is not None and cmf20>-.02 and obv20 is not None and obv20>-.05
    flow_negative=cmf20 is not None and cmf20<-.09 and obv20 is not None and obv20<-.12
    flow="Positivo (proxy)" if flow_positive else "Negativo (proxy)" if flow_negative else "Mixto (proxy)"

    spy_rel=None
    if spy and len(v)>=64:
        spy_map={x["d"]:x["c"] for x in spy if x["d"]<=c["d"]}
        a=spy_map.get(candles[-64]["d"]);b=spy_map.get(c["d"])
        if a and b:spy_rel=(last/v[-64]-b/a)*100
    # Evaluate each moving average independently; there is no mandatory 50/200 crossing.
    ma_values=[("ma20","EMA 20",ema20[-1],ema20[-6],5),
               ("ma50","SMA 50",s50,mean(v[-55:-5]),5),
               ("ma200","SMA 200",s200,prev200,20)]
    moving_averages={}
    for code,label,value,previous,days in ma_values:
        above=last>=value
        rising=value>=previous
        touched=c["l"]<=value<=c["h"]
        near=abs(last-value)<=atr*1.15
        recovered=touched and above and c["c"]>c["o"] and c["c"]>v[-2] and r>=pr
        moving_averages[code]={
            "label":label,"value":safe(value),"distancePct":safe(pct(last,value)),
            "slopePct":safe(pct(value,previous)),"slopeDays":days,
            "above":above,"rising":rising,"touched":touched,
            "near":near,"recovered":recovered,
            "reading":("Arriba" if above else "Debajo")+" · "+("subiendo" if rising else "bajando")
        }
    m20=moving_averages["ma20"];m50=moving_averages["ma50"];m200=moving_averages["ma200"]
    short=m20["above"] and m20["rising"]
    intermediate=m50["above"] and m50["rising"]
    trend=m200["above"] and m200["rising"]
    leading=spy_rel is not None and spy_rel>0
    risk=not m200["above"] and not m200["rising"]
    risk_high=atr_pct is not None and atr_pct>8
    # A price may be extended even when trend and momentum are strong.
    extension=(last-ema20[-1])/atr if atr>0 else 999
    near_ema=abs(last-ema20[-1])<=1.4*atr
    near_sma50=abs(last-s50)<=1.2*atr
    in_zone=(near_ema or near_sma50) and last>=s200 and 38<=r<=70
    bullish_reversal=(c["c"]>c["o"] and c["c"]>v[-2] and r>=pr)
    # The next-open backtest only acts on confirmed events.
    pullback_confirmed=(trend and leading and liquid and not risk_high and in_zone
                        and c["l"]<=ema20[-1]+.2*atr and c["c"]>=ema20[-1]
                        and bullish_reversal and (rvol or 0)>=.75)
    breakout=(trend and leading and liquid and not risk_high
              and last>high55*1.001 and (rvol or 0)>=1.3
              and extension<=3.5 and 48<=r<=78)
    qualifies=trend and leading and liquid and not risk_high
    candidate=qualifies and in_zone and not pullback_confirmed
    momentum_63=pct(last,v[-64])

    if risk:
        state="Riesgo elevado";setup="risk";status="Riesgo Creciente / Deterioro"
        why="Precio y medias de largo plazo con deterioro."
        next_step="Esperar una recuperación clara de la tendencia."
    elif not liquid:
        state="Sin prioridad";setup="illiquid";status="Sin Ventaja Identificada"
        why="Liquidez insuficiente para los filtros del detector."
        next_step="Revisar negociación diaria antes de invertir."
    elif risk_high:
        state="Volatilidad alta";setup="volatility";status="En Seguimiento / Precaución"
        why="Rango diario elevado para la metodología actual."
        next_step="Evitar confundir volatilidad con oportunidad."
    elif breakout:
        state="Ruptura a estudiar";setup="trend_breakout";status="Ruptura Confirmada"
        why="Tendencia y fuerza relativa positivas, con ruptura y volumen."
        next_step="Vigilar que mantenga el nivel de ruptura."
    elif pullback_confirmed:
        state="Entrada a estudiar";setup="trend_pullback";status="Oportunidad de Entrada"
        why="Retroceso controlado con recuperación y tendencia favorable."
        next_step="Verificar soporte y riesgo antes de tomar una decisión."
    elif candidate:
        state="Cerca de entrada";setup="watch";status="En Seguimiento / Precaución"
        why="Acción fuerte cerca de una zona técnica; falta rebote confirmado."
        next_step="Observar recuperación del cierre y del momentum."
    elif qualifies and extension>3:
        state="Muy extendida";setup="extended";status="En Seguimiento / Precaución"
        why="Tendencia positiva, pero precio alejado de su soporte dinámico."
        next_step="Esperar un retroceso ordenado."
    elif qualifies:
        state="Tendencia fuerte";setup="trend";status="En Seguimiento / Precaución"
        why="Tendencia principal y fuerza relativa favorables."
        next_step="Esperar una zona de entrada o una ruptura con volumen."
    else:
        state="Sin señal";setup="neutral";status="Sin Ventaja Identificada"
        why="No coincide la tendencia, fortaleza relativa y liquidez requeridas."
        next_step="Mantener en observación, sin forzar entradas."

    # Priority orders the stock universe; it is NOT a probability of rising.
    priority=min(100,max(0,
        (35 if trend else 0)+(20 if leading else 0)+(10 if liquid else 0)
        +(15 if in_zone else 0)+(15 if breakout or pullback_confirmed else 0)
        +(5 if momentum_63 is not None and momentum_63>0 else 0)
        -(20 if risk else 0)-(10 if risk_high else 0)))
    support=min(ema20[-1],s50)
    invalidation_price=support-1.5*atr
    setups=[]
    if candidate or pullback_confirmed:
        setups.append({"code":"trend_pullback","label":"Continuación tras retroceso",
                       "stage":"Confirmación" if pullback_confirmed else "Observación",
                       "reason":"Tendencia y fuerza relativa positivas. "+(
                           "Cierre de recuperación en zona de soporte." if pullback_confirmed
                           else "Precio en zona de interés, pero sin confirmación."),
                       "invalidation":"Zona de invalidez orientativa: "+str(round(invalidation_price,2))+" USD; no es un stop recomendado."})
    if breakout:
        setups.append({"code":"trend_breakout","label":"Ruptura con fortaleza relativa",
                       "stage":"Confirmación",
                       "reason":"Máximo de 55 ruedas superado, con volumen relativo y tendencia.",
                       "invalidation":"Una vuelta bajo "+str(round(high55,2))+" USD debilita la ruptura."})
    bullish=[];bearish=[];neutral=[]
    (bullish if trend else bearish).append("Tendencia principal "+("positiva." if trend else "sin confirmación alcista."))
    (bullish if leading else neutral).append("Fortaleza relativa frente a SPY: "+(f"{spy_rel:+.1f}%." if spy_rel is not None else "sin referencia comprobable."))
    (bullish if liquid else bearish).append("Liquidez promedio a 20 sesiones: USD "+f"{dollar_volume20/1e6:.0f}M.")
    (bullish if r>=pr else neutral).append(f"RSI 14: {r:.1f}.")
    (bullish if macd_hist>0 else bearish).append(f"MACD hist.: {macd_hist:.2f}.")
    (bearish if risk_high else neutral).append(f"ATR 14 / precio: {atr_pct:.1f}%.")
    if flow_negative:bearish.append("Flujo CMF/OBV negativo (proxy, no tenencias).")
    elif flow_positive:neutral.append("Flujo CMF/OBV favorable (proxy, no compras institucionales).")

    return {
      "status":status,"setup":setup,"setups":setups,"setupStage":setups[0]["stage"] if setups else None,
      "score":priority,"experimental":True,"reason":why,
      "decision":{"state":state,"priority":priority,"why":why,"next":next_step,
                  "invalidationPrice":safe(invalidation_price),"relativeStrength63":safe(spy_rel),
                  "atr14":safe(atr),"atrPct":safe(atr_pct),"extensionAtr":safe(extension),
                  "trendConfirmed":bool(trend),"liquid":bool(liquid),"candidate":bool(candidate),
                  "signalDate":c["d"],"method":"Trend + Relative Strength + Entry Zone"},
      "criteria":{"Tendencia SMA 50 / SMA 200":trend,"Fortaleza frente a SPY positiva":leading,
                  "Liquidez diaria ≥ USD 20 M":liquid,"ATR menor al 8%":not risk_high,
                  "Zona de entrada":in_zone,"Retroceso recuperado":pullback_confirmed,
                  "Ruptura con volumen":breakout},
      "bullish":bullish,"bearish":bearish,"neutral":neutral,
      "continuation":"Cierres sobre la zona de soporte y fuerza relativa sostenida; evaluar volumen en ruptura.",
      "fakeout":"Un cierre bajo soporte, pérdida de SMA 200 o retorno bajo la resistencia invalida la hipótesis.",
      "invalidation":"Nivel de riesgo orientativo "+str(round(invalidation_price,2))+
                       " USD por soporte y ATR. No garantiza limitar pérdidas ni es un stop individual.",
      "sma50":safe(s50),"sma200":safe(s200),"ema20":safe(ema20[-1]),"ema50":safe(ema50[-1]),
      "ema100":safe(ema100[-1]),"rsi14":safe(r),"rsiPrev":safe(pr),"macd":safe(macd,4),
      "macdSignal":safe(macd_signal,4),"macdHistogram":safe(macd_hist,4),
      "macdImproving":hist[-1]>hist[-2],"relativeVolume":safe(rvol),
      "cmf20":safe(cmf20,3),"obvPressure20":safe(obv20,3),"institutionalProxy":flow,
      "institutionalOwnership":None,"institutionalTransactions":None,
      "dollarVolume20":safe(dollar_volume20,0),"ema20Touched":c["l"]<=ema20[-1]<=c["h"],
      "goldenCross":False,"high52":safe(high252),"low52":safe(low252),
      "distance52High":safe(pct(last,high252)),"distanceSma50":safe(pct(last,s50)),
      "distanceSma200":safe(pct(last,s200)),"momentum63":safe(momentum_63),
      "relative63":safe(spy_rel),
      "dataDefinition":"El flujo CMF/OBV es una medida indirecta, no tenencias de fondos."
    }
