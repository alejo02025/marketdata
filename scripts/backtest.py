"""Event-driven fixed-rule EOD backtest. Signals at t close, orders at t+1 open.
No parameter optimization. Survivorship bias: current ticker universe. Results descriptive only.
"""
import math
import statistics
from advanced_signals import calculate

COST_ONE_WAY = .002 # 0.2 % assumed commissions plus slippage on EACH execution

def metric(trades, equity, benchmark):
    if len(equity)<2:return None
    returns=[equity[i]/equity[i-1]-1 for i in range(1,len(equity)) if equity[i-1]>0]
    yrs=max(len(returns)/252,1/252)
    growth=equity[-1]/equity[0]
    annualized=growth**(1/yrs)-1 if growth>0 else -1
    downside=[min(x,0)**2 for x in returns]
    sd=statistics.stdev(returns) if len(returns)>1 else 0
    downside_dev=math.sqrt(sum(downside)/len(downside)) if downside else 0
    sharpe=(statistics.mean(returns)/sd*math.sqrt(252)) if sd>0 else None
    sortino=(statistics.mean(returns)/downside_dev*math.sqrt(252)) if downside_dev>0 else None
    high=equity[0];maxdd=0
    for x in equity:
        high=max(high,x)
        if high>0:maxdd=min(maxdd,x/high-1)
    wins=[t for t in trades if t['netReturn']>0]
    positives=sum(t['netReturn'] for t in trades if t['netReturn']>0)
    negatives=-sum(t['netReturn'] for t in trades if t['netReturn']<0)
    pf=positives/negatives if negatives>0 and trades else None
    def rd(v):return round(v,4) if v is not None and math.isfinite(v) else None
    return {
        'trades':len(trades),'winRate':rd(len(wins)/len(trades)*100) if trades else None,
        'profitFactor':rd(pf),'totalReturnPct':rd((growth-1)*100),
        'annualizedReturnPct':rd(annualized*100),'buyHoldReturnPct':rd((benchmark[-1]/benchmark[0]-1)*100) if benchmark[0] else None,
        'maxDrawdownPct':rd(maxdd*100),'sharpe':rd(sharpe),'sortino':rd(sortino),
        'avgTradePct':rd(statistics.mean(t['netReturn'] for t in trades)*100) if trades else None,
        'evidence':'limited' if len(trades)<10 else 'sample',
    }

STRATEGIES = ('trend_pullback', 'trend_breakout')

def simulate(candles, signals, start, end, strategy, spy=None, cost=COST_ONE_WAY):
    cash=1.;shares=0.;entry=None;trades=[];equity=[]
    for i in range(start,end):
        c=candles[i];equity.append(cash+shares*c['c'])
        if i==end-1:break
        signal=signals[i]
        events=signal.get('setups',[])
        enter=any(e['code']==strategy and e['stage']=='Confirmación' for e in events)
        exit_now=shares>0 and (c['c']<signal['sma50'] or i-entry[0]>=126)
        nxt=candles[i+1]
        if exit_now:
            cash=shares*nxt['o']*(1-cost)
            trades.append({'entryDate':candles[entry[0]]['d'],'date':nxt['d'],'netReturn':cash/entry[1]-1})
            shares=0.;entry=None
        elif shares==0 and enter:
            entry=(i+1,cash);shares=cash*(1-cost)/nxt['o'];cash=0.
    if shares:
        equity[-1]=shares*candles[end-1]['c']*(1-cost)
        trades.append({'entryDate':candles[entry[0]]['d'],'date':candles[end-1]['d'],'netReturn':equity[-1]/entry[1]-1,'forcedLiquidation':True})
    benchmark=[c['c'] for c in candles[start:end]]
    m=metric(trades,equity,benchmark)
    if m:
        # Same endpoints; price returns, not dividend-reinvested total returns.
        spy_map={c['d']:c['c'] for c in spy or []}
        a=spy_map.get(candles[start]['d']);b=spy_map.get(candles[end-1]['d'])
        m['spyReturnPct']=round((b/a-1)*100,4) if a and b else None
        m['from']=candles[start]['d'];m['to']=candles[end-1]['d']
    return m

def backtest(candles,spy=None):
    if len(candles)<330:return None
    start=220;end=len(candles);split=start+int((end-start)*.6)
    signals={i:calculate(candles[:i+1],spy[:i+1] if spy else None) for i in range(start,end)}
    strategies={}
    for code in STRATEGIES:
        strategies[code]={
            'full':simulate(candles,signals,start,end,code,spy),
            'early':simulate(candles,signals,start,split,code,spy),
            'outOfSample':simulate(candles,signals,split,end,code,spy),
            'higherCost':simulate(candles,signals,start,end,code,spy,cost=.005)}
    return {
        'period':{'from':candles[start]['d'],'to':candles[-1]['d'],'outOfSampleStart':candles[split]['d']},
        'strategies':strategies,'full':strategies['trend_pullback']['full'],'outOfSample':strategies['trend_pullback']['outOfSample'],
        'feeAndSlippagePerSidePct':COST_ONE_WAY*100,
        'method':'Dos estrategias investigadas por separado: continuación tras retroceso y ruptura con fuerza relativa. Solo eventos confirmados. Señal al cierre t, ejecución en apertura t+1. Una posición sin apalancamiento; salida bajo SMA50 o tras 126 sesiones. Liquidación al cierre final. Cada subperíodo empieza en efectivo. Costos: 0,20% por lado y prueba a 0,50%. Benchmarks: retorno de precio bruto, sin dividendos.',
        'warnings':['Survivorship/selection bias: universo de ganadores actuales, no universo histórico.',
            'Sin dividendos reinvertidos, impuestos ni garantía de ajustes corporativos correctos.',
            'Último 40% es un holdout retrospectivo, NO una prueba independiente fuera de muestra.',
            'Costos fijos y fills diarios simplificados. Las liquidaciones finales cuentan como operaciones.',
            'Reglas propuestas, no calibradas ni validadas de forma independiente. Pocas operaciones implican evidencia insuficiente.']
    }
