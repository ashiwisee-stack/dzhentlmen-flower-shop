package ru.ritm.app;
import android.content.Context;
import android.util.AtomicFile;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;

final class Store {
  static final int LIMIT = 16 * 1024 * 1024;
  static AtomicFile file(Context c) { return new AtomicFile(new File(c.getFilesDir(), "ritm.json")); }
  static synchronized String read(Context c) {
    try { return new String(file(c).readFully(), StandardCharsets.UTF_8); }
    catch (FileNotFoundException e) { return "{}"; }
    catch (Exception e) { return "{\"loadError\":true}"; }
  }
  static synchronized boolean write(Context c, String value) {
    FileOutputStream out = null; AtomicFile f = file(c);
    try {
      if (value.length() > LIMIT) return false;
      JSONObject j = new JSONObject(value);
      if (j.optInt("version") != 1 || !j.has("settings") || !j.has("days")) return false;
      out=f.startWrite(); out.write(value.getBytes(StandardCharsets.UTF_8)); f.finishWrite(out); return true;
    } catch (Exception e) { if (out != null) f.failWrite(out); return false; }
  }
  static synchronized JSONObject json(Context c) {
    try { return new JSONObject(read(c)); } catch (Exception e) { return new JSONObject(); }
  }
}
