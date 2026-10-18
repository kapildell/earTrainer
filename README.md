# NoteScout

NoteScout is a cross-platform ear-training app built with Expo and React Native. Choose piano, guitar, or flute, select a low (C3–B3), medium (C4–B4), or high (C5–B5) octave, then identify a randomly played chromatic note within 30 seconds. The spoken prompt and synthesized note work offline.

## Run the app

Install Node.js 20.19.4 or newer, then from this folder run:

```sh
npm install
npm run start
```

Scan the QR code with Expo Go on an iOS or Android device, or use the Expo development tools to launch an emulator.

## Build installable packages

EAS Build creates native packages in the cloud. Install and sign in to the EAS CLI, then configure your Expo account:

```sh
npm install --global eas-cli
eas login
eas build:configure
```

For an Android APK that can be installed directly:

```sh
eas build --platform android --profile preview
```

For store-ready builds:

```sh
eas build --platform all --profile production
```

The resulting iOS build is an `.ipa` intended for App Store Connect/TestFlight distribution; it is not a directly installable iOS file. Publishing on the App Store requires an Apple Developer account and the required signing credentials. Android Play Store distribution similarly requires a Google Play developer account. EAS prompts for or provisions signing credentials during the build.

## Checks

```sh
npm run typecheck
```
