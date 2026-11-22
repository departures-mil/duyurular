package com.departures.tvbakim;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.StatFs;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.List;

public class MainActivity extends Activity {
    static final String CHANNEL = "https://raw.githubusercontent.com/departures-mil/duyurular/main/tv-bakim/guncelleme/";
    static final String OLD_PKG = "tr.tvbakim";
    WebView web;
    final Handler ui = new Handler(Looper.getMainLooper());
    Adb adb;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        adb = new Adb(this);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        if (Build.VERSION.SDK_INT >= 16) s.setAllowUniversalAccessFromFileURLs(true);
        s.setMediaPlaybackRequiresUserGesture(true);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Bridge(), "TV");
        web.setBackgroundColor(0xFF0B1220);
        setContentView(web);
        web.loadUrl("file:///android_asset/www/index.html");
        if (Build.VERSION.SDK_INT >= 23 && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[]{Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE}, 7);
        immersive();
        autoConnect();
    }

    /** Ağ hata ayıklaması açıksa açılışta kendiliğinden Tam Yetki alır; kullanıcıdan bir şey istemez. */
    void autoConnect() {
        new Thread(new Runnable() {
            public void run() {
                if (adb.ready()) return;
                boolean ok = adb.connect(20000);
                if (ok && !canSecure()) adb.shell("pm grant " + getPackageName() + " android.permission.WRITE_SECURE_SETTINGS", 8000);
                js("window.__adbHazir && window.__adbHazir(" + ok + ")");
            }
        }).start();
    }

    /** Kullanıcının başlatıcısı (launcher): arka plan kısıtlamasından muaf tutulur. */
    String launcherPkg() {
        try {
            Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
            android.content.pm.ResolveInfo r = getPackageManager().resolveActivity(i, PackageManager.MATCH_DEFAULT_ONLY);
            return r != null && r.activityInfo != null ? r.activityInfo.packageName : "";
        } catch (Exception e) { return ""; }
    }

    static String sh(String s) { return "'" + s.replace("'", "'\\''") + "'"; }

    void immersive() {
        if (Build.VERSION.SDK_INT >= 19) getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override
    public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) immersive(); }

    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK) { js("window.geri && window.geri()"); return true; }
        return super.onKeyDown(code, e);
    }

    void js(final String code) { ui.post(new Runnable() { public void run() { web.evaluateJavascript(code, null); } }); }

    static String q(String s) { return JSONObject.quote(s == null ? "" : s); }

    // ------------------------------------------------------------------ ölçümler
    long[] ram() {
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);
        return new long[]{mi.availMem, Build.VERSION.SDK_INT >= 16 ? mi.totalMem : 0, mi.lowMemory ? 1 : 0};
    }

    long[] disk() {
        StatFs st = new StatFs(Environment.getDataDirectory().getPath());
        return new long[]{st.getAvailableBytes(), st.getTotalBytes()};
    }

    float anim() {
        try { return Settings.Global.getFloat(getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, 1f); } catch (Exception e) { return 1f; }
    }

    boolean canSecure() {
        return checkCallingOrSelfPermission("android.permission.WRITE_SECURE_SETTINGS") == PackageManager.PERMISSION_GRANTED;
    }

    boolean installed(String pkg) {
        try { getPackageManager().getPackageInfo(pkg, 0); return true; } catch (Exception e) { return false; }
    }

    static long dirSize(File f) {
        if (f == null || !f.exists()) return 0;
        if (f.isFile()) return f.length();
        long t = 0;
        File[] l = f.listFiles();
        if (l != null) for (File c : l) t += dirSize(c);
        return t;
    }

    static long wipe(File f, boolean keepRoot) {
        if (f == null || !f.exists()) return 0;
        long t = 0;
        if (f.isDirectory()) {
            File[] l = f.listFiles();
            if (l != null) for (File c : l) t += wipe(c, false);
        } else t += f.length();
        if (!keepRoot || f.isFile()) f.delete();
        return t;
    }

    // ------------------------------------------------------------------ köprü
    class Bridge {
        @JavascriptInterface
        public String info() {
            try {
                PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
                long[] r = ram(), d = disk();
                int user = 0, all = 0;
                for (ApplicationInfo a : getPackageManager().getInstalledApplications(0)) {
                    all++;
                    if ((a.flags & ApplicationInfo.FLAG_SYSTEM) == 0) user++;
                }
                return new JSONObject()
                        .put("version", pi.versionName).put("code", pi.versionCode)
                        .put("sdk", Build.VERSION.SDK_INT).put("android", Build.VERSION.RELEASE)
                        .put("model", Build.MODEL).put("brand", Build.MANUFACTURER)
                        .put("ramFree", r[0]).put("ramTotal", r[1]).put("lowMem", r[2] == 1)
                        .put("diskFree", d[0]).put("diskTotal", d[1])
                        .put("uptimeMs", SystemClock.elapsedRealtime())
                        .put("anim", anim()).put("secure", canSecure()).put("adb", adb.ready())
                        .put("userApps", user).put("allApps", all).put("oldApp", installed(OLD_PKG))
                        .toString();
            } catch (Exception e) { return "{}"; }
        }

        /** Arka plan uygulamalarını kapatır. Dönen: {count, freed} */
        @JavascriptInterface
        public String killBackground() {
            try {
                ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
                long before = ram()[0];
                int n = 0;
                for (ApplicationInfo a : getPackageManager().getInstalledApplications(0)) {
                    if (a.packageName.equals(getPackageName())) continue;
                    am.killBackgroundProcesses(a.packageName);
                    n++;
                }
                if (adb.ready()) adb.shell("am kill-all", 8000);
                Thread.sleep(1200);
                long after = ram()[0];
                return new JSONObject().put("count", n).put("freed", Math.max(0, after - before)).put("free", after).toString();
            } catch (Exception e) { return "{\"count\":0,\"freed\":0}"; }
        }

        /** Önbellekleri temizler: bu uygulama, sistemin toplu temizliği (izin varsa) ve ADB ile tüm uygulamalar. */
        @JavascriptInterface
        public String clearCaches() {
            try {
                long before = disk()[0];
                wipe(getCacheDir(), true);
                if (Build.VERSION.SDK_INT >= 8) wipe(getExternalCacheDir(), true);
                String yol = "app";
                if (adb.ready()) {
                    adb.shell("pm trim-caches 999G", 60000);
                    yol = "adb";
                } else {
                    try {
                        PackageManager pm = getPackageManager();
                        Class<?> obs = Class.forName("android.content.pm.IPackageDataObserver");
                        Method m = pm.getClass().getMethod("freeStorageAndNotify", long.class, obs);
                        m.invoke(pm, Long.MAX_VALUE, null);
                        yol = "system";
                    } catch (Throwable ignored) {}
                }
                Thread.sleep(1500);
                long after = disk()[0];
                return new JSONObject().put("freed", Math.max(0, after - before)).put("free", after).put("way", yol).toString();
            } catch (Exception e) { return "{\"freed\":0}"; }
        }

        /** Paylaşılan depolamadaki gereksiz dosyalar: küçük resim önbellekleri, LOST.DIR, geçici/günlük dosyalar,
         *  uygulamaların dış önbellekleri, boş klasörler. Kullanıcı belgelerine (fotoğraf, video, indirilenler) dokunulmaz. */
        @JavascriptInterface
        public String cleanJunk() {
            long freed = 0; int files = 0;
            try {
                File root = Environment.getExternalStorageDirectory();
                String[] dirs = {"DCIM/.thumbnails", "Pictures/.thumbnails", "Movies/.thumbnails", "LOST.DIR", ".Trash", "tmp", "temp", ".tmp", "Android/data/.nomedia_cache"};
                for (String d : dirs) { long s = wipe(new File(root, d), true); freed += s; }
                File data = new File(root, "Android/data");
                File[] apps = data.listFiles();
                if (apps != null) for (File a : apps) freed += wipe(new File(a, "cache"), true);
                long[] r = sweep(root, 0);
                freed += r[0]; files += (int) r[1];
            } catch (Exception ignored) {}
            try { return new JSONObject().put("freed", freed).put("files", files).put("free", disk()[0]).toString(); } catch (Exception e) { return "{}"; }
        }

        long[] sweep(File dir, int depth) {
            long freed = 0, n = 0;
            if (depth > 6) return new long[]{0, 0};
            File[] l = dir.listFiles();
            if (l == null) return new long[]{0, 0};
            for (File f : l) {
                String name = f.getName().toLowerCase();
                if (f.isDirectory()) {
                    if (name.equals("android") && depth == 0) continue;
                    long[] r = sweep(f, depth + 1); freed += r[0]; n += r[1];
                    String[] in = f.list();
                    if (in != null && in.length == 0) f.delete();
                } else if (name.endsWith(".tmp") || name.endsWith(".temp") || name.endsWith(".log") || name.equals("thumbs.db")
                        || name.equals(".ds_store") || name.startsWith("~$") || name.endsWith(".crdownload") || name.endsWith(".part")) {
                    long s = f.length();
                    if (f.delete()) { freed += s; n++; }
                }
            }
            return new long[]{freed, n};
        }

        /** Menü animasyonlarını hızlandırır (0.5x). true = yapıldı. */
        @JavascriptInterface
        public boolean speedUp(float scale) {
            String v = String.valueOf(scale);
            if (canSecure()) {
                try {
                    Settings.Global.putFloat(getContentResolver(), Settings.Global.WINDOW_ANIMATION_SCALE, scale);
                    Settings.Global.putFloat(getContentResolver(), Settings.Global.TRANSITION_ANIMATION_SCALE, scale);
                    Settings.Global.putFloat(getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE, scale);
                    return true;
                } catch (Exception ignored) {}
            }
            if (adb.ready()) {
                adb.shell("settings put global window_animation_scale " + v + "; settings put global transition_animation_scale " + v
                        + "; settings put global animator_duration_scale " + v, 8000);
                return Math.abs(anim() - scale) < 0.01;
            }
            return false;
        }

        /** Ağ hata ayıklaması açıksa TV'nin kendi ADB'sine bağlanır ve kalıcı izni alır. */
        @JavascriptInterface
        public void powerMode(final String cb) {
            new Thread(new Runnable() {
                public void run() {
                    boolean ok = adb.connect(25000);
                    if (ok) adb.shell("pm grant " + getPackageName() + " android.permission.WRITE_SECURE_SETTINGS", 8000);
                    js("window." + cb + " && window." + cb + "(" + ok + "," + canSecure() + ")");
                }
            }).start();
        }

        /** Derin optimizasyon (ADB ile): uygulamaları önceden derler, açılışları hızlanır. Uzun sürebilir. */
        @JavascriptInterface
        public void optimize(final String cb) {
            new Thread(new Runnable() {
                public void run() {
                    String r = null;
                    if (adb.ready()) {
                        adb.shell("sm fstrim", 120000);                       // flash belleği düzenler (TRIM)
                        r = adb.shell("cmd package bg-dexopt-job", 600000);   // uygulamaları önceden derler
                    }
                    js("window." + cb + " && window." + cb + "(" + (r != null) + ")");
                }
            }).start();
        }

        /** Arka planda kendiliğinden çalışan (açılışta başlayan) kullanıcı uygulamaları. Dönen: [{pkg,name,boot,restricted}] */
        @JavascriptInterface
        public String bgApps() {
            JSONArray out = new JSONArray();
            PackageManager pm = getPackageManager();
            String launcher = launcherPkg();
            String ops = adb.ready() ? adb.shell("appops get-all 2>/dev/null || true", 15000) : null;
            try {
                for (ApplicationInfo a : pm.getInstalledApplications(0)) {
                    if ((a.flags & ApplicationInfo.FLAG_SYSTEM) != 0) continue;
                    if (a.packageName.equals(getPackageName()) || a.packageName.equals(launcher)) continue;
                    boolean boot = false;
                    try {
                        PackageInfo pi = pm.getPackageInfo(a.packageName, PackageManager.GET_PERMISSIONS);
                        if (pi.requestedPermissions != null) for (String p : pi.requestedPermissions)
                            if ("android.permission.RECEIVE_BOOT_COMPLETED".equals(p)) boot = true;
                    } catch (Exception ignored) {}
                    out.put(new JSONObject().put("pkg", a.packageName).put("name", String.valueOf(pm.getApplicationLabel(a))).put("boot", boot));
                }
            } catch (Exception ignored) {}
            return out.toString();
        }

        /** Verilen uygulamaların arka planda çalışmasını kısıtlar/serbest bırakır (ADB gerekir). Dönen: kısıtlanan sayısı. */
        @JavascriptInterface
        public int restrictBackground(String pkgsJson, boolean on) {
            if (!adb.ready()) return -1;
            int n = 0;
            try {
                JSONArray a = new JSONArray(pkgsJson);
                StringBuilder sb = new StringBuilder();
                String mode = on ? "ignore" : "allow";
                for (int i = 0; i < a.length(); i++) {
                    String p = sh(a.getString(i));
                    sb.append("appops set ").append(p).append(" RUN_IN_BACKGROUND ").append(mode).append(" 2>/dev/null;");
                    sb.append("appops set ").append(p).append(" RUN_ANY_IN_BACKGROUND ").append(mode).append(" 2>/dev/null;");
                    if (on) sb.append("am force-stop ").append(p).append(" 2>/dev/null;");
                    n++;
                }
                if (n > 0) adb.shell(sb.toString(), 60000);
            } catch (Exception e) { return -1; }
            return n;
        }

        /** Uygulamayı tamamen durdurur (ADB varsa), yoksa arka plan işlerini kapatır. */
        @JavascriptInterface
        public boolean forceStop(String pkg) {
            if (adb.ready()) { adb.shell("am force-stop " + sh(pkg), 8000); return true; }
            try { ((ActivityManager) getSystemService(ACTIVITY_SERVICE)).killBackgroundProcesses(pkg); } catch (Exception ignored) {}
            return false;
        }

        /** Depolama haritası: ortak depolamadaki üst klasörler + Android/data altındaki uygulama verileri, boyutlarıyla. */
        @JavascriptInterface
        public String storageMap() {
            JSONArray out = new JSONArray();
            try {
                File root = Environment.getExternalStorageDirectory();
                File[] l = root.listFiles();
                if (l != null) for (File f : l) {
                    long s = dirSize(f);
                    if (s > 0) out.put(new JSONObject().put("path", f.getName()).put("size", s).put("dir", f.isDirectory()));
                }
                File data = new File(root, "Android/data");
                File[] apps = data.listFiles();
                if (apps != null) for (File a : apps) {
                    long s = dirSize(a);
                    if (s > 5L * 1024 * 1024) out.put(new JSONObject().put("path", "Android/data/" + a.getName()).put("size", s).put("dir", true).put("pkg", a.getName()));
                }
                // en büyük dosyalar ve bırakılan kurulum dosyaları (.apk)
                JSONArray big = new JSONArray();
                bigFiles(root, 0, big);
                return new JSONObject().put("dirs", out).put("big", big).put("free", disk()[0]).put("total", disk()[1]).toString();
            } catch (Exception e) { return "{\"dirs\":[],\"big\":[]}"; }
        }

        void bigFiles(File dir, int depth, JSONArray big) throws Exception {
            if (depth > 5) return;
            File[] l = dir.listFiles();
            if (l == null) return;
            for (File f : l) {
                if (f.isDirectory()) { if (!(depth == 0 && f.getName().equalsIgnoreCase("Android"))) bigFiles(f, depth + 1, big); continue; }
                String n = f.getName().toLowerCase();
                boolean apk = n.endsWith(".apk") || n.endsWith(".xapk") || n.endsWith(".apks");
                if (apk || f.length() >= 200L * 1024 * 1024)
                    big.put(new JSONObject().put("path", f.getAbsolutePath()).put("name", f.getName()).put("size", f.length()).put("apk", apk));
            }
        }

        /** Seçilen dosyaları siler (yalnız ortak depolama içinde). Dönen: {files, freed} */
        @JavascriptInterface
        public String deleteFiles(String json) {
            long freed = 0; int n = 0;
            try {
                String root = Environment.getExternalStorageDirectory().getCanonicalPath();
                JSONArray a = new JSONArray(json);
                for (int i = 0; i < a.length(); i++) {
                    File f = new File(a.getString(i));
                    if (!f.getCanonicalPath().startsWith(root)) continue;
                    long s = dirSize(f);
                    long w = wipe(f, false);
                    if (!f.exists()) { freed += s; n++; }
                }
            } catch (Exception ignored) {}
            try { return new JSONObject().put("files", n).put("freed", freed).put("free", disk()[0]).toString(); } catch (Exception e) { return "{}"; }
        }

        @JavascriptInterface
        public String apps(boolean all) {
            JSONArray out = new JSONArray();
            PackageManager pm = getPackageManager();
            try {
                for (ApplicationInfo a : pm.getInstalledApplications(0)) {
                    boolean sys = (a.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
                    if (!all && sys) continue;
                    if (a.packageName.equals(getPackageName())) continue;
                    long size = 0;
                    try { size = new File(a.sourceDir).length(); } catch (Exception ignored) {}
                    out.put(new JSONObject().put("pkg", a.packageName).put("name", String.valueOf(pm.getApplicationLabel(a)))
                            .put("sys", sys).put("size", size));
                }
            } catch (Exception ignored) {}
            return out.toString();
        }

        @JavascriptInterface
        public void appInfo(String pkg) {
            try { startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg))); } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void uninstall(String pkg) {
            try { startActivity(new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + pkg))); } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public boolean openSettings(String which) {
            String[][] tries;
            switch (which) {
                case "dev": tries = new String[][]{{"a", Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS},
                        {"c", "com.android.tv.settings", "com.android.tv.settings.system.development.DevelopmentActivity"}}; break;
                case "about": tries = new String[][]{{"a", Settings.ACTION_DEVICE_INFO_SETTINGS},
                        {"c", "com.android.tv.settings", "com.android.tv.settings.about.AboutActivity"}}; break;
                case "storage": tries = new String[][]{{"a", Settings.ACTION_INTERNAL_STORAGE_SETTINGS}}; break;
                case "apps": tries = new String[][]{{"a", Settings.ACTION_APPLICATION_SETTINGS}}; break;
                case "wifi": tries = new String[][]{{"a", Settings.ACTION_WIFI_SETTINGS}}; break;
                case "display": tries = new String[][]{{"a", Settings.ACTION_DISPLAY_SETTINGS}}; break;
                case "date": tries = new String[][]{{"a", Settings.ACTION_DATE_SETTINGS}}; break;
                case "lang": tries = new String[][]{{"a", Settings.ACTION_LOCALE_SETTINGS}}; break;
                default: tries = new String[][]{{"a", Settings.ACTION_SETTINGS}, {"c", "com.android.tv.settings", "com.android.tv.settings.MainSettings"}};
            }
            for (String[] t : tries) {
                try {
                    Intent i = t[0].equals("a") ? new Intent(t[1]) : new Intent().setComponent(new ComponentName(t[1], t[2]));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(i);
                    return true;
                } catch (Exception ignored) {}
            }
            return false;
        }

        @JavascriptInterface
        public void minimize() { ui.post(new Runnable() { public void run() { moveTaskToBack(true); } }); }

        @JavascriptInterface
        public void exit() { ui.post(new Runnable() { public void run() { adb.close(); finishAffinity(); } }); }

        @JavascriptInterface
        public void openUrl(String u) {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(u))); } catch (Exception ignored) {}
        }

        // ---------------- güncelleme: GitHub'dan APK (yüzde, MB, kalan, hız arayüzde)
        @JavascriptInterface
        public void downloadUpdate(final String url, final long size, final String sha256, final String cb) {
            new Thread(new Runnable() {
                public void run() {
                    try {
                        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                        c.setConnectTimeout(15000); c.setReadTimeout(30000);
                        c.setRequestProperty("Accept-Encoding", "identity");
                        long total = c.getContentLength() > 0 ? c.getContentLength() : size;
                        File dir = new File(getExternalCacheDir() != null ? getExternalCacheDir() : getCacheDir(), "upd");
                        dir.mkdirs();
                        File f = new File(dir, "TV-Bakim.apk");
                        InputStream in = c.getInputStream();
                        FileOutputStream o = new FileOutputStream(f);
                        MessageDigest md = MessageDigest.getInstance("SHA-256");
                        byte[] buf = new byte[16384];
                        long got = 0, last = 0;
                        int r;
                        while ((r = in.read(buf)) > 0) {
                            o.write(buf, 0, r); md.update(buf, 0, r); got += r;
                            long now = SystemClock.elapsedRealtime();
                            if (now - last > 200) { last = now; js("window." + cb + "(" + got + "," + total + ",false,null)"); }
                        }
                        o.close(); in.close();
                        StringBuilder h = new StringBuilder();
                        for (byte x : md.digest()) h.append(String.format("%02x", x));
                        if (sha256 != null && sha256.length() > 0 && !sha256.equalsIgnoreCase(h.toString())) {
                            js("window." + cb + "(" + got + "," + total + ",true," + q("sha256") + ")");
                            return;
                        }
                        js("window." + cb + "(" + got + "," + total + ",true,null)");
                        install(f);
                    } catch (final Exception e) {
                        js("window." + cb + "(0,0,true," + q(String.valueOf(e.getMessage())) + ")");
                    }
                }
            }).start();
        }
    }

    void install(File f) {
        try {
            if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
            }
            Intent i = new Intent(Intent.ACTION_VIEW);
            Uri u = Build.VERSION.SDK_INT >= 24 ? Files.uri(this, f) : Uri.fromFile(f);
            i.setDataAndType(u, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (Exception e) {
            js("window.toast && window.toast(" + q(String.valueOf(e.getMessage())) + ")");
        }
    }
}
