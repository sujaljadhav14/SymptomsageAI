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

## 2. Deploy using Cloud Build
Since we have two services (Frontend & Backend), we use `cloudbuild.yaml` to build both in one go.

### A. Run the Build
Run this command from the root directory:
```bash
gcloud builds submit --config cloudbuild.yaml \
    --substitutions=_VITE_CLERK_PUBLISHABLE_KEY="your_key",_VITE_SUPABASE_URL="your_url",_VITE_SUPABASE_ANON_KEY="your_key",_VITE_GOOGLE_MAPS_API_KEY="your_key",_VITE_SIMLI_API_KEY="your_key"
```

---

## 3. Deploy to Cloud Run
After the build completes, deploy the images to Cloud Run.

### A. Deploy Backend
```bash
export PROJECT_ID=$(gcloud config get-value project)

gcloud run deploy symptomsage-backend \
    --image us-central1-docker.pkg.dev/$PROJECT_ID/symptomsage-repo/backend:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars="GEMINI_API_KEY=your_gemini_key,SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,SMTP_USER=your-email@gmail.com,SMTP_PASS=your-app-password"
```

### B. Deploy Frontend
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
