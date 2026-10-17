"""Research-engine regression tests. Synthetic candles exist only in these tests."""
import pathlib,sys,unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from advanced_signals import calculate,cmf,ema_series,macd_series,rsi_series
from backtest import backtest

def rows(n=480,crash=False):
    import datetime
    origin=datetime.date(2024,1,1)
    series=[]
    for i in range(n):
        p=100*(1.001**i)
        if crash and i>n-42:p*=.52
        series.append({'d':str(origin+datetime.timedelta(days=i)),'o':p*.999,'h':p*1.01,'l':p*.99,'c':p,'v':int(1_000_000+(i%3)*100_000)})
    return series

class AdvancedTests(unittest.TestCase):
    def test_ema_and_macd_are_causal(self):
        values=list(range(1,130))
        self.assertEqual(ema_series(values[:99],20)[-1],ema_series(values,20)[98])
        self.assertEqual(macd_series(values[:99])[2][-1],macd_series(values)[2][98])
    def test_rsi_scale(self):
        series=rsi_series([100+i for i in range(100)])
        self.assertTrue(0<=series[-1]<=100)
    def test_no_institutional_ownership_implied(self):
        s=calculate(rows())
        self.assertTrue(s['experimental'])
        self.assertIsNone(s['institutionalOwnership'])
        self.assertIsNone(s['institutionalTransactions'])
        self.assertIn('proxy',s['institutionalProxy'].lower())
    def test_sudden_decline_is_risk(self):
        s=calculate(rows(crash=True))
        self.assertEqual(s['status'],'Riesgo Creciente / Deterioro')
    def test_volume_and_cmf(self):
        self.assertIsNotNone(cmf(rows()))
        s=calculate(rows())
        self.assertIn('relativeVolume',s)
        self.assertIn('macdHistogram',s)
    def test_historical_test_records_disclaimers(self):
        result=backtest(rows())
        self.assertIsNotNone(result)
        self.assertIn('outOfSample',result)
        self.assertIn('survivorship',str(result['warnings']).lower())
        self.assertEqual(result['feeAndSlippagePerSidePct'],.2)
if __name__=='__main__':unittest.main()
