import Phaser from 'phaser';
import { groundAt, segmentBlocked } from '../geom';
import type { EnemyKind, EnemySpec, Rect } from '../types';

interface KindStats {
  hp: number;
  patrol: number;
  chase: number;
  sight: number;
  leash: number;
  texture: string;
  bodyW: number;
  bodyH: number;
  offsetX: number;
  offsetY: number;
  originY: number;
  flying: boolean;
}

const KINDS: Record<EnemyKind, KindStats> = {
  undead: {
    hp: 2,
    patrol: 30,
    chase: 64,
    sight: 126,
    leash: 540,
    texture: 'undead',
    bodyW: 16,
    bodyH: 36,
    offsetX: 8,
    offsetY: 12,
    originY: 1,
    flying: false,
  },
  ferret: {
    hp: 1,
    patrol: 46,
    chase: 158,
    sight: 176,
    leash: 460,
    texture: 'ferret',
    bodyW: 30,
    bodyH: 12,
    offsetX: 5,
    offsetY: 6,
    originY: 1,
    flying: false,
  },
  macaw: {
    hp: 1,
    patrol: 24,
    chase: 92,
    sight: 220,
    leash: 680,
    texture: 'macaw',
    bodyW: 26,
    bodyH: 18,
    offsetX: 5,
    offsetY: 3,
    originY: 0.5,
    flying: true,
  },
};

export class Enemy {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly kind: EnemyKind;
  readonly behindDoor?: string;
  hp: number;
  awake: boolean;
  alert = false;
  dead = false;
  touchCd = 0;
  private readonly stats: KindStats;
  private readonly homeX: number;
  private readonly homeY: number;
  private readonly minX: number;
  private readonly maxX: number;
  private readonly leash: number;
  private patrolDir: 1 | -1 = 1;
  private lost = 0;
  private heardX: number;
  private screechT = 1.2;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, spec: EnemySpec) {
    this.scene = scene;
    this.kind = spec.kind;
    this.stats = KINDS[spec.kind];
    this.hp = this.stats.hp + (spec.bonusHp ?? 0);
    this.behindDoor = spec.behindDoor;
    this.awake = !spec.dormant;
    this.homeX = spec.x;
    this.homeY = spec.y;
    this.minX = spec.minX;
    this.maxX = spec.maxX;
    this.leash = spec.leash ?? this.stats.leash;
    this.heardX = spec.x;
    this.patrolDir = Math.random() < 0.5 ? -1 : 1;

    this.sprite = scene.physics.add.sprite(spec.x, spec.y, this.stats.texture);
    this.sprite.setOrigin(0.5, this.stats.originY);
    this.sprite.setDepth(12);
    this.sprite.setCollideWorldBounds(true);
    const body = this.body;
    body.setSize(this.stats.bodyW, this.stats.bodyH, false);
    body.setOffset(this.stats.offsetX, this.stats.offsetY);
    if (this.stats.flying) body.setAllowGravity(false);
    body.setMaxVelocity(this.stats.flying ? 140 : 220, 700);
    body.updateFromGameObject();
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.sprite.body as Phaser.Physics.Arcade.Body;
  }

  get eye(): { x: number; y: number } {
    if (this.stats.flying) return { x: this.sprite.x, y: this.sprite.y };
    return { x: this.sprite.x, y: this.sprite.y - this.stats.bodyH * 0.7 };
  }

  wake(): void {
    if (this.dead) return;
    this.awake = true;
    this.alert = true;
  }

  hear(x: number): void {
    if (this.dead) return;
    this.awake = true;
    this.alert = true;
    this.heardX = x;
    this.lost = 0;
  }

  /** @returns true when this hit woke the body for the first time */
  hurt(amount: number, dir: number): boolean {
    if (this.dead) return false;
    const wasAsleep = !this.awake;
    this.wake();
    this.hp -= amount;
    this.sprite.setTintFill(0xf2efe6);
    this.scene.time.delayedCall(80, () => {
      if (!this.dead) this.sprite.clearTint();
    });
    if (this.hp <= 0) {
      this.die();
      return wasAsleep;
    }
    this.body.setVelocityX((dir || 1) * (this.kind === 'ferret' ? 40 : 110));
    if (!this.stats.flying) this.body.setVelocityY(-70);
    return wasAsleep;
  }

  update(dt: number, playerX: number, playerY: number, floors: Rect[], blocks: Rect[]): { screech: boolean } {
    if (this.dead) return { screech: false };
    this.touchCd = Math.max(0, this.touchCd - dt);
    if (this.sprite.y > 4000) this.die();

    const sees = this.awake && this.sees(playerX, playerY, blocks);
    if (sees) {
      this.alert = true;
      this.heardX = playerX;
      this.lost = 0;
    } else if (this.alert) {
      this.lost += dt;
      if (this.lost > 3.4) this.alert = false;
    }

    if (!this.awake) {
      this.body.setVelocity(0, 0);
      this.sprite.setFlipX(false);
      return { screech: false };
    }

    if (this.stats.flying) return { screech: this.updateBird(dt, playerX, playerY) };
    this.updateWalker(floors);
    return { screech: false };
  }

  private sees(playerX: number, playerY: number, blocks: Rect[]): boolean {
    const eye = this.eye;
    const dist = Math.hypot(playerX - eye.x, playerY - 20 - eye.y);
    if (dist > this.stats.sight) return false;
    return !segmentBlocked(blocks, eye.x, eye.y, playerX, playerY - 20);
  }

  private updateWalker(floors: Rect[]): void {
    let dir = this.patrolDir;
    let speed = this.stats.patrol;
    const distHome = Math.abs(this.sprite.x - this.homeX);

    if (distHome > this.leash) {
      dir = this.homeX > this.sprite.x ? 1 : -1;
      speed = this.stats.patrol;
      if (distHome > this.leash + 24) this.alert = false;
    } else if (this.alert) {
      const target = this.heardX;
      if (Math.abs(target - this.sprite.x) > 8) dir = target > this.sprite.x ? 1 : -1;
      speed = this.stats.chase;
    } else {
      if (this.sprite.x < this.minX) this.patrolDir = 1;
      if (this.sprite.x > this.maxX) this.patrolDir = -1;
      dir = this.patrolDir;
      speed = this.stats.patrol;
    }

    const aheadX = this.sprite.x + dir * (this.kind === 'ferret' ? 16 : 14);
    if (!groundAt(floors, aheadX, this.sprite.y + 8)) {
      if (!this.alert) {
        this.patrolDir = dir === 1 ? -1 : 1;
        dir = this.patrolDir;
      }
      speed = 0;
    } else {
      this.patrolDir = dir;
    }

    this.body.setVelocityX(dir * speed);
    if (Math.abs(speed) > 1) this.sprite.setFlipX(dir < 0);
  }

  private updateBird(dt: number, playerX: number, playerY: number): boolean {
    const distHome = Math.hypot(this.sprite.x - this.homeX, this.sprite.y - this.homeY);
    let tx = playerX;
    let ty = playerY - 28;
    if (!this.alert || distHome > this.leash) {
      tx = this.homeX;
      ty = this.homeY + Math.sin(this.scene.time.now / 280) * 8;
    }
    const dx = tx - this.sprite.x;
    const dy = ty - this.sprite.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = this.alert ? this.stats.chase : this.stats.patrol;
    this.body.setVelocity((dx / len) * speed, (dy / len) * speed);
    this.sprite.setFlipX(dx < 0);

    if (!this.alert) return false;
    this.screechT -= dt;
    if (this.screechT > 0) return false;
    this.screechT = 2.6;
    return true;
  }

  private die(): void {
    if (this.dead) return;
    this.dead = true;
    this.sprite.disableBody(true, false);
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      y: this.sprite.y + 10,
      duration: 320,
      onComplete: () => this.sprite.destroy(),
    });
  }
}
