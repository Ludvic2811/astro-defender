# Dibujos originales del equipo

Mientras esta carpeta no tenga imágenes, el juego usa sprites provisionales generados por código.

Para usar los dibujos originales:

1. Escanea o fotografía cada dibujo y recórtalo. Lo ideal es un **PNG con fondo transparente** de unos 256 × 256 px.
2. Copia los archivos aquí, por ejemplo: `player.png`, `enemy.png`, `asteroid.png` y, opcionalmente, `boss.png`.
3. Regístralos en `manifest.json`:

```json
{
  "player": "player.png",
  "enemy": "enemy.png",
  "asteroid": "asteroid.png",
  "boss": "boss.png"
}
```

| Clave      | Uso en el juego                             | Orientación esperada  |
|------------|---------------------------------------------|-----------------------|
| `player`   | Cohete o nave del jugador                   | Punta hacia **arriba** |
| `enemy`    | Nave enemiga alienígena                     | Frente hacia **abajo** |
| `asteroid` | Asteroide (gira y se divide en dos)         | Cualquiera            |
| `boss`     | Nave nodriza (jefe de la oleada 10)         | Frente hacia **abajo** |

Si no hay `boss`, el juego usa la nave nodriza provisional. El tamaño en pantalla se ajusta solo y se respeta la proporción del dibujo.
