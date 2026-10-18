"""Audit checks for new research rules; synthetic candles used only in tests."""
import unittest
from backtest import simulate, backtest
from test_advanced_signals import rows
from advanced_signals import calculate

class AuditTests(unittest.TestCase):
    def test_costs_and_next_open(self):
        candles=[{'d':f'2024-01-0{i+1}','o':p,'c':p} for i,p in enumerate([100,200,200,200])]
        signals={i:{'setups':[{'code':'trend_pullback','stage':'Confirmación'}],'sma50':0} for i in range(4)}
        result=simulate(candles,signals,0,4,'trend_pullback',candles)
        self.assertAlmostEqual(result['totalReturnPct'],((1-.002)**2-1)*100,places=4)
        self.assertAlmostEqual(result['avgTradePct'],result['totalReturnPct'],places=4)
        self.assertEqual(result['spyReturnPct'],100)
    def test_observation_never_enters(self):
        c=[{'d':str(i),'o':100,'c':100} for i in range(4)]
        sig={i:{'setups':[{'code':'trend_pullback','stage':'Observación'}],'sma50':0} for i in range(4)}
        self.assertEqual(simulate(c,sig,0,4,'trend_pullback')['trades'],0)
    def test_two_research_hypotheses(self):
        result=backtest(rows())
        self.assertEqual(set(result['strategies']),{'trend_pullback','trend_breakout'})
        self.assertIn('higherCost',result['strategies']['trend_breakout'])
        self.assertIn('outOfSample',result['strategies']['trend_pullback'])
    def test_volume_and_relative_strength_gates(self):
        c=rows()
        # Realistic oscillation rather than a trend with RSI permanently at 100.
        for i,x in enumerate(c):
            base=x['c']
            x.update(o=base,c=base*(1+.012*((-1)**i)),
                     h=base*1.025,l=base*.985,v=1_000_000)
        last=c[-1]
        last.update(c=last['o']*1.055,h=last['o']*1.065,v=3_000_000)
        spy=rows()
        for bar in spy:bar.update(o=100,c=100,h=101,l=99,v=1_000_000)
        high=calculate(c,spy)
        codes=[e['code'] for e in high['setups']]
        self.assertEqual(high['decision']['liquid'],True)
        # If the trend / extension filter rejects this breakout, increasing volume
        # must not bypass it. A passing event, however, must require RVOL >= 1.3.
        if 'trend_breakout' in codes:
            self.assertGreaterEqual(high['relativeVolume'],1.3)
            last['v']=10
            low=calculate(c,spy)
            self.assertNotIn('trend_breakout',[e['code'] for e in low['setups']])
        else:
            self.assertNotEqual(high['decision']['state'],'Ruptura a estudiar')
