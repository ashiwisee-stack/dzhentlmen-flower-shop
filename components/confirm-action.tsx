"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from "@/components/ui/alert-dialog";
export function ConfirmAction({label,description,onConfirm,disabled=false}:{label:string;description:string;onConfirm:()=>void;disabled?:boolean}) {
  const [open,setOpen]=useState(false);
  return <><Button type="button" variant="outline" disabled={disabled} onClick={()=>setOpen(true)}>{label}</Button><AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{label}?</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Подтвердить</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}
