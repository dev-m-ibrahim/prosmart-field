<div align="center">

<img src="assets/banner.png" alt="Pro Smart Field — Smart Living, Simplified" width="100%"/>

# Pro Smart Field

**Field-operations platform for smart-home, CCTV, intercom & network installation teams.**

[![Developer](https://img.shields.io/badge/Developer-MOHAMED%20IBRAHEM-003a5f?style=for-the-badge)](#-copyright--ownership)

[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20Web-0b7285?style=for-the-badge)](#-tech-stack)
[![Status](https://img.shields.io/badge/Status-Active%20development-19c6e6?style=for-the-badge)](#-project-status--updates)
[![Rights](https://img.shields.io/badge/Rights-All%20Reserved-c92a2a?style=for-the-badge)](#-copyright--ownership)

[🇪🇬 النسخة العربية](README.ar.md)

</div>

---

## © Copyright & Ownership

<div align="center">

**Copyright © 2026 MOHAMED IBRAHEM — All rights reserved.**

<a href="tel:+201122822813"><img src="https://img.shields.io/badge/Phone-%2B201122822813-0b7285?style=for-the-badge&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0id2hpdGUiIGQ9Ik02LjYyIDEwLjc5YzEuNDQgMi44MyAzLjc2IDUuMTQgNi41OSA2LjU5bDIuMi0yLjJjLjI3LS4yNy42Ny0uMzYgMS4wMi0uMjQgMS4xMi4zNyAyLjMzLjU3IDMuNTcuNTcuNTUgMCAxIC40NSAxIDFWMjBjMCAuNTUtLjQ1IDEtMSAxLTkuMzkgMC0xNy03LjYxLTE3LTE3IDAtLjU1LjQ1LTEgMS0xaDMuNWMuNTUgMCAxIC40NSAxIDEgMCAxLjI1LjIgMi40NS41NyAzLjU3LjExLjM1LjAzLjc0LS4yNSAxLjAybC0yLjIgMi4yeiIvPjwvc3ZnPg%3D%3D" alt="Phone +201122822813"/></a>
<a href="https://t.me/dev_muhamed"><img src="https://img.shields.io/badge/Telegram-%40dev__muhamed-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram @dev_muhamed"/></a>
<a href="https://instagram.com/mhamed_shsya"><img src="https://img.shields.io/badge/Instagram-%40mhamed__shsya-E4405F?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram @mhamed_shsya"/></a>

</div>

**Pro Smart Field** — its source code, design, database schema, documentation and every related asset — was **designed and developed solely by MOHAMED IBRAHEM** (Pro Smart).

- ❌ Copying, redistributing, reselling or publishing this project or any part of it is **prohibited**.
- ❌ Modifying it and presenting it as your own work is **prohibited**.
- ❌ Removing or altering this notice or the developer attribution is **prohibited**.
- ❌ Attributing the project or its ownership to anyone else, in any form, is **prohibited**.
- ✅ Use is allowed only with the **written permission** of the owner.

Any unauthorised use, copying or false attribution is a violation of the author's rights and may be pursued legally. See [LICENSE](LICENSE). The **Pro Smart** name and logo are trademarks of their owner.

---

## 📖 About

**Pro Smart Field** is a field-service app built for **Pro Smart**, a smart-home installation company in Egypt that installs smart-home systems, security cameras, intercoms and networks.

It replaces paper notes and scattered WhatsApp messages with one organised workflow: the office creates a work order, technicians are notified instantly and record everything they do on site (photos, signatures, devices, cable lengths), the storekeeper tracks every item that leaves or returns to the warehouse, and the owner sees the whole picture in the reports.

> Designed mobile-first for technicians on the road — works as an installable **Android app (APK)** and as a **web app**, with offline support for poor-signal sites.

---

## 📸 Screenshots

<div align="center">

| Work orders | Site survey | Warehouse | Reports |
|:---:|:---:|:---:|:---:|
| <img src="docs/screenshots/orders.png" width="180"/> | <img src="docs/screenshots/survey.png" width="180"/> | <img src="docs/screenshots/stock.png" width="180"/> | <img src="docs/screenshots/reports.png" width="180"/> |

</div>

---

## ✨ Features

### 📋 Work orders
- 🛠️ **Three order types** — Installation · Site survey · Maintenance
- 👥 Assign several technicians, pick a team leader, set date & time, client name / phone / address
- 🔔 Instant push notification to every assigned technician
- 📍 "Arrived" / "Departed" time stamps recorded on site
- 🔗 Maintenance orders can be **linked to a previous order** (client data auto-filled)
- 💬 WhatsApp button to confirm the appointment with the client

### 🔍 Site survey
- 🏠 Three sections: **Smart Home · CCTV · Network**
- 🚪 Add rooms / areas with names and floors, pick devices from the catalog with quantities
- 📡 Smart-home system chosen once per survey: **Wi-Fi 2.4 GHz**, **Zigbee** (number of hubs) or **KNX-style panels** (number of panels + length × width × depth for each panel)
- 🧮 Automatic **totals per section**
- 📄 Admin can review, edit and **export the survey as PDF**

### 🗂️ Device catalog
- 📚 **91 bilingual devices** out of the box — touch switches (1–4 gang), smart shutters, presence & motion sensors, smart locks, plugs, gas & water sensors, NVRs, 2 MP–8 MP cameras, cables (Cat6 / coax / power, per metre), 1 TB–10 TB hard drives, routers, access points, switches and racks
- ✏️ The owner adds, edits and deletes devices from **Settings → Survey device catalog**
- 🔐 The owner can grant any user the "manage survey catalog" permission

### 📦 Warehouse
- ➕ **Top-up** button with a full audit trail: source (invoice / supplier / job name), balance before and after — balances can never be edited by hand
- 🕘 Supply history: who added what, and from where
- 📤 Issue → install → return flow; returns need **storekeeper approval** before going back to stock
- 📷 Barcode / serial scanning with the phone camera
- 🗃️ Nested categories (Brand › Type › Model)

### 👷 Technicians
- ✅ Per-technician tasks inside one order, each with its own bonus (added after admin approval)
- 📸 Multiple site photos, client signature, IPs & passwords, cable lengths, follow-up flag
- 📴 Offline mode — data is queued and synced when the signal returns

### 📊 Reports & exports
- 🏆 Who completes the most orders · who works most on sites
- 📑 Export to **Excel** and **PDF**
- ⏰ Manager reminders delivered to selected people

### 🌍 Bilingual & themed
- 🔤 Arabic (RTL) and English (LTR) — switch from the header, the login page or Settings
- 🌗 Light / dark theme
- 🔄 **In-app updates** — the app detects a new release and installs it over the old one

---

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| UI | ![React](https://img.shields.io/badge/React_18-20232a?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS_4-06b6d4?logo=tailwindcss&logoColor=white) |
| Backend | ![Supabase](https://img.shields.io/badge/Supabase-3ecf8e?logo=supabase&logoColor=white) PostgreSQL · Auth · Row-Level Security · Edge Functions |
| Mobile | ![Capacitor](https://img.shields.io/badge/Capacitor_6-119eff?logo=capacitor&logoColor=white) ![Android](https://img.shields.io/badge/Android-3ddc84?logo=android&logoColor=white) |
| Notifications | Firebase Cloud Messaging |
| Exports | ExcelJS · jsPDF |
| Scanning | ZXing |
| CI / CD | ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088ff?logo=githubactions&logoColor=white) |

---

## 🚀 Installation

1. Download **`ProSmart.apk`** from [**Releases → latest**](https://github.com/dev-m-ibrahim/prosmart-field/releases/tag/latest).
2. Open it on your Android phone and allow installation from this source if asked.
3. Sign in with the account created for you by the admin.
4. Updates: when a new version is available, a banner appears at the top — tap **Update now**.

---

## 🧭 System sections

| Role | Sections |
|---|---|
| 👑 **Owner / Admin** | Work orders · Warehouse · Issue · Reports · Alerts · Settings (users, catalog, categories, permissions) |
| 🛠️ **Technician** | My orders · Order details & survey · Alerts · Settings |
| 📦 **Storekeeper** | Warehouse · Issue · Returns approval · Alerts · Settings |

---

## 📌 Project status & updates

**Status:** 🟢 Active development — in daily use.

### Latest
- ✅ Order types: Installation / Site survey / Maintenance
- ✅ Site survey with Smart Home · CCTV · Network sections and automatic totals
- ✅ Smart-home setup per survey: Wi-Fi 2.4, Zigbee hubs, or KNX-style panels with the size of **each** panel
- ✅ Bilingual device catalog (91 devices) managed by the owner
- ✅ Warehouse top-up with supply source and before / after balance
- ✅ Arabic / English interface

### Planned
- ⏳ Translate the remaining database-generated PDFs and alerts to English

---

<div align="center">

**© 2026 MOHAMED IBRAHEM — All rights reserved. Unauthorised copying or attribution to others is prohibited.**

<a href="tel:+201122822813"><img src="https://img.shields.io/badge/Phone-%2B201122822813-0b7285?style=for-the-badge&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0id2hpdGUiIGQ9Ik02LjYyIDEwLjc5YzEuNDQgMi44MyAzLjc2IDUuMTQgNi41OSA2LjU5bDIuMi0yLjJjLjI3LS4yNy42Ny0uMzYgMS4wMi0uMjQgMS4xMi4zNyAyLjMzLjU3IDMuNTcuNTcuNTUgMCAxIC40NSAxIDFWMjBjMCAuNTUtLjQ1IDEtMSAxLTkuMzkgMC0xNy03LjYxLTE3LTE3IDAtLjU1LjQ1LTEgMS0xaDMuNWMuNTUgMCAxIC40NSAxIDEgMCAxLjI1LjIgMi40NS41NyAzLjU3LjExLjM1LjAzLjc0LS4yNSAxLjAybC0yLjIgMi4yeiIvPjwvc3ZnPg%3D%3D" alt="Phone +201122822813"/></a>
<a href="https://t.me/dev_muhamed"><img src="https://img.shields.io/badge/Telegram-%40dev__muhamed-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram @dev_muhamed"/></a>
<a href="https://instagram.com/mhamed_shsya"><img src="https://img.shields.io/badge/Instagram-%40mhamed__shsya-E4405F?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram @mhamed_shsya"/></a>

*Smart Living, Simplified.*

</div>
