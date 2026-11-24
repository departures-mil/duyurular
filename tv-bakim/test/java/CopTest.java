import com.departures.tvbakim.CopKutusu;
import com.departures.tvbakim.Tarama;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.util.List;

/** JVM birim testi: tarama sınıflandırması + çöp kutusu (taşı → geri al → kalıcı sil). node test/java.test.js çalıştırır. */
public class CopTest {
    static int hata = 0;
    static void ok(boolean b, String m) { if (!b) { hata++; System.out.println("HATA: " + m); } }
    static File yaz(File kok, String rel, int n) throws Exception {
        File f = new File(kok, rel); f.getParentFile().mkdirs();
        try (FileOutputStream o = new FileOutputStream(f)) { o.write(new byte[n]); }
        return f;
    }

    public static void main(String[] a) throws Exception {
        ok("apk".equals(Tarama.kategori("Kodi.APK", 5, false, false)), "apk");
        ok("temp".equals(Tarama.kategori("film.mp4.crdownload", 5, false, false)), "crdownload");
        ok("temp".equals(Tarama.kategori("~$belge.docx", 5, false, false)), "~$");
        ok("temp".equals(Tarama.kategori("._foto.jpg", 100, false, false)), "._ küçük");
        ok(Tarama.kategori("._foto.jpg", 100000, false, false) == null, "._ büyük değil");
        ok("thumbs".equals(Tarama.kategori("x.jpg", 5, true, false)), "thumbs");
        ok("lost".equals(Tarama.kategori("123", 5, false, true)), "lost");
        ok("log".equals(Tarama.kategori("a.log", 5, false, false)), "log");
        ok("big".equals(Tarama.kategori("film.mkv", Tarama.BUYUK, false, false)), "big");
        ok(Tarama.kategori("foto.jpg", 1000, false, false) == null, "foto dokunulmaz");
        ok(Tarama.kategori("belge.pdf", 1000, false, false) == null, "pdf dokunulmaz");
        ok(!Tarama.varsayilanSecili("big") && Tarama.varsayilanSecili("apk"), "varsayılan seçim");
        ok(Tarama.kesinGereksiz("temp") && !Tarama.kesinGereksiz("apk") && !Tarama.kesinGereksiz("big"), "kesin");

        File kok = Files.createTempDirectory("tvbakim").toFile();
        yaz(kok, "Download/Kodi.apk", 300);
        yaz(kok, "Download/foto.jpg", 300);
        yaz(kok, "DCIM/.thumbnails/1.jpg", 40);
        yaz(kok, "DCIM/Camera/2.jpg", 40);
        yaz(kok, ".gizli/x.tmp", 10);
        yaz(kok, "Android/data/com.x/cache/y.tmp", 10);
        yaz(kok, "LOST.DIR/77", 9);
        yaz(kok, "tmp/a.part", 11);
        Tarama.Sonuc s = Tarama.tara(kok, CopKutusu.KLASOR, null);
        ok(s.ogeler.size() == 4, "tarama 4 öğe bulur: " + s.ogeler.size());
        for (Tarama.Oge o : s.ogeler) {
            ok(!o.rel.startsWith("Android/") && !o.rel.startsWith(".gizli"), "atlanan klasör: " + o.rel);
            ok(!o.rel.endsWith(".jpg") || o.cat.equals("thumbs"), "foto taşınmaz: " + o.rel);
        }

        CopKutusu c = new CopKutusu(kok);
        Tarama.Oge apk = null;
        for (Tarama.Oge o : s.ogeler) if (o.cat.equals("apk")) apk = o;
        ok(Tarama.ayni(apk), "ayni");
        CopKutusu.Kayit k = c.tasi(apk.file, apk.rel);
        ok(!apk.file.exists(), "kaynak taşındı");
        ok(new File(new File(c.kok(), k.id), "Kodi.apk").length() == 300, "çöp kutusunda");
        ok(new File(c.kok(), ".nomedia").exists() && new File(c.kok(), "BENIOKU.txt").exists(), "nomedia/benioku");
        ok(c.liste().size() == 1 && c.toplam() == 300, "liste");
        ok(!Tarama.ayni(apk), "taşınmış dosya ayni değil");
        // çöp kutusundakiler yeniden taranmaz
        Tarama.Sonuc s2 = Tarama.tara(kok, CopKutusu.KLASOR, null);
        ok(s2.ogeler.size() == 3, "çöp kutusu taranmaz: " + s2.ogeler.size());
        // aynı adda dosya varken geri al → yeni ad
        yaz(kok, "Download/Kodi.apk", 5);
        File geri = c.geriAl(k.id);
        ok(geri.getName().equals("Kodi (geri 2).apk") && geri.length() == 300, "geri al: " + geri);
        ok(c.liste().isEmpty(), "geri alınca listeden çıkar");
        // tab içeren ad
        File garip = yaz(kok, "Download/a\tb.log", 7);
        CopKutusu.Kayit k2 = c.tasi(garip, "Download/a\tb.log");
        List<CopKutusu.Kayit> l = c.liste();
        ok(l.size() == 1 && l.get(0).orig.equals("Download/a\tb.log"), "kaçış");
        ok(c.kaliciSil(k2.id) == 7 && c.liste().isEmpty() && !new File(c.kok(), k2.id).exists(), "kalıcı sil");
        // depolama dışından ve çöp kutusundan taşıma reddedilir
        File dis = File.createTempFile("dis", ".apk");
        try { c.tasi(dis, "x"); ok(false, "dışarıdan taşındı"); } catch (Exception e) { ok(dis.exists(), "dış dosya yerinde"); }
        dis.delete();
        System.out.println(hata == 0 ? "JAVA TAMAM" : "JAVA HATA " + hata);
        System.exit(hata == 0 ? 0 : 1);
    }
}
