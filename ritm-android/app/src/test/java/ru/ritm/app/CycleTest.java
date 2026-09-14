package ru.ritm.app;
import org.junit.Test;
import java.time.LocalDate;
import static org.junit.Assert.*;
public class CycleTest {
 @Test public void cycleCrossesMonthAndYear(){LocalDate a=LocalDate.of(2026,12,30);assertEquals(4,Cycle.day(a,2,LocalDate.of(2027,1,1)));assertEquals(0,Cycle.day(a,2,a.minusDays(2)));assertEquals(5,Cycle.day(a,0,a.minusDays(1)));}
 @Test public void sleepNeverRoundsDownToCycles(){assertEquals(440,Cycle.sleepMinutes(23*60+20,7*60,20));assertEquals(50,Cycle.sleepMinutes(6*60,7*60,10));assertEquals(0,Cycle.sleepMinutes(6*60+55,7*60,20));}
}
