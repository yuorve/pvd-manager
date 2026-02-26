#!/bin/bash

# Colors for the terminal
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Starting security audit...${NC}\n"

# --- 1. FRONTEND VALIDATION (Vite/React) ---
echo -e "--- Checking vulnerabilities in FRONTEND (NPM) ---"
cd frontend
if [ -f package-lock.json ]; then
    npm audit --audit-level=high
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend free of critical vulnerabilities.${NC}\n"
    else
        echo -e "${RED}❌ Vulnerabilities found in Frontend.${NC}\n"
    fi
else
    echo -e "⚠️ package-lock.json not found, skipping NPM audit.\n"
fi
cd ..

# --- 2. BACKEND VALIDATION (PHP/Composer) ---
echo -e "--- Checking vulnerabilities in BACKEND (Composer) ---"
cd backend
if [ -f composer.lock ]; then
    # Download official Symfony checker (single binary)
    if [ ! -f local-php-security-checker ]; then
        echo "Downloading security checker..."
        curl -L https://github.com/fabpot/local-php-security-checker/releases/latest/download/local-php-security-checker_linux_amd64 -o local-php-security-checker
        chmod +x local-php-security-checker
    fi

    ./local-php-security-checker
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backend free of known vulnerabilities.${NC}\n"
    else
        echo -e "${RED}❌ Vulnerabilities found in Backend.${NC}\n"
    fi
else
    echo -e "⚠️ composer.lock not found, skipping Composer audit.\n"
fi
cd ..

echo -e "${GREEN}Audit finished.${NC}"
