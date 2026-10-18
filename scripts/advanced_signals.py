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
    if len(candles)<220:
        return {"status":"Insuficiente","reason":"Se requieren al menos 220 velas verificadas.","score":None,"experimental":True}
    v=[x["c"] for x in candles];last=v[-1]
    ema20=ema_series(v,20);ema50=ema_series(v,50);ema100=ema_series(v,100)
    s50=sma(v,50);s200=sma(v,200);prev200=sma(v[-220:-20],200)
    rsi=rsi_series(v);r=rsi[-1];pr=rsi[-2]
    line,signal,hist=macd_series(v);macd=line[-1];macd_signal=signal[-1];macd_hist=hist[-1]
    trend=last>s200 and s50>s200 and s200>=prev200
    near20=abs(last/ema20[-1]-1)<.045
    break55=last>max(c["h"] for c in candles[-56:-1])*1.001
    avg50=mean(x["v"] for x in candles[-51:-1])
    relative_volume=candles[-1]["v"]/avg50 if avg50>0 else None
    # Event rules: observable OHLC only, no future information.
    # For an EMA20 touch we inspect the actual day's range, not merely proximity at close.
    candle=candles[-1]
    touches_ema20=candle["l"]<=ema20[-1]*1.005 and candle["h"]>=ema20[-1]*.995
    dollar_volume20=mean(x["c"]*x["v"] for x in candles[-20:])
    liquid=dollar_volume20>=20_000_000
    touch_in_uptrend=trend and liquid and touches_ema20 and last>=ema20[-1]*.97
    touch_confirmed=(touch_in_uptrend and last>ema20[-1] and last>candle["o"]
                     and last>v[-2] and (relative_volume or 0)>=1)
    prev_s50=mean(v[-51:-1])
    prev_s200=mean(v[-201:-1])
    golden_cross=(prev_s50<=prev_s200 and s50> s200 and last>s200)
    golden_high_volume=golden_cross and liquid and (relative_volume or 0)>=1.2
    cmf20=cmf(candles);obv20=obv_slope(candles)
    # This signal cannot prove large funds are buying. It observes only price and volume.
    flow_positive=cmf20 is not None and cmf20>-.02 and obv20 is not None and obv20>-.05
    flow_negative=cmf20 is not None and cmf20<-.09 and obv20 is not None and obv20<-.12
    flow='Positivo (proxy)' if flow_positive else 'Negativo (proxy)' if flow_negative else 'Mixto (proxy)'
    macd_improving=macd_hist>hist[-2] and hist[-2]>=hist[-3]
    macd_bullish=macd>macd_signal and macd_hist>0
    rsi_recovery=42<=r<=66 and r>pr
    breakout=trend and liquid and break55 and (relative_volume or 0)>=1.5 and macd_improving and flow_positive
    bearish=(last<s200 and s50<s200) or (last<s50 and (relative_volume or 0)>1.25 and flow_negative)
    setups=[]
    if not bearish:
        if touch_in_uptrend:
            setups.append({
                "code":"ema20_touch","label":"Toque de EMA 20","stage":"Rebote confirmado" if touch_confirmed else "Alerta temprana",
                "reason":"La vela tocó EMA 20 en tendencia alcista. "+("Cierre positivo y volumen al menos igual al promedio: confirmación preliminar." if touch_confirmed else "Aún no se confirmó un rebote; no implica comprar automáticamente."),
                "invalidation":"Vigilar cierres por debajo de EMA 20 y pérdida de SMA 50."
            })
        if golden_high_volume:
            setups.append({
                "code":"golden_cross","label":"Golden Cross con volumen","stage":"Confirmación de tendencia",
                "reason":"SMA 50 cruzó sobre SMA 200, con RVOL ≥1,2x y liquidez de al menos USD 20 M/día. Es una señal rezagada, no un precio óptimo de compra.",
                "invalidation":"Un nuevo cruce bajista o debilidad bajo SMA 200 deteriora la señal."
            })
        if breakout:
            setups.append({
                "code":"breakout","label":"Ruptura de máximo de 55 ruedas","stage":"Ruptura confirmada",
                "reason":"Superó máximo previo de 55 ruedas con RVOL ≥1,5x, MACD mejorando y flujo proxy positivo.",
                "invalidation":"Cierre posterior por debajo de la resistencia superada."
            })
    if bearish:status,setup='Riesgo Creciente / Deterioro','risk'
    elif breakout:status,setup='Ruptura Confirmada','breakout'
    elif touch_in_uptrend:status,setup='Oportunidad de Entrada','ema20_touch'
    elif golden_high_volume:status,setup='En Seguimiento / Precaución','golden_cross'
    elif trend or near20:status,setup='En Seguimiento / Precaución','watch'
    else:status,setup='Sin Ventaja Identificada','neutral'
    bullish=[];bearish_points=[];neutral=[]
    (bullish if trend else bearish_points).append("Tendencia: precio y SMA 50 "+("sobre SMA 200 con pendiente no negativa." if trend else "sin estructura alcista confirmada."))
    (bullish if rsi_recovery else neutral).append(f"RSI 14: {r:.1f}; "+("recuperación de momentum moderado." if rsi_recovery else "sin recuperación confirmada entre 42 y 66."))
    (bullish if macd_bullish else bearish_points if macd_hist<0 and not macd_improving else neutral).append(f"MACD 12/26/9: histograma {macd_hist:.2f}; "+("impulso positivo." if macd_bullish else "confluencia todavía incompleta."))
    (bullish if flow_positive else bearish_points if flow_negative else neutral).append(f"Flujo precio/volumen (CMF 20: {cmf20:.2f}): {flow.lower()}. NO mide tenencias de fondos.")
    if break55:
        (bullish if relative_volume is not None and relative_volume>=1.5 else neutral).append(f"Supera el máximo anterior de 55 ruedas, con volumen relativo {relative_volume:.2f}x." if relative_volume is not None else "Ruptura sin datos de volumen válidos.")
    else:neutral.append("Sin ruptura del máximo anterior de 55 ruedas.")
    if r>70:neutral.append("RSI por encima de 70: el momentum puede ser fuerte, pero aumenta el riesgo de extensión.")
    if relative_volume is not None and relative_volume<.8:neutral.append("Volumen inferior a su media de 50 ruedas: conviene exigir confirmación.")
    if status=='Ruptura Confirmada':
        reason="Ruptura de máximos de 55 ruedas, volumen ≥1,5x, MACD en aceleración y proxy de flujo positivo."
    elif setup=='ema20_touch':
        reason=("Rebote preliminar sobre EMA 20 dentro de tendencia alcista, con liquidez adecuada." if touch_confirmed else
                "Posible entrada: la vela tocó EMA 20 en tendencia alcista; falta confirmar rebote. No es señal automática de compra.")
    elif setup=='golden_cross':
        reason="Golden Cross (SMA 50 cruza sobre SMA 200) con volumen relativo ≥1,2x: contexto de tendencia, no entrada garantizada."
    elif status=='Riesgo Creciente / Deterioro':
        reason="Deterioro de tendencia o pérdida de SMA 50 acompañada de presión vendedora observada en precio/volumen."
    elif status=='En Seguimiento / Precaución':
        reason="Estructura con aspectos favorables, pero falta confluencia para una oportunidad de entrada o ruptura."
    else:reason="Los criterios combinados de tendencia, momentum, volumen y flujo proxy no muestran ventaja clara."
    conditions={
        "Precio > SMA 50 > SMA 200 y SMA 200 ascendente":trend,
        "Toque real de EMA 20 en el rango OHLC":touches_ema20,
        "Tendencia alcista + liquidez diaria ≥USD 20 M":trend and liquid,
        "Rebote sobre EMA 20 (volumen ≥media)":touch_confirmed,
        "Golden Cross SMA 50/200 con volumen ≥1,2x":golden_high_volume,
        "RSI 14 ascendiendo dentro de 42–66":rsi_recovery,
        "MACD: histograma en mejora sostenida":macd_improving,
        "CMF/OBV: proxy de presión compradora":flow_positive,
        "Ruptura de máximos de 55 sesiones":break55,
        "Volumen relativo ≥1,5x":relative_volume is not None and relative_volume>=1.5
    }
    score=sum([24 if trend else 0,14 if touch_in_uptrend else 0,15 if rsi_recovery else 0,17 if macd_improving else 0,16 if flow_positive else 0,14 if break55 and (relative_volume or 0)>=1.5 else 0])
    # Use same-timepoint daily relative return, not proprietary Finviz institutional data.
    rel=None
    if spy and len(v)>=64:
        spy_map={x["d"]:x["c"] for x in spy}
        if candles[-1]["d"] in spy_map and candles[-64]["d"] in spy_map:
            rel=pct(v[-1],v[-64])-pct(spy_map[candles[-1]["d"]],spy_map[candles[-64]["d"]])
    return {
        "status":status,"setup":setup,"setups":setups,"setupStage":(setups[0]["stage"] if setups else None),"score":score,"experimental":True,
        "reason":reason,"criteria":conditions,"bullish":bullish,"bearish":bearish_points,"neutral":neutral,
        "continuation":"Buscar varios cierres sobre resistencia, volumen sostenido >1,5x y MACD con histograma creciente; luego confirmar un retesteo que conserve la zona.",
        "fakeout":"Alertas: cierre nuevamente bajo resistencia, mechas superiores largas, volumen comprador decreciente, MACD debilitándose y CMF negativo.",
        "invalidation":"Si la ruptura vuelve bajo resistencia o el pullback pierde soporte y EMA 20 con volumen vendedor, revisar la hipótesis. No constituye stop personalizado.",
        "sma50":safe(s50),"sma200":safe(s200),"ema20":safe(ema20[-1]),"ema50":safe(ema50[-1]),"ema100":safe(ema100[-1]),
        "rsi14":safe(r),"rsiPrev":safe(pr),"macd":safe(macd,4),"macdSignal":safe(macd_signal,4),
        "macdHistogram":safe(macd_hist,4),"macdImproving":bool(macd_improving),"relativeVolume":safe(relative_volume),
        "cmf20":safe(cmf20,3),"obvPressure20":safe(obv20,3),"institutionalProxy":flow,
        "institutionalOwnership":None,"institutionalTransactions":None,
        "dollarVolume20":safe(dollar_volume20,0),"ema20Touched":touches_ema20,"goldenCross":golden_cross,
        "high52":safe(max(x["h"] for x in candles[-252:])),
        "low52":safe(min(x["l"] for x in candles[-252:])),
        "distance52High":safe(pct(last,max(x["h"] for x in candles[-252:]))),
        "distanceSma50":safe(pct(last,s50)),"distanceSma200":safe(pct(last,s200)),
        "momentum63":safe(pct(last,v[-64])),"relative63":safe(rel),
        "dataDefinition":"CMF/OBV es proxy de presión de negociación, no prueba de compras de fondos."
    }
