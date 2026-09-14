package ru.ritm.app;
import android.app.*;
import android.content.*;
import android.os.*;
import android.webkit.WebView;
import android.view.*;
import org.json.*;
import java.util.concurrent.*;
import java.time.LocalDate;
public class SmokeRunner extends Instrumentation {
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 static void check(boolean b,String message){if(!b)throw new AssertionError(message);}
 WebView find(View v){if(v instanceof WebView)return (WebView)v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){WebView w=find(g.getChildAt(i));if(w!=null)return w;}}return null;}
 String js(WebView w,String code)throws Exception{
  CountDownLatch latch=new CountDownLatch(1);String[] value={null};
  runOnMainSync(()->w.evaluateJavascript(code,x->{value[0]=x;latch.countDown();}));
  check(latch.await(10,TimeUnit.SECONDS),"JavaScript evaluation timed out");return value[0];
 }
 @Override public void onStart(){
  Bundle result=new Bundle();
  try{
   Context c=getTargetContext();
   Intent launch=new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
   Activity activity=startActivitySync(launch);WebView w=find(activity.getWindow().getDecorView());check(w!=null,"WebView exists");
   boolean loaded=false;
   for(int i=0;i<100;i++){if("true".equals(js(w,"typeof window.Ritm === 'object'"))){loaded=true;break;}Thread.sleep(100);}
   check(loaded,"Bundled app loads offline without INTERNET permission");
   check("true".equals(js(w,"document.body.innerText.includes('РИТМ')")),"Rendered interface");
   js(w,"document.querySelector('#start-phase').value='0';document.querySelector('[data-action=onboard]').click()");
   check(Store.json(c).optBoolean("onboarded"),"Native bridge persists onboarding");
   js(w,"document.querySelector('[data-action=water][data-ml=\"200\"]').click()");
   String date=LocalDate.now().toString();
   check(Store.json(c).getJSONObject("days").getJSONObject(date).getJSONArray("drinks").length()==1,"Native bridge persists water");
   JSONObject root=Store.json(c);long revision=root.getLong("revision");
   check("false".equals(js(w,"Android.save("+JSONObject.quote(root.toString())+")")),"Stale revision rejected");
   check(Store.json(c).getLong("revision")==revision,"Rejected write is non-destructive");
   if(Build.VERSION.SDK_INT>=33){try(ParcelFileDescriptor p=getUiAutomation().executeShellCommand("pm grant ru.ritm.app android.permission.POST_NOTIFICATIONS")){new java.io.FileInputStream(p.getFileDescriptor()).readAllBytes();}}
   root=Store.json(c);root.getJSONObject("settings").put("notifications",true);root.put("revision",root.optLong("revision")+1);Store.write(c,root.toString());
   Reminders.schedule(c);
   Reminders.show(c,"water","Проверка Ритма","Добавить воду",date+":water:test");
   NotificationManager nm=c.getSystemService(NotificationManager.class);
   check(nm.getActiveNotifications().length>0,"Native notification visible");
   android.service.notification.StatusBarNotification notice=null;
   for(android.service.notification.StatusBarNotification n:nm.getActiveNotifications())if(n.getId()=="water".hashCode())notice=n;
   check(notice!=null&&notice.getNotification().actions.length==1,"Quick action exists");
   PendingIntent action=notice.getNotification().actions[0].actionIntent;action.send();
   for(int i=0;i<50;i++){if(Store.json(c).getJSONObject("days").getJSONObject(date).getJSONArray("drinks").length()==2)break;Thread.sleep(100);}
   check(Store.json(c).getJSONObject("days").getJSONObject(date).getJSONArray("drinks").length()==2,"Notification adds 250 ml while app is idle");
   action.send();Thread.sleep(300);
   check(Store.json(c).getJSONObject("days").getJSONObject(date).getJSONArray("drinks").length()==2,"Duplicate action is idempotent");
   Intent stale=new Intent().setAction("ru.ritm.DONE").putExtra("kind","water").putExtra("token",LocalDate.now().minusDays(1)+":water:old");
   new ReminderReceiver().onReceive(c,stale);
   check(Store.json(c).getJSONObject("days").getJSONObject(date).getJSONArray("drinks").length()==2,"Old-day action does not corrupt today's log");
   js(w,"window.Ritm.resume()");
   check("true".equals(js(w,"document.body.innerText.includes('Все напитки: 450 мл')")),"UI refreshes after notification action");
   result.putString("stream","\nRITM_NATIVE_OK: offline launch, bridge storage, revision conflict, notification, idempotency, old-day guard, UI refresh\n");
   finish(Activity.RESULT_OK,result);
  }catch(Throwable e){result.putString("stream","\nRITM_NATIVE_FAILED: "+android.util.Log.getStackTraceString(e));finish(Activity.RESULT_CANCELED,result);}
 }
}