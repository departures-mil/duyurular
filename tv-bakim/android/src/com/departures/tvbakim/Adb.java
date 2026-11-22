package com.departures.tvbakim;

import android.content.Context;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.security.interfaces.RSAPrivateCrtKey;

import javax.crypto.Cipher;

/**
 * TV'nin kendi ADB'sine (ağ hata ayıklaması, 127.0.0.1:5555) bağlanan küçük istemci.
 * İlk bağlantıda TV ekranında "Hata ayıklamaya izin verilsin mi?" sorusu çıkar; "Her zaman izin ver" seçilince
 * bir daha sorulmaz. Bağlanınca uygulama kendine WRITE_SECURE_SETTINGS verir ve kabuk komutları çalıştırabilir
 * (önbellekleri topluca temizleme, animasyonları kısma, arka plan uygulamalarını kapatma).
 */
final class Adb {
    private static final int CNXN = 0x4e584e43, AUTH = 0x48545541, OPEN = 0x4e45504f, OKAY = 0x59414b4f,
            CLSE = 0x45534c43, WRTE = 0x45545257;
    private static final int VERSION = 0x01000000, MAXDATA = 4096;
    private static final byte[] SHA1_PREFIX = { 0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a, 0x05, 0x00, 0x04, 0x14 };

    private final Context ctx;
    private Socket sock;
    private InputStream in;
    private OutputStream out;
    private int localId = 1;

    Adb(Context c) { ctx = c; }

    // ---------- anahtar (uygulama verisinde kalıcı)
    private KeyPair keys() throws Exception {
        File f = new File(ctx.getFilesDir(), "adbkey");
        KeyFactory kf = KeyFactory.getInstance("RSA");
        if (f.exists()) {
            byte[] b = readAll(new FileInputStream(f));
            PrivateKey pk = kf.generatePrivate(new PKCS8EncodedKeySpec(b));
            RSAPrivateCrtKey c = (RSAPrivateCrtKey) pk;
            RSAPublicKey pub = (RSAPublicKey) kf.generatePublic(new RSAPublicKeySpec(c.getModulus(), c.getPublicExponent()));
            return new KeyPair(pub, pk);
        }
        KeyPairGenerator g = KeyPairGenerator.getInstance("RSA");
        g.initialize(2048);
        KeyPair kp = g.generateKeyPair();
        FileOutputStream o = new FileOutputStream(f);
        o.write(kp.getPrivate().getEncoded());
        o.close();
        return kp;
    }

    /** ADB'nin beklediği açık anahtar biçimi (mincrypt RSAPublicKey, base64) + " ad\0" */
    private static byte[] adbPublicKey(RSAPublicKey pub) {
        BigInteger n = pub.getModulus();
        int words = 64;
        BigInteger r32 = BigInteger.ZERO.setBit(32);
        BigInteger n0inv = n.remainder(r32).modInverse(r32);
        n0inv = r32.subtract(n0inv);
        BigInteger rr = BigInteger.ZERO.setBit(words * 32).modPow(BigInteger.valueOf(2), n);
        ByteBuffer bb = ByteBuffer.allocate(4 + 4 + words * 4 + words * 4 + 4).order(ByteOrder.LITTLE_ENDIAN);
        bb.putInt(words);
        bb.putInt(n0inv.intValue());
        putWords(bb, n, words);
        putWords(bb, rr, words);
        bb.putInt(pub.getPublicExponent().intValue());
        String s = Base64.encodeToString(bb.array(), Base64.NO_WRAP) + " tvbakim@tv\u0000";
        return s.getBytes();
    }

    private static void putWords(ByteBuffer bb, BigInteger v, int words) {
        BigInteger mask = BigInteger.ZERO.setBit(32).subtract(BigInteger.ONE);
        for (int i = 0; i < words; i++) {
            bb.putInt(v.and(mask).intValue());
            v = v.shiftRight(32);
        }
    }

    // ---------- iletiler
    private void send(int cmd, int a0, int a1, byte[] data) throws Exception {
        int len = data == null ? 0 : data.length, sum = 0;
        if (data != null) for (byte b : data) sum += b & 0xff;
        ByteBuffer h = ByteBuffer.allocate(24).order(ByteOrder.LITTLE_ENDIAN);
        h.putInt(cmd).putInt(a0).putInt(a1).putInt(len).putInt(sum).putInt(~cmd);
        out.write(h.array());
        if (data != null) out.write(data);
        out.flush();
    }

    private static final class Msg { int cmd, a0, a1; byte[] data; }

    private Msg recv() throws Exception {
        byte[] hb = readN(24);
        ByteBuffer h = ByteBuffer.wrap(hb).order(ByteOrder.LITTLE_ENDIAN);
        Msg m = new Msg();
        m.cmd = h.getInt(); m.a0 = h.getInt(); m.a1 = h.getInt();
        int len = h.getInt();
        m.data = len > 0 ? readN(len) : new byte[0];
        return m;
    }

    private byte[] readN(int n) throws Exception {
        byte[] b = new byte[n];
        int o = 0;
        while (o < n) { int r = in.read(b, o, n - o); if (r < 0) throw new java.io.EOFException(); o += r; }
        return b;
    }

    /** Bağlanır; true = yetkili kabuk hazır. waitMs: TV'deki izin sorusu için beklenecek süre. */
    synchronized boolean connect(int waitMs) {
        close();
        try {
            sock = new Socket();
            sock.connect(new InetSocketAddress("127.0.0.1", 5555), 1500);
            sock.setSoTimeout(waitMs);
            in = sock.getInputStream();
            out = sock.getOutputStream();
            send(CNXN, VERSION, MAXDATA, "host::\u0000".getBytes());
            KeyPair kp = keys();
            boolean sentSig = false, sentKey = false;
            while (true) {
                Msg m = recv();
                if (m.cmd == CNXN) return true;
                if (m.cmd != AUTH) continue;
                if (!sentSig) {
                    Cipher c = Cipher.getInstance("RSA/ECB/PKCS1Padding");
                    c.init(Cipher.ENCRYPT_MODE, kp.getPrivate());
                    c.update(SHA1_PREFIX);
                    send(AUTH, 2, 0, c.doFinal(m.data));
                    sentSig = true;
                } else if (!sentKey) {
                    send(AUTH, 3, 0, adbPublicKey((RSAPublicKey) kp.getPublic()));
                    sentKey = true;
                } else return false;
            }
        } catch (Exception e) {
            close();
            return false;
        }
    }

    /** Kabuk komutu çalıştırıp çıktısını döndürür (bağlantı yoksa null). */
    synchronized String shell(String cmd, int timeoutMs) {
        if (sock == null) return null;
        try {
            sock.setSoTimeout(timeoutMs);
            int me = localId++;
            send(OPEN, me, 0, ("shell:" + cmd + "\u0000").getBytes());
            ByteArrayOutputStream acc = new ByteArrayOutputStream();
            int remote = 0;
            while (true) {
                Msg m = recv();
                if (m.cmd == OKAY) { remote = m.a0; continue; }
                if (m.cmd == WRTE) { acc.write(m.data); send(OKAY, me, m.a0, null); continue; }
                if (m.cmd == CLSE) { if (remote != 0) send(CLSE, me, remote, null); break; }
            }
            return acc.toString("UTF-8");
        } catch (Exception e) {
            close();
            return null;
        }
    }

    synchronized boolean ready() { return sock != null && sock.isConnected() && !sock.isClosed(); }

    synchronized void close() {
        try { if (sock != null) sock.close(); } catch (Exception ignored) {}
        sock = null; in = null; out = null;
    }

    private static byte[] readAll(InputStream i) throws Exception {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] b = new byte[4096];
        int r;
        while ((r = i.read(b)) > 0) o.write(b, 0, r);
        i.close();
        return o.toByteArray();
    }
}
