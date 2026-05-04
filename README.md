# Autoplay Buscaminas

Autoplay Buscaminas es una aplicacion web de Buscaminas con un agente de inteligencia artificial capaz de analizar el tablero, calcular riesgos y jugar de forma autonoma. El proyecto combina un motor de juego propio, un solver logico-probabilistico y aprendizaje local para explorar como una IA puede resolver partidas con la misma informacion visible que tendria una persona.

El objetivo no es solo automatizar clicks: es construir una experiencia visual donde se pueda observar como razona el bot, que decisiones considera seguras, cuando necesita asumir riesgo y como evoluciona su rendimiento a traves de diferentes niveles de dificultad.

## Que ofrece

- Buscaminas jugable con revelado manual, banderas, primer click seguro y deteccion de victoria o derrota.
- Modo manual para jugar como usuario y modo Autoplay para delegar la partida en la IA.
- Cinco dificultades: Principiante, Facil, Normal, Dificil y Experto.
- Paneles de estadisticas con partida, banderas, porcentaje de sesion y guesses.
- Control de velocidad del bot para observar partidas paso a paso o acelerar simulaciones.
- Solver ejecutado en Web Worker para mantener la interfaz fluida durante el analisis.
- Sistema de aprendizaje local basado en patrones visibles del tablero.
- Panel informativo que explica el estado actual del modelo y del solver.

## Enfoque de IA

La IA interpreta cada numero revelado como una restriccion sobre sus casillas vecinas ocultas. A partir de esas restricciones, separa la frontera del tablero en componentes independientes y enumera configuraciones de minas que cumplen todas las pistas visibles.

Con ese analisis puede identificar tres tipos de decisiones:

- Casillas con riesgo `0%`, que se pueden abrir con seguridad.
- Casillas con riesgo `100%`, que se pueden marcar como minas.
- Casillas inciertas, donde compara probabilidades y escoge la jugada con menor riesgo estimado.

Cuando la logica exacta no basta, el proyecto combina la probabilidad local con un modelo N-Tuple `4x6` entrenable en el navegador. Ese modelo aprende de patrones visibles y conserva sus pesos en `localStorage`, permitiendo mejorar la seleccion de jugadas inciertas durante el uso.

## Arquitectura del proyecto

El codigo esta separado por responsabilidades para que el motor, la IA y la interfaz puedan evolucionar sin mezclarse demasiado:

```text
src/
  ai/
    solverWorker.ts       # Analisis de IA fuera del hilo principal
    useSolverWorker.ts    # Comunicacion entre React y el worker
  game/
    difficulties.ts       # Configuracion de dificultades
    engine.ts             # Reglas del tablero y estado de partida
    learning.ts           # Modelo N-Tuple y aprendizaje local
    solver.ts             # Solver logico, probabilistico y heuristicas
    types.ts              # Tipos compartidos del dominio
  App.tsx                 # Interfaz principal y orquestacion del juego
  main.tsx                # Entrada de la aplicacion
  styles.css              # Sistema visual
```

## Stack tecnico

- React
- TypeScript
- Vite
- Web Workers
- Lucide React
- CSS

## Estado actual

El proyecto cuenta con una primera version funcional que incluye motor independiente, tablero interactivo, autoplay, solver en worker, paneles visuales, estadisticas de sesion y aprendizaje local.

Las proximas lineas naturales de mejora son:

- Generacion de tableros `no-guess` para medir rendimiento sin azar inevitable.
- Comparativas entre heuristicas de IA.
- Persistencia o exportacion de estadisticas.
- Modo benchmark mas completo para analizar win rate, guesses y movimientos medios.
- Visualizacion mas detallada del razonamiento del solver sobre cada casilla.

## Limitacion importante

Un bot que juega Buscaminas sin mirar el tablero oculto no puede garantizar el `100%` de victorias en tableros aleatorios. Existen estados donde varias distribuciones de minas son compatibles con todas las pistas visibles, y cualquier jugador, humano o IA, debe asumir una probabilidad de fallo.

Por eso este proyecto distingue entre resolver con informacion legitima y usar un modo debug/oraculo. El interes principal esta en el primer caso: una IA que razona sobre la informacion disponible, no una que conoce la solucion de antemano.

## Autor

Desarrollado por Joseba Collados como experimento de inteligencia artificial aplicada a juegos de logica.

## Licencia

MIT (c) 2026 Joseba Collados.
