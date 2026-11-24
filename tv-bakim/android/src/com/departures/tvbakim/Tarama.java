package com.departures.tvbakim;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Ortak depolamada (iç bellek /sdcard) gereksiz dosya taraması. Yalnız java.io kullanır: JVM'de birim testi yapılır.
 * HİÇBİR ŞEY SİLMEZ; yalnız liste çıkarır. Taşıma CopKutusu'nda, kullanıcı onayıyla yapılır.
 *
 * Kategoriler (cat):
 *   thumbs  — ".thumbnails" klasörlerindeki küçük resim önbelleği (sistem yeniden üretir)
 *   temp    — yarım kalmış indirmeler ve geçici dosyalar (.tmp .temp .part .crdownload .partial, ~$…, Thumbs.db, .DS_Store, ._…)
 *   log     — günlük dosyaları (.log)
 *   lost    — LOST.DIR (dosya sistemi onarımından kalan parçalar)
 *   apk     — bırakılmış kurulum dosyaları (.apk .xapk .apks .apkm)
 *   big     — 300 MB ve üstü diğer dosyalar (yalnız gözden geçirmek için; varsayılan seçili DEĞİL)
 * Atlananlar: kökteki "Android" (uygulama verileri), çöp kutusu klasörü, gizli klasörler (.thumbnails hariç).
 */
public final class Tarama {
    public static final long BUYUK = 300L * 1024 * 1024;
    public static final int MAX_DERINLIK = 12;
    public static final int MAX_OGE = 5000;
    public static final int MAX_DOSYA = 200000;

    public static final class Oge {
        public final int id;
        public final File file;
        public final String rel;
        public final long size;
        public final long mtime;
        public final String cat;

        Oge(int id, File file, String rel, long size, long mtime, String cat) {
            this.id = id; this.file = file; this.rel = rel; this.size = size; this.mtime = mtime; this.cat = cat;
        }
    }

    public interface Ilerleme {
        /** Her ~500 dosyada bir; true dönerse tarama durdurulur. */
        boolean dosya(int taranan, int bulunan);
    }

    public static final class Sonuc {
        public final List<Oge> ogeler = new ArrayList<>();
        public int taranan = 0;
        public boolean kesildi = false;
    }

    private Tarama() { }

    /** Dosya adına ve konumuna göre kategori; gereksiz değilse null. */
    public static String kategori(String ad, long boyut, boolean kucukResimKlasoru, boolean kayipKlasoru) {
        String n = ad.toLowerCase(Locale.ROOT);
        if (kucukResimKlasoru) return "thumbs";
        if (kayipKlasoru) return "lost";
        if (n.endsWith(".apk") || n.endsWith(".xapk") || n.endsWith(".apks") || n.endsWith(".apkm")) return "apk";
        if (n.endsWith(".tmp") || n.endsWith(".temp") || n.endsWith(".part") || n.endsWith(".crdownload") || n.endsWith(".partial")
                || n.startsWith("~$") || n.equals("thumbs.db") || n.equals(".ds_store") || n.equals("desktop.ini")
                || (n.startsWith("._") && boyut < 8192)) return "temp";
        if (n.endsWith(".log")) return "log";
        if (boyut >= BUYUK) return "big";
        return null;
    }

    /** Varsayılan olarak seçili gelen kategoriler (büyük dosyalar kullanıcının kendi dosyası olabilir: seçili gelmez). */
    public static boolean varsayilanSecili(String cat) { return !"big".equals(cat); }

    /** "Kesin gereksiz" kategoriler: isteğe bağlı otomatik temizlik yalnız bunları çöp kutusuna taşır (apk ve big hariç). */
    public static boolean kesinGereksiz(String cat) {
        return "thumbs".equals(cat) || "temp".equals(cat) || "log".equals(cat) || "lost".equals(cat);
    }

    public static Sonuc tara(File kok, String copKlasoruAdi, Ilerleme ilerleme) {
        Sonuc s = new Sonuc();
        gez(kok, "", 0, false, false, copKlasoruAdi, ilerleme, s);
        return s;
    }

    private static boolean gez(File dir, String rel, int derinlik, boolean kucuk, boolean kayip, String cop, Ilerleme il, Sonuc s) {
        if (derinlik > MAX_DERINLIK) return true;
        File[] l = dir.listFiles();
        if (l == null) return true;
        for (File f : l) {
            if (s.ogeler.size() >= MAX_OGE || s.taranan >= MAX_DOSYA) { s.kesildi = true; return false; }
            String ad = f.getName();
            String r = rel.isEmpty() ? ad : rel + "/" + ad;
            if (f.isDirectory()) {
                if (isSymlink(f)) continue;
                String a = ad.toLowerCase(Locale.ROOT);
                if (derinlik == 0 && (a.equals("android") || ad.equals(cop))) continue;
                boolean thumbs = kucuk || a.equals(".thumbnails");
                boolean lost = kayip || (derinlik == 0 && a.equals("lost.dir"));
                if (a.startsWith(".") && !thumbs) continue;
                if (!gez(f, r, derinlik + 1, thumbs, lost, cop, il, s)) return false;
            } else if (f.isFile()) {
                s.taranan++;
                long size = f.length();
                String cat = kategori(ad, size, kucuk, kayip);
                if (cat != null) s.ogeler.add(new Oge(s.ogeler.size(), f, r, size, f.lastModified(), cat));
                if (il != null && s.taranan % 500 == 0 && il.dosya(s.taranan, s.ogeler.size())) { s.kesildi = true; return false; }
            }
        }
        return true;
    }

    static boolean isSymlink(File f) {
        try {
            File p = f.getParentFile();
            File c = p == null ? f : new File(p.getCanonicalFile(), f.getName());
            return !c.getCanonicalFile().equals(c.getAbsoluteFile());
        } catch (Exception e) {
            return true;
        }
    }

    /** Dosya hâlâ tarandığı gibi mi (boyut ve zaman aynı) — başka bir şeyle değiştiyse taşınmaz. */
    public static boolean ayni(Oge o) {
        return o.file.isFile() && o.file.length() == o.size && o.file.lastModified() == o.mtime;
    }
}
