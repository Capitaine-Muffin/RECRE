"""Minimal but complete-enough MPQ reader for Warcraft III .w3x maps.

Supports: v0/v1 headers, w3x 512-byte HM3W prefix, hash/block tables,
file + table decryption, single-unit and multi-sector files,
zlib / bzip2 / PKWARE-DCL(implode) / raw compression.
"""
import struct, zlib, bz2
from io import BytesIO

# ---------------------------------------------------------------- crypt table
_CT = {}
def _init_crypt():
    seed = 0x00100001
    for i in range(0x100):
        idx = i
        for _ in range(5):
            seed = (seed * 125 + 3) % 0x2AAAAB
            t1 = (seed & 0xFFFF) << 0x10
            seed = (seed * 125 + 3) % 0x2AAAAB
            t2 = (seed & 0xFFFF)
            _CT[idx] = (t1 | t2)
            idx += 0x100
_init_crypt()

HASH_TABLE_OFFSET, HASH_NAME_A, HASH_NAME_B, HASH_FILE_KEY = 0, 1, 2, 3

def hash_string(s, typ):
    seed1, seed2 = 0x7FED7FED, 0xEEEEEEEE
    for ch in s.upper().replace('/', '\\'):
        c = ord(ch)
        seed1 = _CT[(typ << 8) + c] ^ ((seed1 + seed2) & 0xFFFFFFFF)
        seed2 = (c + seed1 + seed2 + (seed2 << 5) + 3) & 0xFFFFFFFF
    return seed1

def decrypt(data, key):
    seed1, seed2 = key, 0xEEEEEEEE
    out = bytearray()
    for i in range(len(data) // 4):
        seed2 = (seed2 + _CT[0x400 + (seed1 & 0xFF)]) & 0xFFFFFFFF
        val = struct.unpack_from('<I', data, i * 4)[0] ^ ((seed1 + seed2) & 0xFFFFFFFF)
        val &= 0xFFFFFFFF
        seed1 = (((~seed1 << 0x15) + 0x11111111) | (seed1 >> 0x0B)) & 0xFFFFFFFF
        seed2 = (val + seed2 + (seed2 << 5) + 3) & 0xFFFFFFFF
        out += struct.pack('<I', val)
    out += data[len(data) // 4 * 4:]
    return bytes(out)

# ------------------------------------------------------- PKWARE DCL "explode"
_DIST_BITS = [2,4,4,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
              6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
              8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,
              8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8]
_DIST_CODE = [
0x03,0x0D,0x05,0x19,0x09,0x11,0x01,0x3E,0x1E,0x2E,0x0E,0x36,0x16,0x26,0x06,0x3A,
0x1A,0x2A,0x0A,0x32,0x12,0x22,0x42,0x02,0x7C,0x3C,0x5C,0x1C,0x6C,0x2C,0x4C,0x0C,
0x74,0x34,0x54,0x14,0x64,0x24,0x44,0x04,0x78,0x38,0x58,0x18,0x68,0x28,0x48,0x08,
0xF0,0x70,0xB0,0x30,0xD0,0x50,0x90,0x10,0xE0,0x60,0xA0,0x20,0xC0,0x40,0x80,0x00]
_LEN_BITS  = [3,2,3,3,4,4,4,5,5,5,5,6,6,6,7,7,7,7,8,8,8,8,8,8,8,8,8,8,8,8,8,8]
_LEN_CODE  = [0x05,0x03,0x01,0x06,0x0A,0x02,0x0C,0x14,0x04,0x18,0x08,0x30,0x10,0x20,
              0x40,0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0A,0x0B,0x0C,
              0x0D,0x0E,0x0F,0x10]
_EX_LEN_BITS = [0,0,0,0,0,0,0,0,1,2,3,4,5,6,7,8]
_LEN_BASE    = [0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x0A,0x0E,0x16,0x26,0x46,0x86,0x106]

def _mk_table(codes, bits):
    t = {}
    for i, (c, b) in enumerate(zip(codes, bits)):
        t[(b, c)] = i
    return t
_LEN_T = _mk_table(_LEN_CODE, _LEN_BITS)
_DIST_T = _mk_table(_DIST_CODE, _DIST_BITS)

class _Bits:
    def __init__(self, data):
        self.d, self.pos, self.bit = data, 0, 0
    def get(self, n):
        v = 0
        for i in range(n):
            if self.pos >= len(self.d):
                raise EOFError
            b = (self.d[self.pos] >> self.bit) & 1
            v |= b << i
            self.bit += 1
            if self.bit == 8:
                self.bit = 0
                self.pos += 1
        return v

def explode(data):
    """PKWARE Data Compression Library decompression."""
    lit_mode, dict_bits = data[0], data[1]
    if lit_mode not in (0, 1):
        raise ValueError('bad DCL literal mode %d' % lit_mode)
    if lit_mode == 1:
        raise NotImplementedError('DCL ascii/huffman literal mode')
    bs = _Bits(data[2:])
    out = bytearray()
    dict_size = {4: 1024, 5: 2048, 6: 4096}[dict_bits]
    while True:
        try:
            if bs.get(1) == 0:
                out.append(bs.get(8))
                continue
            # length: read bit-reversed prefix code
            code, nb = 0, 0
            while nb < 8:
                code = (code << 1) | bs.get(1)
                nb += 1
                if (nb, code) in _LEN_T:
                    break
            else:
                raise ValueError('bad length code')
            li = _LEN_T[(nb, code)]
            length = _LEN_BASE[li] + (bs.get(_EX_LEN_BITS[li]) if _EX_LEN_BITS[li] else 0)
            if length == 519:
                break
            # distance
            code, nb = 0, 0
            while nb < 8:
                code = (code << 1) | bs.get(1)
                nb += 1
                if (nb, code) in _DIST_T:
                    break
            else:
                raise ValueError('bad dist code')
            dh = _DIST_T[(nb, code)]
            if length == 2:
                dist = (dh << 2) | bs.get(2)
            else:
                dist = (dh << dict_bits) | bs.get(dict_bits)
            dist += 1
            length += 2
            for _ in range(length):
                out.append(out[-dist])
        except EOFError:
            break
    return bytes(out)

def _decompress(data):
    ctype = data[0]
    body = data[1:]
    if ctype == 0:
        return data
    if ctype & 0x02:
        return zlib.decompress(body)
    if ctype & 0x10:
        return bz2.decompress(body)
    if ctype & 0x08:
        return explode(body)
    raise ValueError('unsupported compression 0x%02x' % ctype)

MPQ_FILE_IMPLODE     = 0x00000100
MPQ_FILE_COMPRESS    = 0x00000200
MPQ_FILE_ENCRYPTED   = 0x00010000
MPQ_FILE_FIX_KEY     = 0x00020000
MPQ_FILE_SINGLE_UNIT = 0x01000000
MPQ_FILE_SECTOR_CRC  = 0x04000000
MPQ_FILE_EXISTS      = 0x80000000

class MPQArchive:
    def __init__(self, path):
        self.data = open(path, 'rb').read()
        off = 0
        if self.data[:4] == b'HM3W':
            off = 512
        if self.data[off:off+4] == b'MPQ\x1b':
            off = off + struct.unpack_from('<I', self.data, off + 8)[0]
        if self.data[off:off+4] != b'MPQ\x1a':
            i = self.data.find(b'MPQ\x1a')
            if i < 0:
                raise ValueError('no MPQ header')
            off = i
        self.base = off
        (_, hsize, asize, ver, self.ssh, hto, bto, hte, bte) = struct.unpack_from(
            '<4s2I2H4I', self.data, off)
        self.hash_count, self.block_count = hte, bte
        ht = self.data[off+hto: off+hto + hte*16]
        bt = self.data[off+bto: off+bto + bte*16]
        ht = decrypt(ht, hash_string('(hash table)', HASH_FILE_KEY))
        bt = decrypt(bt, hash_string('(block table)', HASH_FILE_KEY))
        self.hash_table = [struct.unpack_from('<2I2HI', ht, i*16) for i in range(hte)]
        self.block_table = [struct.unpack_from('<4I', bt, i*16) for i in range(bte)]

    def _find(self, name):
        h = hash_string(name, HASH_TABLE_OFFSET) & (self.hash_count - 1)
        a = hash_string(name, HASH_NAME_A)
        b = hash_string(name, HASH_NAME_B)
        for i in range(self.hash_count):
            e = self.hash_table[(h + i) % self.hash_count]
            if e[4] == 0xFFFFFFFF:
                return None
            if e[0] == a and e[1] == b and e[4] != 0xFFFFFFFE:
                return e
        return None

    def read(self, name):
        e = self._find(name)
        if e is None:
            return None
        off, csize, size, flags = self.block_table[e[4]]
        if not flags & MPQ_FILE_EXISTS or csize == 0:
            return None
        raw = self.data[self.base+off: self.base+off+csize]
        key = None
        if flags & MPQ_FILE_ENCRYPTED:
            base = name.replace('/', '\\').split('\\')[-1]
            key = hash_string(base, HASH_FILE_KEY)
            if flags & MPQ_FILE_FIX_KEY:
                key = ((key + off) ^ size) & 0xFFFFFFFF
        compressed = bool(flags & (MPQ_FILE_COMPRESS | MPQ_FILE_IMPLODE))
        imploded_only = bool(flags & MPQ_FILE_IMPLODE) and not (flags & MPQ_FILE_COMPRESS)

        def dec_sector(s, want):
            if not compressed or len(s) >= want:
                return s
            if imploded_only:
                return explode(s)
            return _decompress(s)

        if flags & MPQ_FILE_SINGLE_UNIT:
            if key is not None:
                raw = decrypt(raw, key)
            return dec_sector(raw, size)

        sector_size = 512 << self.ssh
        nsec = (size + sector_size - 1) // sector_size
        ntab = nsec + 1 + (1 if flags & MPQ_FILE_SECTOR_CRC else 0)
        tab = raw[:4*ntab]
        if key is not None:
            tab = decrypt(tab, (key - 1) & 0xFFFFFFFF)
        pos = struct.unpack('<%dI' % ntab, tab)
        out = BytesIO()
        left = size
        for i in range(nsec):
            s = raw[pos[i]:pos[i+1]]
            if key is not None:
                s = decrypt(s, (key + i) & 0xFFFFFFFF)
            want = min(left, sector_size)
            out.write(dec_sector(s, want))
            left -= want
        return out.getvalue()[:size]
