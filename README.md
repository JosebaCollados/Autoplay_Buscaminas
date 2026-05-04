# Autoplay Buscaminas

Autoplay Buscaminas es un proyecto de inteligencia artificial capaz de jugar automaticamente al Buscaminas. El objetivo es crear un agente que analice el tablero, calcule riesgos y tome decisiones para resolver partidas con la mayor eficiencia posible.

## Descripcion

La IA observa el estado actual de la partida y decide que casilla abrir o marcar como mina. Para ello puede combinar reglas logicas, busqueda de patrones y estimaciones probabilisticas cuando no existe una jugada segura.

El proyecto esta pensado para experimentar con estrategias de resolucion automatica y comparar el rendimiento de la IA en distintos niveles de dificultad.

## Niveles de dificultad

El juego contara con 5 niveles de dificultad:

1. **Principiante**: tablero pequeno, pocas minas y partidas ideales para probar reglas basicas.
2. **Facil**: aumenta ligeramente el tamano del tablero y la cantidad de minas.
3. **Normal**: dificultad equilibrada para medir el rendimiento general de la IA.
4. **Dificil**: tablero mas grande, mayor densidad de minas y mas situaciones con incertidumbre.
5. **Experto**: el reto principal, con decisiones complejas y mayor dependencia del calculo probabilistico.

## Caracteristicas previstas

- Juego automatico de partidas de Buscaminas.
- Deteccion de jugadas seguras mediante reglas logicas.
- Marcado automatico de minas.
- Estimacion de probabilidades en jugadas inciertas.
- Cinco niveles de dificultad configurables.
- Registro de estadisticas como victorias, derrotas, tiempo y movimientos realizados.

## Objetivos del proyecto

- Desarrollar una IA capaz de resolver tableros de Buscaminas de forma autonoma.
- Comparar estrategias de juego entre los distintos niveles.
- Mejorar progresivamente la toma de decisiones de la IA.
- Crear una base facil de ampliar con nuevas heuristicas o modelos.

## Estado del proyecto

Primera version funcional creada con React, TypeScript y Vite.

## Como ejecutar

```bash
npm install
npm run dev
```

La aplicacion se abre en la URL que indique Vite, normalmente `http://127.0.0.1:5173`.

Para comprobar una build de produccion:

```bash
npm run build
```

## Version actual

- Motor de Buscaminas independiente de la interfaz.
- Generacion de tablero con primer click seguro.
- Revelado manual, marcado de banderas y flood reveal.
- Deteccion de victoria y derrota.
- Cinco dificultades y modo custom.
- Autoplay con solver logico y probabilistico:
  - Si todas las minas de una pista ya estan marcadas, abre las casillas restantes.
  - Si todas las casillas ocultas alrededor de una pista deben ser minas, las marca.
  - Agrupa la frontera visible en problemas de restricciones.
  - Enumera configuraciones validas por grupo para detectar casillas 0% mina y 100% mina.
  - Si no hay jugada segura, combina el menor riesgo calculado con un modelo N-Tuple 4x6 entrenable.
- Solver en Web Worker:
  - El analisis de la IA se calcula fuera del hilo principal de React.
  - La interfaz muestra estados como calculando, lista o error.
- Benchmark:
  - Panel para simular 100 partidas con la dificultad y nivel IA actuales.
  - Muestra win rate, victorias, movimientos medios y guesses.
- Aprendizaje local:
  - El modelo mira ventanas visibles `4x6` alrededor de casillas candidatas.
  - Aprende pesos con ejemplos generados por autoplay y simulaciones internas.
  - Los pesos se guardan en `localStorage`.
  - El boton con icono de cerebro entrena el numero de partidas configurado en la dificultad actual.
  - El boton con brillo reinicia el aprendizaje.
- Opciones de calidad:
  - Primer click amplio configurable.
  - Autoplay sin suposiciones: el bot se pausa si la siguiente jugada no es segura.
  - Preferencias guardadas en el navegador.
- Panel visual de razonamiento, pistas de riesgo y estadisticas de sesion.

## Limite importante

Sin mirar el tablero oculto, ningun bot puede garantizar 100% de victorias en tableros aleatorios de Buscaminas. Hay estados indistinguibles donde varias configuraciones de minas cumplen exactamente las mismas pistas visibles y obligan a adivinar.

Para autoplay sin fallos reales hay dos opciones distintas:

- Generar solo tableros `no-guess`, siempre resolubles por logica.
- Activar un modo oraculo/debug que mire las minas ocultas, que ya no seria una IA jugando con la misma informacion que un humano.

## Autor

Proyecto creado para explorar inteligencia artificial aplicada a juegos de logica.
