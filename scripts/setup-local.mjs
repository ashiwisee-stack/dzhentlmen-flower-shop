import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
const path=new URL('../.dev.vars',import.meta.url);
let text=await readFile(new URL('../.env.example',import.meta.url),'utf8');
for(const key of ['ADMIN_PASSWORD','ADMIN_SESSION_SECRET','CUSTOMER_AUTH_SECRET'])text=text.replace(new RegExp('^'+key+'=$','m'),key+'='+randomBytes(32).toString('hex'));
text=text.replace('SMS_DEV_MODE=0','SMS_DEV_MODE=1').replace('PUBLIC_ORIGIN=\n','PUBLIC_ORIGIN=http://localhost:5173\n');
try {await writeFile(path,text,{flag:'wx',mode:0o600});console.log('Создан .dev.vars. Пароль администратора находится в этом файле. Файл исключён из Git.');}
catch(error){if(error.code==='EEXIST')console.log('.dev.vars уже существует; данные сохранены без изменений.');else throw error;}
