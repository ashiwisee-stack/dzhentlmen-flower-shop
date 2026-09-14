import { database } from "@/db";

// Include these statements in the same D1 batch as the order mutation.
// The ledger row is unique; settling and marking it applied are atomic.
export function settleBonuses(customerId:string) {
  const db=database();
  return [
    db.prepare("UPDATE customers SET bonus_balance=bonus_balance+COALESCE((SELECT SUM(delta) FROM bonus_operations WHERE customer_id=? AND applied=0),0),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(customerId,customerId),
    db.prepare("UPDATE bonus_operations SET applied=1 WHERE customer_id=? AND applied=0").bind(customerId),
  ];
}

export function spendBonuses(customerId:string,orderId:string,amount:number,note:string) {
  const db=database();
  return [db.prepare("INSERT INTO bonus_operations(id,customer_id,delta,kind,note) SELECT ?,id,?,'spend',? FROM customers WHERE id=? AND bonus_balance>=?").bind("spend:"+orderId,-amount,note,customerId,amount),...settleBonuses(customerId)];
}

// Reconcile the desired ledger total on every transition, including reopening.
// The optimistic order version and ledger insertion are in the same D1 batch.
export function orderBonuses(orderId:string,customerId:string|null,status:string|null,version:number|null=null) {
 if(!customerId)return [];
 const db=database();
 const where="id=? AND customer_id=? AND (? IS NULL OR status=?) AND (? IS NULL OR version=?)";
 const target="CASE WHEN status='cancelled' THEN bonus_spent WHEN status='completed' AND payment_status='paid' THEN bonus_earned ELSE 0 END";
 const previous="COALESCE((SELECT SUM(delta) FROM bonus_operations WHERE customer_id=orders.customer_id AND (id IN ('earn:'||orders.id,'return:'||orders.id,'revoke:'||orders.id) OR id LIKE 'adjust:'||orders.id||':%')),0)";
 const args=[orderId,customerId,status,status,version,version];
 return [
 db.prepare("INSERT OR IGNORE INTO bonus_operations(id,customer_id,delta,kind,note) SELECT 'adjust:'||id||':'||version,customer_id,("+target+")-("+previous+"),'status',order_number FROM orders WHERE "+where).bind(...args),
 db.prepare("UPDATE orders SET bonus_awarded=CASE WHEN status='completed' AND payment_status='paid' THEN 1 ELSE 0 END WHERE "+where).bind(...args),
 ...settleBonuses(customerId)
 ];
}
