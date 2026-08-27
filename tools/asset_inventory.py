#!/usr/bin/env python3
"""Inventory the art imported into each map, and flag third-party IP.

Imported models/textures are the part of these maps that cannot ship, so the
inventory doubles as a replacement worklist.

Usage: python3 tools/asset_inventory.py
"""
import os, sys, json, glob, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Franchise -> substrings that appear in the imported filenames.
FRANCHISE = {
    'Pokémon': ['pikachu', 'raichu'],
    'SpongeBob': ['spongebob', 'krustykrab', 'jellyfishing'],
    'Star Wars': ['revan', 'revsabre', 'turbolazer', 'ioncannon'],
    'Dragon Ball': ['goku'],
    'Terminator': ['terminator'],
    'Final Fantasy': ['cloud'],
    'Warhammer 40k / misc': ['spaceorc', 'shocktrooper'],
}


def franchise_of(name):
    low = name.lower()
    for f, keys in FRANCHISE.items():
        if any(k in low for k in keys):
            return f
    return None


def main():
    rows = []
    for d in sorted(glob.glob(os.path.join(ROOT, 'assets/extracted/*/'))):
        m = os.path.basename(d.rstrip('/'))
        for p in sorted(glob.glob(os.path.join(d, '**', '*'), recursive=True)):
            if not os.path.isfile(p):
                continue
            rel = os.path.relpath(p, d)
            ext = os.path.splitext(rel)[1].lower()
            if ext not in ('.mdx', '.mdl', '.blp', '.tga'):
                continue
            if rel.startswith('war3mapMap'):      # auto-generated minimap
                continue
            rows.append({'map': m, 'file': rel.replace('\\', '/'),
                         'kind': {'.mdx': 'model', '.mdl': 'model',
                                  '.blp': 'texture', '.tga': 'texture'}[ext],
                         'bytes': os.path.getsize(p),
                         'franchise': franchise_of(rel)})

    os.makedirs(os.path.join(ROOT, 'data/catalog'), exist_ok=True)
    json.dump(rows, open(os.path.join(ROOT, 'data/catalog/assets.json'), 'w'),
              indent=1, ensure_ascii=False)

    flagged = [r for r in rows if r['franchise']]
    by_f = collections.Counter(r['franchise'] for r in flagged)

    out = ['# Inventaire des assets importés (généré)', '',
           'Généré par `tools/asset_inventory.py`. Ne pas éditer à la main.', '',
           '%d fichiers d\'art importés au total, dont **%d identifiés comme '
           'propriété intellectuelle tierce**.' % (len(rows), len(flagged)), '']
    if by_f:
        out += ['| Franchise | Fichiers |', '|---|---|']
        out += ['| %s | %d |' % (f, n) for f, n in by_f.most_common()]
        out.append('')
    cur = None
    for r in rows:
        if r['map'] != cur:
            cur = r['map']
            out += ['## %s' % cur, '', '| fichier | type | Ko | franchise |',
                    '|---|---|---|---|']
        out.append('| `%s` | %s | %d | %s |' % (
            r['file'], r['kind'], round(r['bytes'] / 1024), r['franchise'] or '—'))
    out.append('')
    os.makedirs(os.path.join(ROOT, 'docs/generated'), exist_ok=True)
    open(os.path.join(ROOT, 'docs/generated/assets.md'), 'w').write('\n'.join(out))
    print('%d art files, %d flagged' % (len(rows), len(flagged)))
    for f, n in by_f.most_common():
        print('  %-24s %d' % (f, n))


if __name__ == '__main__':
    main()
