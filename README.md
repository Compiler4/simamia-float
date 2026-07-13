# Simamia Float ERP - Step 2 Prisma + MySQL

Copy these files into your Next.js project root:

C:\Users\Micha\simamia-float

## 1. Install packages

npm install @prisma/client @prisma/adapter-mariadb dotenv bcryptjs
npm install -D prisma tsx

## 2. Create MySQL database

Open phpMyAdmin SQL tab or MySQL terminal and run:

CREATE DATABASE IF NOT EXISTS simamia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

## 3. Create .env

Copy `.env.example` to `.env`.

For XAMPP default root with empty password:

DATABASE_URL="mysql://root:@localhost:3306/simamia"
DATABASE_HOST="localhost"
DATABASE_PORT="3306"
DATABASE_USER="root"
DATABASE_PASSWORD=""
DATABASE_NAME="simamia"

## 4. Add scripts to package.json

"db:generate": "prisma generate",
"db:migrate": "prisma migrate dev",
"db:seed": "prisma db seed",
"db:studio": "prisma studio"

## 5. Run commands

npx prisma migrate dev --name init
npx prisma generate
npx prisma db seed
npm run dev

Open http://localhost:3000/login

## Login credentials

system_developer / Dev@12345
super_admin / Super@12345
company_admin / Admin@12345
accountant / Accountant@12345
staff / Staff@12345
broker / Broker@12345
gps_manager / Gps@12345
