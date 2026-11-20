#!/usr/bin/env python3
"""
Marca todos los archivos JS/CSS con un número de versión (?v=...) para que,
después de publicar cambios, los navegadores descarguen la versión nueva
completa en lugar de mezclar archivos viejos guardados en caché.

Uso (antes de cada commit con cambios):   python3 tools/version.py
"""
import re, time, pathlib

raiz = pathlib.Path(__file__).resolve().parent.parent
v = time.strftime('%Y%m%d%H%M')

def marcar(texto):
    # import ... from './x.js'   |   import('./x.js')   |   href="css/x.css"   |   src="js/x.js"
    texto = re.sub(r"""((?:from\s+|import\()\s*['"]\./[\w\-/]+\.js)(?:\?v=\w+)?(['"])""", rf"\1?v={v}\2", texto)
    texto = re.sub(r"""((?:href|src)=["'](?:css|js)/[\w\-/]+\.(?:css|js))(?:\?v=\w+)?(["'])""", rf"\1?v={v}\2", texto)
    return texto

for f in [raiz / 'index.html', *sorted((raiz / 'js').glob('*.js'))]:
    viejo = f.read_text(encoding='utf-8')
    nuevo = marcar(viejo)
    if nuevo != viejo:
        f.write_text(nuevo, encoding='utf-8')
        print('versionado:', f.relative_to(raiz))
print('versión', v)
