import { urlToClashProxy } from '../functions/utils/url-to-clash.js';

const url = 'vless://e9e989f8-a824-4d6e-ac09-8d6ec785c95f@boil.hkt.dpdns.org:17211?type=tcp&security=reality&sni=www.lovelive-anime.jp&pbk=g-oxbqigzCaXqARxuyD2_vbTYeMD9zn8wnTo02S69QM&flow=xtls-rprx-vision&fp=safari#HKT';

const proxy = urlToClashProxy(url);
console.log(JSON.stringify(proxy, null, 2));
