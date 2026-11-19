# AltusVera Pharmacy Management System

## Architecture

| Layer | Technology | Purpose |
|---|---|---|
| API | ASP.NET Core 8 Web API | Business logic, database access, JWT auth |
| ERP | React 18 + Vite + TypeScript | Web-based inventory & management dashboard |
| POS UI | React 18 + Vite + TypeScript | Point-of-sale interface |
| POS Desktop | Electron.js | Desktop shell hosting the React POS |
| Database | SQL Server (SQLEXPRESS) | Primary data store |

## Project Structure

```
AltuVera.Pharmacy.slnx
├── src/
│   ├── AltuVera.Pharmacy.Domain/         # Entities & Enums
│   ├── AltuVera.Pharmacy.Application/    # (future: CQRS / services)
│   ├── AltuVera.Pharmacy.Infrastructure/ # EF Core DbContext, JWT, seeding
│   ├── AltuVera.Pharmacy.API/            # ASP.NET Core controllers
│   └── AltuVera.Pharmacy.POS/            # WPF desktop app (optional)
├── frontend/
│   ├── erp/          # React ERP (port 5121)
│   ├── pos/          # React POS (port 5120)
│   └── pos-desktop/  # Electron shell for POS
├── uploads/          # File uploads served by API (runtime, not committed)
└── scripts/          # Startup batch scripts
```

## Getting Started

### 1. Configure the API

Edit `src/AltuVera.Pharmacy.API/appsettings.Development.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.\\SQLEXPRESS;Database=epharmacy;User Id=sa;Password=YOUR_PASSWORD;TrustServerCertificate=True;"
  }
}
```

### 2. Run everything

```bat
start-all.bat
```

This starts all four services in sequence:

| Service | Command | URL |
|---|---|---|
| API | `dotnet run` | http://localhost:8000 |
| ERP | `npm run dev` | http://localhost:5121 |
| POS React | `npm run dev` | http://localhost:5120 |
| POS Desktop | `npm run electron` | Electron window |

Or start each individually using the scripts in `scripts/`.

### 3. First run — install Node dependencies

```bat
cd frontend\erp && npm install
cd frontend\pos && npm install
cd frontend\pos-desktop && npm install
```

### 4. Default login credentials

Seeded automatically on first `dotnet run`:

| Username | Password | Role |
|---|---|---|
| `admin` | `Admin@123` | System Administrator |
| `pharmacist` | `Pharm@123` | Pharmacist |
| `stockmgr` | `Stock@123` | Stock Manager |
| `manager` | `Manager@123` | Pharmacy Manager |

## API Docs

Swagger UI available in development at: http://localhost:8000/swagger
