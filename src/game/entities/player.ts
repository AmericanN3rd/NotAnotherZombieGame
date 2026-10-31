import Phaser from 'phaser';
import { CLIMB_SPEED, COYOTE_TIME, JUMP_BUFFER, JUMP_CUT, JUMP_VELOCITY, RUN_SPEED, STEP_UP } from '../balance';
import type { Frame } from '../input';
import type { Rect } from '../types';

export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  facing: 1 | -1 = 1;
  climbing = false;
  jumpBuffer = 0;
  iframes = 0;
  meleeCd = 0;
  fireCd = 0;
  /** Extra spread that decays. Compensator scales how fast this builds. */
  recoil = 0;
  private prevKeyUp = false;
  private walkT = 0;
  coyote = COYOTE_TIME;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, 'player');
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(14);
    this.sprite.setCollideWorldBounds(true);
    const body = this.body;
    body.setSize(16, 36, false);
    body.setOffset(8, 12);
    body.setMaxVelocity(280, 740);
    body.updateFromGameObject();
  }

  get body(): Phaser.Physics.Arcade.Body {
    return this.sprite.body as Phaser.Physics.Arcade.Body;
  }

  place(x: number, y: number): void {
    this.climbing = false;
    this.coyote = COYOTE_TIME;
    this.body.setAllowGravity(true);
    this.body.reset(x, y);
  }

  /**
   * Arcade physics steps before Scene.update, so velocities set here apply next frame.
   * Returns whether a footstep should play.
   */
  update(frame: Frame, dt: number, onLadder: boolean, ladderX: number | null, floors: Rect[]): boolean {
    const body = this.body;
    this.meleeCd = Math.max(0, this.meleeCd - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.recoil = Math.max(0, this.recoil - dt * 1.5);
    if (this.iframes > 0) {
      this.iframes -= dt;
      this.sprite.setAlpha(Math.sin(this.iframes * 36) > 0 ? 1 : 0.4);
    } else if (this.sprite.alpha !== 1) {
      this.sprite.setAlpha(1);
    }

    const up = frame.keyUp || frame.joyUp;
    const down = frame.keyDown || frame.joyDown;
    const jumpEdge = frame.jumpEdge || (frame.keyUp && !this.prevKeyUp && !onLadder);
    this.prevKeyUp = frame.keyUp;

    if (this.climbing && jumpEdge) {
      this.climbing = false;
      body.setAllowGravity(true);
      body.setVelocityY(JUMP_VELOCITY);
      this.coyote = 0;
      this.jumpBuffer = 0;
    } else if (onLadder && (this.climbing || up || down)) {
      if (!this.climbing && (up || down)) {
        this.climbing = true;
        this.coyote = 0;
        body.setAllowGravity(false);
        body.setVelocity(0, 0);
      }
      if (this.climbing) {
        this.sprite.setRotation(0);
        const pull = ladderX != null && Math.abs(frame.axisX) < 0.4 ? (ladderX - this.sprite.x) * 5 : 0;
        body.setVelocityY(up ? -CLIMB_SPEED : down ? CLIMB_SPEED : 0);
        body.setVelocityX(frame.axisX * 78 + pull);
        this.face(frame.axisX);
        return false;
      }
    } else if (this.climbing && !onLadder) {
      this.climbing = false;
      body.setAllowGravity(true);
      this.snapToFloor(floors);
    }

    if (jumpEdge) this.jumpBuffer = JUMP_BUFFER;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    const grounded = body.blocked.down || body.touching.down;
    if (grounded && body.velocity.y >= 0) this.coyote = COYOTE_TIME;
    else this.coyote = Math.max(0, this.coyote - dt);

    const target = frame.axisX * RUN_SPEED;
    const rate = (grounded ? 2600 : 1450) * dt;
    const diff = target - body.velocity.x;
    body.setVelocityX(Math.abs(diff) <= rate ? target : body.velocity.x + Math.sign(diff) * rate);
    this.face(frame.axisX);

    const jumpHeld = frame.jumpHeld || (frame.keyUp && !this.climbing);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      body.setVelocityY(JUMP_VELOCITY);
      this.jumpBuffer = 0;
      this.coyote = 0;
    } else if (!jumpHeld && body.velocity.y < JUMP_CUT) {
      body.setVelocityY(JUMP_CUT);
    }

    if (grounded && (body.blocked.left || body.blocked.right) && Math.abs(frame.axisX) > 0.25) {
      this.tryStep(floors, body.blocked.right ? 1 : -1);
    }

    const moving = grounded && Math.abs(body.velocity.x) > 50;
    if (moving) this.walkT += dt;
    else this.walkT = 0;
    this.sprite.setRotation(moving ? Math.sin(this.walkT * 13) * 0.045 : 0);
    return moving && Math.floor((this.walkT - dt) * 3.4) !== Math.floor(this.walkT * 3.4);
  }

  private face(axisX: number): void {
    if (axisX < -0.15) this.facing = -1;
    else if (axisX > 0.15) this.facing = 1;
    this.sprite.setFlipX(this.facing < 0);
  }

  private tryStep(floors: Rect[], dir: 1 | -1): void {
    const ahead = this.sprite.x + dir * 12;
    const foot = this.sprite.y;
    let top: number | null = null;
    for (const rect of floors) {
      if (ahead < rect.x || ahead > rect.x + rect.w) continue;
      const rise = foot - rect.y;
      if (rise > 3 && rise <= STEP_UP && (top == null || rect.y < top)) top = rect.y;
    }
    if (top == null) return;
    const vx = this.body.velocity.x;
    this.body.reset(this.sprite.x, top);
    this.body.setVelocityX(vx);
  }

  /** If a climb ended inside a platform, stand on its top. */
  private snapToFloor(floors: Rect[]): void {
    const foot = this.sprite.y;
    const head = foot - 36;
    let top: number | null = null;
    for (const rect of floors) {
      const overlapsX = this.sprite.x > rect.x - 4 && this.sprite.x < rect.x + rect.w + 4;
      const overlapsY = foot > rect.y && head < rect.y + rect.h;
      if (!overlapsX || !overlapsY) continue;
      if (top == null || rect.y < top) top = rect.y;
    }
    if (top == null || foot <= top) return;
    const vx = this.body.velocity.x;
    this.body.reset(this.sprite.x, top);
    this.body.setVelocity(vx, 0);
  }
}
