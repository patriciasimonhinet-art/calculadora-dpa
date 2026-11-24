# Calculadora DPA (PWA para Móvil)

Aplicación Web Progresiva (PWA) diseñada para calcular la **Demanda Pronosticada Ajustada ($DPA_t$)** combinando un piso contractual flexible con suavización exponencial en 2 fases.

## Fórmula Implementada

$$DPA_t = \max\Big( C_t \cdot (1 - \tau), \; \hat{D}_{\text{Estd}, t} + F_t \Big) + SS_t$$

### Estrategia en 2 Fases
1. **Fase 1 — Arranque (Semanas 1 a 8):**
   - Pronóstico estadístico mediante Suavización Exponencial Simple ($\alpha = 0.3 - 0.4$).
   - Estacionalidad desactivada ($S_{t-m} = 1.0$).
   - El piso contractual $C_t(1 - \tau)$ protege la capacidad mínima.
2. **Fase 2 — Consolidación (Semana 9 en adelante):**
   - Activa automáticamente los componentes de Tendencia ($b_t$) y Estacionalidad multiplicativa ($S_{t-m}$) de Holt-Winters.
   - Calcula la desviación estándar real ($\sigma_L$) a partir de los errores históricos guardados en el dispositivo.

## Cómo desplegar en GitHub Pages e instalar en el móvil
1. Crea un repositorio público en **GitHub** (ej. `calculadora-dpa`).
2. Sube todos los archivos de esta carpeta (`index.html`, `styles.css`, `app.js`, `manifest.json`, `sw.js`, `icon.svg`) a la raíz del repositorio.
3. Ve a **Settings → Pages → Source**, selecciona `Deploy from a branch` (`main` / `root`) y guarda.
4. Abre la URL generada (`https://tu-usuario.github.io/calculadora-dpa/`) desde Chrome (Android) o Safari (iOS) y pulsa **Añadir a pantalla de inicio / Instalar aplicación**.
