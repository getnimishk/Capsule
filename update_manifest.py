import json

path = 'src/main/resources/extension/manifest.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

core_scripts = ['shared/core/storage.js', 'shared/core/ui.js', 'shared/core/observer.js']

for entry in data.get('content_scripts', []):
    if entry.get('world') == 'MAIN':
        continue
    if 'shared/token_estimator.js' in entry.get('js', []):
        idx = entry['js'].index('shared/token_estimator.js')
        entry['js'][idx:idx] = core_scripts
    elif 'injectors/notebooklm.js' in entry.get('js', []):
        entry['js'][0:0] = core_scripts

with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)
