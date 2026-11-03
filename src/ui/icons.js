'use strict';
// Icônes des sorts : illustration de l'utilisateur (SPELL_ART, assets/ui/spells/) sinon icône vectorielle (skillIconSVG), trinket.
function rgbHex(c) {
  return (
    '#' +
    c
      .map(v =>
        Math.round(clamp(v, 0, 1) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}
function skillMotif(name) {
  const n = name.toLowerCase();
  if (/heal|hymn/.test(n)) return 'heal';
  if (/shield|bark|cloak/.test(n)) return 'shield';
  if (/nova|frost|pillar/.test(n)) return 'frost';
  if (/root|hamstring/.test(n)) return 'root';
  if (/silence|counter|pummel|lock/.test(n)) return 'silence';
  if (/charge|blink|step|advance|gate/.test(n)) return 'move';
  if (/fear|dark soul|vendetta|arcane power/.test(n)) return 'power';
  if (/grip/.test(n)) return 'grip';
  if (/starfall/.test(n)) return 'star';
  if (/stun|kidney|asphyx/.test(n)) return 'stun';
  if (/bolt/.test(n)) return 'bolt';
  if (/poly|morph/.test(n)) return 'sheep';
  if (/cat form/.test(n)) return 'claws'; // félin = griffures (spec : docs/SPEC.md)
  if (/bear form/.test(n)) return 'paw'; // ours = empreinte de patte
  if (/human form/.test(n)) return 'leaf';
  if (/stealth/.test(n)) return 'stealth';
  if (/sap|maim/.test(n)) return 'stun';
  if (/wrath/.test(n)) return 'bolt';
  if (/frenzied/.test(n)) return 'heal';
  if (/wild charge/.test(n)) return 'move';
  return 'strike';
}
// Icônes dessinées par l'utilisateur (assets/ui/spells/<sort>.webp, découpées par tools/build_spell_icons.js) :
// elles remplacent entièrement l'ancienne icône vectorielle ; les sorts sans illustration gardent celle-ci.
const SPELL_ART = new Set(
  (
    'ambush angelic_step arcane_bolt arcane_power asphyxiate backstab barkskin bear_form blink cat_form ' +
    'charge cloak counterspell dark_soul death_advance death_grip demonic_gate divine_hymn ' +
    'entangling_roots fear flash_heal frenzied_regeneration frost_nova hamstring human_form kidney_shot ' +
    'rejuvenation regrowth cheap_shot drain_life demoralizing_roar pain dispel ' +
    'maim maul mortal_strike obliterate pillar_of_frost polymorph power_shield pummel rake sap ' +
    'shadow_bolt shadowstep shield_wall shred silence spell_lock starfall stealth swipe vendetta ' +
    'wild_charge wrath'
  ).split(' ')
);
const spellArtKey = n => n.toLowerCase().replace(/\W+/g, '_');
// Image d'un sort : la sienne, ou celle d'un sort remplacé (champ art de SPELLS)
const spellArt = n => SPELLS[n]?.art || spellArtKey(n);
function skillIconSVG(cls, i, S) {
  const C = CLASS[cls];
  S = S || C.skills[i];
  const art = spellArt(S.n);
  if (SPELL_ART.has(art))
    return `<svg viewBox="0 0 48 48" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><image href="assets/ui/spells/${art}.webp" width="48" height="48" preserveAspectRatio="xMidYMid slice"/></svg>`;
  const a = rgbHex(C.accent),
    b = rgbHex(C.color),
    id = `g_${cls}_${S.n.replace(/\W/g, '')}`,
    m = skillMotif(S.n);
  const motifs = {
    strike: `<path d="M13 35L34 12l3 3-21 23-7 2 4-5z" fill="#eef6ff"/><path d="M12 12l24 24" stroke="${a}" stroke-width="5" stroke-linecap="round"/><path d="M11 11l26 26" stroke="#fff" stroke-width="1.5" opacity=".7"/>`,
    heal: `<circle cx="24" cy="24" r="13" fill="#fff6b8" opacity=".22"/><path d="M20 10h8v10h10v8H28v10h-8V28H10v-8h10z" fill="#fff7cb"/><path d="M24 5v5M24 38v5M5 24h5M38 24h5" stroke="${a}" stroke-width="2"/>`,
    shield: `<path d="M24 7l14 6v10c0 9-5 15-14 19-9-4-14-10-14-19V13z" fill="#d8efff" stroke="${a}" stroke-width="2.5"/><path d="M24 12v24c6-3 9-7 9-13v-7z" fill="${a}" opacity=".45"/>`,
    frost: `<path d="M24 5v38M7 14l34 20M7 34l34-20M13 7l4 7-8 1M35 7l-4 7 8 1M13 41l4-7-8-1M35 41l-4-7 8-1" stroke="#dff8ff" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="24" r="6" fill="${a}"/>`,
    root: `<path d="M24 5c-5 10 4 12-1 20-3 5-10 4-12 14M25 22c6 2 10-2 13-8M21 28c5 1 10 6 12 12" fill="none" stroke="#bdf27c" stroke-width="4" stroke-linecap="round"/><path d="M15 16l-5-5M33 28l7-3" stroke="${a}" stroke-width="3"/>`,
    silence: `<circle cx="24" cy="24" r="15" fill="none" stroke="#f0e4ff" stroke-width="3"/><path d="M13 35L35 13" stroke="${a}" stroke-width="6"/><path d="M17 20c4-5 10-5 14 0v8c-4 5-10 5-14 0z" fill="#ddd2ff" opacity=".65"/>`,
    move: `<path d="M6 25h23l-7-8 5-5 15 12-15 13-5-5 7-7H6z" fill="#e9fbff"/><path d="M8 15h14M5 34h16" stroke="${a}" stroke-width="3" stroke-linecap="round"/>`,
    power: `<path d="M25 4l-5 15 9-2-7 27 18-27-10 2 5-15z" fill="${a}" stroke="#fff0d0" stroke-width="1.5"/><circle cx="24" cy="24" r="17" fill="none" stroke="${a}" stroke-width="2" opacity=".55"/>`,
    grip: `<path d="M8 17c6-8 14-7 17-1s-2 10-7 9-6-7-2-10M40 31c-6 8-14 7-17 1s2-10 7-9 6 7 2 10" fill="none" stroke="#d5ecff" stroke-width="4"/><path d="M17 31l14-14" stroke="${a}" stroke-width="5"/>`,
    star: `<path d="M24 5l5 12 13 1-10 8 4 13-12-7-12 7 4-13-10-8 13-1z" fill="#fff2a8" stroke="${a}" stroke-width="2"/><circle cx="39" cy="8" r="3" fill="#fff"/>`,
    stun: `<path d="M9 26l8-8 5 6 7-12 10 8-7 8 7 6-11 8-5-8-8 7z" fill="#ffe27a" stroke="${a}" stroke-width="2"/><circle cx="15" cy="11" r="3" fill="#fff3a0"/>`,
    paw: `<path d="M24 28c-6 0-11 4-11 9 0 3 3 5 6 4 2-1 3-2 5-2s3 1 5 2c3 1 6-1 6-4 0-5-5-9-11-9z" fill="#fff3d6"/><ellipse cx="12" cy="20" rx="4" ry="5.5" fill="#fff3d6"/><ellipse cx="20" cy="13" rx="4" ry="5.5" fill="#fff3d6"/><ellipse cx="28" cy="13" rx="4" ry="5.5" fill="#fff3d6"/><ellipse cx="36" cy="20" rx="4" ry="5.5" fill="#fff3d6"/><circle cx="24" cy="24" r="20" fill="none" stroke="${a}" stroke-width="2" opacity=".7"/>`,
    claws: `<path d="M10 10c4 10 6 20 4 30M20 7c3 11 4 22 1 34M30 7c2 11 2 22-1 34M39 11c0 10-2 20-5 29" stroke="#ffd9a8" stroke-width="4.5" stroke-linecap="round" fill="none"/><path d="M10 10c4 10 6 20 4 30M20 7c3 11 4 22 1 34M30 7c2 11 2 22-1 34M39 11c0 10-2 20-5 29" stroke="${a}" stroke-width="1.5" fill="none"/>`,
    leaf: `<path d="M10 38C10 18 22 8 40 8c0 18-10 30-30 30z" fill="#c9f59a"/><path d="M12 36L36 12" stroke="${a}" stroke-width="2.5"/>`,
    stealth: `<path d="M5 24c6-9 13-13 19-13s13 4 19 13c-6 9-13 13-19 13S11 33 5 24z" fill="#2a2235" stroke="#d9c9ff" stroke-width="2"/><circle cx="24" cy="24" r="6" fill="${a}"/><path d="M8 40L40 8" stroke="#d9c9ff" stroke-width="3" opacity=".8"/>`,
    sheep: `<ellipse cx="25" cy="26" rx="14" ry="10" fill="#f4f0ff"/><circle cx="16" cy="20" r="6" fill="#fff"/><circle cx="28" cy="18" r="6" fill="#fff"/><ellipse cx="10" cy="27" rx="5" ry="6" fill="#3a3348"/><path d="M17 34v8M24 35v8M31 35v8M37 33v8" stroke="#3a3348" stroke-width="3" stroke-linecap="round"/><circle cx="24" cy="24" r="19" fill="none" stroke="${a}" stroke-width="2" opacity=".7"/>`,
    bolt: `<circle cx="14" cy="30" r="7" fill="${a}"/><path d="M16 29c10-13 15-16 27-20-6 9-11 17-19 28z" fill="#e8faff"/><path d="M19 30c8-8 13-12 20-15" stroke="${a}" stroke-width="4"/>`
  };
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><radialGradient id="${id}" cx="38%" cy="30%"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="#09070d"/></radialGradient></defs><rect width="48" height="48" rx="7" fill="url(#${id})"/><path d="M2 40C13 30 11 15 29 3" stroke="#fff" stroke-opacity=".10" stroke-width="7" fill="none"/>${motifs[m] || motifs.strike}<rect x="1" y="1" width="46" height="46" rx="6" fill="none" stroke="#fff" stroke-opacity=".22"/></svg>`;
}
function trinketIconSVG() {
  return `<svg viewBox="0 0 48 48" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><image href="assets/ui/spells/trinket.webp" width="48" height="48" preserveAspectRatio="xMidYMid slice"/></svg>`;
}
