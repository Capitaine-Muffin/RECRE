#!/usr/bin/env python3
"""Rend une planche de contact PNG des sprites, pour les regarder.

Lit `www/rendu/sprites.js` et `www/rendu/palette.js` directement — pas de
duplication des dessins, la planche suit le code.

Usage: python3 tools/apercu_sprites.py [sortie.png] [--zoom 6]
"""
import os, re, sys, zlib, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOND = (0x1a, 0x16, 0x24)
ETIQUETTE = (0xc9, 0xc2, 0xd4)

# Micro-fonte 3x5, de quoi écrire les noms sous les dessins.
FONTE = {
    'A': ['010', '101', '111', '101', '101'], 'B': ['110', '101', '110', '101', '110'],
    'C': ['011', '100', '100', '100', '011'], 'D': ['110', '101', '101', '101', '110'],
    'E': ['111', '100', '110', '100', '111'], 'F': ['111', '100', '110', '100', '100'],
    'G': ['011', '100', '101', '101', '011'], 'H': ['101', '101', '111', '101', '101'],
    'I': ['111', '010', '010', '010', '111'], 'J': ['001', '001', '001', '101', '010'],
    'K': ['101', '110', '100', '110', '101'], 'L': ['100', '100', '100', '100', '111'],
    'M': ['101', '111', '111', '101', '101'], 'N': ['101', '111', '111', '111', '101'],
    'O': ['010', '101', '101', '101', '010'], 'P': ['110', '101', '110', '100', '100'],
    'Q': ['010', '101', '101', '111', '011'], 'R': ['110', '101', '110', '101', '101'],
    'S': ['011', '100', '010', '001', '110'], 'T': ['111', '010', '010', '010', '010'],
    'U': ['101', '101', '101', '101', '111'], 'V': ['101', '101', '101', '101', '010'],
    'W': ['101', '101', '111', '111', '101'], 'X': ['101', '101', '010', '101', '101'],
    'Y': ['101', '101', '010', '010', '010'], 'Z': ['111', '001', '010', '100', '111'],
    '_': ['000', '000', '000', '000', '111'], ' ': ['000'] * 5,
}


def lire_palette():
    src = open(os.path.join(ROOT, 'www/rendu/palette.js'), encoding='utf-8').read()
    pal = {'.': None}
    for cle, hexa in re.findall(r"^\s*'?([A-Za-z.])'?:\s*'(#[0-9a-fA-F]{6})'", src, re.M):
        pal[cle] = tuple(int(hexa[i:i + 2], 16) for i in (1, 3, 5))
    return pal


def lire_sprites():
    src = open(os.path.join(ROOT, 'www/rendu/sprites.js'), encoding='utf-8').read()
    out = []
    for nom, corps in re.findall(r'export const (\w+) = \[(.*?)\];', src, re.S):
        out.append((nom, re.findall(r"'([^']*)'", corps)))
    return out


class Toile:
    def __init__(self, w, h, fond):
        self.w, self.h = w, h
        self.px = [list(fond) * w for _ in range(h)]

    def point(self, x, y, couleur):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x * 3:x * 3 + 3] = list(couleur)

    def bloc(self, x, y, n, couleur):
        for dy in range(n):
            for dx in range(n):
                self.point(x + dx, y + dy, couleur)

    def texte(self, x, y, mot, couleur):
        for i, ch in enumerate(mot.upper()):
            motif = FONTE.get(ch, FONTE[' '])
            for dy, ligne in enumerate(motif):
                for dx, bit in enumerate(ligne):
                    if bit == '1':
                        self.point(x + i * 4 + dx, y + dy, couleur)

    def png(self, chemin):
        brut = b''.join(b'\x00' + bytes(l) for l in self.px)
        def bloc(typ, data):
            c = typ + data
            return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c))
        with open(chemin, 'wb') as f:
            f.write(b'\x89PNG\r\n\x1a\n')
            f.write(bloc(b'IHDR', struct.pack('>IIBBBBB', self.w, self.h, 8, 2, 0, 0, 0)))
            f.write(bloc(b'IDAT', zlib.compress(brut, 9)))
            f.write(bloc(b'IEND', b''))


def main():
    sortie = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') \
        else os.path.join(ROOT, 'docs/generated/sprites.png')
    zoom = int(sys.argv[sys.argv.index('--zoom') + 1]) if '--zoom' in sys.argv else 6

    pal, sprites = lire_palette(), lire_sprites()
    marge, gouttiere, hauteurNom = 16, 14, 10
    colonnes = 5

    cases = [(n, s, len(s[0]) * zoom, len(s) * zoom) for n, s in sprites]
    largeurCase = max(c[2] for c in cases) + gouttiere
    hauteurCase = max(c[3] for c in cases) + gouttiere + hauteurNom
    lignes = (len(cases) + colonnes - 1) // colonnes

    t = Toile(marge * 2 + largeurCase * colonnes,
              marge * 2 + hauteurCase * lignes, FOND)

    for i, (nom, sprite, w, h) in enumerate(cases):
        cx = marge + (i % colonnes) * largeurCase + (largeurCase - gouttiere - w) // 2
        cy = marge + (i // colonnes) * hauteurCase
        for y, ligne in enumerate(sprite):
            for x, ch in enumerate(ligne):
                couleur = pal.get(ch)
                if couleur:
                    t.bloc(cx + x * zoom, cy + y * zoom, zoom, couleur)
        t.texte(cx, cy + h + 4, nom.replace('_', ' '), ETIQUETTE)

    os.makedirs(os.path.dirname(sortie), exist_ok=True)
    t.png(sortie)
    print('%s  (%d × %d, %d sprites, zoom ×%d)' % (sortie, t.w, t.h, len(cases), zoom))


if __name__ == '__main__':
    main()
