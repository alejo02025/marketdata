# Market Radar · Signal Intelligence

Detector personal de señales para acciones y ETF estadounidenses. **Solo tres secciones: Radar, Análisis y Daily.** Sin módulo Cartera, sin órdenes automáticas y sin cotizaciones simuladas.

## Qué está implementado

- Radar de activos: confluencia de EMA/SMA, RSI, MACD, volumen relativo, niveles de 52 semanas y proxy de presión de negociación CMF/OBV.
- Análisis: velas OHLCV y volumen; medias EMA 20/50/100/200; MACD separado; menú de 2 a 45 minutos, 1–4 horas, 1 día, 1 semana, 1/3/6/12 meses.
- Los marcos intradía se consultan en el widget oficial TradingView. Los marcos diarios/semanales/mensuales se reconstruyen exclusivamente con velas de origen diario descargadas. **Nunca se interpolan velas intradía ficticias**. Algunos intervalos o mercados pueden requerir sesión o suscripción de TradingView.
- Reporte de puntos alcistas, bajistas, neutrales; hipótesis de continuación, señales de fakeout e invalidación.
- Backtest histórico exploratorio para SPY, QQQ, AAPL, MSFT, NVDA y GOOGL. Señal al cierre de t → ejecución hipotética a apertura de t+1; costes aproximados de 0,2 % por ejecución; resultados totales y último 40 % cronológico. No implica validación prospectiva ni eliminación completa de sesgos.
- Daily: dashboard móvil en español, con hasta seis indicadores, tres titulares, contexto argentino, temas para seguir, conclusión y fuentes desplegables. La tarea de ChatGPT guarda el briefing largo bilingüe en `bodyMarkdown` para archivo y un resumen estructurado separado en `webBrief` para la interfaz. La web no muestra el artículo completo. No fabrica datos ni presenta precios sin fecha.

## Datos y limitaciones

- `scripts/refresh_market.py` obtiene diarios de Yahoo Finance mediante endpoint no oficial, cuyo acceso y licencia pueden cambiar. Sin garantías de realtime.
- Porcentaje de Institutional Ownership / Institutional Transactions: no se obtiene automáticamente de Finviz. Se incluye enlace a Finviz para consulta. **CMF/OBV no mide compras de fondos ni es Konkorde oficial.** Es solo un proxy de presión de precio/volumen.
- Finviz inspira criterios tipo volumen relativo / máximos de 52 semanas, pero no se realiza scraping de sus pantallas.
- Los resultados históricos corresponden al universo de supervivientes hoy, no están ajustados completamente por dividendos, sesgos de selección, impuestos u operaciones reales; el backtest es informativo y no prueba predictibilidad.
- La watchlist editable queda en el navegador mediante localStorage y no sincroniza entre dispositivos. Ya no se guardan operaciones ni cartera en la aplicación nueva.

## Desarrollo

```bash
npm install
npm run dev
npm run build
npm test
python -m unittest discover -s scripts -p 'test_*.py' -v
python scripts/refresh_market.py
```

## GitHub Pages

GitHub Pages debe configurarse en **Source = GitHub Actions**. Solo publicar `dist/` (el build de Vite) y nunca el TypeScript fuente. El workflow de Deploy valida Python, compilación, navegación Playwright desktop/mobile y comprueba el HTML público servido por Pages.

Sitio: https://alejo02025.github.io/marketdata/

## Briefing de chat y web

El mismo proceso de investigación alimenta dos experiencias distintas: el briefing completo **inglés B1 + español** se envía al chat, y una versión **más breve y solo en español** se muestra en la web. Las cifras, fechas y fuentes deben coincidir; la redacción y la extensión difieren por diseño.

Contrato de `public/data/daily.json` (schema 1, ampliado compatible):

```json
{
  "schema": 1,
  "date": "YYYY-MM-DD",
  "title": "LO QUE NECESITÁS SABER PARA ARRANCAR LA JORNADA",
  "status": "published",
  "generatedAt": "2026-10-19T07:30:00-03:00",
  "bodyMarkdown": "Briefing bilingüe completo enviado en ChatGPT",
  "webBrief": {
    "updatedAt": "2026-10-19T07:30:00-03:00",
    "metrics": [
      {"label": "Riesgo país", "value": "648", "change": "+26 pb", "movement": "up", "asOf": "Cierre 16/10"}
    ],
    "highlights": [
      {"tag": "Wall Street", "title": "Título corto", "summary": "Explicación breve verificada"}
    ],
    "argentina": ["Dato relevante de Argentina con fecha o contexto"],
    "watch": ["Tasas", "Bonos", "Dólar"],
    "takeaway": "Conclusión breve para inversiones."
  },
  "sourceLinks": [{"title": "Fuente", "url": "https://example.com"}]
}
```

No generar `webBrief` mediante recortes ciegos o traducción automática de titulares. Los valores deben estar respaldados por `bodyMarkdown` y tener las referencias correctas. Las cifras viejas deben tener su fecha, no mostrarse como cotizaciones actuales.

La automatización diaria existente publica un único JSON con ambas presentaciones a través de GitHub y valida el contenido de los campos. GitHub Actions publica el JSON junto con el sitio compilado. Una edición con `webBrief` ausente se muestra como pendiente en Daily para evitar exhibir el artículo bilingüe antiguo. Los enlaces de fuente quedan detrás del desplegable.

## Respaldo y próximos pasos

Copia de seguridad anterior: rama `backup/pre-signal-v3`. Mejoras futuras: datos point-in-time para sesgos de supervivencia, validación independiente de backtesting, propiedad institucional de fuentes autorizadas, prueba profunda de indicadores intradía, artículos Daily de producción.

Solo se deben mostrar cifras de datos reales con proveedor y timestamp verificables.
