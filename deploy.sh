#!/bin/bash

# 1. Load production environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | xargs)
else
    echo "Error: .env.production file not found."
    exit 1
fi

echo "🚀 Starting production deployment..."

# 2. Build Frontend (Outside Docker for optimization)
# This generates the /dist folder served by Nginx
echo "📦 Building Frontend..."
cd frontend
npm install
npm run build
cd ..

# 3. Clean containers and orphan images
echo "🧹 Cleaning environment..."
docker-compose -f docker-compose.prod.yml down --remove-orphans

# 4. Build and start services in detached mode
echo "🏗️ Starting containers..."
docker-compose -f docker-compose.prod.yml up --build -d

# 5. Health check
echo "Wait: Verifying service status..."
sleep 5
docker ps

echo "✅ Deployment completed successfully!"
echo "Access your app on port 80"
