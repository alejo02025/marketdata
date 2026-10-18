"""Recompute research using the existing provider snapshot, without changing retrieval dates."""
import json
from refresh_market import OUT
from advanced_signals import calculate
from backtest import backtest

def main():
    data=json.loads(OUT.read_text());spy=data['assets']['SPY']['candles']
    for ticker,item in data['assets'].items():
        candles=item['candles'];item['signal']=calculate(candles,spy)
        history=[];previous=set()
        for idx in range(max(219,len(candles)-125),len(candles)):
            result=calculate(candles[:idx+1], [x for x in spy if x['d']<=candles[idx]['d']]);current=set()
            for e in result.get('setups',[]):
                key=(e['code'],e['label'],e['stage']);current.add(key)
                if key in previous:continue
                history.append({'date':candles[idx]['d'],'price':candles[idx]['c'],'status':result['status'],'score':result['score'],'reason':e['reason'],'setupCode':e['code'],'setupLabel':e['label'],'stage':e['stage']})
            previous=current
        item['recentSignals']=history[-24:];item['lastHistoricalSignal']=history[-1] if history else None
        item['backtest']=backtest(candles,spy)
        print(ticker,[(k,v['full']['trades']) for k,v in item['backtest']['strategies'].items()],flush=True)
    data['researchVersion']='three-averages-v4'
    OUT.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
if __name__=='__main__':main()
