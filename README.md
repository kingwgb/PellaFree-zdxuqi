## ⭐ Star 一下支持项目 ⭐

> 动动发财手点点 Star ⭐

基于 **Cloudflare Workers** 部署的 **PellaFree 自动续期 + 自动重启脚本**

---

## 📌 功能说明

* ✅ 多账号自动续期
* ✅ 支持定时 Cron 触发
* ✅ 支持手动触发（网页 / API）
* ✅ 支持服务器一键重启
* ✅ Telegram 通知推送

---

## ⚠️ 注意事项

> ❗ 仅支持 **Web 创建的机器（PellaFree）**
> ❗ 不支持 API / 其他来源创建的实例

---

## 📝 注册地址

👉 [https://www.pella.app/](https://www.pella.app/)

---

## 🚀 部署方式

使用 **Cloudflare Workers** 部署

---

## 🔧 环境变量配置

| 变量名            | 说明                 |
| -------------- | ------------------ |
| `PASSWORD`     | 访问密码               |
| `ACCOUNT`      | 账号列表（格式见下）         |
| `TG_BOT_TOKEN` | Telegram Bot Token |
| `TG_CHAT_ID`   | Telegram Chat ID   |

### 📄 ACCOUNT 格式示例

```
user1@gmail.com-----password1
user2@gmail.com-----password2
```

---

## ⏰ 定时任务（Cron）

在 Cloudflare Workers 中配置：

```
0 */4 * * *
```

👉 每 4 小时自动执行一次续期

---

## 🌐 使用方式

### 1️⃣ 浏览器手动续期

```
https://xxx.workers.dev/
```

---

### 2️⃣ API 触发续期（所有账号）

```bash
curl "https://xxx.workers.dev/?pwd=你的密码"
```

---

## 🔄 重启功能

### 1️⃣ 浏览器手动重启

```
https://xxx.workers.dev/
```

---

### 2️⃣ API 重启所有账号服务器

```bash
curl "https://xxx.workers.dev/restart?pwd=你的密码"
```

---

### 3️⃣ API 重启指定账号服务器

```bash
curl "https://xxx.workers.dev/restart?pwd=你的密码&account=user@gmail.com"
```

---

## 📸 效果展示

### 🔔 通知效果

![通知效果](img/通知效果.png)

### ⏰ Cron 设置

![Cron 定时](img/Cron定时.png)

### ⚙️ 环境变量

![环境变量](img/环境变量.png)

### 📢 注意事项 
- ❗ 仅支持 Web 创建的机器

![注意事项](img/注意：只支持web创建的机器.png)

---

## 💬 Telegram 通知说明

配置 `TG_BOT_TOKEN` 和 `TG_CHAT_ID` 后：

* ✅ 续期结果推送
* ✅ 重启结果推送
* ❌ 失败告警

---

## ❤️ 支持项目

如果这个项目对你有帮助：

👉 点个 **Star ⭐** 支持一下吧！

---
