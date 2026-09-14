package ru.ritm.app;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
final class Cycle {
  static int day(LocalDate anchor,int phase,LocalDate date) { return (int)Math.floorMod(ChronoUnit.DAYS.between(anchor,date)+phase,6L); }
  static int sleepMinutes(int bed,int wake,int latency) { return Math.max(0,Math.floorMod(wake-bed,1440)-latency); }
}
