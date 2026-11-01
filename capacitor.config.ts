import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.americann3rd.nazg',
  appName: 'NAZG',
  webDir: 'dist',
  android: {
    backgroundColor: '#07080c',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
