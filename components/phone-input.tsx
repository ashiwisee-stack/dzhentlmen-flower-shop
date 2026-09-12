"use client";
import { useId, type InputHTMLAttributes } from "react";
import { phoneDigits } from "@/lib/phone";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
};

export function PhoneInput({ value, onChange, required = true, ...props }: Props) {
  const hint = useId();
  return <span className="phone-field-wrap">
    <span className="phone-field"><span className="phone-prefix" aria-hidden="true">+7</span><input
      {...props} type="tel" inputMode="numeric" autoComplete="tel-national" required={required}
      value={phoneDigits(value)} pattern="[0-9]{10}" minLength={10} maxLength={10}
      placeholder="999 123 45 67" aria-describedby={hint} title="Введите 10 цифр после +7"
      onChange={event => { event.target.setCustomValidity(""); onChange("+7" + phoneDigits(event.target.value)); }}
      onPaste={event => { event.preventDefault(); event.currentTarget.setCustomValidity(""); onChange("+7" + phoneDigits(event.clipboardData.getData("text"))); }}
      onInvalid={event => event.currentTarget.setCustomValidity("Введите 10 цифр номера после +7")}
    /></span><small id={hint}>10 цифр после +7</small>
  </span>;
}
