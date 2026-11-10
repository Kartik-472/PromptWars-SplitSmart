# SplitSmart 💸
### Smart Expense Splitting & Settlement Platform for College Students

SplitSmart is a web-based expense management platform designed to make shared spending among college students simple, transparent, and hassle-free.

Whether it's a hostel grocery run, a group dinner, a cab ride, or a college trip, SplitSmart helps friends track shared expenses, calculate individual balances, and settle debts with optimized payment suggestions.

**Live Demo:** https://prompt-wars-split-smart.vercel.app

**GitHub Repository:** https://github.com/Kartik-472/PromptWars-SplitSmart

---

## 🚀 Problem Statement

Students frequently share expenses with friends and classmates. Tracking who paid, who owes whom, and how much everyone needs to contribute can quickly become confusing.

Existing manual methods involving notes, spreadsheets, and chat messages are inefficient and prone to mistakes.

SplitSmart addresses this problem through a centralized platform that automates expense tracking and settlement calculations.

## ✨ Key Features

- **User Authentication:** Secure registration and login.
- **Group Management:** Create expense groups and invite members using unique invite codes.
- **Expense Tracking:** Record shared expenses with descriptions, categories, and payment details.
- **Flexible Splitting:** Split expenses equally, using custom amounts, or by percentage.
- **Automatic Balance Calculation:** Track how much each member owes or is owed.
- **Smart Settlement Suggestions:** Minimize the number of transactions required to settle outstanding balances.
- **Settlement History:** Keep track of confirmed settlements.
- **Responsive Interface:** Access the application across desktop and mobile devices.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js |
| Build Tool | Vite |
| Styling | Tailwind CSS / Custom CSS |
| Backend | Node.js |
| API Framework | Express.js |
| Database | SQLite |
| Database Driver | better-sqlite3 |
| Authentication | JWT and bcrypt |
| Charts | Recharts |
| Icons | Lucide React |
| Security | Helmet, CORS, Express Rate Limit |

## 🏗️ Project Structure

```text
split-smart/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── database/
│   │   └── server.js
│   └── package.json
│
├── .gitignore
└── README.md
```

## ⚙️ Installation and Setup

### Prerequisites

Install the following:

- Node.js (LTS recommended)
- npm
- Git

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd split-smart
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file inside the backend folder:

```env
PORT=5000
JWT_SECRET=your_secure_random_secret
CLIENT_URL=http://localhost:5173
```

Start the backend:

```bash
npm run dev
```

Backend runs at:

`http://localhost:5000`

Health check:

`http://localhost:5000/api/health`

### 3. Set up the frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Create a `.env` file inside the frontend folder:

```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

Frontend runs at:

`http://localhost:5173`

## 🧮 How Smart Settlement Works

SplitSmart calculates each member's net balance using:

**Net Balance = Total Paid − Total Share Owed**

- Positive balance: The member should receive money.
- Negative balance: The member needs to pay money.
- Zero balance: The member is settled.

The settlement engine matches people who owe money with people who should receive money, reducing the number of transactions needed.

### Example

Suppose three friends share expenses:

| Member | Net Balance |
|---|---:|
| Aarav | +₹300 |
| Riya | ₹0 |
| Kabir | -₹300 |

Suggested settlement:

**Kabir → Aarav: ₹300**

One transaction settles the entire outstanding balance.

## 🔐 Security Considerations

SplitSmart includes:

- Password hashing using bcrypt.
- JWT-based authentication.
- Protected API routes.
- Helmet security headers.
- CORS configuration.
- Authentication rate limiting.
- Request body size limits.
- Group membership validation.

The application is a hackathon MVP. Further security testing and production hardening are required before handling real financial transactions or sensitive financial data.

## 🌐 Deployment

The application can be deployed using:

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | SQLite with persistent storage |

Configure the following production environment variables:

**Backend:**
- `JWT_SECRET`
- `CLIENT_URL`
- `NODE_ENV=production`

**Frontend:**
- `VITE_API_URL`

Ensure the SQLite database is stored on persistent storage in production. Otherwise, database records may be lost after service restarts or redeployments.

## 🧪 Testing

Important scenarios to test:

- User registration and authentication.
- Group creation and invite-code validation.
- Equal, custom, and percentage-based expense splitting.
- Balance calculation accuracy.
- Settlement suggestion correctness.
- Unauthorized group access prevention.
- Duplicate settlement prevention.
- Data persistence after restarting the backend.
- Responsive design and keyboard accessibility.

## 🎯 Future Enhancements

- UPI payment integration.
- Real-time expense notifications.
- Group expense analytics and monthly reports.
- Recurring expenses.
- Export expenses to PDF and CSV.
- PostgreSQL support for scalable deployments.
- Advanced accessibility improvements.
- Multi-currency support.

## 💡 Why SplitSmart?

SplitSmart aims to eliminate the awkwardness and confusion of shared expenses among friends.

Instead of manually calculating who owes whom, students can focus on their experiences while SplitSmart handles the accounting.

**Split expenses. Simplify settlements. Stay friends.**

---

### Built for college communities and hackathon innovation.

**SplitSmart | Making shared expenses smarter.**
