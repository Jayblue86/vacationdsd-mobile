import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jaybluecreations.vacationdsd',
  appName: 'VacationDSD',
  webDir: 'dist',
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      appReadyTimeout: 10000,
    }
  }
};

export default config;