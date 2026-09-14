"use client";
import { useId } from "react";
import { CreditCard, Wallet } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import styles from "./payment-method-picker.module.css";

export function PaymentMethodPicker({value,onChange,ready,test}:{value:string;onChange:(value:string)=>void;ready:boolean;test:boolean}) {
  const id=useId();
  return <fieldset className={styles.fieldset}>
    <legend>Способ оплаты</legend>
    <RadioGroup aria-label="Способ оплаты" value={value} onValueChange={onChange} className={styles.options}>
      <label htmlFor={id+"-receipt"} className={styles.option} data-selected={value==="on_receipt"}>
        <span className={styles.top}><Wallet aria-hidden="true"/><RadioGroupItem id={id+"-receipt"} value="on_receipt" aria-label="При получении"/></span>
        <span className={styles.copy}><strong>При получении</strong><small>Оплатить при доставке или самовывозе</small></span>
      </label>
      <label htmlFor={id+"-online"} className={styles.option} data-selected={value==="online"} data-disabled={!ready}>
        <span className={styles.top}><CreditCard aria-hidden="true"/><RadioGroupItem id={id+"-online"} value="online" disabled={!ready} aria-label="Оплата онлайн"/></span>
        <span className={styles.copy}><strong>Оплата онлайн</strong><small>{!ready?"Временно недоступна":test?"Тестовый режим · без списания денег":"Оплатить на сайте после подтверждения"}</small></span>
      </label>
    </RadioGroup>
  </fieldset>;
}
