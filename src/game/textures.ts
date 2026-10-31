import Phaser from 'phaser';

/** One sheet for every sprite, so the phone binds a single texture. */
export const ATLAS = 'atlas';

export function createTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(ATLAS)) return;
  const tex = scene.textures.createCanvas(ATLAS, 256, 256);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, 256, 256);
  let cursorX = 0;
  let cursorY = 0;
  let rowH = 0;

  const canvas = (_scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void => {
    if (cursorX + w > 256) {
      cursorX = 0;
      cursorY += rowH;
      rowH = 0;
    }
    ctx.save();
    ctx.translate(cursorX, cursorY);
    draw(ctx);
    ctx.restore();
    tex.add(key, 0, cursorX, cursorY, w, h);
    cursorX += w;
    rowH = Math.max(rowH, h);
  };
  canvas(scene, 'player', 32, 48, (ctx) => {
    ctx.fillStyle = '#14161c';
    ctx.fillRect(10, 16, 12, 18);
    ctx.fillStyle = '#3a2a2e';
    ctx.fillRect(8, 18, 4, 12);
    ctx.fillStyle = '#8f2d2d';
    ctx.fillRect(12, 20, 3, 10);
    ctx.fillStyle = '#d7cbb8';
    ctx.fillRect(11, 4, 10, 12);
    ctx.fillStyle = '#1a1c22';
    ctx.fillRect(10, 4, 12, 4);
    ctx.fillStyle = '#6e1d1d';
    ctx.fillRect(14, 9, 2, 2);
    ctx.fillStyle = '#101218';
    ctx.fillRect(9, 34, 5, 12);
    ctx.fillRect(18, 34, 5, 12);
    ctx.fillStyle = '#2a241c';
    ctx.fillRect(8, 44, 7, 3);
    ctx.fillRect(17, 44, 7, 3);
    ctx.fillStyle = '#c9b89a';
    ctx.fillRect(22, 26, 7, 2);
  });

  canvas(scene, 'undead', 32, 48, (ctx) => {
    ctx.fillStyle = '#3e4638';
    ctx.fillRect(9, 16, 14, 18);
    ctx.fillStyle = '#2a3126';
    ctx.fillRect(4, 18, 6, 5);
    ctx.fillRect(22, 18, 6, 5);
    ctx.fillStyle = '#8a9180';
    ctx.fillRect(10, 3, 12, 13);
    ctx.fillStyle = '#1a100e';
    ctx.fillRect(12, 8, 3, 3);
    ctx.fillRect(18, 8, 3, 3);
    ctx.fillStyle = '#c44b3a';
    ctx.fillRect(13, 9, 1, 1);
    ctx.fillRect(19, 9, 1, 1);
    ctx.fillStyle = '#2c3328';
    ctx.fillRect(10, 34, 5, 13);
    ctx.fillRect(17, 34, 5, 13);
    ctx.fillStyle = '#5c2a28';
    ctx.fillRect(11, 28, 4, 5);
  });

  canvas(scene, 'ferret', 40, 18, (ctx) => {
    ctx.fillStyle = '#5c4638';
    ctx.fillRect(6, 6, 26, 8);
    ctx.fillStyle = '#3a2c24';
    ctx.fillRect(2, 8, 8, 4);
    ctx.fillRect(30, 4, 8, 4);
    ctx.fillStyle = '#c44b3a';
    ctx.fillRect(8, 7, 2, 2);
    ctx.fillStyle = '#2a211c';
    ctx.fillRect(10, 13, 3, 4);
    ctx.fillRect(18, 13, 3, 4);
    ctx.fillRect(26, 13, 3, 4);
  });

  canvas(scene, 'macaw', 36, 24, (ctx) => {
    ctx.fillStyle = '#2f4f4e';
    ctx.fillRect(8, 8, 16, 10);
    ctx.fillStyle = '#8d3d32';
    ctx.fillRect(20, 6, 12, 6);
    ctx.fillStyle = '#d7cbb8';
    ctx.fillRect(30, 8, 4, 2);
    ctx.fillStyle = '#1a100e';
    ctx.fillRect(14, 10, 3, 3);
    ctx.fillStyle = '#c44b3a';
    ctx.fillRect(15, 11, 1, 1);
    ctx.fillStyle = '#243e3d';
    ctx.beginPath();
    ctx.moveTo(6, 12);
    ctx.lineTo(16, 6);
    ctx.lineTo(16, 16);
    ctx.fill();
    ctx.fillStyle = '#6a3030';
    ctx.fillRect(12, 18, 3, 5);
    ctx.fillRect(18, 18, 3, 5);
  });

  canvas(scene, 'bullet', 8, 4, (ctx) => {
    ctx.fillStyle = '#f0d7a2';
    ctx.fillRect(0, 1, 8, 2);
  });

  canvas(scene, 'note', 16, 18, (ctx) => {
    ctx.fillStyle = '#d9c7a2';
    ctx.fillRect(1, 1, 14, 16);
    ctx.fillStyle = '#b7a88a';
    ctx.fillRect(3, 5, 10, 1);
    ctx.fillRect(3, 8, 8, 1);
    ctx.fillRect(3, 11, 9, 1);
  });

  canvas(scene, 'coin', 10, 10, (ctx) => {
    ctx.fillStyle = '#e0b15a';
    ctx.beginPath();
    ctx.arc(5, 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6a32';
    ctx.fillRect(4, 2, 2, 6);
  });

  canvas(scene, 'medkit', 16, 14, (ctx) => {
    ctx.fillStyle = '#6e1d1d';
    ctx.fillRect(1, 3, 14, 10);
    ctx.fillStyle = '#e6e0d6';
    ctx.fillRect(7, 5, 2, 6);
    ctx.fillRect(5, 7, 6, 2);
  });

  canvas(scene, 'vending', 34, 52, (ctx) => {
    ctx.fillStyle = '#1a1e28';
    ctx.fillRect(2, 2, 30, 48);
    ctx.fillStyle = '#243044';
    ctx.fillRect(6, 6, 22, 22);
    ctx.fillStyle = '#8fb4c9';
    ctx.globalAlpha = 0.35;
    ctx.fillRect(8, 8, 18, 16);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#c44b3a';
    ctx.fillRect(8, 32, 6, 6);
    ctx.fillStyle = '#d7a15f';
    ctx.fillRect(16, 32, 6, 6);
    ctx.fillStyle = '#9cbc6a';
    ctx.fillRect(24, 32, 4, 6);
    ctx.fillStyle = '#3a4154';
    ctx.fillRect(6, 42, 22, 4);
  });

  canvas(scene, 'terminal', 22, 28, (ctx) => {
    ctx.fillStyle = '#1c2430';
    ctx.fillRect(2, 4, 18, 22);
    ctx.fillStyle = '#9cbc6a';
    ctx.globalAlpha = 0.8;
    ctx.fillRect(5, 8, 12, 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#2a3344';
    ctx.fillRect(6, 18, 10, 3);
  });

  canvas(scene, 'door', 16, 64, (ctx) => {
    ctx.fillStyle = '#3a2a24';
    ctx.fillRect(1, 0, 14, 64);
    ctx.fillStyle = '#5a4036';
    ctx.fillRect(3, 4, 10, 56);
    ctx.fillStyle = '#d7a15f';
    ctx.fillRect(10, 30, 2, 4);
  });

  canvas(scene, 'stone', 14, 12, (ctx) => {
    ctx.fillStyle = '#6a6458';
    ctx.fillRect(1, 3, 12, 7);
    ctx.fillStyle = '#c4b49a';
    ctx.fillRect(2, 4, 8, 2);
  });

  canvas(scene, 'gear', 14, 14, (ctx) => {
    ctx.fillStyle = '#2a3140';
    ctx.fillRect(1, 1, 12, 12);
    ctx.fillStyle = '#d7a15f';
    ctx.fillRect(6, 2, 2, 10);
    ctx.fillRect(2, 6, 10, 2);
  });

  tex.refresh();
}
