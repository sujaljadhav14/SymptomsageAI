# GCP Deployment Guide (Cloud Run)

This guide explains how to deploy SymptomSage AI to Google Cloud Platform using **Google Cloud Run**.

## Prerequisites
1.  **GCP Account**: A Google Cloud Project with billing enabled.
2.  **gcloud CLI**: Installed and authenticated (`gcloud auth login`).
3.  **Docker**: Installed locally.

---

## 1. Setup Artifact Registry
Create a repository for your Docker images:
```bash
gcloud artifacts repositories create symptomsage-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Docker repository for SymptomSage AI"
```

---

## 2. Deploy Backend (Email Server)
The backend needs access to SMTP secrets.

### A. Build and Push
```bash
export PROJECT_ID=$(gcloud config get-value project)

docker build -t us-central1-docker.pkg.dev/$PROJECT_ID/symptomsage-repo/backend:latest -f Dockerfile.backend .
docker push us-central1-docker.pkg.dev/$PROJECT_ID/symptomsage-repo/backend:latest
```

### B. Deploy to Cloud Run
```bash
gcloud run deploy symptomsage-backend \
    --image us-central1-docker.pkg.dev/$PROJECT_ID/symptomsage-repo/backend:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars="SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,SMTP_USER=your-email@gmail.com,SMTP_PASS=your-app-password"
```
*Note: Make sure to replace the SMTP variables or use Secret Manager.*

---

## 3. Deploy Frontend
The frontend requires the **Backend URL** and other VITE keys during build.

### A. Build and Push
```bash
# Get the backend URL from the previous step
export BACKEND_URL=$(gcloud run services describe symptomsage-backend --format='value(status.url)' --region us-central1)

docker build -t us-central1-docker.pkg.dev/$PROJECT_ID/symptomsage-repo/frontend:latest \
    -f Dockerfile.frontend \
    --build-arg VITE_GEMINI_API_KEY=your_key \
    --build-arg VITE_CLERK_PUBLISHABLE_KEY=your_key \
    --build-arg VITE_SUPABASE_URL=your_url \
    --build-arg VITE_SUPABASE_ANON_KEY=your_key \
    --build-arg VITE_GOOGLE_MAPS_API_KEY=your_key \
    --build-arg VITE_SIMLI_API_KEY=your_key \
    .

docker push us-central1-docker.pkg.dev/$PROJECT_ID/symptomsage-repo/frontend:latest
```

### B. Deploy to Cloud Run
```bash
gcloud run deploy symptomsage-frontend \
    --image us-central1-docker.pkg.dev/$PROJECT_ID/symptomsage-repo/frontend:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated
```

---

## 4. Final Verification
1.  Open the URL provided by the Frontend Cloud Run service.
2.  Test the Voice Consultation and Email feature.
3.  Monitor logs in the GCP Console under **Cloud Run > [Service Name] > Logs**.
