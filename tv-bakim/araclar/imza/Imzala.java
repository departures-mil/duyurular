import com.android.apksig.ApkSigner;
import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/** apksig ile v2 imza (jarsigner ile atılmış v1 korunur): java --add-exports java.base/sun.security.x509=ALL-UNNAMED -cp apksig.jar:. Imzala <jks> <alias> <girdi.apk> <çıktı.apk> (şifre: TVBAKIM_SIFRE ortam değişkeni) */
public class Imzala {
    public static void main(String[] a) throws Exception {
        KeyStore ks = KeyStore.getInstance("JKS");
        String pw = System.getenv("TVBAKIM_SIFRE");
        ks.load(new FileInputStream(a[0]), pw.toCharArray());
        PrivateKey pk = (PrivateKey) ks.getKey(a[1], pw.toCharArray());
        X509Certificate cert = (X509Certificate) ks.getCertificate(a[1]);
        ApkSigner.SignerConfig sc = new ApkSigner.SignerConfig.Builder("TVBAKIM", pk, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(sc))
                .setInputApk(new File(a[2])).setOutputApk(new File(a[3]))
                .setMinSdkVersion(21).setV1SigningEnabled(false).setV2SigningEnabled(true).setOtherSignersSignaturesPreserved(true)
                .build().sign();
        System.out.println("imzalandı " + a[3]);
    }
}
