#!/usr/bin/env python3
"""Extract a Warcraft III .w3x map into structured JSON + raw assets.

Usage:  python3 tools/extract_map.py raw/maps/<map>.w3x data/maps assets/extracted
"""
import os, sys, json, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mpq import MPQArchive
import w3fmt, fields

# Internal filenames a w3x always uses (MPQ hash lookup needs the exact name).
KNOWN = [
    '(listfile)', '(attributes)', '(signature)',
    'war3map.j', 'scripts\\war3map.j', 'war3map.w3e', 'war3map.w3i', 'war3map.wpm',
    'war3map.doo', 'war3mapUnits.doo', 'war3map.w3r', 'war3map.w3c', 'war3map.w3s',
    'war3map.w3u', 'war3map.w3t', 'war3map.w3a', 'war3map.w3b', 'war3map.w3d',
    'war3map.w3q', 'war3map.w3h', 'war3map.wts', 'war3map.shd', 'war3map.mmp',
    'war3map.imp', 'war3map.wct', 'war3map.wtg', 'war3mapMap.blp', 'war3mapMap.b00',
    'war3mapPreview.tga', 'war3mapMisc.txt', 'war3mapExtra.txt', 'war3mapSkin.txt',
]
# Object-editor tables: ext -> (has level/data columns, field-name map)
OBJ = {
    'w3u': (False, fields.UNIT, 'units'),
    'w3t': (False, fields.ITEM, 'items'),
    'w3b': (False, fields.DEST, 'destructables'),
    'w3h': (False, {},           'buffs'),
    'w3a': (True,  fields.ABIL,  'abilities'),
    'w3d': (True,  fields.DOOD,  'doodads'),
    'w3q': (True,  fields.UPGR,  'upgrades'),
}


def dump_files(arc, outdir):
    """Write every file we can name out of the archive. Returns {name: bytes}."""
    names, blobs = list(KNOWN), {}
    lf = arc.read('(listfile)')
    if lf:
        raw = lf.decode('utf-8', 'replace').replace('\r', '\n')
        names += [l.strip() for l in raw.split('\n') if l.strip()]
    for n in dict.fromkeys(names):
        try:
            d = arc.read(n)
        except Exception as e:
            print('  !! %s: %s' % (n, e), file=sys.stderr)
            continue
        if d is None:
            continue
        blobs[n] = d
        p = os.path.join(outdir, n.replace('\\', '/'))
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'wb') as f:
            f.write(d)
    return blobs


def resolve(v, wts):
    if isinstance(v, str) and v.startswith('TRIGSTR_'):
        try:
            return wts.get(int(v[8:]), {}).get('text', v)
        except ValueError:
            pass
    return v


def flatten_obj(entry, namemap, wts):
    """Turn one object-mod entry into a flat dict with readable keys."""
    out = {'id': entry['id'], 'base': entry['base']}
    for m in entry['mods']:
        k = namemap.get(m['field'], m['field'])
        if 'level' in m:
            k = '%s@%d' % (k, m['level'])
        v = resolve(m['value'], wts)
        if k in out:
            out[k] = (out[k] if isinstance(out[k], list) else [out[k]]) + [v]
        else:
            out[k] = v
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('mapfile')
    ap.add_argument('datadir')
    ap.add_argument('assetdir', nargs='?')
    a = ap.parse_args()

    slug = os.path.splitext(os.path.basename(a.mapfile))[0]
    assetdir = os.path.join(a.assetdir or a.datadir, slug)
    os.makedirs(assetdir, exist_ok=True)
    os.makedirs(a.datadir, exist_ok=True)

    arc = MPQArchive(a.mapfile)
    blobs = dump_files(arc, assetdir)
    print('%s: %d files (%d hash / %d block entries)'
          % (slug, len(blobs), arc.hash_count, arc.block_count))

    wts = w3fmt.read_wts(blobs['war3map.wts']) if 'war3map.wts' in blobs else {}
    out = {'map': slug, 'source_file': os.path.basename(a.mapfile),
           'archive': {'files': sorted(blobs), 'hash_entries': arc.hash_count,
                       'block_entries': arc.block_count},
           'strings': {str(k): v for k, v in sorted(wts.items())}}

    if 'war3map.w3i' in blobs:
        try:
            info = w3fmt.read_w3i(blobs['war3map.w3i'])
            for k in ('name', 'author', 'description', 'recommended_players'):
                info[k] = resolve(info.get(k), wts)
            for p in info.get('players', []):
                p['name'] = resolve(p['name'], wts)
            for f in info.get('forces', []):
                f['name'] = resolve(f['name'], wts)
            out['info'] = info
        except Exception as e:
            out['info'] = {'error': str(e)}

    for ext, (lvl, namemap, key) in OBJ.items():
        b = blobs.get('war3map.' + ext)
        if not b:
            continue
        try:
            o = w3fmt.read_objmod(b, lvl)
        except Exception as e:
            out[key] = {'error': str(e)}
            continue
        out[key] = {
            'modified_standard': [flatten_obj(e, namemap, wts) for e in o['original']],
            'custom': [flatten_obj(e, namemap, wts) for e in o['custom']],
        }

    if 'war3map.w3r' in blobs:
        try:
            out['regions'] = w3fmt.read_w3r(blobs['war3map.w3r'])['regions']
        except Exception as e:
            out['regions'] = {'error': str(e)}

    if 'war3mapUnits.doo' in blobs:
        try:
            out['preplaced_units'] = w3fmt.read_units_doo(blobs['war3mapUnits.doo'])['units']
        except Exception as e:
            out['preplaced_units'] = {'error': str(e)}

    if 'war3map.w3e' in blobs:
        try:
            out['terrain'] = w3fmt.read_w3e(blobs['war3map.w3e'])
        except Exception as e:
            out['terrain'] = {'error': str(e)}

    p = os.path.join(a.datadir, slug + '.json')
    with open(p, 'w') as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
    print('  -> %s' % p)


if __name__ == '__main__':
    main()
