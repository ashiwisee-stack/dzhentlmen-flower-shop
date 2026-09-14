package ru.ritm.app;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.*;
import java.time.*;
import java.util.*;

final class Reminders {
  static final String CHANNEL="ritm_daily";
  static class Event { long at; String kind,title,text,day;
    Event(ZonedDateTime t,String k,String a,String b){at=t.toInstant().toEpochMilli();day=t.toLocalDate().toString();kind=k;title=a;text=b;}
  }
  static int phase(JSONObject s,LocalDate date){
    try{return Cycle.day(LocalDate.parse(s.optString("anchorDate")),s.optInt("anchorPhase",0),date);}catch(Exception e){return 0;}
  }
  static boolean bath(JSONObject s,int p){return s.optJSONArray("bathDays")!=null && contains(s.optJSONArray("bathDays"),p);}
  static boolean contains(JSONArray a,int n){for(int i=0;i<a.length();i++)if(a.optInt(i,-1)==n)return true;return false;}
  static LocalTime time(JSONObject s,String key,String fallback){try{return LocalTime.parse(s.optString(key,fallback));}catch(Exception e){return LocalTime.parse(fallback);}}
  static boolean quiet(JSONObject s,LocalTime t){
    LocalTime a=time(s,"quietStart","22:00"),b=time(s,"quietEnd","07:00");
    if(a.equals(b))return false;
    return a.isBefore(b)?(!t.isBefore(a)&&t.isBefore(b)):(!t.isBefore(a)||t.isBefore(b));
  }
  static boolean done(JSONObject root,String day,String kind){
    JSONObject days=root.optJSONObject("days");JSONObject d=days==null?null:days.optJSONObject(day);
    return d!=null&&d.optJSONObject("done")!=null&&d.optJSONObject("done").optBoolean(kind);
  }
  static boolean waterGoalReached(JSONObject root,JSONObject s,String day){
    int goal=s.optInt("waterGoal",0);if(goal<=0)return false;
    JSONObject ds=root.optJSONObject("days");JSONObject d=ds==null?null:ds.optJSONObject(day);
    JSONArray drinks=d==null?null:d.optJSONArray("drinks");int total=0;
    if(drinks!=null)for(int i=0;i<drinks.length();i++){JSONObject x=drinks.optJSONObject(i);if(x!=null&&"water".equals(x.optString("type")))total+=x.optInt("ml");}
    return total>=goal;
  }
  static synchronized void schedule(Context c){
    AlarmManager alarm=c.getSystemService(AlarmManager.class);
    Intent intent=new Intent(c,ReminderReceiver.class).setAction("ru.ritm.REMIND");
    PendingIntent old=PendingIntent.getBroadcast(c,100,intent,PendingIntent.FLAG_NO_CREATE|PendingIntent.FLAG_IMMUTABLE);
    if(old!=null)alarm.cancel(old);
    JSONObject root=Store.json(c),s=root.optJSONObject("settings");
    if(s==null||!s.optBoolean("notifications",false)||!c.getSystemService(NotificationManager.class).areNotificationsEnabled())return;
    ZoneId zone=ZoneId.systemDefault();ZonedDateTime now=ZonedDateTime.now(zone);
    List<Event> events=new ArrayList<>();
    for(int i=0;i<8;i++){
      LocalDate date=now.toLocalDate().plusDays(i);int p=phase(s,date);String day=date.toString();
      LocalTime wake=time(s,p<4?"wakeWork":"wakeOff",p<4?"07:00":"09:00");
      add(events,s,date.atTime(wake).atZone(zone).plusMinutes(20),"am","Доброе утро","Пора уделить несколько минут уходу.");
      add(events,s,date.atTime(time(s,"eveningTime","20:30")).atZone(zone),"pm","Вечерний уход","Очищение, увлажнение и отметка состояния кожи.");
      if(!bath(s,p)&&contains(s.optJSONArray("trainingDays")==null?new JSONArray().put(0).put(2).put(4):s.optJSONArray("trainingDays"),p))
        add(events,s,date.atTime(time(s,"trainingTime","18:30")).atZone(zone),"workout","Время для себя","Открой тренировку и оцени самочувствие.");
      if(bath(s,p))add(events,s,date.atTime(time(s,"trainingTime","18:30")).atZone(zone),"bath","Вечер с баней","Отметь баню и самочувствие в журнале.");
      for(String raw:s.optString("waterTimes","10:00,12:00,14:00,16:00,20:00").split(",")){
        try{LocalTime t=LocalTime.parse(raw.trim());if(!t.isBefore(wake)&&!waterGoalReached(root,s,day))
          add(events,s,date.atTime(t).atZone(zone),"water","Пауза на воду","Если хочется пить — сделай несколько глотков и отметь выпитое.");}catch(Exception ignored){}
      }
      LocalDate next=date.plusDays(1);int np=phase(s,next);
      LocalTime nextWake=time(s,np<4?"wakeWork":"wakeOff",np<4?"07:00":"09:00");
      ZonedDateTime bedtime=next.atTime(nextWake).atZone(zone).minusMinutes(Math.round(s.optDouble("sleepGoal",8)*60)+s.optInt("latency",20)+30);
      add(events,s,bedtime,"sleep","Пора готовиться ко сну","Дай себе больше времени на сон. Не жди кратности циклам.");
    }
    long ms=System.currentTimeMillis();Event best=null;
    for(Event e:events)if(e.at>ms+1000&&!done(root,e.day,e.kind)&&(best==null||e.at<best.at))best=e;
    if(best==null)return;
    intent.putExtra("kind",best.kind).putExtra("title",best.title).putExtra("text",best.text).putExtra("day",best.day).putExtra("at",best.at);
    PendingIntent pi=PendingIntent.getBroadcast(c,100,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    if(Build.VERSION.SDK_INT<31||alarm.canScheduleExactAlarms()){
      try{alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,best.at,pi);return;}catch(SecurityException ignored){}
    }
    alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,best.at,pi);
  }
  static void add(List<Event> list,JSONObject s,ZonedDateTime t,String kind,String title,String text){if(!quiet(s,t.toLocalTime()))list.add(new Event(t,kind,title,text));}
  static void show(Context c,String kind,String title,String text,String token){
    NotificationManager manager=c.getSystemService(NotificationManager.class);
    manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Ежедневные напоминания",NotificationManager.IMPORTANCE_DEFAULT));
    if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
    PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder b=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.ic_notification).setContentTitle(title).setContentText(text)
      .setStyle(new Notification.BigTextStyle().bigText(text)).setContentIntent(open).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE);
    if(kind.matches("water|am|pm|workout")){
      Intent action=new Intent(c,ReminderReceiver.class).setAction("ru.ritm.DONE").putExtra("kind",kind).putExtra("token",token);
      PendingIntent pi=PendingIntent.getBroadcast(c,kind.hashCode(),action,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
      b.addAction(new Notification.Action.Builder(null,kind.equals("water")?"+250 мл":"Готово",pi).build());
    }
    manager.notify(kind.hashCode(),b.build());
  }
}
