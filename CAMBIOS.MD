# 🎯 Objetivo
Reemplazar el bloque actual del header (texto "Creado por...") por un **componente dinámico útil para el usuario**.

Actualmente ese espacio no aporta valor ni mejora la UX. Debe transformarse en un elemento funcional tipo HUD.

---

# 🧠 Contexto de diseño

En UI de juegos, el HUD debe mostrar información relevante para la toma de decisiones del usuario (estado, progreso, contexto), evitando ruido innecesario. :contentReference[oaicite:0]{index=0}

---

# 🔧 Reemplazo requerido

## ❌ Eliminar
Eliminar completamente este bloque:
- "Creado por Joseba Collados inspirado en Autoplay 2048"

---

## ✅ Añadir nuevo componente: `GameStatusBar`

Un componente dinámico que muestre:

### 1. Estado de la partida
Valores posibles:
- `playing` → 🟢 Jugando
- `lost` → 💥 Perdido
- `won` → 🏆 Victoria

---

### 2. Modo actual
- `manual` → Manual
- `ai` → AI

---

### 3. Insight contextual (opcional pero recomendado)
Mostrar solo si hay información disponible:

Ejemplos:
- "Movimiento seguro detectado"
- "Riesgo bajo"
- "Probabilidad media: 12%"
- "Exploración activa"

---

# 🧩 Ejemplo de render

Formato final:
