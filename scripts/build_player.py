#!/usr/bin/env python3
"""Genera el snippet de Accessibility Player con la salida de voz de la extensión."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
voice = (ROOT / 'Extension/content/core/kwsr.voice.js').read_text()
# El reproductor de archivos no usa la sonda experimental de Flow de la beta.
voice = re.sub(r'  // Diagnóstico optativo: registrar la entrega no debe afectar la lectura\.\n  function traceFlowOutput\(stage, text\) \{\n    try \{ KWSR\.flowTiming\?\.noteOutput\?\.\(stage, text\); \} catch \{\}\n  \}\n\n', '', voice)
voice = re.sub(r'^.*traceFlowOutput\([^\n]*\n', '', voice, flags=re.M)
opening = '(() => {\n  const KWSR = window.KWSR;\n'
assert voice.count(opening) == 1 and voice.rstrip().endswith('})();')
voice = voice.replace(opening, 'function installVoice(KWSR) {\n', 1)
voice = voice.rstrip()[:-5] + '}\n'
assert voice.count('      u.rate = 1;') == 1
voice = voice.replace('      u.rate = 1;', '      u.rate = KWSR.CFG.ttsRate || 1;', 1)
template = (ROOT / 'web/player-template.html').read_text()
assert template.count('/* KATHWARE_SHARED_VOICE */') == 1
output = template.replace('/* KATHWARE_SHARED_VOICE */', voice)
target = ROOT / 'web/kathware-player-local.html'
target.write_text(output)
print(f'Generado: {target.relative_to(ROOT)}')
