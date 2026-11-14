# AltuVera Pharmacy — New Architecture

## Architecture

| Layer | Technology | Purpose |
|---|---|---|
| API | ASP.NET Core 8 Web API | Replaces Python/FastAPI backend |
| POS | WPF + WebView2 (.NET 8) | Desktop app hosting React POS |
| ERP | React + Vite (unchanged) | Web browser-based ERP |
| Database | PostgreSQL 16 (unchanged) | Same schema, no migration needed |

---

## 1. Configure the API

Edit `src/AltuVera.Pharmacy.API/appsettings.Development.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=epharmacy;Username=postgres;Password=YOUR_PASSWORD"
  }
}
```

---

## 2. Run the API

```bash
cd src/AltuVera.Pharmacy.API
dotnet run
```

API runs on **http://localhost:8000** by default.  
Swagger UI: http://localhost:8000/swagger

To set port 8000 explicitly, edit `src/AltuVera.Pharmacy.API/Properties/launchSettings.json`:
```json
"applicationUrl": "http://localhost:8000"
```

---

## 3. Run the ERP (web)

```bash
cd frontend/erp
npm install
npm run dev
```

Runs on **http://localhost:5121** — proxies `/api` → `http://localhost:8000`

---

## 4. Run the POS (desktop)

```bash
cd src/AltuVera.Pharmacy.POS
dotnet run
```

The WPF window opens and loads the React POS via WebView2.

> **Important:** The React POS dev server must be running first:
> ```bash
> cd frontend/pos
> npm install
> npm run dev
> ```
> Then launch the WPF app. It loads http://localhost:5120.

For a production build, build React POS (`npm run build`), then configure the WPF app to load the built files via a local HTTP server or embed them.

---

## 5. Login Credentials

After running `python reset_password.py` from the `backend/` folder:

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@1234` | System Administrator |
| `pharmacist` | `Pharm@1234` | Pharmacist |
| `stockmgr` | `Stock@1234` | Stock Manager |
| `manager` | `Manager@1234` | Pharmacy Manager |

---

## Solution Structure

```
AltuVera.Pharmacy.slnx
└── src/
    ├── AltuVera.Pharmacy.Domain/        # Entities & Enums
    ├── AltuVera.Pharmacy.Application/   # (future: CQRS / services)
    ├── AltuVera.Pharmacy.Infrastructure/ # EF Core DbContext, JWT
    ├── AltuVera.Pharmacy.API/           # ASP.NET Core controllers
    └── AltuVera.Pharmacy.POS/           # WPF desktop app
frontend/
    ├── erp/   # React ERP web app (port 5121)
    └── pos/   # React POS web app (port 5120)
```
