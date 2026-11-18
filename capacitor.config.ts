import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.routinetracker.app',
  appName: 'Inaya',
  webDir: 'dist',
  plugins: {
    // Edge-to-edge: the web app pads itself with env(safe-area-inset-*).
    SystemBars: {
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
    },
    // Resize the web view when the keyboard opens so fields can scroll above it.
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#1d4ed8',
    },
  },
};

export default config;
