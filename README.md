# KAGE-KEN 影拳 · World Tour

Juego de peleas en **pixel art** de estilo japonés, jugador contra la computadora,
hecho en HTML5 Canvas y JavaScript puro (sin librerías, sin instalación).
[COMABATE](https://geekrovira.github.io/combate/)
## Cómo jugar

Abre `index.html` en Chrome, Edge o Firefox (doble clic basta).
Si quieres servirlo por HTTP:

```bash
python -m http.server 8791
```

y entra a http://localhost:8791

## Controles (teclado)

| Tecla | Acción |
|-------|--------|
| ← → (o A / D) | Avanzar / retroceder |
| ↑ ↓ (o W / S) | Moverse hacia el fondo / hacia el frente (profundidad) |
| Espacio | Saltar (salto + X = patada voladora) |
| Z (o J) | Puñetazo rápido |
| X (o K) | Patada fuerte |
| C (o L) | Golpe especial: bola de KI (requiere la barra KI llena) |
| Shift (o V) | Bloquear (reduce el daño al 12 %) |
| Enter | Confirmar / saltar pantalla / continuar |
| Esc | Volver al menú |
| M | Silenciar música y efectos |

La barra **KI** se llena con el tiempo, al golpear y al recibir golpes.

## Luchadores seleccionables

| Nombre | Estilo | Perfil |
|--------|--------|--------|
| Kenji 健二 | Karate | Equilibrado |
| Sakura 桜 | Ninjutsu | Muy rápida, poca vida |
| Hiro 大 | Boxeo | Lento, pega durísimo |
| Aiko 愛子 | Kung Fu | Ágil y técnica |

## Rivales y escenarios (en orden)

1. **Goro** (Yakuza) — Tokio, Shibuya de noche, con neones y la Torre de Tokio.
2. **Pierre** (Savate) — París, Montmartre al atardecer, con la Torre Eiffel.
3. **Brooklyn** (Callejero) — Nueva York, con el Empire State y un taxi amarillo.
4. **Carlos** (Capoeira) — Río de Janeiro, Copacabana, Pan de Azúcar y el Cristo.
5. **Aka-Oni** (Demonio, jefe final) — Kioto, templo con pagoda, torii y cerezos.

Cada combate es al **mejor de 3 rondas** de 60 segundos. La CPU se vuelve más
agresiva, bloquea más y reacciona más rápido en cada etapa. Si pierdes puedes
continuar en la misma etapa con Enter.

## Técnica

- Resolución interna de 320×180 escalada con `image-rendering: pixelated`.
- Los luchadores son "marionetas" de píxeles: cabeza dibujada a partir de mapas de
  8×9 píxeles y cuerpo articulado por ángulos (poses), recoloreado por paleta.
- Escenarios dibujados por código y cacheados en canvas fuera de pantalla, con
  animaciones (lluvia y neón en Tokio, vapor en Nueva York, olas en Río, pétalos en Kioto).
- Música chiptune (escala japonesa) y efectos generados con Web Audio, sin archivos externos.
