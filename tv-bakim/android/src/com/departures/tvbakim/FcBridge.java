package com.departures.tvbakim;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import com.departuresmil.ortak.ApkPatchInstaller;
import com.departuresmil.ortak.FcDelta;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Arrays;

/**
 * window.AndroidBridge — ortak çekirdeğin Android sözleşmesi (web/js/host.js):
 *   appVersion, moveTaskToBack, openExternal (yalnız https),
 *   updateBegin / updateChunk / updateFinish (çekirdek sözleşmesi: JS'ten gelen yama ya da tam APK baytları),
 *   apkUpdate(planJson) (YEREL EK: indirme + yama + kurulum yerelde, ortak ApkPatchInstaller ile:
 *     kurulu APK (applicationInfo.sourceDir) + FCD1 yama → yeni APK; yama yoksa/başarısızsa otomatik tam APK).
 * Olaylar JS'e window.__fcApk({type:'progress'|'patchFailed'|'installing'|'done'|'error', …}) ile gider.
 * Tüm sürümler aynı anahtarla imzalanır (CI: ANDROID_KEYSTORE_* secret'ları; tvbakim.jks); aksi halde Android kurulumu reddeder.
 * Kitaplık FcBridge.java'nın aynısı (bildirim ve tam ekran düğmesi yok: TV hep tam ekran).
 */
final class FcBridge {
    static final String AUTHORITY_SUFFIX = ".guncelleme";   // UpdateFileProvider (AndroidManifest.xml)
    private final MainActivity a;
    private File incoming = null;
    private FileOutputStream incomingOut = null;
    private String incomingKind = "";
    private JSONObject incomingMeta = null;
    private static volatile boolean busy = false;

    FcBridge(MainActivity a) { this.a = a; }

    private ApkPatchInstaller installer() {
        return new ApkPatchInstaller(a, a.getPackageName() + AUTHORITY_SUFFIX);
    }
    private SharedPreferences prefs() { return a.getSharedPreferences("fc_guncelleme", MainActivity.MODE_PRIVATE); }

    @JavascriptInterface
    public String appVersion() {
        try { return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName; } catch (Exception e) { return ""; }
    }

    @JavascriptInterface
    public void moveTaskToBack() { a.runOnUiThread(() -> a.moveTaskToBack(true)); }

    @JavascriptInterface
    public void openExternal(String url) {
        if (url == null || !url.startsWith("https://")) return;
        a.runOnUiThread(() -> {
            try { a.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
        });
    }

    // ---------- çekirdek sözleşmesi: baytlar JS'ten (base64 parçalar) ----------
    @JavascriptInterface
    public synchronized boolean updateBegin(String kind, String metaJson) {
        try {
            closeIncoming();
            incomingKind = "patch".equals(kind) ? "patch" : "full";
            incomingMeta = new JSONObject(metaJson == null ? "{}" : metaJson);
            incoming = new File(installer().updatesDir(), "patch".equals(incomingKind) ? "update.patch" : "incoming.apk");
            incomingOut = new FileOutputStream(incoming);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public synchronized boolean updateChunk(String b64) {
        try {
            incomingOut.write(Base64.decode(b64, Base64.DEFAULT));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public synchronized String updateFinish() {
        try {
            incomingOut.close();
            incomingOut = null;
            String want = incomingMeta.optString("targetSha256", "");
            File out = new File(installer().updatesDir(), "update.apk");
            if ("patch".equals(incomingKind)) {
                File installed = new File(a.getApplicationInfo().sourceDir);
                FcDelta.Header h = FcDelta.apply(installed, incoming, out, null);
                if (!want.isEmpty() && !want.equalsIgnoreCase(h.dstSha256Hex())) throw new IOException("BAD_HASH");
            } else {
                if (!want.isEmpty() && !want.equalsIgnoreCase(FcDelta.hex(FcDelta.sha256(incoming)))) throw new IOException("BAD_HASH");
                if (out.exists()) out.delete();
                if (!incoming.renameTo(out)) throw new IOException("MOVE_FAILED");
            }
            dogrula(out);
            installOnUi(out);
            return "{\"ok\":true}";
        } catch (Exception e) {
            return "{\"ok\":false,\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}";
        } finally {
            if (incoming != null && incoming.getName().equals("update.patch")) incoming.delete();
            closeIncoming();
        }
    }

    private void closeIncoming() {
        if (incomingOut != null) try { incomingOut.close(); } catch (IOException ignored) { }
        incomingOut = null;
    }

    // ---------- YEREL EK: yerel indirme + ApkPatchInstaller ----------
    @JavascriptInterface
    public void apkUpdate(String planJson) {
        if (busy) { emit("{\"type\":\"error\",\"error\":\"BUSY\"}"); return; }
        busy = true;
        new Thread(() -> {
            try {
                JSONObject p = new JSONObject(planJson);
                JSONObject full = p.getJSONObject("full");
                JSONObject patch = p.optJSONObject("patch");
                if (!izinliAdres(full.getString("url")) || (patch != null && !izinliAdres(patch.optString("url", "")))) throw new IOException("BAD_URL");
                ApkPatchInstaller up = installer();
                File apk = up.obtainApk(full.getString("url"), full.getString("sha256"), full.optLong("size", 0),
                        patch != null ? patch.optString("url", null) : null,
                        patch != null ? patch.optString("sha256", null) : null,
                        patch != null ? patch.optLong("size", 0) : 0,
                        new ApkPatchInstaller.Listener() {
                            @Override
                            public void onProgress(boolean patchMode, long done, long total, double bps) {
                                emit("{\"type\":\"progress\",\"patch\":" + patchMode + ",\"done\":" + done + ",\"total\":" + total + "}");
                            }

                            @Override
                            public void onPatchFailed(Exception e) {
                                emit("{\"type\":\"patchFailed\",\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}");
                            }
                        });
                dogrula(apk);
                emit("{\"type\":\"installing\"}");
                installOnUi(apk);
                emit("{\"type\":\"done\",\"result\":\"done\"}");
            } catch (Exception e) {
                emit("{\"type\":\"error\",\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())) + "}");
            } finally {
                busy = false;
            }
        }).start();
    }

    /** Paket yükleyiciyi açar; "bilinmeyen kaynaklar" izni yoksa ayar ekranı açılır ve geri dönülünce (onResume) yeniden denenir. */
    private void installOnUi(File apk) {
        a.runOnUiThread(() -> {
            boolean ok = installer().install(apk);
            prefs().edit().putBoolean("installPending", !ok).apply();
        });
    }

    /** MainActivity.onResume: izin verildiyse bekleyen kurulumu sürdür. */
    void resumeInstall() {
        if (!prefs().getBoolean("installPending", false)) return;
        File apk = new File(installer().updatesDir(), "update.apk");
        if (!apk.exists()) { prefs().edit().putBoolean("installPending", false).apply(); return; }
        if (android.os.Build.VERSION.SDK_INT >= 26 && !a.getPackageManager().canRequestPackageInstalls()) return;
        installOnUi(apk);
    }

    /** Açılışta: önceki güncelleme dosyalarını sil (kurulumdan sonra yeni sürüm açıldığında). */
    void cleanupIfUpdated() {
        String v = appVersion();
        if (!v.equals(prefs().getString("lastVersion", ""))) {
            if (!busy) installer().cleanup();
            prefs().edit().putString("lastVersion", v).putBoolean("installPending", false).apply();
        }
    }

    /** Yalnız bu deponun sürüm dosyaları indirilir. */
    static boolean izinliAdres(String u) {
        return u != null && u.startsWith("https://github.com/departures-mil/duyurular/releases/download/");
    }

    /** Kurulacak APK bu uygulamanın kendisi mi (aynı paket adı + aynı imza)? Değilse kurulum açılmaz. */
    private void dogrula(File apk) throws IOException {
        PackageManager pm = a.getPackageManager();
        PackageInfo yeni = pm.getPackageArchiveInfo(apk.getPath(), PackageManager.GET_SIGNATURES);
        if (yeni == null || !a.getPackageName().equals(yeni.packageName)) throw new IOException("WRONG_PACKAGE");
        try {
            PackageInfo kurulu = pm.getPackageInfo(a.getPackageName(), PackageManager.GET_SIGNATURES);
            if (yeni.signatures != null && yeni.signatures.length > 0 && kurulu.signatures != null
                    && !Arrays.equals(yeni.signatures, kurulu.signatures)) throw new IOException("WRONG_SIGNATURE");
        } catch (PackageManager.NameNotFoundException e) {
            throw new IOException("WRONG_PACKAGE");
        }
    }

    private void emit(String json) { a.js("window.__fcApk && window.__fcApk(" + json + ")"); }
}
