#!/bin/bash

# SymptomSage AI - GCP Deployment Script
# This script builds and deploys both Frontend and Backend to Cloud Run.

# --- 1. CONFIGURATION ---
export PROJECT_ID=$(gcloud config get-value project)
echo "🚀 Starting deployment for GCP Project: $PROJECT_ID"

# Frontend Build Arguments (taken from your .env.local)
VITE_GEMINI_API_KEY=""
VITE_CLERK_PUBLISHABLE_KEY=""
VITE_SUPABASE_URL="https://.supabase.co"
VITE_SUPABASE_ANON_KEY=""
VITE_GOOGLE_MAPS_API_KEY=""
VITE_SIMLI_API_KEY=""

# Backend Runtime Secrets
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="@gmail.com"
SMTP_PASS=""

# --- 2. BUILD IMAGES ---
echo "📦 Building images via Cloud Build..."
gcloud builds submit --config cloudbuild.yaml \
    --substitutions=_VITE_GEMINI_API_KEY="$VITE_GEMINI_API_KEY",_VITE_CLERK_PUBLISHABLE_KEY="$VITE_CLERK_PUBLISHABLE_KEY",_VITE_SUPABASE_URL="$VITE_SUPABASE_URL",_VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY",_VITE_GOOGLE_MAPS_API_KEY="$VITE_GOOGLE_MAPS_API_KEY",_VITE_SIMLI_API_KEY="$VITE_SIMLI_API_KEY"

# --- 3. DEPLOY BACKEND ---
echo "🌐 Deploying Backend Service..."
gcloud run deploy symptomsage-backend \
    --image us-central1-docker.pkg.dev/$PROJECT_ID/symptomsage-repo/backend:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars="SMTP_HOST=$SMTP_HOST,SMTP_PORT=$SMTP_PORT,SMTP_USER=$SMTP_USER,SMTP_PASS=$SMTP_PASS"

# --- 4. DEPLOY FRONTEND ---
echo "🎨 Deploying Frontend Service..."
gcloud run deploy symptomsage-frontend \
    --image us-central1-docker.pkg.dev/$PROJECT_ID/symptomsage-repo/frontend:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated

echo "✅ Deployment Complete!"
gcloud run services list
