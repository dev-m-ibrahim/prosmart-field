"""Run after `npx cap add android`: manifest tweaks, icons, sound, versionCode."""
import os, re, shutil, sys, glob

ROOT = 'android/app/src/main'
RES = f'{ROOT}/res'
SRC = 'android-res'

# ---- 1. copy icons / notification icon / sound ----
for d in os.listdir(SRC):
    if d == 'splash':
        continue
    dst = f'{RES}/{d}'
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(f'{SRC}/{d}'):
        shutil.copy(f'{SRC}/{d}/{f}', f'{dst}/{f}')

# adaptive icon background colour = brand navy
os.makedirs(f'{RES}/values', exist_ok=True)
open(f'{RES}/values/ic_launcher_background.xml', 'w').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">#003A5F</color>\n</resources>\n')
# adaptive icon: navy background + our cyan house as foreground (PNG mipmaps copied above)
os.makedirs(f'{RES}/mipmap-anydpi-v26', exist_ok=True)
for n in ('ic_launcher', 'ic_launcher_round'):
    open(f'{RES}/mipmap-anydpi-v26/{n}.xml', 'w').write(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '</adaptive-icon>\n')

# ---- 2. splash screens ----
for f in glob.glob(f'{RES}/drawable*/splash.png'):
    src = 'splash_land.png' if 'land' in f else 'splash_port.png'
    shutil.copy(f'{SRC}/splash/{src}', f)

# ---- 3. manifest ----
mf = f'{ROOT}/AndroidManifest.xml'
t = open(mf, encoding='utf-8').read()
perms = [
    'android.permission.CAMERA',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.VIBRATE',
    'android.permission.REQUEST_INSTALL_PACKAGES',  # in-app updater
]
add = ''.join(f'    <uses-permission android:name="{p}" />\n' for p in perms if p not in t)
if add:
    t = t.replace('<application', add + '    <application', 1)
meta = '''
        <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@drawable/ic_stat_prosmart" />
        <meta-data android:name="com.google.firebase.messaging.default_notification_color" android:resource="@color/ic_launcher_background" />
        <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="prosmart_alerts_v1" />
'''
if 'default_notification_channel_id' not in t:
    t = re.sub(r'(<application[^>]*>)', r'\1' + meta, t, count=1)
# FileProvider (the Capacitor template ships one; add it only if missing)
if 'fileprovider' not in t:
    prov = ('        <provider android:name="androidx.core.content.FileProvider" '
            'android:authorities="${applicationId}.fileprovider" android:exported="false" '
            'android:grantUriPermissions="true">\n'
            '            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" />\n'
            '        </provider>\n')
    t = t.replace('</application>', prov + '    </application>', 1)
open(mf, 'w', encoding='utf-8').write(t)

# file_paths: superset so the updater can share files from the cache dir
os.makedirs(f'{RES}/xml', exist_ok=True)
open(f'{RES}/xml/file_paths.xml', 'w').write(
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<paths xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <external-path name="my_images" path="." />\n'
    '    <cache-path name="my_cache_images" path="." />\n'
    '    <files-path name="my_files" path="." />\n'
    '</paths>\n')

# ---- 3b. in-app updater plugin (download APK + launch installer) ----
mains = glob.glob('android/app/src/main/java/**/MainActivity.java', recursive=True)
assert mains, 'MainActivity.java not found'
jdir = os.path.dirname(mains[0])
shutil.copy('ci/ApkInstallerPlugin.java', f'{jdir}/ApkInstallerPlugin.java')
open(mains[0], 'w').write(
    'package com.prosmart.field;\n\n'
    'import android.os.Bundle;\n'
    'import com.getcapacitor.BridgeActivity;\n\n'
    'public class MainActivity extends BridgeActivity {\n'
    '    @Override\n'
    '    public void onCreate(Bundle savedInstanceState) {\n'
    '        registerPlugin(ApkInstallerPlugin.class);\n'
    '        super.onCreate(savedInstanceState);\n'
    '    }\n'
    '}\n')

# ---- 4. versionCode = CI run number so every build can update the previous one ----
vc = os.environ.get('RUN_NUMBER', '1')
for g in ('android/app/build.gradle',):
    s = open(g).read()
    s = re.sub(r'versionCode\s+\d+', f'versionCode {vc}', s)
    s = re.sub(r'versionName\s+"[^"]*"', f'versionName "1.0.{vc}"', s)
    open(g, 'w').write(s)
print('patched android project, versionCode', vc)
