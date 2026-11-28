package com.departures.tvbakim;

import android.Manifest;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.app.AppOpsManager;
import android.app.UiModeManager;
import android.app.usage.StorageStats;
import android.app.usage.StorageStatsManager;
import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.Configuration;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Process;
import android.os.StatFs;
import android.os.SystemClock;
import android.os.storage.StorageManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * window.TV — TV Bakım'ın DAR köprüsü. Yalnız belirli, güvenli işlemler:
 *  - durum (RAM/depolama/animasyon ölçeği/izinler) okuma — salt okunur;
 *  - kendi önbelleğini temizleme;
 *  - ortak depolamada gereksiz dosya TARAMA; JS yalnız taramanın verdiği numaralarla (yol DEĞİL) dosyaları
 *    ÇÖP KUTUSUNA TAŞIR (geri alınabilir). Kalıcı silme yalnız çöp kutusunu boşaltırken, yerel (Android) onay penceresiyle;
 *  - uygulama listesi (yalnız başlatıcıda görünen uygulamalar; QUERY_ALL_PACKAGES yok), açma, sistem ayrıntı ekranı,
 *    kaldırma = sistemin kendi onay penceresi (ACTION_DELETE);
 *  - sabit bir listeden sistem ayar ekranı açma (ayar DEĞİŞTİRMEZ; WRITE_SECURE_SETTINGS / ADB yok);
 *  - ağ testi (yalnız sabit adresler).
 * Uzun işler arka planda; sonuç window.__tv(tür, json) ile gelir.
 */
final class TvBridge {
    private static final Pattern PKG = Pattern.compile("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z0-9_]+)+");
    static final String OLD_PKG = "tr.tvbakim";
    private final MainActivity a;
    private volatile Map<Integer, Tarama.Oge> sonTarama = new HashMap<>();
    private volatile boolean taramaIptal = false, taraniyor = false, agTesti = false;

    TvBridge(MainActivity a) { this.a = a; }

    private void emit(String kind, String json) {
        a.js("window.__tv && window.__tv(" + JSONObject.quote(kind) + "," + json + ")");
    }

    private void arka(Runnable r) { new Thread(r, "tv-bakim").start(); }

    // ------------------------------------------------------------------ durum
    File depo() { return Environment.getExternalStorageDirectory(); }

    boolean dosyaIzni() {
        if (Build.VERSION.SDK_INT >= 30) return Environment.isExternalStorageManager();
        if (Build.VERSION.SDK_INT >= 23) return a.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
        return true;
    }

    boolean kullanimIzni() {
        try {
            AppOpsManager ao = (AppOpsManager) a.getSystemService(Context.APP_OPS_SERVICE);
            @SuppressWarnings("deprecation")
            int m = ao.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), a.getPackageName());
            return m == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) {
            return false;
        }
    }

    private float olcek(String ad) {
        try { return Settings.Global.getFloat(a.getContentResolver(), ad, 1f); } catch (Exception e) { return 1f; }
    }

    private int global(String ad) {
        try { return Settings.Global.getInt(a.getContentResolver(), ad, 0); } catch (Exception e) { return 0; }
    }

    /** Kısıtlı profil / yönetilen kullanıcı: geliştirici özellikleri bu kullanıcı için yasaklanmış ("Geliştirici seçenekleri kullanılamaz"). */
    private boolean gelistiriciKisitli() {
        try {
            android.os.UserManager um = (android.os.UserManager) a.getSystemService(Context.USER_SERVICE);
            return um != null && (um.hasUserRestriction(android.os.UserManager.DISALLOW_DEBUGGING_FEATURES)
                    || (Build.VERSION.SDK_INT >= 24 && um.isDemoUser()));
        } catch (Exception e) { return false; }
    }

    private boolean cozulur(Intent i) {
        try { return a.getPackageManager().resolveActivity(i, 0) != null; } catch (Exception e) { return false; }
    }

    boolean kurulu(String pkg) {
        try { a.getPackageManager().getPackageInfo(pkg, 0); return true; } catch (Exception e) { return false; }
    }

    @JavascriptInterface
    public String info() {
        try {
            ActivityManager am = (ActivityManager) a.getSystemService(Context.ACTIVITY_SERVICE);
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            StatFs ic = new StatFs(Environment.getDataDirectory().getPath());
            UiModeManager um = (UiModeManager) a.getSystemService(Context.UI_MODE_SERVICE);
            boolean tv = um != null && um.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
            long cache = CopKutusu.boyut(a.getCacheDir()) + (a.getExternalCacheDir() != null ? CopKutusu.boyut(a.getExternalCacheDir()) : 0);
            return new JSONObject()
                    .put("version", a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName)
                    .put("sdk", Build.VERSION.SDK_INT).put("android", Build.VERSION.RELEASE)
                    .put("model", Build.MODEL).put("brand", Build.MANUFACTURER).put("tv", tv)
                    .put("ramFree", mi.availMem).put("ramTotal", mi.totalMem).put("lowMem", mi.lowMemory)
                    .put("diskFree", ic.getAvailableBytes()).put("diskTotal", ic.getTotalBytes())
                    .put("ownCache", cache)
                    .put("uptimeMs", SystemClock.elapsedRealtime())
                    .put("animWindow", olcek(Settings.Global.WINDOW_ANIMATION_SCALE))
                    .put("animTransition", olcek(Settings.Global.TRANSITION_ANIMATION_SCALE))
                    .put("animator", olcek(Settings.Global.ANIMATOR_DURATION_SCALE))
                    .put("devOptions", global(Settings.Global.DEVELOPMENT_SETTINGS_ENABLED) == 1)
                    .put("devRestricted", gelistiriciKisitli())
                    .put("devScreen", cozulur(new Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS)) || cozulur(bilesen("com.android.tv.settings", "com.android.tv.settings.system.development.DevelopmentActivity")))
                    .put("accessScreen", Build.VERSION.SDK_INT >= 28 && cozulur(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)))
                    .put("adb", global(Settings.Global.ADB_ENABLED) == 1)
                    .put("storagePerm", dosyaIzni())
                    .put("storagePermKind", Build.VERSION.SDK_INT >= 30 ? "all-files" : Build.VERSION.SDK_INT >= 23 ? "runtime" : "none")
                    .put("usagePerm", kullanimIzni()).put("usageSizes", Build.VERSION.SDK_INT >= 26)
                    .put("installPerm", Build.VERSION.SDK_INT < 26 || a.getPackageManager().canRequestPackageInstalls())
                    .put("oldApp", kurulu(OLD_PKG))
                    .put("trashBytes", dosyaIzni() ? new CopKutusu(depo()).toplam() : 0)
                    .toString();
        } catch (Exception e) {
            return "{}";
        }
    }

    /** Yalnız bu uygulamanın kendi önbelleği (güncelleme klasörü hariç). */
    @JavascriptInterface
    public String clearOwnCache() {
        long n = 0;
        n += temizle(a.getCacheDir(), true);
        if (a.getExternalCacheDir() != null) n += temizle(a.getExternalCacheDir(), true);
        try {
            a.runOnUiThread(() -> a.clearWebCache());
            return new JSONObject().put("freed", n).toString();
        } catch (Exception e) {
            return "{\"freed\":0}";
        }
    }

    private static long temizle(File d, boolean kok) {
        long n = 0;
        File[] l = d.listFiles();
        if (l != null) for (File f : l) {
            if (kok && f.getName().equals("updates")) continue;   // ApkPatchInstaller (güncelleme sürüyor olabilir)
            if (f.isDirectory()) n += temizle(f, false);
            else { long s = f.length(); if (f.delete()) n += s; }
        }
        if (!kok) d.delete();
        return n;
    }

    // ------------------------------------------------------------------ gereksiz dosyalar
    @JavascriptInterface
    public void scan() {
        if (taraniyor) return;
        taraniyor = true;
        taramaIptal = false;
        arka(() -> {
            try {
                if (!dosyaIzni()) { emit("scan", "{\"ok\":false,\"needPermission\":true}"); return; }
                Tarama.Sonuc s = Tarama.tara(depo(), CopKutusu.KLASOR, (taranan, bulunan) -> {
                    emit("scanProgress", "{\"scanned\":" + taranan + ",\"found\":" + bulunan + "}");
                    return taramaIptal;
                });
                Map<Integer, Tarama.Oge> m = new HashMap<>();
                JSONArray arr = new JSONArray();
                for (Tarama.Oge o : s.ogeler) {
                    m.put(o.id, o);
                    arr.put(new JSONObject().put("id", o.id).put("rel", o.rel).put("size", o.size).put("mtime", o.mtime).put("cat", o.cat));
                }
                sonTarama = m;
                emit("scan", new JSONObject().put("ok", true).put("items", arr).put("scanned", s.taranan).put("truncated", s.kesildi).toString());
            } catch (Exception e) {
                emit("scan", "{\"ok\":false,\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}");
            } finally {
                taraniyor = false;
            }
        });
    }

    @JavascriptInterface
    public void cancelScan() { taramaIptal = true; }

    /** Son taramadaki numaralı dosyaları çöp kutusuna taşır. Yol kabul etmez; değişmiş dosyayı taşımaz. */
    @JavascriptInterface
    public void trash(String idsJson) {
        arka(() -> {
            int moved = 0, failed = 0;
            long bytes = 0;
            try {
                if (!dosyaIzni()) throw new Exception("NO_PERMISSION");
                JSONArray ids = new JSONArray(idsJson);
                CopKutusu c = new CopKutusu(depo());
                Map<Integer, Tarama.Oge> m = sonTarama;
                for (int i = 0; i < ids.length(); i++) {
                    Tarama.Oge o = m.get(ids.optInt(i, -1));
                    if (o == null || !Tarama.ayni(o)) { failed++; continue; }
                    try { c.tasi(o.file, o.rel); moved++; bytes += o.size; m.remove(o.id); } catch (Exception e) { failed++; }
                }
                emit("trashed", new JSONObject().put("moved", moved).put("bytes", bytes).put("failed", failed).toString());
            } catch (Exception e) {
                emit("trashed", "{\"moved\":" + moved + ",\"bytes\":" + bytes + ",\"failed\":" + failed + ",\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}");
            }
        });
    }

    @JavascriptInterface
    public String trashList() {
        try {
            JSONArray arr = new JSONArray();
            long t = 0;
            if (dosyaIzni()) for (CopKutusu.Kayit k : new CopKutusu(depo()).liste()) {
                arr.put(new JSONObject().put("id", k.id).put("at", k.at).put("size", k.size).put("orig", k.orig).put("name", k.name));
                t += k.size;
            }
            return new JSONObject().put("items", arr).put("total", t).put("folder", CopKutusu.KLASOR).put("permission", dosyaIzni()).toString();
        } catch (Exception e) {
            return "{\"items\":[],\"total\":0}";
        }
    }

    @JavascriptInterface
    public void restore(String idsJson) {
        arka(() -> {
            int ok = 0, failed = 0;
            try {
                JSONArray ids = new JSONArray(idsJson);
                CopKutusu c = new CopKutusu(depo());
                for (int i = 0; i < ids.length(); i++) {
                    try { c.geriAl(ids.getString(i)); ok++; } catch (Exception e) { failed++; }
                }
            } catch (Exception ignored) { }
            emit("restored", "{\"ok\":" + ok + ",\"failed\":" + failed + "}");
        });
    }

    /**
     * Çöp kutusundaki seçilenleri KALICI siler — ama önce Android'in kendi onay penceresi açılır (varsayılan düğme Vazgeç).
     * Metinler arayüzün dilinde JS'ten gelir. Onaylanmazsa hiçbir şey silinmez.
     */
    @JavascriptInterface
    public void emptyTrash(String idsJson, String title, String message, String yes, String no) {
        a.runOnUiThread(() -> {
            try {
                AlertDialog d = new AlertDialog.Builder(a)
                        .setTitle(title).setMessage(message)
                        .setNegativeButton(no, (x, w) -> emit("emptied", "{\"cancelled\":true}"))
                        .setPositiveButton(yes, (x, w) -> kaliciSil(idsJson))
                        .setOnCancelListener(x -> emit("emptied", "{\"cancelled\":true}"))
                        .create();
                d.show();
                d.getButton(AlertDialog.BUTTON_NEGATIVE).requestFocus();
            } catch (Exception e) {
                emit("emptied", "{\"cancelled\":true}");
            }
        });
    }

    private void kaliciSil(String idsJson) {
        arka(() -> {
            long bytes = 0;
            int n = 0;
            try {
                JSONArray ids = new JSONArray(idsJson);
                CopKutusu c = new CopKutusu(depo());
                for (int i = 0; i < ids.length(); i++) {
                    try { bytes += c.kaliciSil(ids.getString(i)); n++; } catch (Exception ignored) { }
                }
            } catch (Exception ignored) { }
            emit("emptied", "{\"count\":" + n + ",\"bytes\":" + bytes + "}");
        });
    }

    // ------------------------------------------------------------------ uygulamalar
    /** Başlatıcıda (TV ya da telefon) görünen uygulamalar. QUERY_ALL_PACKAGES kullanılmaz (manifest <queries>). */
    Set<String> gorunenler() {
        PackageManager pm = a.getPackageManager();
        Set<String> s = new HashSet<>();
        for (String cat : new String[]{Intent.CATEGORY_LAUNCHER, Intent.CATEGORY_LEANBACK_LAUNCHER}) {
            try {
                List<ResolveInfo> l = pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(cat), 0);
                for (ResolveInfo r : l) if (r.activityInfo != null) s.add(r.activityInfo.packageName);
            } catch (Exception ignored) { }
        }
        s.remove(a.getPackageName());
        return s;
    }

    private boolean gecerli(String pkg) {
        return pkg != null && pkg.length() < 200 && PKG.matcher(pkg).matches() && !pkg.equals(a.getPackageName())
                && (gorunenler().contains(pkg) || pkg.equals(OLD_PKG) && kurulu(OLD_PKG));
    }

    @JavascriptInterface
    public void apps() {
        arka(() -> {
            try {
                PackageManager pm = a.getPackageManager();
                boolean usage = Build.VERSION.SDK_INT >= 26 && kullanimIzni();
                JSONArray arr = new JSONArray();
                List<String> l = new ArrayList<>(gorunenler());
                for (String p : l) {
                    try {
                        ApplicationInfo ai = pm.getApplicationInfo(p, 0);
                        long apk = new File(ai.sourceDir).length();
                        JSONObject o = new JSONObject().put("pkg", p).put("name", String.valueOf(pm.getApplicationLabel(ai)))
                                .put("sys", (ai.flags & ApplicationInfo.FLAG_SYSTEM) != 0).put("apk", apk);
                        if (usage) {
                            StorageStatsManager ssm = (StorageStatsManager) a.getSystemService(Context.STORAGE_STATS_SERVICE);
                            StorageStats st = ssm.queryStatsForPackage(StorageManager.UUID_DEFAULT, p, Process.myUserHandle());
                            o.put("app", st.getAppBytes()).put("data", st.getDataBytes()).put("cache", st.getCacheBytes());
                        }
                        arr.put(o);
                    } catch (Exception ignored) { }
                }
                emit("apps", new JSONObject().put("usage", usage).put("items", arr).toString());
            } catch (Exception e) {
                emit("apps", "{\"usage\":false,\"items\":[],\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}");
            }
        });
    }

    @JavascriptInterface
    public boolean openApp(String pkg) {
        if (!gecerli(pkg)) return false;
        PackageManager pm = a.getPackageManager();
        Intent i = Build.VERSION.SDK_INT >= 21 ? pm.getLeanbackLaunchIntentForPackage(pkg) : null;
        if (i == null) i = pm.getLaunchIntentForPackage(pkg);
        return i != null && baslat(i);
    }

    /** Sistemin uygulama bilgisi ekranı (orada "Önbelleği temizle" / "Durmaya zorla" kullanıcının elindedir). */
    @JavascriptInterface
    public boolean appDetails(String pkg) {
        if (!gecerli(pkg)) return false;
        return baslat(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg)));
    }

    /** Kaldırma: sistemin kendi onay penceresi açılır; kullanıcı onaylamazsa hiçbir şey olmaz. */
    @JavascriptInterface
    public boolean uninstall(String pkg) {
        if (!gecerli(pkg)) return false;
        return baslat(new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + pkg)));
    }

    // ------------------------------------------------------------------ sistem ekranları (yalnız açar, değiştirmez)
    private boolean baslat(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            a.startActivity(i);
            return true;
        } catch (ActivityNotFoundException | SecurityException e) {
            return false;
        }
    }

    private static Intent bilesen(String pkg, String cls) { return new Intent().setComponent(new ComponentName(pkg, cls)); }

    @JavascriptInterface
    public boolean openSettings(String which) {
        String pk = "package:" + a.getPackageName();
        List<Intent> l = new ArrayList<>();
        switch (String.valueOf(which)) {
            case "dev":
                l.add(new Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS));
                l.add(bilesen("com.android.tv.settings", "com.android.tv.settings.system.development.DevelopmentActivity"));
                break;
            case "about":
                l.add(new Intent(Settings.ACTION_DEVICE_INFO_SETTINGS));
                l.add(bilesen("com.android.tv.settings", "com.android.tv.settings.about.AboutActivity"));
                l.add(bilesen("com.android.tv.settings", "com.android.tv.settings.device.DevicePrefsActivity"));
                l.add(new Intent(Settings.ACTION_SETTINGS));
                break;
            case "storage":
                l.add(new Intent(Settings.ACTION_INTERNAL_STORAGE_SETTINGS));
                l.add(bilesen("com.android.tv.settings", "com.android.tv.settings.device.StorageResetActivity"));
                break;
            case "apps":
                l.add(new Intent(Settings.ACTION_MANAGE_APPLICATIONS_SETTINGS));
                l.add(new Intent(Settings.ACTION_APPLICATION_SETTINGS));
                break;
            case "access": l.add(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)); break;
            case "users": l.add(new Intent("android.settings.USER_SETTINGS")); l.add(new Intent(Settings.ACTION_SETTINGS)); break;
            case "wifi": l.add(new Intent(Settings.ACTION_WIFI_SETTINGS)); break;
            case "network": l.add(new Intent(Settings.ACTION_WIRELESS_SETTINGS)); l.add(new Intent(Settings.ACTION_WIFI_SETTINGS)); break;
            case "display": l.add(new Intent(Settings.ACTION_DISPLAY_SETTINGS)); break;
            case "date": l.add(new Intent(Settings.ACTION_DATE_SETTINGS)); break;
            case "lang": l.add(new Intent(Settings.ACTION_LOCALE_SETTINGS)); break;
            case "usage":
                if (Build.VERSION.SDK_INT >= 29) l.add(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS, Uri.parse(pk)));
                l.add(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
                break;
            case "allfiles":
                if (Build.VERSION.SDK_INT >= 30) {
                    l.add(new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse(pk)));
                    l.add(new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION));
                }
                l.add(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse(pk)));
                break;
            case "unknown":
                if (Build.VERSION.SDK_INT >= 26) l.add(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse(pk)));
                l.add(new Intent(Settings.ACTION_SECURITY_SETTINGS));
                break;
            case "self": l.add(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse(pk))); break;
            default:
                l.add(new Intent(Settings.ACTION_SETTINGS));
                l.add(bilesen("com.android.tv.settings", "com.android.tv.settings.MainSettings"));
        }
        for (Intent i : l) if (baslat(i)) return true;
        return false;
    }

    /** Dosya izni: Android 11+ "Tüm dosyalara erişim" ekranı, 6–10 çalışma zamanı izni. Dönen: requested | opened | granted | unavailable */
    @JavascriptInterface
    public String requestStorage() {
        if (dosyaIzni()) return "granted";
        if (Build.VERSION.SDK_INT >= 30) return openSettings("allfiles") ? "opened" : "unavailable";
        a.runOnUiThread(() -> a.requestPermissions(new String[]{Manifest.permission.READ_EXTERNAL_STORAGE, Manifest.permission.WRITE_EXTERNAL_STORAGE}, MainActivity.REQ_STORAGE));
        return "requested";
    }

    // ------------------------------------------------------------------ ağ testi (sabit adresler)
    @JavascriptInterface
    public void netTest() {
        if (agTesti) return;
        agTesti = true;
        arka(() -> {
            try {
                JSONObject r = new JSONObject();
                ConnectivityManager cm = (ConnectivityManager) a.getSystemService(Context.CONNECTIVITY_SERVICE);
                @SuppressWarnings("deprecation") NetworkInfo ni = cm == null ? null : cm.getActiveNetworkInfo();
                @SuppressWarnings("deprecation") boolean bagli = ni != null && ni.isConnected();
                @SuppressWarnings("deprecation") String tur = ni == null ? "none" : ni.getType() == ConnectivityManager.TYPE_ETHERNET ? "ethernet" : ni.getType() == ConnectivityManager.TYPE_WIFI ? "wifi" : "other";
                r.put("connected", bagli).put("type", tur);
                emit("net", new JSONObject().put("phase", "link").put("result", r).toString());
                if (!bagli) { emit("net", "{\"phase\":\"done\",\"result\":" + r + "}"); return; }
                long t0 = SystemClock.elapsedRealtime();
                try { InetAddress.getByName("www.google.com"); r.put("dnsMs", SystemClock.elapsedRealtime() - t0); } catch (Exception e) { r.put("dnsMs", -1); }
                emit("net", new JSONObject().put("phase", "dns").put("result", r).toString());
                long[] p = new long[4];
                int ok = 0;
                for (int i = 0; i < p.length; i++) {
                    long s = SystemClock.elapsedRealtime();
                    int code = istek("https://www.google.com/generate_204", 0, null);
                    p[i] = code == 204 || code == 200 ? SystemClock.elapsedRealtime() - s : -1;
                    if (p[i] >= 0) ok++;
                }
                long[] sirali = Arrays.copyOfRange(p, 1, p.length);   // ilki TLS el sıkışmasını da içerir
                Arrays.sort(sirali);
                long ping = -1;
                for (long x : sirali) if (x >= 0) { ping = x; break; }
                r.put("pingMs", ping).put("pingOk", ok);
                emit("net", new JSONObject().put("phase", "ping").put("result", r).toString());
                long[] dl = new long[]{0, 0};
                int code = istek("https://speed.cloudflare.com/__down?bytes=25000000", 8000, dl);
                double mbps = dl[1] > 0 ? (dl[0] * 8.0 / 1e6) / (dl[1] / 1000.0) : 0;
                r.put("downBytes", dl[0]).put("downMs", dl[1]).put("mbps", Math.round(mbps * 10) / 10.0).put("downCode", code);
                emit("net", new JSONObject().put("phase", "done").put("result", r).toString());
            } catch (Exception e) {
                emit("net", "{\"phase\":\"error\",\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}");
            } finally {
                agTesti = false;
            }
        });
    }

    /** limitMs > 0: gövde o süre boyunca okunur, dl = {bayt, ms}. Dönen: HTTP kodu ya da -1. */
    private static int istek(String u, long limitMs, long[] dl) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(u).openConnection();
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            c.setUseCaches(false);
            c.setRequestProperty("User-Agent", "TVBakim");
            int code = c.getResponseCode();
            if (dl != null) {
                long t0 = SystemClock.elapsedRealtime(), n = 0;
                byte[] buf = new byte[32 * 1024];
                try (InputStream in = c.getInputStream()) {
                    int r;
                    while ((r = in.read(buf)) > 0) {
                        n += r;
                        if (SystemClock.elapsedRealtime() - t0 > limitMs) break;
                    }
                }
                dl[0] = n;
                dl[1] = SystemClock.elapsedRealtime() - t0;
            } else {
                try (InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream()) { if (in != null) while (in.read() >= 0) { } }
            }
            return code;
        } catch (Exception e) {
            return -1;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    // ------------------------------------------------------------------ 1.0.x'ten taşınan ayarlar
    /** Eski sürümün (file:// kökeni) localStorage ayarları; bir kez taşınır. */
    @JavascriptInterface
    public String legacy() { return a.getSharedPreferences("tasima", Context.MODE_PRIVATE).getString("eski", "{}"); }

    @JavascriptInterface
    public void legacyDone() { a.getSharedPreferences("tasima", Context.MODE_PRIVATE).edit().putString("eski", "{}").apply(); }

    /** Yalnız MainActivity'nin bir kerelik taşıma sayfası (file:///android_asset/tasi.html) çağırır. */
    @JavascriptInterface
    public void tasi(String json) { a.runOnUiThread(() -> a.tasimaBitti(json)); }
}
