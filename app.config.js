const IS_PROD = process.env.APP_VARIANT === 'production';

// Your EAS project, created with `npx eas-cli init`. Builds, push
// notifications and over-the-air updates all hang off it.
const EAS_PROJECT_ID = undefined;

export default {
  name: IS_PROD ? 'WeechatRN' : 'WeechatRN (Dev)',
  description: 'Weechat relay client using websockets',
  slug: 'WeechatRN',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: IS_PROD
      ? 'com.richardherold.weechatrn'
      : 'com.richardherold.weechatrn.dev',
    supportsTablet: true,
    config: {
      usesNonExemptEncryption: false
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType:
            'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1']
        }
      ]
    },
    buildNumber: '1'
  },
  // Android keeps the upstream package name: google-services.json (push via
  // Firebase) is registered to it.
  android: {
    package: IS_PROD
      ? 'com.matthoran.weechatrn'
      : 'com.matthoran.weechatrn.dev',
    googleServicesFile: './google-services.json'
  },
  platforms: ['ios', 'android'],
  version: '1.8.0',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  plugins: [
    [
      'expo-splash-screen',
      {
        backgroundColor: '#ffffff',
        image: './assets/splash.png',
        imageWidth: 200
      }
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png'
      }
    ],
    'expo-image-picker',
    './plugins/withSceneDelegate.ts',
    [
      'expo-build-properties',
      {
        ios: {
          usePrecompiledModules: false
        }
      }
    ],
    'expo-font',
    '@react-native-vector-icons/material-icons',
    '@react-native-vector-icons/material-design-icons',
    'expo-system-ui'
  ],
  assetBundlePatterns: ['**/*'],
  githubUrl: 'https://github.com/RichardHerold/weechatRN',
  ...(EAS_PROJECT_ID && {
    updates: {
      fallbackToCacheTimeout: 0,
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`
    },
    extra: {
      eas: {
        projectId: EAS_PROJECT_ID
      }
    }
  }),
  ...(IS_PROD && {
    runtimeVersion: {
      policy: 'appVersion'
    }
  }),
  experiments: {
    inlineModules: {
      watchedDirectories: ['src/native']
    }
  }
};
