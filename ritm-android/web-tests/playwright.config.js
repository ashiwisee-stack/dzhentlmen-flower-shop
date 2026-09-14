const { defineConfig } = require('@playwright/test');
module.exports=defineConfig({
 testDir:'.',testMatch:'*.spec.js',timeout:30000,
 use:{baseURL:'http://127.0.0.1:4173',viewport:{width:393,height:852},locale:'ru-RU',timezoneId:'Asia/Yekaterinburg',screenshot:'only-on-failure'},
 webServer:{command:'python3 -m http.server 4173 --directory ../app/src/main/assets/www',port:4173,reuseExistingServer:false},
 reporter:[['list'],['html',{open:'never',outputFolder:'report'}]]
});