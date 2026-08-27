#!/usr/bin/env python3
"""Pull the game-rule constants out of a map's war3map.j.

The maps are GUI-generated JASS, so every rule shows up as a very regular
call pattern. We read the ones that define the game loop:
  - starting resources / food caps / time of day
  - the gold drip and what pauses it
  - which building trains which unit (the spawner table)
  - where finished units are sent, and who ends up owning them
  - victory conditions
  - chat commands

Usage: python3 tools/parse_jass.py assets/extracted/<map>/war3map.j
"""
import os, re, sys, json

FUNC = re.compile(r'^function (\w+) takes .*?^endfunction', re.S | re.M)


def functions(src):
    out = {}
    for m in FUNC.finditer(src):
        out[m.group(1)] = m.group(0)
    return out


def const(src, pat, cast=float):
    m = re.search(pat, src)
    return cast(m.group(1)) if m else None


def analyse(path):
    src = open(path, encoding='utf-8', errors='replace').read()
    fns = functions(src)
    r = {'source': os.path.basename(path), 'functions': len(fns)}

    # ---- start-of-game state -------------------------------------------------
    init = ''.join(v for k, v in fns.items() if k.startswith('Trig_Melee_Initialization'))
    r['start'] = {
        'gold': const(init, r'PLAYER_STATE_RESOURCE_GOLD,\s*(-?\d+)', int),
        'lumber': const(init, r'PLAYER_STATE_RESOURCE_LUMBER,\s*(-?\d+)', int),
        'food_cap': const(init, r'PLAYER_STATE_RESOURCE_FOOD_CAP,\s*(-?\d+)', int),
        'food_cap_ceiling': const(init, r'PLAYER_STATE_FOOD_CAP_CEILING,\s*(-?\d+)', int),
        'xp_handicap_pct': const(init, r'SetPlayerHandicapXPBJ\([^,]+,\s*([\d.]+)'),
        'time_of_day': const(init, r'SetTimeOfDay\(\s*([\d.]+)'),
        'day_night_cycle': 'UseTimeOfDayBJ( false )' not in init
                           and 'UseTimeOfDayBJ(false)' not in init,
        'fog_of_war_disabled': 'FogEnableOff' in init,
        'fog_mask_disabled': 'FogMaskEnableOff' in init,
    }

    # ---- gold drip -----------------------------------------------------------
    money = [k for k in fns if re.match(r'InitTrig_Money4P\d+$', k)]
    if money:
        body = fns[money[0]]
        act = fns.get(money[0].replace('InitTrig_', 'Trig_') + '_Actions', '')
        r['income'] = {
            'triggers': len(money),
            'period_seconds': const(body, r'TriggerRegisterTimerEventPeriodic\([^,]+,\s*([\d.]+)'),
            'gold_per_tick': const(act, r'AdjustPlayerStateBJ\(\s*(-?\d+)', int),
            'paused_while_constructing': 'DisableTrigger( gg_trg_Money4P1 )'
                                         in fns.get('Trig_When_Building_Actions', ''),
            'resume_sweep_seconds': const(
                fns.get('InitTrig_remise_en_route_de_gold', ''),
                r'TriggerRegisterTimerEventPeriodic\([^,]+,\s*([\d.]+)'),
        }
        if r['income']['period_seconds'] and r['income']['gold_per_tick']:
            r['income']['gold_per_minute'] = round(
                60.0 / r['income']['period_seconds'] * r['income']['gold_per_tick'])

    # ---- spawner table: building type -> trained unit type -------------------
    act = fns.get('Trig_AutoTrain_Actions', '')
    buildings = re.findall(r"GetUnitsOfTypeIdAll\('(....)'\), function (\w+)", act)
    spawn = []
    for btype, fname in buildings:
        body = fns.get(fname, '')
        m = re.search(r"IssueTrainOrderByIdBJ\([^,]+,\s*'(....)'", body)
        spawn.append({'building': btype, 'trains': m.group(1) if m else None})
    r['spawners'] = spawn
    r['autotrain_period_seconds'] = const(
        fns.get('InitTrig_AutoTrain', ''),
        r'TriggerRegisterTimerEventPeriodic\([^,]+,\s*([\d.]+)')

    # ---- what happens to a unit the moment it finishes training --------------
    routes = []
    for name, body in fns.items():
        m = re.match(r'Trig_(\w+?)_Actions$', name)
        if not m or 'SetUnitOwner' not in body:
            continue
        cond = fns.get('Trig_%s_Conditions' % m.group(1), '')
        utype = re.search(r"GetUnitTypeId\(Get\w+\(\)\) == '(....)'", cond)
        owner = re.search(r'SetUnitOwner\([^,]+,\s*Player\((\d+)\)', body)
        dest = re.search(r'GetRectCenter\(gg_rct_(\w+)\)', body)
        order = re.search(r'IssuePointOrderLocBJ\([^,]+,\s*"(\w+)"', body)
        if utype and owner:
            routes.append({'trigger': m.group(1), 'unit': utype.group(1),
                           'transferred_to_player': int(owner.group(1)),
                           'order': order.group(1) if order else None,
                           'destination_region': dest.group(1) if dest else None})
    r['unit_routing'] = routes

    # ---- periodic re-order sweep (anti-idle) ---------------------------------
    sweeps = []
    for name in fns:
        m = re.match(r'InitTrig_(mouvement_auto\w*)$', name)
        if not m:
            continue
        a = fns.get('Trig_%s_Actions' % m.group(1), '')
        dests = set(re.findall(r'GetRectCenter\(gg_rct_(\w+)\)',
                    ''.join(fns.get(f, '') for f in
                            re.findall(r'function (\w+)\s*\)', a))))
        sweeps.append({
            'name': m.group(1),
            'period_seconds': const(fns[name],
                                    r'TriggerRegisterTimerEventPeriodic\([^,]+,\s*([\d.]+)'),
            'unit_types': re.findall(r"GetUnitsOfPlayerAndTypeId\(Player\(\d+\), '(....)'\)", a),
            'destinations': sorted(dests),
        })
    r['reorder_sweeps'] = sweeps

    # ---- victory ------------------------------------------------------------
    wins = []
    for name in fns:
        m = re.match(r'InitTrig_(team\dwin|ballon_t\d)$', name)
        if not m:
            continue
        wins.append({
            'trigger': m.group(1),
            'on_unit_death': bool(re.search(r'EVENT_UNIT_DEATH', fns[name])),
            'on_enter_region': (re.search(r'TriggerRegisterEnterRectSimple\([^,]+,\s*gg_rct_(\w+)',
                                          fns[name]) or [None, None])[1],
        })
    r['victory'] = wins

    # ---- chat commands ------------------------------------------------------
    r['chat_commands'] = sorted(set(re.findall(
        r'TriggerRegisterPlayerChatEvent\(\s*\w+,\s*Player\((\d+)\),\s*"([^"]+)"', src)))

    # ---- respawn penalty ----------------------------------------------------
    kid = fns.get('Trig_KidDeath4T1_Actions', '')
    if kid:
        # The teacher is spawned first and walks the kid off to school; the
        # replacement builder is created after the sleep, so split on it.
        before, _, after = kid.partition('TriggerSleepAction')
        one = lambda pat, txt: (re.search(pat, txt) or [None, None])[1]
        spawn = r"CreateNUnitsAtLoc(?:FacingLocBJ)?\(\s*1,\s*'(....)'"
        r['builder_death_penalty'] = {
            'escort_unit': one(spawn, before),
            'escorted_to_region': one(r'GetRectCenter\(gg_rct_(\w+)\)', before),
            'message': one(r'DisplayTimedTextToForce\([^,]+,\s*[\d.]+,\s*"([^"]+)"', before),
            'respawn_delay_seconds': const(kid, r'TriggerSleepAction\(\s*([\d.]+)'),
            'respawn_unit': one(spawn, after),
            'respawn_region': one(r'GetRectCenter\(gg_rct_(\w+)\)', after),
        }
    return r


if __name__ == '__main__':
    print(json.dumps(analyse(sys.argv[1]), indent=1, ensure_ascii=False))
