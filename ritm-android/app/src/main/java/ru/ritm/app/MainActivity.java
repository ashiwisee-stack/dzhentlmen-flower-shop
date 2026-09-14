package ru.ritm.app;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.*;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.util.Base64;
import android.view.*;
import android.webkit.*;
import android.widget.Toast;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
  private WebView web;
  private String photoSlot="front";
  private boolean ready;
  private final java.util.concurrent.ExecutorService io = Executors.newSingleThreadExecutor();
  private static final int PHOTO=41, EXPORT=42, IMPORT=43;
  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    web=new WebView(this); web.setBackgroundColor(Color.rgb(17,23,19)); setContentView(web);
    web.setOnApplyWindowInsetsListener((v,insets)->{
      v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
      return insets;
    });
    WebSettings s=web.getSettings();
    s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
    s.setAllowFileAccess(false); s.setAllowContentAccess(false);
    s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    s.setMediaPlaybackRequiresUserGesture(true); s.setSupportMultipleWindows(false);
    web.addJavascriptInterface(new Bridge(),"Android");
    web.setWebViewClient(new WebViewClient(){
      @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
        Uri u=req.getUrl();
        if ("https".equals(u.getScheme()) && "ritm.local".equals(u.getHost())) {
          String path=u.getPath();
          if (path==null||path.equals("/")) path="/index.html";
          if (!path.contains("..") && path.matches("/[a-zA-Z0-9_.-]+")) {
            try { String mime=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":"text/html";
              return new WebResourceResponse(mime,"UTF-8",getAssets().open("www"+path));
            } catch(IOException ignored){}
          }
        }
        return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
      }
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req) {
        Uri u=req.getUrl();
        if ("https".equals(u.getScheme()) && "ritm.local".equals(u.getHost())) return false;
        if(req.hasGesture() && "https".equals(u.getScheme())) {
          try { startActivity(new Intent(Intent.ACTION_VIEW,u)); } catch(Exception e){ toast("Не удалось открыть ссылку"); }
        }
        return true;
      }
      @Override public void onPageFinished(WebView v,String url){ready=true;}
    });
    web.loadUrl("https://ritm.local/index.html");
    Reminders.schedule(this);
  }
  private void toast(String s){runOnUiThread(()->Toast.makeText(this,s,Toast.LENGTH_LONG).show());}
  private void call(String fn,String text){runOnUiThread(()->{if(!isFinishing())web.evaluateJavascript("window.Ritm && window.Ritm."+fn+"("+JSONObject.quote(text)+")",null);});}
  @Override protected void onResume(){super.onResume();Reminders.schedule(this);if(ready)web.evaluateJavascript("window.Ritm && window.Ritm.resume()",null);}
  @Override public void onBackPressed(){web.evaluateJavascript("window.Ritm && window.Ritm.back()",null);}
  @Override protected void onDestroy(){io.shutdown();web.removeJavascriptInterface("Android");web.destroy();super.onDestroy();}
  class Bridge {
    @JavascriptInterface public String load(){return Store.read(MainActivity.this);}
    @JavascriptInterface public boolean save(String data){
      boolean ok=false;
      synchronized(Store.class){try{
        JSONObject incoming=new JSONObject(data),current=Store.json(MainActivity.this);
        if(incoming.optLong("revision",0)!=current.optLong("revision",0)+1)return false;
        ok=Store.write(MainActivity.this,data);
      }catch(Exception ignored){}}
      if(ok)Reminders.schedule(MainActivity.this);return ok;
    }
    @JavascriptInterface public String notificationStatus(){
      NotificationManager nm=getSystemService(NotificationManager.class);
      AlarmManager am=getSystemService(AlarmManager.class);
      return "{\"enabled\":"+nm.areNotificationsEnabled()+",\"exact\":"+(Build.VERSION.SDK_INT<31||am.canScheduleExactAlarms())+"}";
    }
    @JavascriptInterface public void requestNotifications(){runOnUiThread(()->{
      if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},71);
      else startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));
    });}
    @JavascriptInterface public void requestExact(){runOnUiThread(()->{
      if(Build.VERSION.SDK_INT>=31) try {startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));}catch(Exception e){toast("Открой разрешения приложения в настройках Android");}
    });}
    @JavascriptInterface public void testNotification(){runOnUiThread(()->Reminders.show(MainActivity.this,"test","Ритм рядом","Напоминания включены. Можно вернуться к своему дню.",""));}
    @JavascriptInterface public void photo(String slot){runOnUiThread(()->{
      if(!slot.matches("front|left|right"))return;photoSlot=slot;
      try {startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE),PHOTO);}catch(Exception e){toast("Не удалось открыть выбор фото");}
    });}
    @JavascriptInterface public void exportBackup(){runOnUiThread(()->{
      try {startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"Ritm-"+java.time.LocalDate.now()+".json"),EXPORT);}catch(Exception e){toast("Не удалось открыть сохранение");}
    });}
    @JavascriptInterface public void importBackup(){runOnUiThread(()->{
      try {startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE),IMPORT);}catch(Exception e){toast("Не удалось открыть файл");}
    });}
  }
  @Override public void onRequestPermissionsResult(int code,String[] p,int[] result){super.onRequestPermissionsResult(code,p,result);if(ready)web.evaluateJavascript("window.Ritm && window.Ritm.resume()",null);Reminders.schedule(this);}
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(result!=RESULT_OK||data==null||data.getData()==null)return;
    Uri uri=data.getData();String slot=photoSlot;
    io.execute(()->{
      try {
        if(request==EXPORT){
          try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException();out.write(Store.read(this).getBytes(StandardCharsets.UTF_8));}
          toast("Резервная копия сохранена");
        } else if(request==IMPORT){
          try(InputStream in=getContentResolver().openInputStream(uri);ByteArrayOutputStream out=new ByteArrayOutputStream()){
            if(in==null)throw new IOException();byte[] b=new byte[8192];int n;
            while((n=in.read(b))!=-1){out.write(b,0,n);if(out.size()>Store.LIMIT)throw new IOException("size");}
            call("importState",out.toString("UTF-8"));
          }
        } else if(request==PHOTO) {
          BitmapFactory.Options opt=new BitmapFactory.Options();opt.inJustDecodeBounds=true;
          try(InputStream in=getContentResolver().openInputStream(uri)){BitmapFactory.decodeStream(in,null,opt);}
          if(opt.outWidth<=0||opt.outHeight<=0)throw new IOException();
          opt.inSampleSize=1;while(Math.max(opt.outWidth,opt.outHeight)/opt.inSampleSize>1000)opt.inSampleSize*=2;
          opt.inJustDecodeBounds=false;Bitmap bmp;
          try(InputStream in=getContentResolver().openInputStream(uri)){bmp=BitmapFactory.decodeStream(in,null,opt);}
          if(bmp==null)throw new IOException();
          Matrix m=new Matrix();
          try(InputStream in=getContentResolver().openInputStream(uri)){
            int orientation=new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION,ExifInterface.ORIENTATION_NORMAL);
            switch(orientation){
              case 2:m.setScale(-1,1);break; case 3:m.setRotate(180);break;case 4:m.setScale(1,-1);break;
              case 5:m.setRotate(90);m.postScale(-1,1);break;case 6:m.setRotate(90);break;
              case 7:m.setRotate(-90);m.postScale(-1,1);break;case 8:m.setRotate(-90);break;
            }
          }catch(Exception ignored){}
          Bitmap oriented=Bitmap.createBitmap(bmp,0,0,bmp.getWidth(),bmp.getHeight(),m,true);
          float scale=Math.min(1f,720f/Math.max(oriented.getWidth(),oriented.getHeight()));
          Bitmap small=Bitmap.createScaledBitmap(oriented,Math.max(1,Math.round(oriented.getWidth()*scale)),Math.max(1,Math.round(oriented.getHeight()*scale)),true);
          ByteArrayOutputStream out=new ByteArrayOutputStream();small.compress(Bitmap.CompressFormat.JPEG,78,out);
          JSONObject payload=new JSONObject().put("slot",slot).put("data","data:image/jpeg;base64,"+Base64.encodeToString(out.toByteArray(),Base64.NO_WRAP));
          call("photoResult",payload.toString());
          if(small!=oriented)small.recycle();if(oriented!=bmp)oriented.recycle();bmp.recycle();
        }
      }catch(Exception e){toast("Не удалось обработать файл. Проверь формат и свободное место.");}
    });
  }
}
