import { isMuted, playClip, stopClip, toggleMute } from '../game/audio';
import { RELEASE_PAGE } from '../game/updateCheck';
import { saveSettings, settings, watchSettings } from '../game/settings';
import { gearDef, slotLabel, type GearId, type Slot } from '../game/gear';
import { knifeBand } from '../game/knife';
import { metaState, nextBlurb, nextCost, stationLevel, stationName, unlockedPowers, type Meta, type StationId } from '../game/meta';
import type { ItemId } from '../game/shop';
import { offersFor, spentOn } from '../game/shop';
import type { EchoNote, RunState } from '../game/state';
import { input } from '../game/input';

export interface HudData {
  floor: string;
  hp: number;
  maxHp: number;
  mag: number;
  magSize: number;
  reserve: number;
  coins: number;
  knife: number;
  silenced: boolean;
  power: boolean;
  compensated: boolean;
  notes: number;
  flareShells: number;
  helmet: string;
  armor: string;
  weapon: string;
  salvage: number;
}

interface Handlers {
  climb: () => void;
  buy: (id: ItemId) => void;
  closeShop: () => void;
  closeWager: () => void;
  resume: () => void;
  restart: () => void;
  flare: () => void;
  applySeed: (seed: number) => void;
  replayIntro: () => void;
  openGear: () => void;
  closeGear: () => void;
  equip: (id: GearId) => void;
  clearSlot: (slot: Slot) => void;
  useHealth: () => void;
  buyStation: (id: StationId) => void;
  closeStation: () => void;
  showNotices: () => void;
  returnToCamp: () => void;
  resetProgress: () => void;
  leaveClimb: () => void;
  noticeSettings: () => void;
  noticeControls: () => void;
  noticeCredits: () => void;
}

const root = document.getElementById('ui');
if (!root) throw new Error('Missing #ui');

root.innerHTML = `
  <button id="update-banner" type="button" class="hidden">Update available</button>
  <div id="hud">
    <div class="hud-stack">
      <div id="floor-name">Floor 1</div>
      <div class="meter">
        <span>Vital</span>
        <div class="track"><i id="hp-fill"></i></div>
        <em id="hp-read">5</em>
      </div>
      <div class="meter">
        <span>Mag</span>
        <div class="track pips" id="ammo-pips"></div>
        <em id="ammo-read">0</em>
      </div>
      <div class="meter">
        <span>Knife</span>
        <div class="track"><i id="knife-fill"></i></div>
        <em id="knife-read">keen</em>
      </div>
    </div>
    <div class="hud-right">
      <div class="hud-tools">
        <button id="mute" type="button">Sound</button>
        <button id="gear-open" type="button">Pack</button>
        <button id="flare" type="button">Flare</button>
      </div>
      <div id="coins">0 coins</div>
      <div id="salvage">0 salvage</div>
      <div id="kit-gun">pistol</div>
      <div id="note-count">0 echoes</div>
    </div>
  </div>
  <div id="prompt"></div>
  <div id="toast"></div>
  <div id="echo"><span>echo</span><p></p></div>
  <div id="pad-legend">A jump · X knife · RT fire · Y reload · B use · View pack · LB flare · Menu pause</div>
  <div id="reload" class="hidden">
    <div class="sweet"></div>
    <div class="needle"></div>
    <div class="reload-label">reload</div>
  </div>
  <div id="touch" class="touch-controls">
    <div class="stick" id="stick"><div class="nub"></div></div>
    <div class="buttons">
      <button type="button" data-act="reload">Reload</button>
      <button type="button" data-act="interact">Use</button>
      <button type="button" data-act="melee">Knife</button>
      <button type="button" data-act="fire">Fire</button>
      <button type="button" data-act="jump">Jump</button>
    </div>
  </div>
  <section id="menu" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker">a tower, already dead</p>
      <h1>NAZG</h1>
      <p class="sub">Not Another Zombie Game</p>
      <p class="blurb">The lobby is the camp. The stairs start a climb. You never see anyone alive.</p>
      <button id="climb" type="button">Climb</button>
      <button id="open-settings" type="button" class="ghost">Settings</button>
      <ul class="controls">
        <li>Move A/D or arrows. Jump Space. Climb W/S on ladders.</li>
        <li>Knife J. Shoot K. Reload R. Use E.</li>
        <li>Pad: stick or D-pad, A jump, X knife, RT shoot, Y or RB reload, B use, Menu pauses.</li>
        <li>Gunshots draw the dead. The knife does not.</li>
        <li>Reload: tap again in the green. A miss jams the gun. Waiting the bar out is slow and safe.</li>
      </ul>
      <p id="menu-pad" class="pad-only">A or Menu to climb.</p>
    </div>
  </section>
  <section id="shop" class="panel-wrap hidden">
    <div class="panel shop-panel">
      <p class="kicker">vending cache</p>
      <h2>Supplies left behind</h2>
      <p id="shop-wallet"></p>
      <div id="shop-items"></div>
      <p id="shop-msg"></p>
      <p id="shop-pad" class="pad-only">Stick or D-pad chooses. A buys. B steps back.</p>
      <button id="shop-close" type="button">Step back</button>
    </div>
  </section>
  <section id="gear" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker">what you are wearing</p>
      <h2>Pack</h2>
      <div id="slots"></div>
      <div id="bag"></div>
      <p id="gear-msg"></p>
      <p class="pad-only">Stick or D-pad chooses. A wears it. X uses the health item. B closes.</p>
      <div class="setting-row">
        <button id="use-health" type="button">Use health item</button>
        <button id="gear-close" type="button" class="ghost">Close</button>
      </div>
    </div>
  </section>
  <section id="pause" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker">held breath</p>
      <h2>Paused</h2>
      <div id="journal"></div>
      <p id="pause-seed" class="seed-line"></p>
      <button id="resume" type="button">Keep climbing</button>
      <button id="pause-leave" type="button" class="ghost">Leave the climb</button>
      <button id="pause-settings" type="button" class="ghost">Settings</button>
    </div>
  </section>
  <section id="transition" class="panel-wrap hidden">
    <div class="panel plain">
      <p class="kicker">stairwell</p>
      <h2 id="tr-title">Floor 2</h2>
      <p id="tr-sub"></p>
    </div>
  </section>
  <section id="settings" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker">settings</p>
      <h2>How dark, how loud</h2>
      <label class="setting">Brightness <input id="set-bright" type="range" min="35" max="100" value="62" /></label>
      <label class="setting"><input id="set-low" type="checkbox" /> Low effects</label>
      <label class="setting">Seed <input id="set-seed" type="number" min="1" step="1" /></label>
      <p class="empty">Floors 4 and up are built from this seed. The pause screen shows the seed that actually fit.</p>
      <div class="setting-row">
        <button id="set-apply" type="button">Apply seed</button>
        <button id="set-replay" type="button" class="ghost">Replay the door</button>
        <button id="set-reset" type="button" class="ghost">Reset progress</button>
        <button id="set-close" type="button" class="ghost">Close</button>
      </div>
    </div>
  </section>
  <section id="wager" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker">floor 6</p>
      <h2>Optional wager</h2>
      <p>Three lanes under this hall. Harder lanes pay more. The stairs up are on this floor, not down there.</p>
      <ul class="controls">
        <li>Short — a few spikes, 8 coins.</li>
        <li>Harsh — spikes and a pit, 16 coins.</li>
        <li>Brutal — more of both, 28 coins.</li>
      </ul>
      <button id="wager-close" type="button">Leave it</button>
    </div>
  </section>
  <section id="intro" class="panel-wrap hidden intro">
    <div class="intro-rain"></div>
    <div class="intro-door"></div>
    <p id="intro-line">The rain is louder than the street.</p>
    <button id="intro-skip" type="button" class="hidden">Skip</button>
    <button id="intro-go" type="button" class="hidden">Go in</button>
  </section>
  <section id="station" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker" id="station-kicker">station</p>
      <h2 id="station-title">Workbench</h2>
      <p id="station-level"></p>
      <p id="station-next"></p>
      <p id="station-msg"></p>
      <div class="setting-row">
        <button id="station-buy" type="button">Improve</button>
        <button id="station-close" type="button" class="ghost">Step back</button>
      </div>
    </div>
  </section>
  <section id="notices" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker">pinned to the wall</p>
      <h2>Notices</h2>
      <p class="empty">No one else posted these. The board is just here.</p>
      <div class="setting-row">
        <button id="notice-settings" type="button">Settings</button>
        <button id="notice-controls" type="button" class="ghost">Controls</button>
        <button id="notice-credits" type="button" class="ghost">Credits</button>
        <button id="notice-close" type="button" class="ghost">Step back</button>
      </div>
    </div>
  </section>
  <section id="controls-panel" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker">how you move</p>
      <h2>Controls</h2>
      <ul class="controls">
        <li>Move A/D or arrows. Jump Space. Climb W/S on ladders.</li>
        <li>Knife J. Shoot K. Reload R. Use E. Pack I.</li>
        <li>Pad: stick or D-pad, A jump, X knife, RT shoot, Y reload, B use, View pack, Menu pauses.</li>
        <li>Reload again in the green. A miss jams the gun unless you bought gun oil.</li>
        <li>The camp stairs start a climb. Death keeps salvage and drops the run's gear.</li>
      </ul>
      <button id="controls-close" type="button">Step back</button>
    </div>
  </section>
  <section id="credits" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker">who is not here</p>
      <h2>Credits</h2>
      <p>You are alone in the tower. The stations are furniture.</p>
      <p class="empty">Sound effects in the climb are synthesized. Weather, the door, and the walls are CC0 files listed in AUDIO_CREDITS.md.</p>
      <p class="empty">Music slots: camp, climb, and the hatch. The files in public/audio/music/ are CC0 placeholders until original tracks replace them.</p>
      <p><strong>Original music by the user.</strong> Drop camp, climb, and hatch into public/audio/music/.</p>
      <button id="credits-close" type="button">Step back</button>
    </div>
  </section>
  <section id="run-end" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker" id="end-kicker">the climb stops</p>
      <h2 id="end-title">You fall.</h2>
      <p id="end-copy"></p>
      <p id="end-salvage"></p>
      <button id="end-camp" type="button">Back to the lobby</button>
    </div>
  </section>
  <section id="ending" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker">to be continued</p>
      <h2>The hatch will not open.</h2>
      <p id="end-legacy"></p>
      <button id="again" type="button">Climb again</button>
    </div>
  </section>
`;

const $ = <T extends HTMLElement>(id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
};

let handlers: Handlers = {
  climb: () => undefined,
  buy: () => undefined,
  closeShop: () => undefined,
  closeWager: () => undefined,
  resume: () => undefined,
  restart: () => undefined,
  flare: () => undefined,
  applySeed: () => undefined,
  replayIntro: () => undefined,
  openGear: () => undefined,
  closeGear: () => undefined,
  equip: () => undefined,
  clearSlot: () => undefined,
  useHealth: () => undefined,
  buyStation: () => undefined,
  closeStation: () => undefined,
  showNotices: () => undefined,
  returnToCamp: () => undefined,
  resetProgress: () => undefined,
  leaveClimb: () => undefined,
  noticeSettings: () => undefined,
  noticeControls: () => undefined,
  noticeCredits: () => undefined,
};

let toastTimer = 0;
let echoTimer = 0;
let shopIndex = 0;

input.watchScheme((scheme) => {
  document.body.classList.toggle('pad-active', scheme === 'pad');
  $('climb').textContent = scheme === 'pad' ? 'A · climb' : 'Climb';
  $('shop-close').textContent = scheme === 'pad' ? 'B · step back' : 'Step back';
  $('gear-close').textContent = scheme === 'pad' ? 'B · close' : 'Close';
  $('gear-open').textContent = scheme === 'pad' ? 'View' : 'Pack';
  $('resume').textContent = scheme === 'pad' ? 'A · keep climbing' : 'Keep climbing';
  $('again').textContent = scheme === 'pad' ? 'A · climb again' : 'Climb again';
  if (scheme === 'pad') applyShopSelection();
});

function wantTouch(): boolean {
  const params = new URLSearchParams(location.search);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return coarse || params.has('touch') || window.innerWidth < 980;
}

function syncTouch(): void {
  document.body.classList.toggle('touch-device', wantTouch());
}

syncTouch();
window.addEventListener('resize', syncTouch);

$('climb').addEventListener('click', () => handlers.climb());
$('shop-close').addEventListener('click', () => handlers.closeShop());
$('resume').addEventListener('click', () => handlers.resume());
$('again').addEventListener('click', () => handlers.restart());
$('flare').addEventListener('click', () => handlers.flare());
$('gear-open').addEventListener('click', () => handlers.openGear());
$('gear-close').addEventListener('click', () => handlers.closeGear());
$('use-health').addEventListener('click', () => handlers.useHealth());
$('open-settings').addEventListener('click', () => ui.showSettings());
$('pause-settings').addEventListener('click', () => ui.showSettings());
$('pause-leave').addEventListener('click', () => handlers.leaveClimb());
$('set-close').addEventListener('click', () => ui.hideSettings());
$('wager-close').addEventListener('click', () => handlers.closeWager());
$('set-apply').addEventListener('click', () => {
  const value = Number(($('set-seed') as HTMLInputElement).value);
  if (Number.isFinite(value)) handlers.applySeed(Math.floor(value));
});
$('set-replay').addEventListener('click', () => handlers.replayIntro());
$('set-reset').addEventListener('click', () => handlers.resetProgress());
$('station-close').addEventListener('click', () => handlers.closeStation());
$('station-buy').addEventListener('click', () => {
  const id = $('station').dataset.station as StationId | undefined;
  if (id) handlers.buyStation(id);
});
$('notice-settings').addEventListener('click', () => handlers.noticeSettings());
$('notice-controls').addEventListener('click', () => handlers.noticeControls());
$('notice-credits').addEventListener('click', () => handlers.noticeCredits());
$('notice-close').addEventListener('click', () => ui.hideNotices());
$('controls-close').addEventListener('click', () => $('controls-panel').classList.add('hidden'));
$('credits-close').addEventListener('click', () => $('credits').classList.add('hidden'));
$('end-camp').addEventListener('click', () => handlers.returnToCamp());
$('set-bright').addEventListener('input', () => {
  settings.brightness = Number(($('set-bright') as HTMLInputElement).value) / 100;
  saveSettings(settings);
});
$('set-low').addEventListener('change', () => {
  settings.lowEffects = ($('set-low') as HTMLInputElement).checked;
  saveSettings(settings);
  document.body.classList.toggle('low-fx', settings.lowEffects);
});
watchSettings((value) => {
  ($('set-bright') as HTMLInputElement).value = String(Math.round(value.brightness * 100));
  ($('set-low') as HTMLInputElement).checked = value.lowEffects;
  if (value.seed != null) ($('set-seed') as HTMLInputElement).value = String(value.seed);
  document.body.classList.toggle('low-fx', value.lowEffects);
});
$('mute').addEventListener('click', () => {
  const muted = toggleMute();
  $('mute').textContent = muted ? 'Muted' : 'Sound';
});

const stick = $('stick');
const nub = stick.querySelector('.nub') as HTMLElement;
const moveStick = (event: PointerEvent) => {
  const rect = stick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = event.clientX - cx;
  let dy = event.clientY - cy;
  const max = rect.width * 0.34;
  const mag = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(mag, max);
  dx = (dx / mag) * clamped;
  dy = (dy / mag) * clamped;
  nub.style.transform = `translate(${dx}px, ${dy}px)`;
  input.setJoy(dx / max, dy / max);
};
stick.addEventListener('pointerdown', (event) => {
  stick.setPointerCapture(event.pointerId);
  moveStick(event);
});
stick.addEventListener('pointermove', (event) => {
  if (!stick.hasPointerCapture(event.pointerId)) return;
  moveStick(event);
});
const releaseStick = (event: PointerEvent) => {
  if (stick.hasPointerCapture(event.pointerId)) stick.releasePointerCapture(event.pointerId);
  nub.style.transform = 'translate(0px, 0px)';
  input.setJoy(0, 0);
};
stick.addEventListener('pointerup', releaseStick);
stick.addEventListener('pointercancel', releaseStick);

document.querySelectorAll<HTMLButtonElement>('#touch button').forEach((button) => {
  const act = button.dataset.act;
  if (act !== 'jump' && act !== 'melee' && act !== 'fire' && act !== 'reload' && act !== 'interact') return;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    input.press(act);
  });
  button.addEventListener('pointerup', () => {
    if (act === 'jump' || act === 'interact') input.release(act);
  });
  button.addEventListener('pointercancel', () => {
    if (act === 'jump' || act === 'interact') input.release(act);
  });
});

window.addEventListener('keydown', (event) => {
  const shop = $('shop');
  if (shop.classList.contains('hidden')) return;
  const index = Number(event.code.replace('Digit', '')) - 1;
  if (!Number.isInteger(index) || index < 0) return;
  const button = shopButtons()[index];
  if (button && !button.disabled) button.click();
});

window.addEventListener('contextmenu', (event) => event.preventDefault());

function renderShop(run: RunState, limit: number): void {
  const spent = spentOn(run, run.floor);
  $('shop-wallet').textContent = `Coins ${run.coins} · this floor ${spent}/${limit}. Three powers, plus rounds and a stone.`;
  const list = $('shop-items');
  list.innerHTML = '';
  offersFor(run, unlockedPowers(metaState())).forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shop-item';
    button.disabled = item.owned;
    button.innerHTML = `<span>${index + 1}. ${item.name}</span><span>${item.owned ? 'owned' : item.cost}</span><small>${item.detail}</small>`;
    button.addEventListener('click', () => handlers.buy(item.id));
    list.appendChild(button);
  });
  const buttons = shopButtons();
  if (buttons.length === 0) shopIndex = 0;
  else if (shopIndex >= buttons.length || buttons[shopIndex]?.disabled) {
    shopIndex = buttons.findIndex((button) => !button.disabled);
    if (shopIndex < 0) shopIndex = 0;
  }
  applyShopSelection();
}

async function openReleasePage(url: string): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform()) {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    }
  } catch {
    // The browser plugin is absent in tests and plain web builds.
  }
  window.open(url, '_blank', 'noopener');
}

function shopButtons(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>('#shop-items .shop-item')];
}

function applyShopSelection(): void {
  const buttons = shopButtons();
  buttons.forEach((button, index) => button.classList.toggle('selected', input.device === 'pad' && index === shopIndex));
}

export const ui = {
  offerUpdate(url: string = RELEASE_PAGE): void {
    const banner = $('update-banner');
    banner.textContent = 'Update available';
    banner.classList.remove('hidden');
    banner.onclick = () => {
      void openReleasePage(url);
    };
  },
  bind(next: Handlers): void {
    handlers = next;
    $('mute').textContent = isMuted() ? 'Muted' : 'Sound';
  },
  showMenu(): void {
    $('menu').classList.remove('hidden');
  },
  hideMenu(): void {
    $('menu').classList.add('hidden');
  },
  playMode(on: boolean): void {
    document.body.classList.toggle('playing', on);
  },
  setHud(data: HudData): void {
    $('floor-name').textContent = data.floor;
    $('coins').textContent = `${data.coins} coins`;
    $('note-count').textContent = `${data.notes} echoes`;
    const hp = Math.max(0, data.hp) / Math.max(1, data.maxHp);
    $('hp-fill').style.transform = `scaleX(${hp})`;
    $('hp-read').textContent = `${Math.max(0, data.hp)}/${data.maxHp}`;
    const pips = $('ammo-pips');
    if (pips.childElementCount !== data.magSize) {
      pips.innerHTML = '';
      for (let i = 0; i < data.magSize; i++) {
        const pip = document.createElement('i');
        pips.appendChild(pip);
      }
    }
    [...pips.children].forEach((pip, index) => pip.classList.toggle('off', index >= data.mag));
    $('ammo-read').textContent = `${data.mag}+${data.reserve}`;
    const knife = Math.max(0, Math.min(100, data.knife)) / 100;
    const band = knifeBand(data.knife);
    const knifeFill = $('knife-fill');
    knifeFill.style.transform = `scaleX(${knife})`;
    knifeFill.dataset.band = band;
    $('knife-read').textContent = band === 'sharp' ? 'keen' : band;
    const gun = $('kit-gun');
    const tags = [data.weapon === 'Knife' ? 'pistol' : data.weapon];
    if (data.power) tags.push('power');
    if (data.compensated) tags.push('comp');
    if (data.silenced) tags.push('quiet');
    gun.textContent = tags.join(' · ');
    $('flare').textContent = data.flareShells > 0 ? `Flare ${data.flareShells}` : 'Flare';
    $('flare').classList.toggle('armed', data.flareShells > 0);
    $('salvage').textContent = `${data.salvage} salvage`;
  },
  setPrompt(text: string | null): void {
    const node = $('prompt');
    node.textContent = text ?? '';
    node.classList.toggle('show', Boolean(text));
  },
  setReload(progress: number | null, jammed: boolean, sweet: { start: number; end: number } = { start: 0.6, end: 0.84 }): void {
    const bar = $('reload');
    if (progress == null) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    bar.classList.toggle('jammed', jammed);
    bar.style.setProperty('--p', String(Math.max(0, Math.min(1, progress))));
    const sweetBand = bar.querySelector('.sweet') as HTMLElement | null;
    if (sweetBand) {
      sweetBand.style.left = `${sweet.start * 100}%`;
      sweetBand.style.width = `${(sweet.end - sweet.start) * 100}%`;
    }
    const label = bar.querySelector('.reload-label');
    if (label) label.textContent = jammed ? 'jammed' : input.device === 'pad' ? 'Y in the green' : 'tap in the green';
  },
  showEcho(text: string): void {
    const node = $('echo');
    const paragraph = node.querySelector('p');
    if (paragraph) paragraph.textContent = text;
    node.classList.add('show');
    window.clearTimeout(echoTimer);
    echoTimer = window.setTimeout(() => node.classList.remove('show'), 4600);
  },
  toast(text: string): void {
    const node = $('toast');
    node.textContent = text;
    node.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => node.classList.remove('show'), 3200);
  },
  flashHurt(): void {
    const hurt = document.getElementById('hurt');
    if (!hurt) return;
    hurt.classList.add('on');
    window.setTimeout(() => hurt.classList.remove('on'), 180);
  },
  showShop(run: RunState, limit: number): void {
    $('shop-msg').textContent = '';
    shopIndex = 0;
    renderShop(run, limit);
    $('shop').classList.remove('hidden');
  },
  nudgeShop(dir: -1 | 1): void {
    const buttons = shopButtons();
    if (buttons.length === 0) return;
    for (let step = 0; step < buttons.length; step++) {
      shopIndex = (shopIndex + dir + buttons.length) % buttons.length;
      if (!buttons[shopIndex]?.disabled) break;
    }
    applyShopSelection();
  },
  confirmShop(): void {
    const button = shopButtons()[shopIndex];
    if (button && !button.disabled) button.click();
  },
  refreshShop(run: RunState, limit: number): void {
    renderShop(run, limit);
  },
  shopMessage(text: string): void {
    $('shop-msg').textContent = text;
  },
  hideShop(): void {
    $('shop').classList.add('hidden');
  },
  showPause(notes: EchoNote[], seed?: number): void {
    const journal = $('journal');
    if (notes.length === 0) {
      journal.innerHTML = '<p class="empty">No echoes yet. The paper is still where they left it.</p>';
    } else {
      journal.innerHTML = notes.map((note) => `<blockquote>Floor ${note.floor}. ${note.text}</blockquote>`).join('');
    }
    $('pause-seed').textContent = seed == null ? '' : `Seed ${seed}`;
    $('pause').classList.remove('hidden');
  },
  hidePause(): void {
    $('pause').classList.add('hidden');
  },
  showTransition(title: string, sub: string): Promise<void> {
    $('tr-title').textContent = title;
    $('tr-sub').textContent = sub;
    const node = $('transition');
    node.classList.remove('hidden');
    return new Promise((resolve) => {
      window.setTimeout(resolve, 1150);
    });
  },
  hideTransition(): void {
    $('transition').classList.add('hidden');
  },
  showEnding(run: RunState): void {
    const names = [
      run.owned.power ? 'power' : '',
      run.owned.compensator ? 'compensator' : '',
      run.owned.silencer ? 'silencer' : '',
    ].filter(Boolean);
    const gear = names.length ? names.join(', ') : 'the gun you started with';
    $('end-legacy').textContent = `Floor 16 ends at a hatch that will not open. You kept ${gear}, ${run.notes.length} echoes, and ${run.coins} coins. The knife is ${knifeBand(run.knife)}. Seed ${run.builtSeed ?? run.seed}.`;
    $('ending').classList.remove('hidden');
  },
  showSettings(): void {
    if (settings.seed != null) ($('set-seed') as HTMLInputElement).value = String(settings.seed);
    $('settings').classList.remove('hidden');
  },
  hideSettings(): void {
    $('settings').classList.add('hidden');
  },
  showWager(): void {
    $('wager').classList.remove('hidden');
  },
  hideWager(): void {
    $('wager').classList.add('hidden');
  },
  showIntro(allowSkip: boolean, onDone: () => void): void {
    const timers: number[] = [];
    const later = (ms: number, fn: () => void) => {
      timers.push(window.setTimeout(fn, ms));
    };
    const intro = $('intro');
    const line = $('intro-line');
    const skip = $('intro-skip');
    const go = $('intro-go');
    $('menu').classList.add('hidden');
    intro.classList.remove('hidden', 'slam', 'black', 'flash');
    skip.classList.toggle('hidden', !allowSkip);
    go.classList.add('hidden');
    line.textContent = 'The rain is louder than the street.';
    const rain = playClip('rain', 0.45, true);
    const finish = () => {
      for (const timer of timers) window.clearTimeout(timer);
      stopClip(rain);
      intro.classList.add('hidden');
      onDone();
    };
    skip.onclick = finish;
    go.onclick = finish;
    later(2200, () => {
      intro.classList.add('slam');
      line.textContent = 'You get the door shut.';
      playClip('door-slam', 0.7);
    });
    later(3200, () => {
      intro.classList.add('black');
      line.textContent = 'Then nothing.';
    });
    later(3600, () => {
      intro.classList.add('flash');
      line.textContent = 'Thunder. The tower answers.';
      playClip('thunder', 0.55);
      window.setTimeout(() => intro.classList.remove('flash'), 500);
    });
    later(4500, () => {
      line.textContent = 'Something in the dark is awake.';
      playClip('wail', 0.4);
    });
    later(6200, () => playClip('teeth', 0.35));
    later(7600, () => {
      playClip('scratch', 0.4);
      line.textContent = 'It thins as you go further in.';
    });
    later(9400, () => {
      go.classList.remove('hidden');
      if (!allowSkip) skip.classList.add('hidden');
    });
  },
  showGear(run: RunState): void {
    const slots = $('slots');
    slots.innerHTML = '';
    const order: Slot[] = ['helmet', 'armor', 'weapon', 'health'];
    for (const slot of order) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'slot';
      button.innerHTML = `<span>${slot}</span><strong>${slotLabel(run.loadout, slot)}</strong>`;
      button.addEventListener('click', () => handlers.clearSlot(slot));
      slots.appendChild(button);
    }
    const bag = $('bag');
    bag.innerHTML = '';
    const entries = Object.entries(run.bag) as [GearId, number][];
    if (entries.length === 0) {
      bag.innerHTML = '<p class="empty">The bag is empty. What you find on a floor can be worn from here.</p>';
    }
    entries.forEach(([id, count], index) => {
      const def = gearDef(id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'shop-item';
      button.innerHTML = `<span>${index + 1}. ${def.name} ×${count}</span><span>wear</span><small>${def.detail}</small>`;
      button.addEventListener('click', () => handlers.equip(id));
      bag.appendChild(button);
    });
    $('gear-msg').textContent = '';
    $('gear').classList.remove('hidden');
  },
  refreshGear(run: RunState): void {
    this.showGear(run);
  },
  gearMessage(text: string): void {
    $('gear-msg').textContent = text;
  },
  hideGear(): void {
    $('gear').classList.add('hidden');
  },
  nudgeGear(dir: -1 | 1): void {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('#bag .shop-item')];
    if (buttons.length === 0) return;
    const current = buttons.findIndex((button) => button.classList.contains('selected'));
    const next = current < 0 ? 0 : (current + dir + buttons.length) % buttons.length;
    buttons.forEach((button, index) => button.classList.toggle('selected', index === next));
  },
  confirmGear(): void {
    const button = document.querySelector<HTMLButtonElement>('#bag .shop-item.selected') ?? document.querySelector<HTMLButtonElement>('#bag .shop-item');
    button?.click();
  },
  showStation(meta: Meta, id: StationId): void {
    const level = stationLevel(meta, id);
    $('station').dataset.station = id;
    $('station-kicker').textContent = 'salvage ' + meta.salvage;
    $('station-title').textContent = stationName(id);
    $('station-level').textContent = level >= 3 ? 'Raised as far as the lobby allows.' : `Level ${level} of 3.`;
    $('station-next').textContent = nextBlurb(id, level);
    const cost = nextCost(meta, id);
    $('station-buy').textContent = cost == null ? 'Nothing to add' : `Improve · ${cost} salvage`;
    ($('station-buy') as HTMLButtonElement).disabled = cost == null || meta.salvage < cost;
    $('station-msg').textContent = '';
    $('station').classList.remove('hidden');
  },
  stationMessage(text: string): void {
    $('station-msg').textContent = text;
  },
  hideStation(): void {
    $('station').classList.add('hidden');
  },
  showControls(): void {
    $('controls-panel').classList.remove('hidden');
  },
  showCredits(): void {
    $('credits').classList.remove('hidden');
  },
  showNotices(): void {
    $('notices').classList.remove('hidden');
  },
  hideNotices(): void {
    $('notices').classList.add('hidden');
  },
  showRunEnd(data: { reason: 'dead' | 'leave' | 'hatch'; earned: number; total: number; floor: number }): void {
    const title = $('end-title');
    const kicker = $('end-kicker');
    if (data.reason === 'hatch') {
      kicker.textContent = 'floor 16';
      title.textContent = 'The hatch stays shut.';
      $('end-copy').textContent = 'You came back down with what the tower let you keep. The gear from the climb does not.';
    } else if (data.reason === 'leave') {
      kicker.textContent = 'walking back';
      title.textContent = 'You leave the climb.';
      $('end-copy').textContent = 'The gun, the knife’s edge, and the pockets of coins stay in the tower. Salvage does not.';
    } else {
      kicker.textContent = 'the climb stops';
      title.textContent = 'You fall.';
      $('end-copy').textContent = `Floor ${data.floor} keeps the gear. The lobby is still downstairs, and the salvage is still yours.`;
    }
    $('end-salvage').textContent = `This run pocketed ${data.earned}. Salvage kept: ${data.total}.`;
    $('run-end').classList.remove('hidden');
  },
  hideRunEnd(): void {
    $('run-end').classList.add('hidden');
  },
  hideOverlays(): void {
    for (const id of ['menu', 'shop', 'pause', 'transition', 'ending', 'settings', 'wager', 'intro', 'gear', 'station', 'notices', 'controls-panel', 'credits', 'run-end']) {
      $(id).classList.add('hidden');
    }
  },
};
