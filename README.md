# Zendt Frontend

A modern, high-performance fintech dashboard application built with **React**, **TypeScript**, and **Vite**. This project features a sleek, dark-themed UI with glassmorphism effects, interactive financial tools, and a responsive layout.

## Project Overview

This repository is a fork of [princysivakumar/zendt-frontend](https://github.com/princysivakumar/zendt-frontend).

Significant enhancements and UI/UX improvements were made by **GeorgeET15** ([georgeemmanuelthomas.dev](https://georgeemmanuelthomas.dev)) during an internship at **Zendit** (Dec 3, 2025 - Dec 17, 2025).

### Change Log
For a detailed breakdown of all features, UI refinements, and architectural changes implemented during this period, please refer to:

**[GeorgeET15.md](./GeorgeET15.md)**

## Technology Stack

- **Framework:** React 18
- **Language:** TypeScript
- **Build Tool:** Vite
- **Mobile Runtime:** Capacitor
- **Styling:** Tailwind CSS
- **Icons:** Custom SVG Components
- **State Management:** React Context API (Auth)
- **Authentication (backend integration):** **AWS Cognito** — the app will use Amazon Cognito for sign-up, sign-in, and JWT-based API auth. The current UI uses mock auth; replace it with Cognito (e.g. `aws-amplify` or `amazon-cognito-identity-js`) when connecting to the backend. See the project’s **BACKEND-BUILD-GUIDE** for the full stack (AWS + MongoDB Atlas + Cognito).

## Setup Instructions

Follow these steps to set up the project locally.

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/GeorgeET15/zendt-frontend.git
   cd zendt-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Build for production**
   ```bash
   npm run build
   ```

## Mobile Development (Capacitor)

This project uses **Capacitor** to run the web app as a native mobile application.

### Running on Devices

1. **Sync web assets to native projects** (keeps `ZendtAppleSignInPlugin` on iOS — do not use raw `npx cap sync` alone)
   ```bash
   npm run cap:sync
   # iOS only: npm run cap:sync:ios
   ```

2. **Open Android Studio**
   ```bash
   npm run cap:open:android
   ```

3. **Open Xcode (iOS)**
   ```bash
   npm run cap:open:ios
   ```



## Features

- **Authentication:** Secure login with persistence. Auth will be wired to **AWS Cognito** when the backend is connected (see BACKEND-BUILD-GUIDE).
- **Dashboard:** Recent transactions, settlement overview, and quick actions.
- **Financial Tools:**
  - **Pay-ins:** Payment links and invoicing with settlement to your bank (Zwitch sub-account).
  - **Payment Links:** Generate and share payment links.
  - **Invoicing:** Create professional invoices with dynamic calculations.
  - **Cards:** Manage physical/virtual cards with realistic UI (coming soon).
- **Modern UI:** Dark mode, glassmorphism, custom animations, and responsive design.

---
*Maintained by GeorgeET15*
# admin
