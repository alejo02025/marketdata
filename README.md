# Market Radar — Signal Intelligence

Plataforma personal para estudiar señales de acciones y ETF. Secciones: Radar, Análisis, Cartera y Daily.

## Estado del producto

- Radar: señales técnicas exploratorias de ruptura, pullback, tendencia y riesgo con condiciones visibles.
- Análisis: gráfico propio OHLCV, medias 50 y 200, criterios activados e invalidación orientativa.
- Cartera: operaciones locales de compra y venta, costo promedio, conexión con Radar, backup JSON.
- Daily: fuentes originales y últimos cierres SPY/QQQ. Aún no genera un briefing actualizado de manera automática.

## Datos de mercado

GitHub Actions consulta OHLCV diarios mediante el endpoint chart no oficial de Yahoo Finance. El acceso no está garantizado y puede estar limitado o restringido por el proveedor. El sitio utiliza el archivo de cierres generado durante la compilación. Cada activo conserva fecha de sesión, momento de consulta y proveedor. Si falla un ticker se conserva el último dato válido; si no hay datos auténticos se informa falta de cobertura.

Las señales constituyen reglas exploratorias: NO cuentan todavía con backtesting fuera de muestra validado. No representan probabilidades de rendimiento, alertas de compra automáticas ni asesoramiento personalizado. No existe garantía de tiempo real.

## Desarrollo

Instalación local:

    npm install
    npm run dev

Validación:

    npm run build
    python -m unittest discover -s scripts -p 'test_*.py' -v

Actualización manual de datos:

    python scripts/refresh_market.py

## Publicación

El repositorio contiene una sola aplicación React en src/. GitHub Pages debe utilizar Source: GitHub Actions. El workflow de deploy compila Vite, comprueba la existencia de assets y publica exclusivamente dist/. Nunca se debe publicar la raíz del repositorio con TypeScript sin compilar.

Sitio: https://alejo02025.github.io/marketdata/

El éxito en GitHub Actions no sustituye la verificación visual en un navegador real. Si hay una pantalla en blanco, inspeccionar Console y Network.

## Privacidad

El repositorio es público. Los datos de mercado en public/data también lo son. La cartera y watchlist se guardan exclusivamente en localStorage, sin cifrado ni sincronización. No guardar datos sensibles en dispositivos compartidos y exportar respaldos periódicamente.

## Próximas fases

1. Evaluación de señales con datos point-in-time, costes, sesgos y resultados fuera de muestra.
2. Fuente secundaria de precios licenciada o permitida y validación de estabilidad de Yahoo.
3. IndexedDB y exportaciones cifradas para cartera privada.
4. Daily editorial con fuentes verificadas internacionales y argentinas.
5. Prueba automática E2E de navegador sobre el sitio publicado.

Respaldo anterior: rama backup/pre-radar-v2.
