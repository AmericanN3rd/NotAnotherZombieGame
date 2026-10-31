import { isMuted, toggleMute } from '../game/audio';
import type { ItemId } from '../game/shop';
import { SHOP_ITEMS, spentOn } from '../game/shop';
import type { EchoNote, RunState } from '../game/state';
import { input } from '../game/input';

export interface HudData {
  floor: string;
  hp: number;
  maxHp: number;
  mag: number;
  reserve: number;
  coins: number;
  silenced: boolean;
  power: boolean;
  compensated: boolean;
  notes: number;
}

interface Handlers {
  climb: () => void;
  buy: (id: ItemId) => void;
  closeShop: () => void;
  resume: () => void;
  restart: () => void;
  flare: () => void;
}

const root = document.getElementById('ui');
if (!root) throw new Error('Missing #ui');

root.innerHTML = `
  <div id="hud">
    <div class="hud-left">
      <div id="floor-name">Floor 1</div>
      <div id="hearts"></div>
    </div>
    <div class="hud-right">
      <button id="mute" type="button">Sound</button>
      <div id="coins">0</div>
      <div id="ammo">0 | 0</div>
      <div id="kit">
        <span class="kit-knife">knife</span>
        <span id="kit-gun">pistol</span>
        <button id="flare" type="button">flare</button>
      </div>
      <div id="note-count">0 echoes</div>
    </div>
  </div>
  <div id="prompt"></div>
  <div id="toast"></div>
  <div id="echo"><span>echo</span><p></p></div>
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
  <section id="menu" class="panel-wrap">
    <div class="panel">
      <p class="kicker">a tower, already dead</p>
      <h1>NAZG</h1>
      <p class="sub">Not Another Zombie Game</p>
      <p class="blurb">Floors 1–3. You never see anyone alive. The flare gun stays on your belt until the roof.</p>
      <button id="climb" type="button">Climb</button>
      <ul class="controls">
        <li>Move A/D or arrows. Jump Space. Climb W/S on ladders.</li>
        <li>Knife J. Shoot K. Reload R. Use E.</li>
        <li>Gunshots draw the dead. The knife does not.</li>
        <li>Reload: tap again in the green. A miss jams the gun. Waiting the bar out is slow and safe.</li>
      </ul>
    </div>
  </section>
  <section id="shop" class="panel-wrap hidden">
    <div class="panel shop-panel">
      <p class="kicker">vending cache</p>
      <h2>Supplies left behind</h2>
      <p id="shop-wallet"></p>
      <div id="shop-items"></div>
      <p id="shop-msg"></p>
      <button id="shop-close" type="button">Step back</button>
    </div>
  </section>
  <section id="pause" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker">held breath</p>
      <h2>Paused</h2>
      <div id="journal"></div>
      <button id="resume" type="button">Keep climbing</button>
    </div>
  </section>
  <section id="transition" class="panel-wrap hidden">
    <div class="panel plain">
      <p class="kicker">stairwell</p>
      <h2 id="tr-title">Floor 2</h2>
      <p id="tr-sub"></p>
    </div>
  </section>
  <section id="ending" class="panel-wrap hidden">
    <div class="panel">
      <p class="kicker">to be continued</p>
      <h2>The roof is above this landing.</h2>
      <p id="end-copy"></p>
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
  resume: () => undefined,
  restart: () => undefined,
  flare: () => undefined,
};

let toastTimer = 0;
let echoTimer = 0;

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
  const map: Record<string, ItemId> = {
    Digit1: 'ammo',
    Digit2: 'compensator',
    Digit3: 'power',
    Digit4: 'silencer',
  };
  const item = map[event.code];
  if (item) handlers.buy(item);
});

window.addEventListener('contextmenu', (event) => event.preventDefault());

function renderShop(run: RunState, limit: number): void {
  const spent = spentOn(run, run.floor);
  $('shop-wallet').textContent = `Coins ${run.coins}  ·  this floor ${spent}/${limit}. The wallet stands in for Recon earnings.`;
  const list = $('shop-items');
  list.innerHTML = '';
  SHOP_ITEMS.forEach((item, index) => {
    const owned = !item.repeatable && item.id !== 'ammo' && run.owned[item.id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shop-item';
    button.disabled = owned;
    button.innerHTML = `<span>${index + 1}. ${item.name}</span><span>${owned ? 'on the gun' : item.cost}</span><small>${item.detail}</small>`;
    button.addEventListener('click', () => handlers.buy(item.id));
    list.appendChild(button);
  });
}

export const ui = {
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
    $('ammo').textContent = `${data.mag} | ${data.reserve}`;
    $('note-count').textContent = `${data.notes} echoes`;
    const hearts = $('hearts');
    hearts.innerHTML = '';
    for (let i = 0; i < data.maxHp; i++) {
      const pip = document.createElement('i');
      if (i >= data.hp) pip.className = 'off';
      hearts.appendChild(pip);
    }
    const gun = $('kit-gun');
    const tags = ['pistol'];
    if (data.power) tags.push('power');
    if (data.compensated) tags.push('comp');
    if (data.silenced) tags.push('quiet');
    gun.textContent = tags.join(' · ');
  },
  setPrompt(text: string | null): void {
    const node = $('prompt');
    node.textContent = text ?? '';
    node.classList.toggle('show', Boolean(text));
  },
  setReload(progress: number | null, jammed: boolean): void {
    const bar = $('reload');
    if (progress == null) {
      bar.classList.add('hidden');
      return;
    }
    bar.classList.remove('hidden');
    bar.classList.toggle('jammed', jammed);
    bar.style.setProperty('--p', String(Math.max(0, Math.min(1, progress))));
    const label = bar.querySelector('.reload-label');
    if (label) label.textContent = jammed ? 'jammed' : 'tap in the green';
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
    renderShop(run, limit);
    $('shop').classList.remove('hidden');
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
  showPause(notes: EchoNote[]): void {
    const journal = $('journal');
    if (notes.length === 0) {
      journal.innerHTML = '<p class="empty">No echoes yet. The paper is still where they left it.</p>';
    } else {
      journal.innerHTML = notes.map((note) => `<blockquote>Floor ${note.floor}. ${note.text}</blockquote>`).join('');
    }
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
    $('end-copy').textContent = `The flare gun is still on your belt. You kept ${gear}, ${run.notes.length} echoes, and ${run.coins} coins. The helicopter is not in this climb.`;
    $('ending').classList.remove('hidden');
  },
  hideOverlays(): void {
    for (const id of ['menu', 'shop', 'pause', 'transition', 'ending']) {
      $(id).classList.add('hidden');
    }
  },
};
