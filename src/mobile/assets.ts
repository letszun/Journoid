const publicAsset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

export const mobileAssets = {
  iphoneBezel: publicAsset("assets/iphone/Bezel.png"),
  iphoneKeyboard: publicAsset("assets/iphone/Keyboard.png"),
  androidKeyboard: publicAsset("assets/android/Keyboard.png"),
  pixel10Bezel: publicAsset("assets/android/Pixel10.png"),
  androidNavigationBar: publicAsset("assets/android/navigation-bar.svg"),
  androidStatusIcons: publicAsset("assets/status/status-icons.svg"),
  iosStatusIcons: publicAsset("assets/status/ios-status-icons.svg"),
} as const;
