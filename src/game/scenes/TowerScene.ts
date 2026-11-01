import Phaser from 'phaser';
import { playClip, playMusic, sfx, unlockAudio } from '../audio';
import { paletteFor } from '../palette';
import { saveSettings, settings } from '../settings';
import { BULLET_SPEED, GRAVITY, IFRAME_TIME, MACAW_NOISE, ROOF_FLOOR } from '../balance';
import { ATLAS, createTextures } from '../textures';
import { Enemy } from '../entities/enemy';
import { Player } from '../entities/player';
import { input } from '../input';
import { getLevel } from '../levels';
import { RELOAD_DURATION, RELOAD_WINDOW, beginReload, idleReload, JAM_DURATION, reloadProgress, tickReload, type ReloadState } from '../reload';
import { attemptPurchase, type ItemId } from '../shop';
import { clearFloorBuffs, STEADY_WINDOW } from '../powerups';
import { GEAR_IDS, clearSlot as dropSlot, equip, gearDef, grantGear, iframeBonus, incomingDamage, slotLabel, speedScale, useHealthItem, type GearId, type Slot } from '../gear';
import { hone, strike, type MeleeWeapon } from '../knife';
import { bulletSpread, createRun, gearLevel, noiseRadius, recoilScale, type RunState } from '../state';
import type { CampStationId, LevelData, Rect } from '../types';
import {
  DEATH_PITY,
  HATCH_BONUS,
  addSalvage,
  buyStation,
  campTier,
  maxUnlockedFloor,
  metaState,
  resetMeta,
  salvageFromClear,
  salvageFromCoins,
  saveMeta,
  widenedWindow,
  type StationId,
} from '../meta';
import { ui } from '../../ui/ui';

type Phase = 'menu' | 'play' | 'shop' | 'wager' | 'pause' | 'gear' | 'station' | 'notices' | 'transition' | 'down' | 'dead' | 'ending';

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
  kind: 'note' | 'coin' | 'medkit' | 'stone' | 'gear';
  rect: Rect;
  sprite: Phaser.GameObjects.Sprite;
  id?: string;
  text?: string;
  amount?: number;
  heal?: number;
  gearId?: GearId;
  taken: boolean;
  bob: number;
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
  private challengeRect: Rect | null = null;
  private storm = 8;
  private dust: Phaser.GameObjects.Arc[] = [];
  private crumbleRect: Rect | null = null;
  private crumbleSprite: Phaser.GameObjects.Rectangle | null = null;
  private collapsed = false;
  private groundCollider!: Phaser.Physics.Arcade.Collider;
  private bullets!: Phaser.Physics.Arcade.Group;
  private spareBullets: Phaser.Physics.Arcade.Sprite[] = [];
  private reload: ReloadState = idleReload();
  private helmCd = 0;
  private steamT = 0;
  private hudClock = 0;
  private staticLights!: Phaser.GameObjects.Graphics;
  private flickerLights: LevelData['lights'] = [];
  private stepAcc = 0;
  private aimUp = false;
  private aimDown = false;
  private lightsGfx!: Phaser.GameObjects.Graphics;
  private flashGfx!: Phaser.GameObjects.Graphics;
  private lightDefs: LevelData['lights'] = [];
  private transitioning = false;
  private campStations: { id: CampStationId; rect: Rect }[] = [];

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

    if (!this.textures.exists(ATLAS)) createTextures(this);
    this.build();
  }

  private build(): void {
    this.level = getLevel(this.run.floor, {
      seed: this.run.seed,
      seenNotes: this.run.notes.map((note) => note.id),
      campTier: campTier(metaState()),
    });
    if (this.level.builtSeed != null) this.run.builtSeed = this.level.builtSeed;
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
    this.staticLights = this.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
    this.flashGfx = this.add.graphics().setDepth(20).setBlendMode(Phaser.BlendModes.ADD);
    this.lightDefs = this.level.lights;
    this.flickerLights = this.level.lights.filter((light) => light.flicker && !light.dead);
    this.paintStaticLights();

    const palette = paletteFor(this.level.id);
    this.cameras.main.setBackgroundColor(palette.bg);
    document.body.style.background = palette.bg;
    this.cameras.main.setBounds(0, 0, this.level.width, this.level.height);
    this.cameras.main.startFollow(this.player.sprite, true, 0.16, 0.16);
    this.cameras.main.setDeadzone(36, 28);
    this.cameras.main.setFollowOffset(-20, 28);
    this.cameras.main.fadeIn(250, 7, 8, 12);

    ui.bind({
      climb: () => this.startClimb(),
      applySeed: (seed) => this.applySeed(seed),
      replayIntro: () => {
        ui.hideSettings();
        ui.showIntro(true, () => {
          settings.introSeen = true;
          saveSettings(settings);
        });
      },
      buy: (id) => this.buy(id),
      closeShop: () => this.closeShop(),
      closeWager: () => this.closeWager(),
      resume: () => this.closePause(),
      restart: () => {
        ui.hideOverlays();
        this.scene.restart({ fresh: true });
      },
      flare: () => this.tryFlare(),
      openGear: () => this.openGear(),
      closeGear: () => this.closeGear(),
      equip: (id) => this.wear(id),
      clearSlot: (slot) => this.takeOff(slot),
      useHealth: () => this.useHealth(),
      buyStation: (id) => this.improveStation(id),
      closeStation: () => this.closeStation(),
      showNotices: () => this.openNotices(),
      returnToCamp: () => this.returnToCamp(),
      resetProgress: () => this.resetProgress(),
      noticeSettings: () => {
        this.closeNotices();
        ui.showSettings();
      },
      noticeControls: () => {
        this.closeNotices();
        ui.showControls();
      },
      noticeCredits: () => {
        this.closeNotices();
        ui.showCredits();
      },
      leaveClimb: () => {
        if (this.level.id <= 1) {
          ui.toast('You are already in the lobby.');
          return;
        }
        this.endRun('leave');
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
          challenge: this.level.challenge,
          seed: this.run.builtSeed ?? this.run.seed,
        }),
        place: (x: number, y: number) => {
          this.player.place(x, y);
        },
        seed: () => this.run.builtSeed ?? this.run.seed,
        setSeed: (seed: number) => this.applySeed(seed),
        openShop: () => this.openShop(),
        openGear: () => this.openGear(),
        setKnife: (n: number) => {
          this.run.knife = n;
          this.syncHud();
        },
        setHp: (n: number) => {
          this.run.hp = n;
          this.syncHud();
        },
        give: (id: string) => {
          if ((GEAR_IDS as string[]).includes(id)) grantGear(this.run, id as GearId);
        },
        setSalvage: (n: number) => {
          const meta = metaState();
          meta.salvage = n;
          saveMeta(meta);
          this.syncHud();
        },
        setStations: (n: number) => {
          const meta = metaState();
          const level = Math.max(0, Math.min(3, n));
          meta.stations.workbench = level;
          meta.stations.armory = level;
          meta.stations.infirmary = level;
          meta.stations.radio = level;
          saveMeta(meta);
          this.run.started = true;
          this.run.floor = 1;
          this.scene.restart({ floor: 1 });
        },
        openStation: (id: string) => this.openStation(id as StationId),
        die: () => this.endRun('dead'),
        pocket: (n: number) => {
          this.run.salvageEarned += n;
          addSalvage(n);
        },
      };
    }

    ui.hideMenu();
    if (this.run.started) {
      this.phase = 'play';
      ui.playMode(true);
      ui.hideTransition();
      this.afterEnter();
      this.syncMusic();
    } else if (!settings.introSeen) {
      this.phase = 'menu';
      this.physics.pause();
      ui.playMode(false);
      ui.showIntro(false, () => {
        settings.introSeen = true;
        saveSettings(settings);
        this.begin();
      });
    } else {
      this.begin();
    }
    this.syncHud();
  }

  private startClimb(): void {
    if (this.phase !== 'menu') return;
    this.begin();
  }

  private syncMusic(): void {
    if (this.level.id <= 1) playMusic('camp');
    else if (this.level.id >= 16) playMusic('hatch');
    else playMusic('climb');
  }

  private applySeed(seed: number): void {
    const next = Math.floor(seed);
    if (!Number.isFinite(next)) return;
    this.run.seed = next;
    settings.seed = next;
    saveSettings(settings);
    if (this.level.id >= 4) this.scene.restart({ floor: this.level.id });
  }

  private mood(dt: number): void {
    document.body.classList.toggle('low-fx', settings.lowEffects);
    this.hudClock += dt;
    const stride = settings.lowEffects ? 0.12 : 0.05;
    if (this.hudClock < stride) return;
    this.hudClock = 0;
    const canvas = this.game.canvas.getBoundingClientRect();
    const cam = this.cameras.main;
    const scaleX = canvas.width / cam.width;
    const scaleY = canvas.height / cam.height;
    const lx = canvas.left + (this.player.sprite.x - cam.scrollX) * scaleX;
    const ly = canvas.top + (this.player.sprite.y - 22 - cam.scrollY) * scaleY;
    const root = document.documentElement;
    root.style.setProperty('--lx', `${lx}px`);
    root.style.setProperty('--ly', `${ly}px`);
    if (!settings.lowEffects) {
      const dark = 0.94 - settings.brightness * 0.5;
      root.style.setProperty('--dark', dark.toFixed(3));
      let threat = 1 - this.run.hp / this.run.maxHp;
      const px = this.player.sprite.x;
      const py = this.player.sprite.y;
      for (const enemy of this.enemies) {
        if (enemy.dead || !enemy.sprite.visible) continue;
        const dist = Math.hypot(enemy.sprite.x - px, enemy.sprite.y - py);
        if (dist > 190) continue;
        threat = Math.max(threat, 1 - dist / 190);
      }
      const vignette = document.getElementById('vignette');
      vignette?.style.setProperty('--threat', threat.toFixed(3));
      vignette?.classList.toggle('pulse', threat > 0.42);
      this.storm -= stride;
      if (this.storm <= 0) {
        this.storm = 14 + Math.random() * 16;
        document.getElementById('lightning')?.classList.add('flash');
        playClip('thunder', 0.28);
        window.setTimeout(() => document.getElementById('lightning')?.classList.remove('flash'), 160);
      }
      for (const mote of this.dust) {
        mote.y -= 6 * stride;
        if (mote.y < cam.scrollY - 20) {
          mote.y = cam.scrollY + cam.height + 10;
          mote.x = cam.scrollX + Math.random() * cam.width;
        }
      }
    }
  }

  private slipLadders(): void {
    if (this.level.id < 4 || !this.player.climbing) return;
    const near = this.enemies.some((enemy) => {
      if (enemy.dead || enemy.kind !== 'undead') return false;
      return Math.hypot(enemy.sprite.x - this.player.sprite.x, enemy.sprite.y - this.player.sprite.y) < 150;
    });
    if (!near) return;
    this.player.slipLock = 0.7;
    this.player.climbing = false;
    this.player.body.setAllowGravity(true);
    this.hurtPlayer(1, this.player.facing * -1 || -1);
    this.player.body.setVelocityY(120);
    ui.toast('The rung gives. Something is too close.');
  }

  private openWager(): void {
    this.phase = 'wager';
    this.physics.pause();
    this.player.sprite.setVelocity(0, 0);
    ui.setPrompt(null);
    ui.showWager();
  }

  private closeWager(): void {
    if (this.phase !== 'wager') return;
    this.phase = 'play';
    this.physics.resume();
    ui.hideWager();
  }

  private begin(): void {
    this.run.started = true;
    this.phase = 'play';
    this.physics.resume();
    unlockAudio();
    ui.hideMenu();
    ui.playMode(true);
    this.syncMusic();
    if (this.level.id <= 1) {
      const meta = metaState();
      if (!meta.tutorialSeen) {
        meta.tutorialSeen = true;
        saveMeta(meta);
        ui.toast('The lobby is empty. Stations take salvage. The stairs on the right start a climb.');
      }
    } else {
      ui.toast('Sidearm, knife, flare gun. Salvage stays if you fall. The gear does not.');
    }
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

    if (frame.gearEdge && (this.phase === 'play' || this.phase === 'pause')) {
      this.openGear();
      return;
    }
    if (this.routeMenus(frame)) return;
    if (frame.flareEdge && this.phase === 'play') this.tryFlare();

    if (this.phase !== 'play') return;

    this.mood(dt);
    this.tickBuffs(dt);
    this.slipLadders();
    this.groundCollider.active = !this.player.climbing;
    const ladder = this.ladderUnder();
    const stepped = this.player.update(
      frame,
      dt,
      ladder != null,
      ladder ? ladder.x + ladder.w / 2 : null,
      this.floors,
      speedScale(this.run.loadout, this.run.buffs.adrenaline),
    );
    if (this.player.landed > 0) {
      if (!this.run.buffs.rubber) this.emitNoise(this.player.sprite.x, this.player.sprite.y, 150, 0.45);
      this.player.landed = 0;
    }
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

  private meleeWeapon(): MeleeWeapon {
    const id = this.run.loadout.weapon;
    if (id === 'hatchet' || id === 'pipe') return id;
    return 'knife';
  }

  private tryMelee(): void {
    if (this.player.meleeCd > 0) return;
    const blow = strike({
      durability: this.run.knife,
      weapon: this.meleeWeapon(),
      sharpened: this.run.buffs.sharpened,
      roll: Math.random(),
      wearScale: this.run.wearScale,
    });
    this.run.knife = blow.durability;
    this.player.meleeCd = blow.cooldown;
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
      const inArc = Math.hypot(point.x - cx, point.y - cy) <= blow.reach + 8;
      if (!touching && !inArc) continue;
      if (!touching && this.wallBetween(this.player.sprite.x, cy, point.x, point.y)) continue;
      if (blow.damage > 0) enemy.hurt(blow.damage, facing);
      hit = true;
    }
    if (blow.glanced) ui.toast(this.run.knife < 30 ? 'The knife is dull.' : 'The edge skates off.');
    if (hit && blow.damage > 0) {
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
    let bullet = this.spareBullets.pop();
    if (!bullet) {
      bullet = this.bullets.create(x, y, ATLAS, 'bullet') as Phaser.Physics.Arcade.Sprite;
      bullet.setDepth(16);
    } else {
      bullet.enableBody(true, x, y, true, true);
    }
    bullet.setActive(true);
    bullet.setVisible(true);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setSize(8, 8);
    bullet.setVelocity(Math.cos(angle) * BULLET_SPEED, Math.sin(angle) * BULLET_SPEED);
    bullet.setData('dmg', this.run.gunDamage + (this.run.buffs.hollow ? 1 : 0));
    bullet.setData('life', 0.95);
    bullet.setRotation(angle);
  }

  private releaseBullet(bullet: Phaser.Physics.Arcade.Sprite): void {
    bullet.disableBody(true, true);
    this.spareBullets.push(bullet);
  }

  private tickBullets(dt: number): void {
    const list = this.bullets.getChildren() as Phaser.Physics.Arcade.Sprite[];
    for (const bullet of list) {
      if (!bullet.active) continue;
      const life = (bullet.getData('life') as number) - dt;
      bullet.setData('life', life);
      if (life <= 0) {
        this.releaseBullet(bullet);
        continue;
      }
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (rectsTouch(body, enemy.body)) {
          enemy.hurt(bullet.getData('dmg') as number, Math.sign(body.velocity.x) || this.player.facing);
          sfx.hit();
          this.releaseBullet(bullet);
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
    const duration = RELOAD_DURATION * this.run.reloadScale;
    const sweet = widenedWindow(this.run.buffs.steady ? STEADY_WINDOW : RELOAD_WINDOW, this.run.windowWiden);
    const result = tickReload(this.reload, dt, tap && this.reload.phase !== 'idle', {
      window: sweet,
      duration,
      oil: this.run.buffs.oil,
    });
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
    if (this.reload.phase === 'active') ui.setReload(reloadProgress(this.reload, duration), false, sweet);
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
    const cam = this.cameras.main.worldView;
    const margin = settings.lowEffects ? 48 : 96;
    for (const enemy of this.enemies) {
      const near =
        enemy.sprite.x > cam.x - margin &&
        enemy.sprite.x < cam.right + margin &&
        enemy.sprite.y > cam.y - margin &&
        enemy.sprite.y < cam.bottom + margin;
      enemy.sprite.setVisible(near);
      if (!near) {
        if (!enemy.dead) enemy.body.setVelocity(0, enemy.body.velocity.y);
        continue;
      }
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
        this.hurtPlayer(1, dir, enemy.kind === 'macaw' ? 'macaw' : 'bite');
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
      if (overlaps(body, spike)) this.hurtPlayer(1, this.player.facing * -1 || -1, 'hazard');
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
        const pocket = salvageFromCoins(pickup.amount);
        this.run.salvageEarned += pocket;
        addSalvage(pocket);
        this.floatText(pickup.rect.x, pickup.rect.y, `+${pickup.amount}`, '#e0b15a');
        sfx.pickup();
      } else if (pickup.kind === 'medkit' && pickup.heal) {
        this.run.hp = Math.min(this.run.maxHp, this.run.hp + pickup.heal);
        this.floatText(pickup.rect.x, pickup.rect.y, 'stitched', '#d7cbb8');
        sfx.pickup();
      } else if (pickup.kind === 'stone') {
        this.run.knife = hone(this.run.knife);
        this.floatText(pickup.rect.x, pickup.rect.y, 'honed', '#d7cbb8');
        sfx.pickup();
      } else if (pickup.kind === 'gear' && pickup.gearId) {
        grantGear(this.run, pickup.gearId);
        this.floatText(pickup.rect.x, pickup.rect.y, 'packed', '#d7a15f');
        ui.toast(`${gearDef(pickup.gearId).name} is in the pack.`);
        sfx.pickup();
      }
    }

    this.steamT += dt;
    const steamOn = this.steamT % 2.8 < 1.1;
    if (steamOn) {
      for (const jet of this.level.steam ?? []) {
        if (overlaps(body, jet)) this.hurtPlayer(1, 0, 'hazard');
      }
    }

    for (const mark of this.checkpoints) {
      if (!overlaps(body, mark.rect)) continue;
      if (this.run.checkpoint.x !== mark.x || this.run.checkpoint.floor !== this.level.id) {
        this.run.checkpoint = { floor: this.level.id, x: mark.x, y: mark.y };
      }
    }

    let prompt: string | null = null;
    if (this.challengeRect && overlaps(body, this.challengeRect, 8)) {
      prompt = `${input.label('interact')}  ·  optional wager`;
      if (interactEdge) this.openWager();
    }
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

    for (const station of this.campStations) {
      if (!overlaps(body, station.rect, 8)) continue;
      const label =
        station.id === 'climb'
          ? 'start the climb'
          : station.id === 'notices'
            ? 'notices'
            : station.id;
      prompt = `${input.label('interact')}  ·  ${label}`;
      if (interactEdge) this.useStation(station.id);
    }

    for (const exit of this.exits) {
      if (!overlaps(body, exit, 0)) continue;
      const next = this.level.id + 1;
      const cap = maxUnlockedFloor(metaState());
      if (next <= ROOF_FLOOR && next > cap) {
        prompt = `${input.label('interact')}  ·  radio stops at floor ${cap}`;
        if (interactEdge) this.endRun('leave');
        break;
      }
      this.gotoFloor(next);
      return;
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

  private openGear(): void {
    if (this.phase !== 'play' && this.phase !== 'pause') return;
    this.phase = 'gear';
    this.physics.pause();
    ui.hidePause();
    ui.setPrompt(null);
    ui.showGear(this.run);
  }

  private closeGear(): void {
    if (this.phase !== 'gear') return;
    this.phase = 'play';
    this.physics.resume();
    ui.hideGear();
  }

  private wear(id: GearId): void {
    const result = equip(this.run, id);
    ui.gearMessage(result.ok ? 'Worn.' : (result.reason ?? 'No.'));
    ui.refreshGear(this.run);
    this.syncHud();
  }

  private takeOff(slot: Slot): void {
    if (slot === 'weapon' && !this.run.loadout.weapon) return;
    dropSlot(this.run, slot);
    ui.refreshGear(this.run);
    this.syncHud();
  }

  private useHealth(): void {
    const result = useHealthItem(this.run);
    if (!result.ok) {
      ui.toast(result.reason ?? 'Nothing to use.');
      return;
    }
    if (result.sprint > 0) this.run.buffs.adrenaline = Math.max(this.run.buffs.adrenaline, result.sprint);
    ui.toast(result.sprint > 0 ? 'The stim hits.' : 'You bind the wound.');
    if (this.phase === 'gear') ui.refreshGear(this.run);
    this.syncHud();
  }

  private tryFlare(): void {
    if (this.phase !== 'play') return;
    if (this.run.buffs.flareShells <= 0) {
      ui.toast('The flare gun is empty.');
      return;
    }
    this.run.buffs.flareShells -= 1;
    const x = this.player.sprite.x;
    const y = this.player.sprite.y;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (Math.hypot(enemy.sprite.x - x, enemy.sprite.y - y) < 220) enemy.stun = 2.4;
    }
    this.cameras.main.flash(180, 255, 220, 160);
    sfx.gun(false);
    this.emitNoise(x, y, 200, 0.8);
    ui.toast('The flare spends a shell.');
    this.syncHud();
  }

  private tickBuffs(dt: number): void {
    if (this.run.buffs.adrenaline > 0) this.run.buffs.adrenaline -= dt;
    if (this.run.buffs.birdseed > 0) this.run.buffs.birdseed -= dt;
    if (this.run.buffs.ferret > 0) this.run.buffs.ferret -= dt;
    if (this.helmCd > 0) this.helmCd -= dt;
  }

  private buy(id: ItemId): void {
    const result = attemptPurchase(this.run, id, this.level.spendLimit);
    if (result.ok && id === 'birdseed') {
      for (const enemy of this.enemies) if (enemy.kind === 'macaw') enemy.bait = this.run.buffs.birdseed;
    }
    if (result.ok && id === 'ferret') {
      for (const enemy of this.enemies) if (enemy.kind === 'ferret') enemy.bait = this.run.buffs.ferret;
    }
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
  private routeMenus(frame: { jumpEdge: boolean; interactEdge: boolean; pauseEdge: boolean; meleeEdge: boolean; navEdge: -1 | 0 | 1 }): boolean {
    const pad = input.device === 'pad';
    if (this.phase === 'dead' && (frame.jumpEdge || frame.interactEdge || frame.pauseEdge)) {
      this.returnToCamp();
      return true;
    }
    if (this.phase === 'station') {
      if (frame.jumpEdge) {
        const id = document.getElementById('station')?.dataset.station as StationId | undefined;
        if (id) this.improveStation(id);
      }
      if (frame.interactEdge || frame.pauseEdge) this.closeStation();
      return true;
    }
    if (this.phase === 'notices') {
      if (frame.interactEdge || frame.pauseEdge) this.closeNotices();
      return true;
    }
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
    if (this.phase === 'wager') {
      if (frame.interactEdge || frame.pauseEdge || frame.jumpEdge) this.closeWager();
      return true;
    }
    if (pad && this.phase === 'gear') {
      if (frame.navEdge !== 0) ui.nudgeGear(frame.navEdge);
      if (frame.jumpEdge) ui.confirmGear();
      if (frame.meleeEdge) this.useHealth();
      if (frame.interactEdge || frame.pauseEdge) this.closeGear();
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
    if (this.phase === 'gear') {
      this.closeGear();
      return;
    }
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
    ui.showPause(this.run.notes, this.run.builtSeed ?? this.run.seed);
  }

  private closePause(): void {
    if (this.phase !== 'pause') return;
    this.phase = 'play';
    this.physics.resume();
    ui.hidePause();
  }

  private hurtPlayer(amount: number, dir: number, source: 'bite' | 'macaw' | 'hazard' = 'bite'): void {
    if (this.phase !== 'play' || this.player.iframes > 0 || amount <= 0) return;
    const hit = incomingDamage(amount, this.run.loadout, source, this.helmCd <= 0, this.run.buffs.lucky);
    if (hit.luckyUsed) {
      this.run.buffs.lucky -= 1;
      ui.toast('The coin spends itself.');
      this.player.iframes = 0.35;
      return;
    }
    if (hit.helmUsed) this.helmCd = 6;
    if (hit.damage <= 0) {
      this.player.iframes = 0.25;
      return;
    }
    this.run.hp -= hit.damage;
    this.player.iframes = IFRAME_TIME + iframeBonus(this.run.loadout);
    this.player.body.setVelocity(dir * 170, -160);
    sfx.hurt();
    ui.flashHurt();
    this.cameras.main.shake(90, 0.006);
    if (this.run.hp <= 0) this.down();
  }

  private down(): void {
    this.endRun('dead');
  }

  private endRun(reason: 'dead' | 'leave' | 'hatch'): void {
    if (this.phase === 'dead' || this.phase === 'ending') return;
    this.phase = 'dead';
    this.physics.pause();
    this.run.hp = reason === 'dead' ? 0 : this.run.hp;
    ui.setPrompt(null);
    ui.hideShop();
    ui.hidePause();
    ui.hideGear();
    ui.hideStation();
    if (reason === 'dead') {
      this.run.salvageEarned += DEATH_PITY;
      addSalvage(DEATH_PITY);
      ui.flashHurt();
    }
    const meta = metaState();
    meta.runs += 1;
    meta.bestFloor = Math.max(meta.bestFloor, this.run.floor);
    saveMeta(meta);
    ui.playMode(false);
    this.syncHud();
    ui.showRunEnd({
      reason,
      earned: this.run.salvageEarned,
      total: meta.salvage,
      floor: this.run.floor,
    });
  }

  private returnToCamp(): void {
    const run = createRun();
    run.started = true;
    run.floor = 1;
    this.registry.set('run', run);
    ui.hideOverlays();
    this.scene.restart({ floor: 1 });
  }

  private beginClimb(): void {
    const run = createRun();
    run.started = true;
    run.floor = 2;
    if (settings.seed == null) run.seed = 1 + Math.floor(Math.random() * 900000);
    this.registry.set('run', run);
    ui.hideOverlays();
    this.scene.restart({ floor: 2 });
  }

  private useStation(id: CampStationId): void {
    if (id === 'climb') {
      this.beginClimb();
      return;
    }
    if (id === 'notices') {
      this.openNotices();
      return;
    }
    this.openStation(id);
  }

  private openStation(id: StationId): void {
    if (this.phase !== 'play' && this.phase !== 'station') return;
    this.phase = 'station';
    this.physics.pause();
    ui.setPrompt(null);
    ui.showStation(metaState(), id);
  }

  private closeStation(): void {
    if (this.phase !== 'station') return;
    this.phase = 'play';
    this.physics.resume();
    ui.hideStation();
  }

  private openNotices(): void {
    if (this.phase !== 'play' && this.phase !== 'notices') return;
    this.phase = 'notices';
    this.physics.pause();
    ui.setPrompt(null);
    ui.showNotices();
  }

  private closeNotices(): void {
    if (this.phase !== 'notices') return;
    this.phase = 'play';
    this.physics.resume();
    ui.hideNotices();
  }

  private improveStation(id: StationId): void {
    const result = buyStation(metaState(), id);
    if (!result.ok) {
      ui.stationMessage(result.reason ?? 'No.');
      sfx.dry();
      return;
    }
    sfx.pickup();
    ui.toast('The lobby closes in a little.');
    this.run.started = true;
    this.run.floor = 1;
    ui.hideOverlays();
    this.scene.restart({ floor: 1 });
  }

  private resetProgress(): void {
    resetMeta();
    ui.toast('Salvage and the stations are cleared. The lobby is bare again.');
    ui.hideSettings();
    if (this.level.id <= 1) {
      this.run.started = true;
      this.scene.restart({ floor: 1 });
    }
  }

  private gotoFloor(next: number): void {
    if (this.transitioning || (this.phase !== 'play' && this.phase !== 'menu')) return;
    if (next > ROOF_FLOOR) {
      this.run.salvageEarned += HATCH_BONUS;
      addSalvage(HATCH_BONUS);
      this.endRun('hatch');
      return;
    }
    if (next > maxUnlockedFloor(metaState())) {
      ui.toast(`The radio has not heard past floor ${maxUnlockedFloor(metaState())}.`);
      return;
    }
    if (this.level.id >= 2) {
      const bonus = salvageFromClear(this.level.id);
      this.run.salvageEarned += bonus;
      addSalvage(bonus);
    }
    clearFloorBuffs(this.run.buffs);
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
      magSize: this.run.magSize,
      reserve: this.run.reserve,
      coins: this.run.coins,
      knife: this.run.knife,
      silenced: this.run.owned.silencer,
      power: this.run.owned.power,
      compensated: this.run.owned.compensator,
      notes: this.run.notes.length,
      flareShells: this.run.buffs.flareShells,
      salvage: metaState().salvage,
      helmet: this.run.loadout.helmet ?? '',
      armor: this.run.loadout.armor ?? '',
      weapon: slotLabel(this.run.loadout, 'weapon'),
    });
  }

  private paintBackdrop(): void {
    const { width, height, id } = this.level;
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(paletteFor(id).wall, 1);
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
    const palette = paletteFor(this.level.id);
    const lip = palette.lip;
    const fill = palette.floor;
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
      const sprite = this.add.sprite(note.x, note.y, ATLAS, 'note').setOrigin(0.5, 1).setDepth(8);
      this.pickups.push({
        kind: 'note',
        sprite,
        id: note.id,
        text: note.text,
        taken: false,
        bob: note.x,
        rect: { x: note.x - 12, y: note.y - 28, w: 24, h: 30 },
      });
    }
    for (const coin of this.level.coins) {
      const sprite = this.add.sprite(coin.x, coin.y - 16, ATLAS, 'coin').setDepth(8);
      this.pickups.push({
        kind: 'coin',
        sprite,
        amount: coin.amount,
        taken: false,
        bob: coin.x,
        rect: { x: coin.x - 12, y: coin.y - 32, w: 24, h: 28 },
      });
    }
    for (const kit of this.level.medkits) {
      const sprite = this.add.sprite(kit.x, kit.y, ATLAS, 'medkit').setOrigin(0.5, 1).setDepth(8);
      this.pickups.push({
        kind: 'medkit',
        sprite,
        heal: kit.heal,
        taken: false,
        bob: kit.x,
        rect: { x: kit.x - 12, y: kit.y - 24, w: 24, h: 26 },
      });
    }
    for (const stone of this.level.stones ?? []) {
      const sprite = this.add.sprite(stone.x, stone.y, ATLAS, 'stone').setOrigin(0.5, 1).setDepth(8);
      this.pickups.push({
        kind: 'stone',
        sprite,
        taken: false,
        bob: stone.x,
        rect: { x: stone.x - 12, y: stone.y - 20, w: 24, h: 22 },
      });
    }
    for (const item of this.level.gear ?? []) {
      if (!(GEAR_IDS as readonly string[]).includes(item.id)) continue;
      const sprite = this.add.sprite(item.x, item.y, ATLAS, 'gear').setOrigin(0.5, 1).setDepth(8);
      this.pickups.push({
        kind: 'gear',
        sprite,
        gearId: item.id as GearId,
        taken: false,
        bob: item.x,
        rect: { x: item.x - 12, y: item.y - 22, w: 24, h: 24 },
      });
    }
    if (this.level.shop) {
      const shop = this.level.shop;
      this.add.sprite(shop.x, shop.y, ATLAS, 'vending').setOrigin(0.5, 1).setDepth(8);
      this.shopRect = { x: shop.x - 28, y: shop.y - 64, w: 60, h: 68 };
    }
    this.campStations = [];
    for (const station of this.level.stations ?? []) {
      const sprite =
        station.id === 'armory'
          ? this.add.sprite(station.x, station.y, ATLAS, 'vending').setOrigin(0.5, 1).setDepth(8)
          : station.id === 'infirmary'
            ? this.add.sprite(station.x, station.y, ATLAS, 'medkit').setOrigin(0.5, 1).setDepth(8).setScale(1.6)
            : station.id === 'notices'
              ? this.add.sprite(station.x, station.y, ATLAS, 'note').setOrigin(0.5, 1).setDepth(8).setScale(1.8)
              : this.add.sprite(station.x, station.y, ATLAS, 'terminal').setOrigin(0.5, 1).setDepth(8);
      if (station.id === 'radio') sprite.setTint(0x9aa4d0);
      if (station.id === 'workbench') sprite.setTint(0xd7a15f);
      if (station.id === 'climb') sprite.setTint(0xe0b15a);
      this.campStations.push({
        id: station.id,
        rect: { x: station.x - 28, y: station.y - 64, w: 64, h: 70 },
      });
    }
    const dressColor: Record<string, number> = {
      barricade: 0x4a3428,
      sandbag: 0x6a6450,
      patch: 0x8a8474,
      rubble: 0x1c1a18,
    };
    for (const piece of this.level.dressing ?? []) {
      this.add
        .rectangle(piece.x + piece.w / 2, piece.y + piece.h / 2, piece.w, piece.h, dressColor[piece.kind] ?? 0x333028)
        .setDepth(piece.kind === 'patch' ? 2 : 7);
    }
    if (this.level.challenge) {
      const machine = this.level.challenge;
      const sprite = this.add.sprite(machine.x, machine.y, ATLAS, 'vending').setOrigin(0.5, 1).setDepth(8);
      sprite.setTint(0xe0b15a);
      this.challengeRect = { x: machine.x - 30, y: machine.y - 66, w: 64, h: 70 };
    }
    if (!settings.lowEffects) {
      for (let i = 0; i < 8; i++) {
        const mote = this.add.circle(Math.random() * this.level.width, Math.random() * this.level.height, 1.2, 0xcbb892, 0.28);
        mote.setDepth(19);
        this.dust.push(mote);
      }
    }
    for (const light of this.level.lights) {
      if (!light.dead) continue;
      this.add.rectangle(light.x, light.y, 7, 4, 0x121212).setDepth(3);
    }
    for (const terminal of this.level.terminals) {
      this.add.sprite(terminal.x, terminal.y, ATLAS, 'terminal').setOrigin(0.5, 1).setDepth(8);
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

  private paintStaticLights(): void {
    const g = this.staticLights;
    if (!g) return;
    g.clear();
    if (settings.lowEffects) return;
    for (const light of this.lightDefs) {
      if (light.dead || light.flicker) continue;
      g.fillStyle(light.color, 0.045);
      g.fillCircle(light.x, light.y, light.radius * 0.8);
    }
  }

  private drawLights(time: number): void {
    const g = this.lightsGfx;
    if (!g) return;
    if (settings.lowEffects) {
      if (g.visible) g.setVisible(false);
      if (this.staticLights?.visible) this.staticLights.setVisible(false);
      if (this.flashGfx?.visible) this.flashGfx.setVisible(false);
      return;
    }
    if (!g.visible) g.setVisible(true);
    g.clear();
    for (const light of this.flickerLights) {
      const flick = 0.45 + Math.sin(time / 90 + light.x) * 0.35;
      g.fillStyle(light.color, 0.05 * flick);
      g.fillCircle(light.x, light.y, light.radius * 0.75);
    }
  }

  private drawFlash(): void {
    const g = this.flashGfx;
    if (!g || !this.player) return;
    if (settings.lowEffects) return;
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
