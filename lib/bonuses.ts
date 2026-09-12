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

export function orderBonuses(orderId:string,customerId:string|null,status:string,version:number|null=null) {
  if(!customerId || !["completed","cancelled"].includes(status))return [];
  const db=database();
  const condition="id=? AND customer_id=? AND status=? AND (? IS NULL OR version=?)";
  const bindings=[orderId,customerId,status,version,version];
  const operations=status==="completed"?[
    db.prepare("INSERT OR IGNORE INTO bonus_operations(id,customer_id,delta,kind,note) SELECT 'earn:'||id,customer_id,bonus_earned,'earn',order_number FROM orders WHERE "+condition).bind(...bindings),
    db.prepare("UPDATE orders SET bonus_awarded=1 WHERE "+condition).bind(...bindings),
  ]:[
    db.prepare("INSERT OR IGNORE INTO bonus_operations(id,customer_id,delta,kind,note) SELECT 'return:'||id,customer_id,bonus_spent,'return',order_number FROM orders WHERE "+condition).bind(...bindings),
    db.prepare("INSERT OR IGNORE INTO bonus_operations(id,customer_id,delta,kind,note) SELECT 'revoke:'||id,customer_id,-(SELECT delta FROM bonus_operations WHERE id='earn:'||orders.id),'revoke',order_number FROM orders WHERE "+condition+" AND EXISTS(SELECT 1 FROM bonus_operations WHERE id='earn:'||orders.id)").bind(...bindings),
  ];
  return [...operations,...settleBonuses(customerId)];
}
