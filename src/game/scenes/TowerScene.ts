import Phaser from 'phaser';
import { unlockAudio, sfx } from '../audio';
import { BULLET_SPEED, GRAVITY, IFRAME_TIME, MACAW_NOISE, MELEE_DAMAGE, MELEE_REACH } from '../balance';
import { createTextures } from '../textures';
import { Enemy } from '../entities/enemy';
import { Player } from '../entities/player';
import { input } from '../input';
import { getLevel } from '../levels';
import { beginReload, idleReload, JAM_DURATION, reloadProgress, tickReload, type ReloadState } from '../reload';
import { attemptPurchase, type ItemId } from '../shop';
import { bulletSpread, createRun, gearLevel, noiseRadius, recoilScale, type RunState } from '../state';
import type { LevelData, Rect } from '../types';
import { ui } from '../../ui/ui';

type Phase = 'menu' | 'play' | 'shop' | 'pause' | 'transition' | 'down' | 'ending';

interface LiveDoor {
  id: string;
  rect: Rect;
  sprite: Phaser.GameObjects.Rectangle;
  open: boolean;
}

interface LiveTerminal {
  doorId: string;
  rect: Rect;
  charge: number;
  bar: Phaser.GameObjects.Rectangle;
}

interface LivePickup {
  kind: 'note' | 'coin' | 'medkit';
  rect: Rect;
  sprite: Phaser.GameObjects.Sprite;
  id?: string;
  text?: string;
  amount?: number;
  heal?: number;
  taken: boolean;
}

function overlaps(body: Phaser.Physics.Arcade.Body, rect: Rect, pad = 0): boolean {
  return (
    body.x < rect.x + rect.w + pad &&
    body.right > rect.x - pad &&
    body.y < rect.y + rect.h + pad &&
    body.bottom > rect.y - pad
  );
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class TowerScene extends Phaser.Scene {
  private run!: RunState;
  private level!: LevelData;
  private phase: Phase = 'menu';
  private player!: Player;
  private enemies: Enemy[] = [];
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private floors: Rect[] = [];
  private blocks: Rect[] = [];
  private ladders: Rect[] = [];
  private pickups: LivePickup[] = [];
  private doors: LiveDoor[] = [];
  private terminals: LiveTerminal[] = [];
  private spikes: Rect[] = [];
  private pits: Rect[] = [];
  private exits: Rect[] = [];
  private checkpoints: { x: number; y: number; rect: Rect }[] = [];
  private shopRect: Rect | null = null;
  private crumbleRect: Rect | null = null;
  private crumbleSprite: Phaser.GameObjects.Rectangle | null = null;
  private collapsed = false;
  private groundCollider!: Phaser.Physics.Arcade.Collider;
  private bullets!: Phaser.Physics.Arcade.Group;
  private reload: ReloadState = idleReload();
  private stepAcc = 0;
  private aimUp = false;
  private aimDown = false;
  private lightsGfx!: Phaser.GameObjects.Graphics;
  private flashGfx!: Phaser.GameObjects.Graphics;
  private lightDefs: LevelData['lights'] = [];
  private transitioning = false;

  constructor() {
    super('tower');
  }

  init(data?: { floor?: number; fresh?: boolean }): void {
    if (data?.fresh || !this.registry.get('run')) {
      this.registry.set('run', createRun());
    }
    this.run = this.registry.get('run') as RunState;
    if (typeof data?.floor === 'number') this.run.floor = data.floor;
  }

  create(): void {
    this.phase = 'menu';
    this.enemies = [];
    this.pickups = [];
    this.doors = [];
    this.terminals = [];
    this.collapsed = this.run.crumbled && this.run.floor === 3;
    this.reload = idleReload();
    this.transitioning = false;

    if (!this.textures.exists('player')) createTextures(this);
    this.build();
  }

  private build(): void {
    this.level = getLevel(this.run.floor);
    if (this.run.checkpoint.floor !== this.level.id) {
      this.run.checkpoint = { floor: this.level.id, x: this.level.spawn.x, y: this.level.spawn.y };
    }

    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.setBounds(0, 0, this.level.width, this.level.height + 360);

    this.paintBackdrop();
    this.solids = this.physics.add.staticGroup();
    this.floors = [];
    this.blocks = [];
    this.placeGeometry();
    this.placeProps();

    const spawn = this.run.checkpoint;
    this.player = new Player(this, spawn.x, spawn.y);
    this.groundCollider = this.physics.add.collider(this.player.sprite, this.solids);
    this.bullets = this.physics.add.group({ allowGravity: false });
    this.physics.add.collider(this.bullets, this.solids, (obj) => {
      (obj as Phaser.Physics.Arcade.Sprite).destroy();
    });

    for (const spec of this.level.enemies) {
      const enemy = new Enemy(this, spec);
      this.enemies.push(enemy);
      if (spec.kind !== 'macaw') this.physics.add.collider(enemy.sprite, this.solids);
    }

    this.lightsGfx = this.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
    this.flashGfx = this.add.graphics().setDepth(20).setBlendMode(Phaser.BlendModes.ADD);
    this.lightDefs = this.level.lights;

    this.cameras.main.setBounds(0, 0, this.level.width, this.level.height);
    this.cameras.main.startFollow(this.player.sprite, true, 0.16, 0.16);
    this.cameras.main.setDeadzone(36, 28);
    this.cameras.main.setFollowOffset(-20, 28);
    this.cameras.main.fadeIn(250, 7, 8, 12);

    ui.bind({
      climb: () => this.begin(),
      buy: (id) => this.buy(id),
      closeShop: () => this.closeShop(),
      resume: () => this.closePause(),
      restart: () => {
        ui.hideOverlays();
        this.scene.restart({ fresh: true });
      },
      flare: () => {
        if (this.phase === 'play') ui.toast('The flare gun is for the roof.');
      },
    });

    const debug = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
    if (debug) {
      window.__nazg = {
        goto: (floor: number) => {
          if (this.phase === 'menu') this.begin();
          this.gotoFloor(floor);
        },
        pos: () => ({
          x: Math.round(this.player.sprite.x),
          y: Math.round(this.player.sprite.y),
          floor: this.run.floor,
          hp: this.run.hp,
          phase: this.phase,
        }),
        kill: () => this.enemies.forEach((enemy) => enemy.hurt(99, 1)),
        coins: (n: number) => {
          this.run.coins += n;
        },
        hurt: (n: number) => this.hurtPlayer(n, -1),
        fill: () => {
          this.run.mag = this.run.magSize;
          this.run.reserve += 12;
        },
        status: () => ({
          floor: this.run.floor,
          phase: this.phase,
          x: Math.round(this.player.sprite.x),
          y: Math.round(this.player.sprite.y),
          hp: this.run.hp,
          mag: this.run.mag,
          reserve: this.run.reserve,
          coins: this.run.coins,
          notes: this.run.notes.map((note) => note.id),
          climbing: this.player.climbing,
          reload: this.reload.phase,
          owned: { ...this.run.owned },
          enemies: this.enemies.filter((enemy) => !enemy.dead).length,
        }),
        place: (x: number, y: number) => {
          this.player.place(x, y);
        },
      };
    }

    if (this.run.started) {
      this.phase = 'play';
      ui.hideMenu();
      ui.playMode(true);
      ui.hideTransition();
      this.afterEnter();
    } else {
      this.phase = 'menu';
      this.physics.pause();
      ui.showMenu();
      ui.playMode(false);
    }
    this.syncHud();
  }

  private begin(): void {
    if (this.phase !== 'menu') return;
    this.run.started = true;
    this.phase = 'play';
    this.physics.resume();
    unlockAudio();
    ui.hideMenu();
    ui.playMode(true);
    ui.toast('Sidearm, knife, flare gun. Save the flare for the roof.');
    this.afterEnter();
  }

  private afterEnter(): void {
    const gear = gearLevel(this.run);
    if (this.level.id > gear && !this.run.gearWarned[this.level.id]) {
      this.run.gearWarned[this.level.id] = true;
      this.time.delayedCall(700, () => {
        if (this.phase === 'play') ui.toast('Your gear is light for this floor. The tower does not stop you.');
      });
    }
  }

  update(time: number, delta: number): void {
    if (!this.player) return;
    const dt = Math.min(0.05, delta / 1000);
    const frame = input.consume();
    this.aimUp = (frame.keyUp || frame.joyUp) && !this.player.climbing;
    this.aimDown = (frame.keyDown || frame.joyDown) && !this.player.climbing;
    this.drawLights(time);
    this.drawFlash();

    if (this.routeMenus(frame)) return;
    if (frame.flareEdge && this.phase === 'play') ui.toast('The flare gun is for the roof.');

    if (this.phase !== 'play') return;

    this.groundCollider.active = !this.player.climbing;
    const ladder = this.ladderUnder();
    const stepped = this.player.update(frame, dt, ladder != null, ladder ? ladder.x + ladder.w / 2 : null, this.floors);
    if (stepped) {
      this.stepAcc += 1;
      if (this.stepAcc >= 1) {
        this.stepAcc = 0;
        sfx.step();
      }
    }

    this.cameras.main.setFollowOffset(this.player.facing * -28, 26);

    if (frame.meleeEdge) this.tryMelee();
    if (frame.fireEdge) this.tryFire();
    this.tickReload(dt, frame.reloadEdge);
    this.tickBullets(dt);
    this.tickEnemies(dt);
    this.tickWorld(frame.interactEdge, frame.interactHeld, dt);

    if (this.player.sprite.y > this.level.height + 8) this.down();
    this.syncHud();
  }

  private ladderUnder(): Rect | null {
    const body = this.player.body;
    let best: Rect | null = null;
    let bestDist = 1e9;
    for (const ladder of this.ladders) {
      if (!overlaps(body, ladder, 4)) continue;
      const dist = Math.abs(this.player.sprite.x - (ladder.x + ladder.w / 2));
      if (dist < bestDist) {
        best = ladder;
        bestDist = dist;
      }
    }
    return best;
  }

  private tryMelee(): void {
    if (this.player.meleeCd > 0) return;
    this.player.meleeCd = 0.42;
    sfx.melee();
    const facing = this.player.facing;
    const cx = this.player.sprite.x + facing * 24;
    const cy = this.player.sprite.y - 20;
    this.drawSlash(cx, cy, facing);
    let hit = false;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const point = enemy.eye;
      const touching = rectsTouch(this.player.body, enemy.body);
      const inArc = Math.hypot(point.x - cx, point.y - cy) <= MELEE_REACH + 8;
      if (!touching && !inArc) continue;
      if (!touching && this.wallBetween(this.player.sprite.x, cy, point.x, point.y)) continue;
      enemy.hurt(MELEE_DAMAGE, facing);
      hit = true;
    }
    if (hit) {
      sfx.hit();
      this.cameras.main.shake(40, 0.002);
    }
  }

  private tryFire(): void {
    if (this.reload.phase === 'jammed') {
      ui.toast('Jammed.');
      sfx.dry();
      return;
    }
    if (this.reload.phase === 'active') return;
    if (this.player.fireCd > 0) return;
    if (this.run.mag <= 0) {
      sfx.dry();
      ui.toast(this.run.reserve > 0 ? 'Empty — reload.' : 'No rounds left.');
      if (this.run.reserve > 0) this.startReload();
      return;
    }
    this.run.mag -= 1;
    this.player.fireCd = 0.34;
    const spread = bulletSpread(this.run) + this.player.recoil * 0.16 * recoilScale(this.run);
    let angle = this.player.facing === 1 ? 0 : Math.PI;
    if (this.aimUp) angle += this.player.facing === 1 ? -0.42 : 0.42;
    if (this.aimDown) angle += this.player.facing === 1 ? 0.28 : -0.28;
    angle += (Math.random() * 2 - 1) * spread;
    this.spawnBullet(angle);
    this.player.recoil = Math.min(1.35, this.player.recoil + 0.62 * recoilScale(this.run));
    const silenced = this.run.owned.silencer;
    sfx.gun(silenced);
    this.emitNoise(this.player.sprite.x, this.player.sprite.y - 18, noiseRadius(this.run), silenced ? 0.35 : 1);
    this.cameras.main.shake(70, 0.0045 * recoilScale(this.run));
    this.muzzle(angle);
  }

  private spawnBullet(angle: number): void {
    const x = this.player.sprite.x + Math.cos(angle) * 18;
    const y = this.player.sprite.y - 22 + Math.sin(angle) * 10;
    const bullet = this.bullets.create(x, y, 'bullet') as Phaser.Physics.Arcade.Sprite;
    bullet.setDepth(16);
    bullet.setActive(true);
    bullet.setVisible(true);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(8, 8);
    bullet.setVelocity(Math.cos(angle) * BULLET_SPEED, Math.sin(angle) * BULLET_SPEED);
    bullet.setData('dmg', this.run.gunDamage);
    bullet.setData('life', 0.95);
    bullet.setRotation(angle);
  }

  private tickBullets(dt: number): void {
    const list = this.bullets.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const bullet of list) {
      if (!bullet.active) continue;
      const life = (bullet.getData('life') as number) - dt;
      bullet.setData('life', life);
      if (life <= 0) {
        bullet.destroy();
        continue;
      }
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (rectsTouch(body, enemy.body)) {
          enemy.hurt(bullet.getData('dmg') as number, Math.sign(body.velocity.x) || this.player.facing);
          sfx.hit();
          bullet.destroy();
          break;
        }
      }
    }
  }

  private tickReload(dt: number, tap: boolean): void {
    if (tap && this.reload.phase === 'idle') {
      this.startReload();
      return;
    }
    const result = tickReload(this.reload, dt, tap && this.reload.phase !== 'idle');
    this.reload = result.state;
    if (result.event === 'perfect' || result.event === 'normal') {
      this.fillMag();
      if (result.event === 'perfect') {
        sfx.perfect();
        ui.toast('Clean.');
      }
    } else if (result.event === 'jam') {
      sfx.jam();
      ui.toast('Jammed.');
      this.cameras.main.shake(140, 0.007);
    }
    if (this.reload.phase === 'active') ui.setReload(reloadProgress(this.reload), false);
    else if (this.reload.phase === 'jammed') ui.setReload(1 - this.reload.t / JAM_DURATION, true);
    else ui.setReload(null, false);
  }

  private startReload(): void {
    if (this.run.reserve <= 0) {
      ui.toast('No rounds left.');
      sfx.dry();
      return;
    }
    if (this.run.mag >= this.run.magSize) return;
    if (!this.run.reloadTaught) {
      this.run.reloadTaught = true;
      ui.toast('Tap reload in the green. A miss jams the gun. Waiting the bar out is slow, and safe.');
    }
    this.reload = beginReload(this.reload);
    sfx.reloadTick();
  }

  private fillMag(): void {
    const need = this.run.magSize - this.run.mag;
    const take = Math.min(need, this.run.reserve);
    this.run.mag += take;
    this.run.reserve -= take;
  }

  private tickEnemies(dt: number): void {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    for (const enemy of this.enemies) {
      const event = enemy.update(dt, px, py, this.floors, this.blocks);
      if (!enemy.dead && enemy.sprite.y > this.level.height) enemy.hurt(99, 1);
      if (event.screech) {
        sfx.screech();
        this.emitNoise(enemy.sprite.x, enemy.sprite.y, MACAW_NOISE, 0.7);
        this.floatText(enemy.sprite.x, enemy.sprite.y - 28, 'SCREE', '#e0b15a');
      }
      if (enemy.dead || enemy.touchCd > 0 || this.player.iframes > 0) continue;
      if (rectsTouch(this.player.body, enemy.body)) {
        enemy.touchCd = 0.75;
        const sign = Math.sign(this.player.sprite.x - enemy.sprite.x);
        const dir = sign !== 0 ? sign : enemy.sprite.flipX ? -1 : 1;
        this.hurtPlayer(1, dir);
      }
    }
  }

  private tickWorld(interactEdge: boolean, interactHeld: boolean, dt: number): void {
    const body = this.player.body;

    for (const pit of this.pits) {
      if (overlaps(body, pit)) {
        this.down();
        return;
      }
    }
    for (const spike of this.spikes) {
      if (overlaps(body, spike)) this.hurtPlayer(1, this.player.facing * -1 || -1);
    }

    for (const pickup of this.pickups) {
      if (pickup.taken) continue;
      if (!overlaps(body, pickup.rect, 2)) continue;
      pickup.taken = true;
      pickup.sprite.destroy();
      if (pickup.kind === 'note' && pickup.id && pickup.text) {
        if (!this.run.notes.some((note) => note.id === pickup.id)) {
          this.run.notes.push({ id: pickup.id, text: pickup.text, floor: this.level.id });
        }
        ui.showEcho(pickup.text);
        sfx.pickup();
      } else if (pickup.kind === 'coin' && pickup.amount) {
        this.run.coins += pickup.amount;
        this.floatText(pickup.rect.x, pickup.rect.y, `+${pickup.amount}`, '#e0b15a');
        sfx.pickup();
      } else if (pickup.kind === 'medkit' && pickup.heal) {
        this.run.hp = Math.min(this.run.maxHp, this.run.hp + pickup.heal);
        this.floatText(pickup.rect.x, pickup.rect.y, 'stitched', '#d7cbb8');
        sfx.pickup();
      }
    }

    for (const mark of this.checkpoints) {
      if (!overlaps(body, mark.rect)) continue;
      if (this.run.checkpoint.x !== mark.x || this.run.checkpoint.floor !== this.level.id) {
        this.run.checkpoint = { floor: this.level.id, x: mark.x, y: mark.y };
      }
    }

    let prompt: string | null = null;
    if (this.shopRect && overlaps(body, this.shopRect, 6)) {
      prompt = `${input.label('interact')}  ·  vending cache`;
      if (interactEdge) this.openShop();
    }

    for (const terminal of this.terminals) {
      const door = this.doors.find((entry) => entry.id === terminal.doorId);
      if (!door || door.open) {
        terminal.bar.setVisible(false);
        continue;
      }
      const near = overlaps(body, terminal.rect, 8);
      if (near && !prompt) prompt = `Hold ${input.label('interact')}  ·  bypass lock`;
      if (near && interactHeld) terminal.charge = Math.min(1, terminal.charge + dt / 1.15);
      else terminal.charge = Math.max(0, terminal.charge - dt * 1.8);
      terminal.bar.setVisible(terminal.charge > 0.02);
      terminal.bar.width = 36 * terminal.charge;
      if (terminal.charge >= 1) this.openDoor(door);
    }

    if (this.crumbleRect && this.crumbleSprite && !this.collapsed) {
      const rect = this.crumbleRect;
      const feet = this.player.sprite.y;
      const x = this.player.sprite.x;
      const onTop = x > rect.x + 6 && x < rect.x + rect.w - 6 && feet >= rect.y - 6 && feet <= rect.y + 10;
      if (onTop) this.startCollapse();
    }

    for (const exit of this.exits) {
      if (overlaps(body, exit, 0)) {
        this.gotoFloor(this.level.id + 1);
        return;
      }
    }

    ui.setPrompt(prompt);
  }

  private startCollapse(): void {
    if (this.collapsed || !this.crumbleSprite || !this.crumbleRect) return;
    this.collapsed = true;
    this.run.crumbled = true;
    this.run.checkpoint = { floor: 3, x: 1360, y: 1000 };
    sfx.collapse();
    this.cameras.main.shake(460, 0.008);
    ui.toast('The floor gives way. Everything you carried comes with you.');
    const sprite = this.crumbleSprite;
    const rect = this.crumbleRect;
    this.time.delayedCall(360, () => {
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody | null;
      if (body) body.enable = false;
      this.floors = this.floors.filter((entry) => entry !== rect);
      this.blocks = this.blocks.filter((entry) => entry !== rect);
      this.tweens.add({
        targets: sprite,
        y: sprite.y + 260,
        alpha: 0,
        duration: 520,
        onComplete: () => sprite.destroy(),
      });
    });
  }

  private openDoor(door: LiveDoor): void {
    if (door.open) return;
    door.open = true;
    const body = door.sprite.body as Phaser.Physics.Arcade.StaticBody | null;
    if (body) body.enable = false;
    this.blocks = this.blocks.filter((entry) => entry !== door.rect);
    this.tweens.add({ targets: door.sprite, y: door.sprite.y - 74, alpha: 0, duration: 280 });
    for (const enemy of this.enemies) {
      if (enemy.behindDoor === door.id) enemy.wake();
    }
    sfx.perfect();
    ui.toast('Lock bypassed. They were waiting.');
  }

  private openShop(): void {
    this.phase = 'shop';
    this.physics.pause();
    this.player.sprite.setVelocity(0, 0);
    ui.setPrompt(null);
    ui.showShop(this.run, this.level.spendLimit);
  }

  private closeShop(): void {
    if (this.phase !== 'shop') return;
    this.phase = 'play';
    this.physics.resume();
    ui.hideShop();
  }

  private buy(id: ItemId): void {
    const result = attemptPurchase(this.run, id, this.level.spendLimit);
    ui.shopMessage(result.ok ? 'Taken from the cache.' : (result.reason ?? 'No.'));
    if (result.ok) sfx.pickup();
    else sfx.dry();
    ui.refreshShop(this.run, this.level.spendLimit);
    this.syncHud();
  }

  /**
   * Pad menus share A / B / Menu with jump, use, and pause.
   * Handled before gameplay so a confirm doesn't also fire a shot.
   */
  private routeMenus(frame: { jumpEdge: boolean; interactEdge: boolean; pauseEdge: boolean; navEdge: -1 | 0 | 1 }): boolean {
    const pad = input.device === 'pad';
    if (pad && this.phase === 'menu' && (frame.jumpEdge || frame.pauseEdge)) {
      this.begin();
      return true;
    }
    if (pad && this.phase === 'ending' && (frame.jumpEdge || frame.pauseEdge)) {
      ui.hideOverlays();
      this.scene.restart({ fresh: true });
      return true;
    }
    if (pad && this.phase === 'shop') {
      if (frame.navEdge !== 0) ui.nudgeShop(frame.navEdge);
      if (frame.jumpEdge) ui.confirmShop();
      if (frame.interactEdge || frame.pauseEdge) this.closeShop();
      return true;
    }
    if (pad && this.phase === 'pause' && (frame.jumpEdge || frame.interactEdge)) {
      this.closePause();
      return true;
    }
    if (frame.pauseEdge) {
      const playing = this.phase === 'play';
      this.onPause();
      return playing || this.phase !== 'play';
    }
    return this.phase !== 'play';
  }

  private onPause(): void {
    if (this.phase === 'shop') {
      this.closeShop();
      return;
    }
    if (this.phase === 'pause') {
      this.closePause();
      return;
    }
    if (this.phase !== 'play') return;
    this.phase = 'pause';
    this.physics.pause();
    ui.showPause(this.run.notes);
  }

  private closePause(): void {
    if (this.phase !== 'pause') return;
    this.phase = 'play';
    this.physics.resume();
    ui.hidePause();
  }

  private hurtPlayer(amount: number, dir: number): void {
    if (this.phase !== 'play' || this.player.iframes > 0) return;
    this.run.hp -= amount;
    this.player.iframes = IFRAME_TIME;
    this.player.body.setVelocity(dir * 170, -160);
    sfx.hurt();
    ui.flashHurt();
    this.cameras.main.shake(90, 0.006);
    if (this.run.hp <= 0) this.down();
  }

  private down(): void {
    if (this.phase !== 'play') return;
    this.phase = 'down';
    this.run.hp = 0;
    ui.setPrompt(null);
    ui.flashHurt();
    this.time.delayedCall(380, () => {
      if (this.phase !== 'down') return;
      const mark = this.run.checkpoint;
      this.player.place(mark.x, mark.y);
      this.run.hp = this.run.maxHp;
      this.player.iframes = 1.15;
      this.reload = idleReload();
      ui.setReload(null, false);
      this.phase = 'play';
      this.cameras.main.flash(180, 20, 8, 8);
    });
  }

  private gotoFloor(next: number): void {
    if (this.transitioning || (this.phase !== 'play' && this.phase !== 'menu')) return;
    if (next > 3) {
      this.ending();
      return;
    }
    this.transitioning = true;
    this.phase = 'transition';
    this.physics.pause();
    ui.setPrompt(null);
    const level = getLevel(next);
    this.run.floor = next;
    this.run.hp = this.run.maxHp;
    this.run.checkpoint = { floor: next, x: level.spawn.x, y: level.spawn.y };
    void ui.showTransition(level.name, level.enter).then(() => {
      this.scene.restart({ floor: next });
    });
  }

  private ending(): void {
    if (this.phase === 'ending') return;
    this.phase = 'ending';
    this.physics.pause();
    ui.playMode(false);
    ui.setPrompt(null);
    ui.showEnding(this.run);
  }

  private emitNoise(x: number, y: number, radius: number, alpha: number): void {
    const ring = this.add.circle(x, y, 6, 0xf0d7a2, 0.18 * alpha);
    ring.setDepth(18);
    this.tweens.add({
      targets: ring,
      scale: Math.max(2, radius / 18),
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (Math.hypot(enemy.sprite.x - x, enemy.sprite.y - y) <= radius) enemy.hear(x);
    }
  }

  private wallBetween(x1: number, y1: number, x2: number, y2: number): boolean {
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      for (const rect of this.blocks) {
        if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return true;
      }
    }
    return false;
  }

  private syncHud(): void {
    ui.setHud({
      floor: this.level.name,
      hp: this.run.hp,
      maxHp: this.run.maxHp,
      mag: this.run.mag,
      reserve: this.run.reserve,
      coins: this.run.coins,
      silenced: this.run.owned.silencer,
      power: this.run.owned.power,
      compensated: this.run.owned.compensator,
      notes: this.run.notes.length,
    });
  }

  private paintBackdrop(): void {
    const { width, height, id } = this.level;
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(id === 3 ? 0x120e12 : 0x10131a, 1);
    g.fillRect(0, 0, width, height);
    const rand = mulberry32(id * 97 + 3);
    for (let x = 40; x < width; x += 150 + Math.floor(rand() * 80)) {
      const wh = 36 + Math.floor(rand() * 30);
      const wy = 70 + Math.floor(rand() * Math.max(40, height * 0.25));
      g.fillStyle(0x1a2838, 0.55);
      g.fillRect(x, wy, 28, wh);
      g.fillStyle(0x0b0e14, 0.8);
      g.fillRect(x + 12, wy, 2, wh);
    }
    for (let x = 20; x < width; x += 90) {
      if (rand() > 0.45) continue;
      g.fillStyle(0x1a1e28, 0.9);
      g.fillRect(x, 0, 3, height);
    }
    const label = this.add
      .text(28, 36, `0${id}`, {
        fontFamily: 'Georgia, serif',
        fontSize: '64px',
        color: '#1c2230',
      })
      .setDepth(1)
      .setAlpha(0.9);
    label.setResolution(2);

    for (const pit of this.level.pits) {
      const hole = this.add.rectangle(pit.x + pit.w / 2, pit.y + pit.h / 2, pit.w + 6, pit.h, 0x05060a);
      hole.setDepth(1);
      const teeth = this.add.graphics().setDepth(2);
      teeth.fillStyle(0x6e2424, 1);
      const n = Math.max(1, Math.floor(pit.w / 14));
      for (let i = 0; i < n; i++) {
        const x = pit.x + i * (pit.w / n);
        const w = pit.w / n;
        teeth.fillTriangle(x, pit.y + 28, x + w / 2, pit.y + 8, x + w, pit.y + 28);
      }
    }
  }

  private placeGeometry(): void {
    const lip = this.level.id === 3 ? 0x6a3838 : this.level.id === 2 ? 0x4a4038 : 0x3e4658;
    const fill = this.level.id === 3 ? 0x241c22 : this.level.id === 2 ? 0x292428 : 0x232733;
    for (const rect of this.level.platforms) this.addBlock(rect, fill, lip, true);
    for (const rect of this.level.walls) this.addBlock(rect, 0x2c313c, 0x465066, false);
    for (const rect of this.level.doors) {
      const sprite = this.addBlock(rect, 0x3a2a24, 0xd7a15f, false);
      this.doors.push({ id: rect.id, rect, sprite, open: false });
    }
    if (this.level.crumble && !this.collapsed) {
      const rect = this.level.crumble;
      this.crumbleRect = rect;
      this.crumbleSprite = this.addBlock(rect, 0x3a2428, 0x8a4038, true);
      const cracks = this.add.graphics().setDepth(7);
      cracks.lineStyle(1, 0x2a1418, 0.9);
      cracks.beginPath();
      cracks.moveTo(rect.x + 20, rect.y + 4);
      cracks.lineTo(rect.x + rect.w * 0.4, rect.y + 18);
      cracks.lineTo(rect.x + rect.w * 0.7, rect.y + 6);
      cracks.lineTo(rect.x + rect.w - 16, rect.y + 16);
      cracks.strokePath();
    } else if (this.level.crumble && this.collapsed) {
      this.run.checkpoint = { floor: 3, x: 1360, y: 1000 };
    }

    this.ladders = this.level.ladders.map((rect) => ({ ...rect }));
    const ladders = this.add.graphics().setDepth(4);
    ladders.lineStyle(2, 0x5c5348, 1);
    for (const ladder of this.ladders) {
      ladders.strokeRect(ladder.x + 4, ladder.y, 2, ladder.h);
      ladders.strokeRect(ladder.x + ladder.w - 6, ladder.y, 2, ladder.h);
      const rungs = Math.floor(ladder.h / 14);
      for (let i = 0; i < rungs; i++) {
        const y = ladder.y + 6 + i * 14;
        ladders.lineBetween(ladder.x + 4, y, ladder.x + ladder.w - 4, y);
      }
    }

    const spikes = this.add.graphics().setDepth(7);
    spikes.fillStyle(0x8a3030, 1);
    for (const rect of this.level.spikes) {
      this.spikes.push(rect);
      const n = Math.max(1, Math.floor(rect.w / 12));
      for (let i = 0; i < n; i++) {
        const x = rect.x + i * (rect.w / n);
        const w = rect.w / n;
        spikes.fillTriangle(x, rect.y + rect.h, x + w / 2, rect.y, x + w, rect.y + rect.h);
      }
    }
    this.pits = this.level.pits;
    this.exits = this.level.exits;
    for (const mark of this.level.checkpoints) {
      this.checkpoints.push({
        x: mark.x,
        y: mark.y,
        rect: { x: mark.x - 18, y: mark.y - 48, w: 36, h: 52 },
      });
    }

    for (const exit of this.exits) {
      const frame = this.add.rectangle(exit.x + exit.w / 2, exit.y + exit.h / 2, exit.w, 3, 0x6a5a44, 0.8);
      frame.setDepth(6);
    }
  }

  private addBlock(rect: Rect, fill: number, lip: number, walkable: boolean): Phaser.GameObjects.Rectangle {
    const block = this.add.rectangle(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h, fill);
    block.setDepth(5);
    this.physics.add.existing(block, true);
    const body = block.body as Phaser.Physics.Arcade.StaticBody;
    body.updateFromGameObject();
    this.solids.add(block);
    const edge = this.add.rectangle(rect.x + rect.w / 2, rect.y + 1.5, rect.w, 3, lip);
    edge.setDepth(6);
    this.blocks.push(rect);
    if (walkable) this.floors.push(rect);
    return block;
  }

  private placeProps(): void {
    for (const note of this.level.notes) {
      const sprite = this.add.sprite(note.x, note.y, 'note').setOrigin(0.5, 1).setDepth(8);
      this.tweens.add({ targets: sprite, y: note.y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.pickups.push({
        kind: 'note',
        sprite,
        id: note.id,
        text: note.text,
        taken: false,
        rect: { x: note.x - 12, y: note.y - 28, w: 24, h: 30 },
      });
    }
    for (const coin of this.level.coins) {
      const sprite = this.add.sprite(coin.x, coin.y - 16, 'coin').setDepth(8);
      this.tweens.add({ targets: sprite, angle: 20, duration: 700, yoyo: true, repeat: -1 });
      this.pickups.push({
        kind: 'coin',
        sprite,
        amount: coin.amount,
        taken: false,
        rect: { x: coin.x - 12, y: coin.y - 32, w: 24, h: 28 },
      });
    }
    for (const kit of this.level.medkits) {
      const sprite = this.add.sprite(kit.x, kit.y, 'medkit').setOrigin(0.5, 1).setDepth(8);
      this.pickups.push({
        kind: 'medkit',
        sprite,
        heal: kit.heal,
        taken: false,
        rect: { x: kit.x - 12, y: kit.y - 24, w: 24, h: 26 },
      });
    }
    if (this.level.shop) {
      const shop = this.level.shop;
      this.add.sprite(shop.x, shop.y, 'vending').setOrigin(0.5, 1).setDepth(8);
      this.shopRect = { x: shop.x - 28, y: shop.y - 64, w: 60, h: 68 };
    }
    for (const terminal of this.level.terminals) {
      this.add.sprite(terminal.x, terminal.y, 'terminal').setOrigin(0.5, 1).setDepth(8);
      const bar = this.add.rectangle(terminal.x, terminal.y - 40, 4, 4, 0x9cbc6a).setOrigin(0, 0.5).setDepth(9);
      bar.setVisible(false);
      this.terminals.push({
        doorId: terminal.doorId,
        charge: 0,
        bar,
        rect: { x: terminal.x - 20, y: terminal.y - 40, w: 44, h: 44 },
      });
    }
    for (const sign of this.level.signs) {
      const text = this.add
        .text(sign.x, sign.y, sign.text, {
          fontFamily: 'Georgia, serif',
          fontSize: '11px',
          color: '#cbb892',
        })
        .setOrigin(0.5, 1)
        .setDepth(9);
      text.setResolution(2);
    }
  }

  private drawLights(time: number): void {
    const g = this.lightsGfx;
    if (!g) return;
    g.clear();
    for (const light of this.lightDefs) {
      const flick = light.flicker ? 0.65 + Math.sin(time / 90 + light.x) * 0.35 : 1;
      g.fillStyle(light.color, 0.055 * flick);
      g.fillCircle(light.x, light.y, light.radius);
    }
    if (this.player) {
      g.fillStyle(0xffe2b0, 0.05);
      g.fillCircle(this.player.sprite.x, this.player.sprite.y - 20, 70);
    }
  }

  private drawFlash(): void {
    const g = this.flashGfx;
    if (!g || !this.player) return;
    g.clear();
    const dir = this.player.facing;
    const x = this.player.sprite.x + dir * 8;
    const y = this.player.sprite.y - 22;
    g.fillStyle(0xffd7a2, 0.045);
    g.beginPath();
    g.moveTo(x, y);
    const spread = this.aimUp ? -0.5 : this.aimDown ? 0.32 : 0;
    const base = dir === 1 ? spread : Math.PI - spread;
    g.lineTo(x + Math.cos(base - 0.28) * 96, y + Math.sin(base - 0.28) * 96);
    g.lineTo(x + Math.cos(base + 0.28) * 96, y + Math.sin(base + 0.28) * 96);
    g.closePath();
    g.fillPath();
  }

  private drawSlash(x: number, y: number, facing: number): void {
    const g = this.add.graphics().setDepth(17);
    g.lineStyle(2, 0xe6e0d6, 0.85);
    g.beginPath();
    g.arc(x - facing * 8, y, 18, facing === 1 ? -0.8 : Math.PI - 0.5, facing === 1 ? 0.9 : Math.PI + 0.8, false);
    g.strokePath();
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 120,
      onComplete: () => g.destroy(),
    });
  }

  private muzzle(angle: number): void {
    const x = this.player.sprite.x + Math.cos(angle) * 20;
    const y = this.player.sprite.y - 22 + Math.sin(angle) * 8;
    const flash = this.add.circle(x, y, this.run.owned.silencer ? 3 : 6, 0xf0d7a2, 0.9).setDepth(17);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.8, duration: 60, onComplete: () => flash.destroy() });
  }

  private floatText(x: number, y: number, message: string, color: string): void {
    const text = this.add
      .text(x, y, message, { fontFamily: 'Georgia, serif', fontSize: '12px', color })
      .setOrigin(0.5, 1)
      .setDepth(30);
    text.setResolution(2);
    this.tweens.add({
      targets: text,
      y: y - 18,
      alpha: 0,
      duration: 700,
      onComplete: () => text.destroy(),
    });
  }
}

function rectsTouch(a: Phaser.Physics.Arcade.Body, b: Phaser.Physics.Arcade.Body): boolean {
  return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}
