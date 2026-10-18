#!/usr/bin/env python3
"""Fetch daily candles from Yahoo's unaffiliated chart endpoint and classify exploratory signals.
No paid key, no scraped browser pages. This endpoint can rate limit or stop working.
Only publish validated real observations; keep previously saved last-good rows on failure.
"""
import datetime as dt
import json
import math
import os
import statistics
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from advanced_signals import calculate
from backtest import backtest

OUT = Path(__file__).resolve().parents[1] / "public" / "data" / "market.json"
TICKERS = ["SPY", "QQQ", "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "AVGO", "AMD", "TSLA", "UBER", "NFLX", "JPM", "V", "MA", "BRK.B", "COST"]
PROVIDER = "Yahoo Finance chart (unofficial access)"
SCHEMA = 3

def sma(xs, n):
    return sum(xs[-n:]) / n if len(xs) >= n else None

def rsi(xs, n=14):
    if len(xs) < n + 1:
        return None
    differences = [xs[i] - xs[i-1] for i in range(len(xs)-n, len(xs))]
    gains = sum(max(v, 0) for v in differences) / n
    losses = sum(max(-v, 0) for v in differences) / n
    if losses == 0:
        return 100.0 if gains else 50.0
    return 100 - 100/(1 + gains/losses)

def pct(a,b):
    return (a / b - 1) * 100 if a is not None and b and b > 0 else None

def rnd(n, places=2):
    return round(n, places) if n is not None and math.isfinite(n) else None

def indicators(candles, spy=None):
    if len(candles) < 201:
        return {"status": "Insuficiente", "reason": "Se requieren al menos 201 sesiones válidas.", "score": None}
    close = [c["c"] for c in candles]
    latest = close[-1]
    s50, s200 = sma(close, 50), sma(close, 200)
    value_rsi = rsi(close)
    m63 = pct(latest, close[-64]) if len(close) >= 64 else None
    max55 = max(close[-56:-1])
    peak252 = max(close[-252:])
    rel = None
    if spy:
        spybydate = {c["d"]:c["c"] for c in spy}
        prev_date = candles[-64]["d"]
        if candles[-1]["d"] in spybydate and prev_date in spybydate:
            rel = pct(latest, close[-64]) - pct(spybydate[candles[-1]["d"]], spybydate[prev_date])
    trend = latest > s200 and s50 > s200
    below = latest < s200 and s50 < s200
    near50 = abs(latest / s50 - 1) <= .035
    pullback = trend and near50 and 42 <= value_rsi <= 65 and rel is not None and rel > 0
    breakout = trend and latest > max55 * 1.001 and 50 <= value_rsi < 75 and rel is not None and rel > 0
    risk = below or (pct(latest, peak252) < -25 and rel is not None and rel < 0)
    criteria = {
        "Tendencia primaria alcista": bool(trend),
        "Cercanía a SMA 50 (±3,5 %)": bool(near50),
        "RSI moderado (42–65)": bool(42 <= value_rsi <= 65),
        "Fortaleza relativa a SPY positiva (63 sesiones)": bool(rel is not None and rel > 0),
        "Ruptura de máximo anterior de 55 sesiones": bool(latest > max55 * 1.001),
    }
    if risk:
        signal,setup,explanation = "Riesgo creciente","risk","El precio muestra deterioro frente a la media de 200 sesiones o una corrección profunda con debilidad relativa."
    elif breakout:
        signal,setup,explanation = "Oportunidad detectada","breakout","Ruptura de máximo de 55 sesiones con tendencia alcista, RSI sin extremo y fortaleza relativa positiva."
    elif pullback:
        signal,setup,explanation = "Oportunidad detectada","pullback","Retroceso cercano a SMA 50 con tendencia principal positiva, RSI moderado y fortaleza frente a SPY."
    elif trend and near50:
        signal,setup,explanation = "Cerca de activarse","watch","Tendencia alcista cerca de SMA 50; faltan condiciones para confirmar un setup experimental."
    elif trend:
        signal,setup,explanation = "En seguimiento","trend","Tendencia principal favorable sin una configuración de entrada completa."
    else:
        signal,setup,explanation = "Sin ventaja identificada","neutral","No se cumplen las condiciones combinadas de entrada exploratoria."
    score = sum([26 if trend else 0, 20 if near50 else 0, 18 if 42 <= value_rsi <= 65 else 0, 22 if rel is not None and rel > 0 else 0, 14 if latest > max55 * 1.001 else 0])
    return {
        "status":signal,"setup":setup,"experimental":True,"score":score,
        "reason":explanation,"criteria":criteria,
        "invalidation":"Revisar tesis si hay cierre sostenido por debajo de SMA 200; no es una orden automática.",
        "sma50":rnd(s50),"sma200":rnd(s200),"rsi14":rnd(value_rsi),"momentum63":rnd(m63),
        "relative63":rnd(rel),"distanceSma50":rnd(pct(latest,s50)),
        "distanceSma200":rnd(pct(latest,s200)),
        "drawdown252":rnd(pct(latest,peak252))
    }

def fetch(ticker):
    symbol = ticker.replace(".", "-")
    params = urllib.parse.urlencode({"range":"5y","interval":"1d","includePrePost":"false","events":"div,splits"})
    err=None
    for host in ("query1.finance.yahoo.com","query2.finance.yahoo.com"):
        url="https://"+host+"/v8/finance/chart/"+urllib.parse.quote(symbol)+"?"+params
        req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; MarketRadarResearch/1.0)","Accept":"application/json"})
        try:
            with urllib.request.urlopen(req,timeout=16) as resp:
                data=json.load(resp)
            result=data["chart"]["result"][0]
            times=result["timestamp"]
            q=result["indicators"]["quote"][0]
            candles=[]
            now=dt.datetime.now(dt.timezone.utc).timestamp()
            session_end=result.get("meta",{}).get("currentTradingPeriod",{}).get("regular",{}).get("end")
            for i,t in enumerate(times):
                if session_end and t>=session_end-24*3600 and now<session_end+900:
                    continue
                c,o,h,l,v=(q[k][i] for k in ("close","open","high","low","volume"))
                if any(x is None or not math.isfinite(float(x)) for x in (c,o,h,l)) or min(c,o,h,l) <= 0:
                    continue
                if h<max(o,c,l) or l>min(o,c,h) or v is None or not math.isfinite(float(v)) or v<0:
                    continue
                candles.append({"d":dt.datetime.fromtimestamp(t,dt.timezone.utc).strftime("%Y-%m-%d"),
                  "o":round(float(o),3),"h":round(float(h),3),"l":round(float(l),3),
                  "c":round(float(c),3),"v":int(v or 0)})
            if len(candles)<201:
                raise ValueError("No hay 201 velas válidas para "+ticker)
            dates=[x["d"] for x in candles]
            if dates != sorted(set(dates)):
                raise ValueError("Fechas no ordenadas o duplicadas")
            meta=result.get("meta",{})
            return {"ticker":ticker,"company":meta.get("shortName") or ticker,
                "currency":meta.get("currency","USD"),"exchange":meta.get("exchangeName",""),
                "candles":candles[-1250:],"lastSession":candles[-1]["d"],
                "price":candles[-1]["c"],"changePct":rnd(pct(candles[-1]["c"],candles[-2]["c"])),
                "source":PROVIDER,"retrievedAt":dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                "dataStatus":"Official Close"}
        except (urllib.error.URLError,TimeoutError,KeyError,IndexError,TypeError,ValueError,OSError) as e:
            err=e
            print("Provider failure",ticker,host,str(e)[:180],flush=True)
            time.sleep(.25)
    raise RuntimeError("No se pudieron verificar precios para "+ticker+": "+str(err))

def main():
    old={}
    if OUT.exists():
        try:old=json.loads(OUT.read_text(encoding="utf-8")).get("assets",{})
        except (OSError,ValueError):pass
    fresh={}
    for ticker in TICKERS:
        try:
            fresh[ticker]=fetch(ticker)
            print("OK",ticker,fresh[ticker]["lastSession"],flush=True)
        except Exception as e:
            print("STALE",ticker,str(e)[:220],flush=True)
    merged={}
    for ticker in TICKERS:
        item=fresh.get(ticker) or old.get(ticker)
        if not item:
            continue
        item["dataStatus"]=item.get("dataStatus","Official Close") if ticker in fresh else "Last Valid Snapshot"
        merged[ticker]=item
    spy=merged.get("SPY",{}).get("candles")
    for ticker,item in merged.items():
        item["signal"]=calculate(item["candles"], spy if ticker!="SPY" else None)
        # Preserve the most recent genuine historical setup, even after market close.
        # Scan only completed sessions and never substitute a historical signal for a current one.
        # Research is recomputed once below, also when provider data is unavailable.
        item["price"]=item["candles"][-1]["c"]
        item["lastSession"]=item["candles"][-1]["d"]
    # Never overwrite a valid old snapshot if the provider failed for every ticker.
    if not fresh and old:
        print("No new prices: preserving last-good market.json",flush=True)
        from recalculate import main as recompute
        recompute()
        return
    if not merged:
        print("No market data available; no fabricated snapshot created",flush=True)
        return
    payload={"schema":SCHEMA,"generatedAt":dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
      "provider":PROVIDER,"methodology":"EMA, RSI, MACD, CMF/OBV proxy. Experimental; partial historical backtests with methodological limitations.",
      "assets":merged,"fetchedCount":len(fresh),"coverageCount":len(merged)}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(payload,separators=(",",":"),ensure_ascii=False),encoding="utf-8")
    from recalculate import main as recompute
    recompute()
    print("Wrote",OUT,"new",len(fresh),"total",len(merged),flush=True)

if __name__=="__main__":
    main()
