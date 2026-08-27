"""Parsers for Warcraft III map sub-formats."""
import struct, io, json, re

def read_wts(data):
    txt = data.decode('utf-8-sig', 'replace').replace('\r\n', '\n').replace('\r', '\n')
    out = {}
    for m in re.finditer(r'^STRING (\d+)\s*(//[^\n]*)?\n\{\n(.*?)\n\}', txt, re.S | re.M):
        out[int(m.group(1))] = {'comment': (m.group(2) or '').lstrip('/ ').strip(),
                                'text': m.group(3)}
    return out

class R:
    def __init__(self, d): self.d, self.p = d, 0
    def u(self, n): v = self.d[self.p:self.p+n]; self.p += n; return v
    def i32(self): v, = struct.unpack_from('<i', self.d, self.p); self.p += 4; return v
    def u32(self): v, = struct.unpack_from('<I', self.d, self.p); self.p += 4; return v
    def f32(self): v, = struct.unpack_from('<f', self.d, self.p); self.p += 4; return v
    def u8(self): v = self.d[self.p]; self.p += 1; return v
    def id4(self): return self.u(4).decode('latin-1')
    def cstr(self):
        e = self.d.index(b'\0', self.p)
        s = self.d[self.p:e].decode('utf-8', 'replace'); self.p = e + 1; return s
    def left(self): return len(self.d) - self.p

# ------------------------------------------------------------------ war3map.w3i
def read_w3i(data):
    r = R(data)
    o = {}
    o['format'] = r.i32()
    o['saves'] = r.i32(); o['editor_version'] = r.i32()
    if o['format'] >= 27:
        o['game_version'] = [r.i32() for _ in range(4)]
    o['name'] = r.cstr(); o['author'] = r.cstr()
    o['description'] = r.cstr(); o['recommended_players'] = r.cstr()
    o['camera_bounds'] = [r.f32() for _ in range(8)]
    o['camera_complements'] = [r.i32() for _ in range(4)]
    o['playable_w'] = r.i32(); o['playable_h'] = r.i32()
    o['flags'] = r.u32()
    o['tileset'] = r.u(1).decode('latin-1')
    o['loading_screen_index'] = r.i32()
    o['loading_screen_custom'] = r.cstr()
    o['loading_text'] = r.cstr(); o['loading_title'] = r.cstr(); o['loading_subtitle'] = r.cstr()
    o['game_data_set'] = r.i32()
    o['prologue_path'] = r.cstr(); o['prologue_text'] = r.cstr()
    o['prologue_title'] = r.cstr(); o['prologue_subtitle'] = r.cstr()
    if o['format'] >= 25:
        o['fog_style'] = r.i32(); o['fog_z_start'] = r.f32(); o['fog_z_end'] = r.f32()
        o['fog_density'] = r.f32(); o['fog_color'] = list(r.u(4))
        o['weather_global'] = r.i32()
        o['sound_env'] = r.cstr(); o['light_env'] = r.u(1).decode('latin-1')
        o['water_color'] = list(r.u(4))
    n = r.i32(); o['players'] = []
    for _ in range(n):
        p = {'id': r.i32(), 'type': r.i32(), 'race': r.i32(), 'fixed_start': r.i32(),
             'name': r.cstr(), 'start_x': r.f32(), 'start_y': r.f32(),
             'ally_low_prio': r.u32(), 'ally_high_prio': r.u32()}
        o['players'].append(p)
    n = r.i32(); o['forces'] = []
    for _ in range(n):
        o['forces'].append({'flags': r.u32(), 'player_mask': r.u32(), 'name': r.cstr()})
    try:
        n = r.i32(); o['upgrades'] = []
        for _ in range(n):
            o['upgrades'].append({'player_mask': r.u32(), 'id': r.id4(),
                                  'level': r.i32(), 'availability': r.i32()})
        n = r.i32(); o['tech'] = []
        for _ in range(n):
            o['tech'].append({'player_mask': r.u32(), 'id': r.id4()})
        n = r.i32(); o['unit_tables'] = []
        for _ in range(n):
            t = {'number': r.i32(), 'types': [r.i32() for _ in range(r.i32())], 'name': r.cstr()}
            t['sets'] = []
            for _ in range(r.i32()):
                t['sets'].append(r.id4())
            o['unit_tables'].append(t)
    except Exception as e:
        o['_partial'] = str(e)
    return o

# --------------------------------------------- w3u/w3t/w3b/w3d/w3a/w3h/w3q (obj)
VAR_TYPE = {0: 'int', 1: 'real', 2: 'unreal', 3: 'string'}

def read_objmod(data, has_level_field):
    r = R(data)
    ver = r.i32()
    out = {'version': ver, 'original': [], 'custom': []}
    for tablekey in ('original', 'custom'):
        n = r.i32()
        for _ in range(n):
            base = r.id4()
            new = r.id4().rstrip('\0')  # blank in the "original" table
            mods = []
            for _ in range(r.i32()):
                mid = r.id4(); vt = r.i32()
                lvl = dp = None
                if has_level_field:
                    lvl = r.i32(); dp = r.i32()
                if vt == 0: val = r.i32()
                elif vt in (1, 2): val = round(r.f32(), 4)
                elif vt == 3: val = r.cstr()
                else: val = None
                r.i32()  # end marker (base/new id)
                m = {'field': mid, 'type': VAR_TYPE.get(vt, vt), 'value': val}
                if lvl is not None and (lvl or dp):
                    m['level'] = lvl; m['data'] = dp
                mods.append(m)
            out[tablekey].append({'base': base, 'id': new or base, 'mods': mods})
    return out

# --------------------------------------------------------- war3mapUnits.doo
def read_units_doo(data):
    r = R(data)
    magic = r.id4(); ver = r.i32(); sub = r.i32()
    units = []
    for _ in range(r.i32()):
        u = {'type': r.id4(), 'variation': r.i32(),
             'x': round(r.f32(), 1), 'y': round(r.f32(), 1), 'z': round(r.f32(), 1),
             'rotation': round(r.f32(), 3),
             'scale': [round(r.f32(), 3) for _ in range(3)],
             'flags': r.u8(), 'player': r.i32(),
             'unknown': list(r.u(2)),
             'hp': r.i32(), 'mp': r.i32()}
        drop = r.i32()
        u['item_table'] = drop
        u['dropsets'] = []
        for _ in range(r.i32()):
            s = []
            for _ in range(r.i32()):
                s.append({'item': r.id4(), 'chance': r.i32()})
            u['dropsets'].append(s)
        u['gold'] = r.i32(); u['target_acq'] = round(r.f32(), 2)
        u['hero_level'] = r.i32(); u['str'] = r.i32(); u['agi'] = r.i32(); u['int'] = r.i32()
        u['items'] = []
        for _ in range(r.i32()):
            u['items'].append({'slot': r.i32(), 'item': r.id4()})
        u['abilities'] = []
        for _ in range(r.i32()):
            u['abilities'].append({'id': r.id4(), 'autocast': r.i32(), 'level': r.i32()})
        u['random_flag'] = r.i32()
        if u['random_flag'] == 0: u['random'] = list(r.u(4))
        elif u['random_flag'] == 1: u['random'] = [r.i32(), r.i32()]
        elif u['random_flag'] == 2:
            k = r.i32(); u['random'] = [{'id': r.id4(), 'chance': r.i32()} for _ in range(k)]
        u['color'] = r.i32(); u['waygate'] = r.i32(); u['creation'] = r.i32()
        units.append(u)
    return {'version': ver, 'subversion': sub, 'units': units}

# ------------------------------------------------------------- war3map.w3e (terrain)
def read_w3e(data):
    r = R(data)
    o = {'magic': r.id4(), 'version': r.i32(),
         'tileset': r.u(1).decode('latin-1'), 'custom_tilesets': r.i32()}
    n = o['custom_tilesets']
    if not 0 <= n <= 256:
        raise ValueError('implausible ground tileset count %d (protected map?)' % n)
    o['ground_tilesets'] = [r.id4() for _ in range(n)]
    n = r.i32()
    if not 0 <= n <= 256:
        raise ValueError('implausible cliff tileset count %d' % n)
    o['cliff_tilesets'] = [r.id4() for _ in range(n)]
    o['width'] = r.i32(); o['height'] = r.i32()
    o['offset_x'] = r.f32(); o['offset_y'] = r.f32()
    return o

# --------------------------------------------------------------- war3map.w3r (regions)
def read_w3r(data):
    r = R(data); o = {'version': r.i32(), 'regions': []}
    for _ in range(r.i32()):
        reg = {'left': round(r.f32(),1), 'bottom': round(r.f32(),1),
               'right': round(r.f32(),1), 'top': round(r.f32(),1),
               'name': r.cstr(), 'index': r.i32(),
               'weather': r.id4(), 'ambient': r.cstr(),
               'color': list(r.u(3)), 'end': r.u8()}
        o['regions'].append(reg)
    return o
