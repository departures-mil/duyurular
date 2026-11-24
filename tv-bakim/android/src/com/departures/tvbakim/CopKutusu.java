package com.departures.tvbakim;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * Çöp kutusu (Milen'in kuralı: veri kaybı yok). Temizlenen dosyalar SİLİNMEZ; ortak depolamadaki
 * "TVBakim-CopKutusu" klasörüne taşınır ve oradan geri alınabilir. Kalıcı silme yalnız kullanıcı
 * çöp kutusunu boşaltınca (MainActivity'deki yerel onay penceresinden sonra) yapılır.
 * Klasör uygulama kaldırılsa da kalır. Yalnız java.io: JVM'de birim testi yapılır.
 *
 * Dizin: index.tsv — her satır: id \t zaman(ms) \t boyut \t asılYol(köke göre) \t saklananAd
 */
public final class CopKutusu {
    public static final String KLASOR = "TVBakim-CopKutusu";
    private static final String DIZIN = "index.tsv";

    public static final class Kayit {
        public final String id;
        public final long at;
        public final long size;
        public final String orig;
        public final String name;

        Kayit(String id, long at, long size, String orig, String name) {
            this.id = id; this.at = at; this.size = size; this.orig = orig; this.name = name;
        }
    }

    private final File depo;   // ortak depolama kökü (/storage/emulated/0)
    private final File kok;    // depo/TVBakim-CopKutusu
    private int sayac = 0;

    public CopKutusu(File depo) {
        this.depo = depo;
        this.kok = new File(depo, KLASOR);
    }

    public File kok() { return kok; }

    private void hazirla() throws IOException {
        if (!kok.isDirectory() && !kok.mkdirs()) throw new IOException("çöp kutusu klasörü açılamadı");
        File nm = new File(kok, ".nomedia");
        if (!nm.exists()) nm.createNewFile();
        File oku = new File(kok, "BENIOKU.txt");
        if (!oku.exists()) {
            try (Writer w = new OutputStreamWriter(new FileOutputStream(oku), StandardCharsets.UTF_8)) {
                w.write("TV Bakım çöp kutusu / recycle bin / سلة المحذوفات\n\n"
                        + "TR: TV Bakım'ın temizlediği dosyalar burada durur. Uygulamada Çöp Kutusu → Geri al ile eski yerine döner.\n"
                        + "EN: Files cleaned by TV Bakım are kept here. In the app, Recycle bin → Restore puts them back.\n"
                        + "AR: الملفات التي نظّفها التطبيق محفوظة هنا. من سلة المحذوفات ← استعادة تعود إلى مكانها.\n");
            }
        }
    }

    public synchronized List<Kayit> liste() {
        List<Kayit> out = new ArrayList<>();
        File f = new File(kok, DIZIN);
        if (!f.isFile()) return out;
        try (BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(f), StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) {
                String[] p = line.split("\t", -1);
                if (p.length != 5) continue;
                try {
                    out.add(new Kayit(p[0], Long.parseLong(p[1]), Long.parseLong(p[2]), coz(p[3]), coz(p[4])));
                } catch (NumberFormatException ignored) { }
            }
        } catch (IOException ignored) { }
        return out;
    }

    private void yaz(List<Kayit> l) throws IOException {
        hazirla();
        File tmp = new File(kok, DIZIN + ".tmp");
        try (Writer w = new OutputStreamWriter(new FileOutputStream(tmp), StandardCharsets.UTF_8)) {
            for (Kayit k : l) w.write(k.id + "\t" + k.at + "\t" + k.size + "\t" + kod(k.orig) + "\t" + kod(k.name) + "\n");
        }
        File f = new File(kok, DIZIN);
        if (!tmp.renameTo(f)) {
            f.delete();
            if (!tmp.renameTo(f)) throw new IOException("dizin yazılamadı");
        }
    }

    /** Dosyayı çöp kutusuna taşır. rel: depo köküne göre yol. Başarısızsa IOException; dosya yerinde kalır. */
    public synchronized Kayit tasi(File f, String rel) throws IOException {
        if (!f.isFile()) throw new IOException("dosya yok");
        if (icinde(kok, f)) throw new IOException("zaten çöp kutusunda");
        if (!icinde(depo, f)) throw new IOException("depolama dışında");
        hazirla();
        String id = new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(new Date()) + "-" + (++sayac) + "-" + Math.abs((rel + System.nanoTime()).hashCode() % 100000);
        File d = new File(kok, id);
        if (!d.mkdirs()) throw new IOException("klasör açılamadı");
        File hedef = new File(d, f.getName());
        long size = f.length();
        tasiDosya(f, hedef);
        Kayit k = new Kayit(id, System.currentTimeMillis(), size, rel, f.getName());
        List<Kayit> l = liste();
        l.add(k);
        yaz(l);
        return k;
    }

    /** Eski yerine geri koyar; aynı adda dosya varsa "ad (geri 2).uzantı" olur. Dönen: geri konan dosya. */
    public synchronized File geriAl(String id) throws IOException {
        List<Kayit> l = liste();
        Kayit k = bul(l, id);
        if (k == null) throw new IOException("kayıt yok");
        File kaynak = new File(new File(kok, k.id), k.name);
        File hedef = new File(depo, k.orig);
        if (!icinde(depo, hedef) || icinde(kok, hedef)) throw new IOException("geçersiz yol");
        File ust = hedef.getParentFile();
        if (ust != null && !ust.isDirectory()) ust.mkdirs();
        hedef = bosAd(hedef);
        tasiDosya(kaynak, hedef);
        new File(kok, k.id).delete();
        l.remove(k);
        yaz(l);
        return hedef;
    }

    /** KALICI siler (yalnız kullanıcı onayından sonra çağrılır). Dönen: açılan bayt. */
    public synchronized long kaliciSil(String id) throws IOException {
        List<Kayit> l = liste();
        Kayit k = bul(l, id);
        if (k == null) return 0;
        File d = new File(kok, k.id);
        long n = boyut(d);
        sil(d);
        l.remove(k);
        yaz(l);
        return n;
    }

    public long toplam() {
        long t = 0;
        for (Kayit k : liste()) t += k.size;
        return t;
    }

    private static Kayit bul(List<Kayit> l, String id) {
        for (Kayit k : l) if (k.id.equals(id)) return k;
        return null;
    }

    static File bosAd(File f) {
        if (!f.exists()) return f;
        String ad = f.getName(), uz = "";
        int nokta = ad.lastIndexOf('.');
        if (nokta > 0) { uz = ad.substring(nokta); ad = ad.substring(0, nokta); }
        for (int i = 2; i < 1000; i++) {
            File c = new File(f.getParentFile(), ad + " (geri " + i + ")" + uz);
            if (!c.exists()) return c;
        }
        return new File(f.getParentFile(), ad + " (geri " + System.currentTimeMillis() + ")" + uz);
    }

    /** Önce yeniden adlandırma (aynı birimde anında); olmazsa kopyala → boyutu doğrula → kaynağı sil. */
    static void tasiDosya(File a, File b) throws IOException {
        if (a.renameTo(b)) return;
        long n = a.length();
        try (InputStream in = new FileInputStream(a); OutputStream out = new FileOutputStream(b)) {
            byte[] buf = new byte[64 * 1024];
            int r;
            while ((r = in.read(buf)) > 0) out.write(buf, 0, r);
        }
        if (b.length() != n) { b.delete(); throw new IOException("kopya eksik"); }
        if (!a.delete()) { b.delete(); throw new IOException("kaynak taşınamadı"); }
    }

    static boolean icinde(File ust, File f) {
        try {
            String u = ust.getCanonicalPath(), p = f.getCanonicalPath();
            return p.startsWith(u.endsWith(File.separator) ? u : u + File.separator);
        } catch (IOException e) {
            return false;
        }
    }

    static long boyut(File f) {
        if (f.isFile()) return f.length();
        long t = 0;
        File[] l = f.listFiles();
        if (l != null) for (File c : l) t += boyut(c);
        return t;
    }

    private static void sil(File f) {
        File[] l = f.listFiles();
        if (l != null) for (File c : l) sil(c);
        f.delete();
    }

    static String kod(String s) { return s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r"); }

    static String coz(String s) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' && i + 1 < s.length()) {
                char d = s.charAt(++i);
                b.append(d == 't' ? '\t' : d == 'n' ? '\n' : d == 'r' ? '\r' : d);
            } else b.append(c);
        }
        return b.toString();
    }
}
