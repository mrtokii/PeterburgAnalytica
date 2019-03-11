# PeterburgAnalytica

## Установка и запуск

В файле `users.json` содержится список идентификаторов пользователей для отслеживания в виде JSON-списка. Идентификатор пользователя можно узнать из адреса его страницы: vk.com/**userID**.

В файл `backup-vk.dat` кешируются данные в формате JSON. 

Для запуска необходим Node.js (рекомендуется версия >= 8.11.3) и модуль `request` с зависимостями:

```bash
npm install request
```

После запуска сервер начнет собирать данные в автоматическом режиме:

```bash
node vk.js
```

При этом, непосредственно в процессе работы можно изменять список отслеживаемых пользователей, редактируя файл `users.json`.

Для более удобной работы можно использовать `pm2`:

```bash
pm2 start vk.js
pm2 monit
```

## Просмотр статистики

Для просмотра собранных данных служит файл `index.html`. Перед использованием необходимо отредактировать переменную `serverURL`, коорая соответствует адресу работающего сервера (по умолчанию: *http://localhost:8080*).
