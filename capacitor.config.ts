import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.laserfood.app',
  appName: 'Laser Food',
  webDir: 'dist',
  server: {
    url: 'https://dispro60.vercel.app/',
    cleartext: true
  }
};

export default config;
