import Phaser from 'phaser';
import { GRAVITY, VIEW_H, VIEW_W } from './game/balance';
import { TowerScene } from './game/scenes/TowerScene';
import { checkForUpdate } from './game/updateCheck';
import { ui } from './ui/ui';

const debug = new URLSearchParams(location.search).has('debug');

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: '#07080c',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: GRAVITY },
      debug,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: VIEW_W,
    height: VIEW_H,
  },
  input: { activePointers: 4 },
  render: { antialias: true, pixelArt: false },
  scene: [TowerScene],
  banner: false,
});

void checkForUpdate((url) => ui.offerUpdate(url));
void hideNativeChrome();

async function hideNativeChrome(): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.hide();
  } catch {
    // Running in a browser.
  }
}
