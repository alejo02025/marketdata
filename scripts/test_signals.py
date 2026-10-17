"""Deterministic unit tests: synthetic prices are ONLY used here, never shipped as market data."""
import math
import pathlib
import sys
import unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
from refresh_market import sma,rsi,pct,indicators

def generate(start=100,rate=.0008,n=310,trend_change=None):
    values=[]
    for i in range(n):
        price=start*((1+rate)**i)
        if trend_change and i>=trend_change:
            price*=.6
        values.append({"d":f"session-{i:03d}","o":price,"h":price*1.01,"l":price*.99,"c":price,"v":1000})
    return values

class IndicatorTests(unittest.TestCase):
    def test_sma(self):
        self.assertEqual(sma([1,2,3,4],2),3.5)
        self.assertIsNone(sma([1],2))
    def test_rsi_flat(self):
        self.assertAlmostEqual(rsi([100]*20),50)
    def test_rsi_rising(self):
        self.assertAlmostEqual(rsi([100+i for i in range(20)]),100)
    def test_pct_zero(self):
        self.assertIsNone(pct(10,0))
    def test_missing_history(self):
        self.assertEqual(indicators(generate(n=20))["status"],"Insuficiente")
    def test_healthy_trend(self):
        r=indicators(generate())
        self.assertIn(r["status"],["En seguimiento","Cerca de activarse","Oportunidad detectada"])
        self.assertTrue(r["experimental"])
        self.assertGreater(r["sma50"],r["sma200"])
    def test_risk(self):
        r=indicators(generate(trend_change=270))
        self.assertEqual(r["status"],"Riesgo creciente")
    def test_score_not_probability(self):
        r=indicators(generate())
        self.assertGreaterEqual(r["score"],0)
        self.assertLessEqual(r["score"],100)
        self.assertNotIn("probability",r)
if __name__=="__main__":
    unittest.main()
