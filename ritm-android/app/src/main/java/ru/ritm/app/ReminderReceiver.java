package ru.ritm.app;
import android.app.NotificationManager;
import android.content.*;
import org.json.*;
import java.time.*;
public class ReminderReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context c,Intent intent){
   String kind=intent.getStringExtra("kind");if(kind==null)return;
   if("ru.ritm.DONE".equals(intent.getAction())){
     synchronized(Store.class){
       try{
         JSONObject root=Store.json(c);
         String token=intent.getStringExtra("token");if(token==null)return;
         JSONArray used=root.optJSONArray("handled");if(used==null)used=new JSONArray();
         for(int i=0;i<used.length();i++)if(token.equals(used.optString(i)))return;
         // Old notification actions must never silently write into a different day's journal.
         String date=token.substring(0,10);
         if(!date.equals(LocalDate.now().toString())){c.getSystemService(NotificationManager.class).cancel(kind.hashCode());return;}
         JSONObject days=root.getJSONObject("days"),d=days.optJSONObject(date);
         if(d==null){d=new JSONObject();days.put(date,d);}
         if(kind.equals("water")){
           JSONArray drinks=d.optJSONArray("drinks");if(drinks==null){drinks=new JSONArray();d.put("drinks",drinks);}
           drinks.put(new JSONObject().put("id",java.util.UUID.randomUUID().toString()).put("type","water").put("ml",250).put("source","cup").put("at",System.currentTimeMillis()));
         }else if(kind.matches("am|pm|workout")){
           JSONObject done=d.optJSONObject("done");if(done==null){done=new JSONObject();d.put("done",done);}done.put(kind,true);
         }
         JSONArray tail=new JSONArray();for(int i=Math.max(0,used.length()-49);i<used.length();i++)tail.put(used.get(i));tail.put(token);root.put("handled",tail);
         root.put("revision",root.optLong("revision",0)+1);
         if(Store.write(c,root.toString()))c.getSystemService(NotificationManager.class).cancel(kind.hashCode());
       }catch(Exception ignored){}
     }
   }else{
     JSONObject root=Store.json(c),s=root.optJSONObject("settings");
     long at=intent.getLongExtra("at",0);
     if(s!=null&&s.optBoolean("notifications")&&System.currentTimeMillis()-at<2*60*60*1000L
        &&!Reminders.quiet(s,LocalTime.now())&&!Reminders.done(root,intent.getStringExtra("day"),kind)){
       if(!kind.equals("water")||!Reminders.waterGoalReached(root,s,intent.getStringExtra("day")))
         Reminders.show(c,kind,intent.getStringExtra("title"),intent.getStringExtra("text"),intent.getStringExtra("day")+":"+kind+":"+at);
     }
   }
   Reminders.schedule(c);
 }
}
