import unittest
from backtest import simulate, backtest
from test_advanced_signals import rows
from advanced_signals import calculate
class AuditTests(unittest.TestCase):
    def test_costs_and_next_open(self):
        candles=[{'d':f'2024-01-0{i+1}','o':p,'c':p} for i,p in enumerate([100,200,200,200])]
        signals={i:{'setups':[{'code':'ema20_touch','stage':'Rebote confirmado'}],'sma50':0} for i in range(4)}
        result=simulate(candles,signals,0,4,'ema20_touch',candles)
        self.assertAlmostEqual(result['totalReturnPct'],((1-.002)**2-1)*100,places=4)
        self.assertAlmostEqual(result['avgTradePct'],result['totalReturnPct'],places=4)
        self.assertEqual(result['spyReturnPct'],100)
    def test_early_alert_never_enters(self):
        c=[{'d':str(i),'o':100,'c':100} for i in range(4)]
        sig={i:{'setups':[{'code':'ema20_touch','stage':'Alerta temprana'}],'sma50':0} for i in range(4)}
        self.assertEqual(simulate(c,sig,0,4,'ema20_touch')['trades'],0)
    def test_three_independent_strategies(self):
        result=backtest(rows())
        self.assertEqual(set(result['strategies']),{'ema20_touch','golden_cross','breakout'})
        self.assertIn('higherCost',result['strategies']['breakout'])
    def test_breakout_volume_gate(self):
        c=rows();c[-1].update(o=c[-1]['c'],c=c[-1]['c']*1.1,h=c[-1]['c']*1.11,v=3_000_000)
        self.assertIn('breakout',[e['code'] for e in calculate(c)['setups']])
        c[-1]['v']=10
        self.assertNotIn('breakout',[e['code'] for e in calculate(c)['setups']])
