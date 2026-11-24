package com.departures.tvbakim;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

/**
 * TV Bakım kabuğu (1.1.0'dan beri). Arayüz https://tvbakim.local/ adresinden APK içindeki assets/www'den sunulur
 * (adres DEĞİŞMEMELİ: ayarlar bu kökenin localStorage'ında). Ağdan yalnız GitHub sürüm dosyaları okunur (latest.json,
 * CORS için yerelde çekilir). file:// erişimi, evrensel erişim ve şifresiz (http) trafik KAPALI.
 * 1.0.x ayarları (file:///android_asset kökeni) ilk açılışta bir kez taşınır.
 * Güvenlik: 1.0.x'in TV'nin kendi ADB'sine bağlanma, WRITE_SECURE_SETTINGS alma ve geliştirici seçeneklerini açık tutma
 * davranışları kaldırıldı; ADB anahtar dosyası silinir.
 */
public class MainActivity extends Activity {
    static final String HOST = "tvbakim.local";
    static final String BASE = "https://" + HOST + "/";
    static final int REQ_STORAGE = 21;
    private static final String RELEASES = "/departures-mil/duyurular/releases/";

    private WebView web;
    private FcBridge fc;
    private boolean tasimaSayfasi = false;

    void js(String code) { runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); }); }

    void clearWebCache() { if (web != null) web.clearCache(false); }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);
        eskiyiTemizle();
        web = new WebView(this);
        web.setBackgroundColor(0xFF0B1220);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);            // file:///android_asset yine okunur (yalnız taşıma sayfası)
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);
        fc = new FcBridge(this);
        web.addJavascriptInterface(fc, "AndroidBridge");
        web.addJavascriptInterface(new TvBridge(this), "TV");
        fc.cleanupIfUpdated();
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost()) && "https".equals(u.getScheme())) return asset(u);
                return githubProxy(req);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost()) && "https".equals(u.getScheme())) return false;
                if ("https".equals(u.getScheme())) dis(u);
                return true;                     // başka hiçbir adres bu pencerede açılmaz
            }
        });
        web.setWebChromeClient(new WebChromeClient());
        setContentView(web);
        tamEkran();
        SharedPreferences t = getSharedPreferences("tasima", MODE_PRIVATE);
        if (!t.getBoolean("bitti", false)) {
            tasimaSayfasi = true;
            web.loadUrl("file:///android_asset/tasi.html");
            web.postDelayed(() -> { if (tasimaSayfasi) tasimaBitti("{}"); }, 4000);
        } else web.loadUrl(BASE + "index.html");
    }

    /** tasi.html eski ayarları okuyunca (ya da 4 sn sonra) asıl arayüz açılır. */
    void tasimaBitti(String json) {
        if (!tasimaSayfasi) return;
        tasimaSayfasi = false;
        getSharedPreferences("tasima", MODE_PRIVATE).edit().putBoolean("bitti", true)
                .putString("eski", json == null || json.length() > 20000 ? "{}" : json).apply();
        web.loadUrl(BASE + "index.html");
    }

    /** 1.0.x kalıntıları: TV ADB'si için üretilen özel anahtar ve eski güncelleme klasörü. */
    private void eskiyiTemizle() {
        new Thread(() -> {
            File[] l = getFilesDir().listFiles();
            if (l != null) for (File f : l) if (f.getName().startsWith("adbkey")) f.delete();
            File ec = getExternalCacheDir();
            File upd = new File(ec != null ? ec : getCacheDir(), "upd");
            File[] u = upd.listFiles();
            if (u != null) for (File f : u) f.delete();
            upd.delete();
        }).start();
    }

    private WebResourceResponse asset(Uri u) {
        String path = u.getPath();
        if (path == null || path.equals("/")) path = "/index.html";
        path = Uri.decode(path);
        if (path.contains("..") || path.contains("\\")) return bulunamadi();
        try {
            InputStream in = getAssets().open("www" + path);
            WebResourceResponse r = new WebResourceResponse(mime(path), "utf-8", in);
            Map<String, String> h = new HashMap<>();
            h.put("Cache-Control", "no-cache");
            h.put("X-Content-Type-Options", "nosniff");
            r.setResponseHeaders(h);
            return r;
        } catch (Exception e) {
            return bulunamadi();
        }
    }

    private static WebResourceResponse bulunamadi() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
    }

    static String mime(String p) {
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    /** github.com/departures-mil/duyurular/releases/… (latest.json) — GitHub CORS başlığı vermediği için yerelde çekilir. */
    private WebResourceResponse githubProxy(WebResourceRequest req) {
        Uri u = req.getUrl();
        String p = u.getPath();
        if (!"GET".equalsIgnoreCase(req.getMethod()) || !"https".equals(u.getScheme()) || !"github.com".equals(u.getHost())
                || p == null || !p.startsWith(RELEASES) || p.contains("..")) return null;
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", BASE.substring(0, BASE.length() - 1));
        h.put("Cache-Control", "no-store");
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(u.toString()).openConnection();
            c.setInstanceFollowRedirects(true);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setUseCaches(false);
            c.setRequestProperty("User-Agent", "TVBakim-Android");
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) in = new ByteArrayInputStream(new byte[0]);
            String msg = c.getResponseMessage();
            return new WebResourceResponse(p.endsWith(".json") ? "application/json" : "application/octet-stream", "utf-8",
                    code, msg == null || msg.isEmpty() ? (code < 400 ? "OK" : "Error") : msg, h, in);
        } catch (Exception e) {
            return new WebResourceResponse("text/plain", "utf-8", 502, "Bad Gateway", h, new ByteArrayInputStream(new byte[0]));
        }
    }

    private void dis(Uri u) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception ignored) { }
    }

    @SuppressWarnings("deprecation")
    private void tamEkran() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) tamEkran(); }

    /** Kumandanın Geri tuşu: önce arayüz (pencere kapat / ana sayfaya dön); arayüz işlemezse uygulama arka plana. */
    @Override
    public boolean onKeyDown(int code, KeyEvent e) {
        if (code == KeyEvent.KEYCODE_BACK) {
            if (web == null || tasimaSayfasi) { moveTaskToBack(true); return true; }
            web.evaluateJavascript("(function(){try{return !!(window.__tvGeri&&window.__tvGeri())}catch(e){return false}})()",
                    v -> { if (!"true".equals(v)) moveTaskToBack(true); });
            return true;
        }
        if (code == KeyEvent.KEYCODE_MENU) { js("window.__tvMenu && window.__tvMenu()"); return true; }
        return super.onKeyDown(code, e);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (fc != null) fc.resumeInstall();
        js("window.__tvResume && window.__tvResume()");
    }

    @Override
    public void onRequestPermissionsResult(int req, String[] perms, int[] res) {
        super.onRequestPermissionsResult(req, perms, res);
        if (req == REQ_STORAGE) js("window.__tvResume && window.__tvResume()");
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

}
