#!/usr/bin/env bash
set -euo pipefail
mkdir -p ritm-android/native-results
adb install -r ritm-android/app/build/outputs/apk/debug/app-debug.apk
adb install -r ritm-android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb shell am instrument -w ru.ritm.app.test/ru.ritm.app.SmokeRunner | tee ritm-android/native-results/test.log
grep -q RITM_NATIVE_OK ritm-android/native-results/test.log
adb exec-out screencap -p > ritm-android/native-results/android35.png
adb shell dumpsys alarm > ritm-android/native-results/alarms.txt
