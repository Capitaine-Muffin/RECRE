#!/usr/bin/env python3
"""Flag unit names in the maps that belong to somebody else's franchise.

The original maps were fan work passed between friends, so they borrow freely.
A published mobile game cannot. This produces the rename worklist.

Usage: python3 tools/ip_audit.py
"""
import os, sys, json, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FRANCHISE = {
    'Marques de jouets': ['lego', 'playmobil', 'barbie', 'barbi', 'ken ', 'g.i. joe',
                          'gi joe', 'matchbox', 'bisounours', 'micromachine', 'megazord',
                          'gundam', 'action man', 'mecano', 'mécano'],
    'Naruto': ['kakashi', 'tsunade', 'jiraya', 'gaara', 'konoha', 'sharingan', 'kyubi',
               'kuyubi', 'chidori', 'jyuuken', 'sarutobi', 'akamaru', 'ichiraku',
               'jounin', 'shuriken', 'surikens'],
    'Le Seigneur des Anneaux': ['aragorn', 'gandalf', 'gimli', 'elrond', 'lurtz',
                                'sauron', 'oliphant', 'orthanc', 'legolas', 'balrog',
                                'elendil'],
    'Blizzard / Warcraft': ['sapphiron', 'anub', 'archimonde', 'illidan', 'arthas',
                            'thrall', 'akama', 'magtheridon', 'balnazaar', 'korth',
                            'blaumeux', 'zeliek', 'vaillefendre', 'icecrown'],
    'DC Comics': ['superman', 'batman', 'joker', 'flash', 'green lantern',
                  'wonder-woman', 'lex luthor'],
    'Pokémon': ['pikachu', 'picachu', 'raichu'],
    'Harry Potter': ['dumbledore', 'voldemort', 'poudlard', 'hedwige'],
    'Star Wars': ['revan', 'turbolaser', 'turbolazer'],
    'SpongeBob': ["bob l'éponge", 'krusty'],
    'Chevaliers du Zodiaque': ['chevalier du zodiaque'],
    'Tortues Ninja': ['tortue ninja'],
    'Dragon Ball': ['goku'],
    'Terminator': ['terminator'],
    'Final Fantasy': ['cloud'],
    'Le Silence des agneaux': ['hannibal lecter'],
    'Peter Pan': ['crochet'],
}


def main():
    rows = json.load(open(os.path.join(ROOT, 'data/catalog/units.json')))
    hits = collections.defaultdict(set)
    all_names = set()
    for r in rows:
        n = r.get('name') or ''
        if not n:
            continue
        all_names.add(n)
        low = n.lower()
        for f, keys in FRANCHISE.items():
            if any(k in low for k in keys):
                hits[f].add(n)

    flagged = set().union(*hits.values()) if hits else set()
    report = {'distinct_names': len(all_names), 'flagged_names': len(flagged),
              'by_franchise': {f: sorted(v) for f, v in sorted(hits.items())}}
    json.dump(report, open(os.path.join(ROOT, 'data/catalog/ip_audit.json'), 'w'),
              indent=1, ensure_ascii=False)

    out = ['# Audit de propriété intellectuelle — noms d\'unités (généré)', '',
           'Généré par `tools/ip_audit.py`. Ne pas éditer à la main.', '',
           '**%d noms distincts** dans les cinq maps, dont **%d (%d %%) appartiennent '
           'à une franchise tierce.**' % (len(all_names), len(flagged),
                                          round(100.0 * len(flagged) / len(all_names))),
           '']
    for f in sorted(hits, key=lambda x: -len(hits[x])):
        out += ['## %s — %d' % (f, len(hits[f])), '']
        out += ['- %s' % n for n in sorted(hits[f])]
        out.append('')
    open(os.path.join(ROOT, 'docs/generated/ip_audit.md'), 'w').write('\n'.join(out))
    print('%d/%d names flagged across %d franchises'
          % (len(flagged), len(all_names), len(hits)))


if __name__ == '__main__':
    main()
