package com.departures.tvbakim;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/** Güncelleme APK'sını yükleyiciye vermek için en küçük içerik sağlayıcı (yalnız uygulamanın önbellek klasörü). */
public class Files extends ContentProvider {
    static final String AUTH = "com.departures.tvbakim.files";

    static Uri uri(Context c, File f) { return Uri.parse("content://" + AUTH + "/" + Uri.encode(f.getName())); }

    private File file(Uri u) throws FileNotFoundException {
        String name = new File(u.getLastPathSegment() == null ? "" : u.getLastPathSegment()).getName();
        File dir = new File(getContext().getExternalCacheDir() != null ? getContext().getExternalCacheDir() : getContext().getCacheDir(), "upd");
        File f = new File(dir, name);
        if (!f.exists()) throw new FileNotFoundException(name);
        return f;
    }

    @Override public boolean onCreate() { return true; }
    @Override public String getType(Uri u) { return "application/vnd.android.package-archive"; }

    @Override
    public ParcelFileDescriptor openFile(Uri u, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(file(u), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri u, String[] p, String s, String[] a, String o) {
        MatrixCursor c = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        try { File f = file(u); c.addRow(new Object[]{f.getName(), f.length()}); } catch (Exception ignored) {}
        return c;
    }

    @Override public Uri insert(Uri u, ContentValues v) { return null; }
    @Override public int delete(Uri u, String s, String[] a) { return 0; }
    @Override public int update(Uri u, ContentValues v, String s, String[] a) { return 0; }
}
