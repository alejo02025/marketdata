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

def backtest(candles,spy=None):
    if len(candles)<330:return None
    start=220
    cash=1.0
    shares=0.0
    entry_price=0.0
    entry_idx=None
    trades=[];daily=[];benchmark=[]
    # 60% calibration window/40% forward evaluation. Fixed params chosen a priori,
    # so the label represents a chronological segment, not optimization.
    split=max(start+1,int(len(candles)*.6))
    for i in range(start,len(candles)-1):
        candle=candles[i]
        # Account equity marked to market at close, zero lookahead.
        daily.append(cash+shares*candle['c'])
        benchmark.append(candle['c'])
        hist=candles[:i+1]
        subset_spy=spy[:i+1] if spy and spy[0]['d']==candles[0]['d'] else None
        signal=calculate(hist,subset_spy)
        enter=signal['status'] in ('Oportunidad de Entrada','Ruptura Confirmada')
        exit_now=(shares>0 and (candle['c']<signal.get('sma50',float('inf')) or
            signal['status']=='Riesgo Creciente / Deterioro' or (entry_idx is not None and i-entry_idx>=40)))
        # Current close signal executes no earlier than NEXT session open.
        nxt=candles[i+1];nxt_open=nxt['o']
        if shares>0 and exit_now:
            cash=shares*nxt_open*(1-COST_ONE_WAY)
            gross=nxt_open/entry_price-1
            net=(1+gross)*(1-COST_ONE_WAY)/(1+COST_ONE_WAY)-1
            trades.append({'date':nxt['d'],'entryDate':candles[entry_idx]['d'] if entry_idx is not None else '', 'netReturn':net})
            shares=0;entry_idx=None
        elif shares==0 and enter:
            shares=cash*(1-COST_ONE_WAY)/nxt_open
            entry_price=nxt_open;entry_idx=i+1;cash=0
    daily.append(cash+shares*candles[-1]['c'])
    benchmark.append(candles[-1]['c'])
    # Liquidate at final known close to mark final equity and an executed trade
    # excluded from live order simulation; counts as hypothetical closing liquidation.
    if shares>0:
        final_price=candles[-1]['c']
        daily[-1]=shares*final_price*(1-COST_ONE_WAY)
        net=final_price/entry_price*(1-COST_ONE_WAY)/(1+COST_ONE_WAY)-1
        trades.append({'date':candles[-1]['d'],'entryDate':candles[entry_idx]['d'],'netReturn':net})
    cutoff=split-start
    full=metric(trades,daily,benchmark)
    out=metric([t for t in trades if t['date']>=candles[split]['d']],daily[cutoff:],benchmark[cutoff:])
    return {
        'period':{'from':candles[start]['d'],'to':candles[-1]['d'],'outOfSampleStart':candles[split]['d']},
        'full':full,'outOfSample':out,'feeAndSlippagePerSidePct':COST_ONE_WAY*100,
        'method':'Long only. Technical signal at close t; enter/exit at t+1 open; single fully invested position; max holding 40 sessions; close below SMA50; liquidate final close.',
        'warnings':['Fixed preselected parameters; no statistical significance claimed.',
            'Present-day surviving universe introduces survivorship/selection bias.',
            'Raw OHLC history may not accurately incorporate dividends, splits or taxes.',
            'OHLC daily fills and 0.2% one-way friction are simplifying assumptions.',
            'Out-of-sample is a chronological segment, not a fully independent forward trial.']
    }
