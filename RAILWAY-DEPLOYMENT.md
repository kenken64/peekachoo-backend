# Peekachoo Backend - Railway Deployment Guide

## Deployment Method

This backend uses **Docker** for deployment via the included `Dockerfile`.

Railway will automatically:
- Detect the Dockerfile
- Build the Docker image
- Pass environment variables as build arguments
- Deploy the container

## Required Environment Variables

Set these in Railway dashboard for your backend service (they will be passed to Docker):

```bash
# Production mode
NODE_ENV=production

# Strong JWT secret (generate a random string)
JWT_SECRET=your-strong-random-secret-here

# Frontend URL for CORS (IMPORTANT!)
CORS_ORIGIN=https://peekachoo-frontend-production.up.railway.app

# WebAuthn Origin - Frontend URL with protocol
ORIGIN=https://peekachoo-frontend-production.up.railway.app

# WebAuthn RP ID - Frontend domain only (no https://, no port)
RP_ID=peekachoo-frontend-production.up.railway.app

# OpenAI API Key (optional - for quiz generation)
OPENAI_API_KEY=your-openai-api-key

# Database path (Railway persistent disk)
DATABASE_PATH=./data/peekachoo.db

# Port (Railway will override this)
PORT=3000
```

## Step-by-Step Deployment

### 1. Deploy Backend First

1. Go to Railway dashboard
2. Create new project from GitHub
3. Select `peekachoo-backend` repository
4. Add all environment variables above
5. Deploy

### 2. Get Your URLs

After deployment, note your Railway URLs:
- **Backend**: `https://peekachoo-backend-production.up.railway.app`
- **Frontend**: `https://peekachoo-frontend-production.up.railway.app`

### 3. Update Environment Variables

Replace the example URLs with your actual Railway URLs:

**Backend Variables:**
```bash
CORS_ORIGIN=https://YOUR-FRONTEND-URL.up.railway.app
ORIGIN=https://YOUR-FRONTEND-URL.up.railway.app
RP_ID=YOUR-FRONTEND-URL.up.railway.app
```

**Frontend Variables:**
```bash
VITE_API_URL=https://YOUR-BACKEND-URL.up.railway.app/api
```

### 4. Redeploy Both Services

After updating environment variables, redeploy both services.

## Common Issues

### CORS Error
```
Access to fetch has been blocked by CORS policy
```

**Solution:** Set `CORS_ORIGIN` to your exact frontend Railway URL

### WebAuthn Origin Mismatch
```
Unexpected registration response origin, expected "http://localhost:3001"
```

**Solution:** Set both `ORIGIN` and `RP_ID`:
- `ORIGIN`: Full URL with https://
- `RP_ID`: Domain only (no protocol)

### Database Not Persisting

**Solution:**
1. Go to Railway dashboard → Your backend service
2. Click **Settings** tab
3. Scroll to **Volumes**
4. Click **+ Add Volume**
5. Set mount path: `/app/data`
6. This ensures SQLite database persists across deployments

## Testing

1. Visit your frontend URL
2. Try to register a new user
3. Check browser console for errors
4. Check Railway backend logs for any issues

## Security Notes

⚠️ **Important:**
- Use a strong random JWT_SECRET in production
- Keep your OpenAI API key secret
- Never commit `.env` file to git
- WebAuthn requires HTTPS (Railway provides this automatically)

## Troubleshooting

Check Railway logs:
```bash
# Using Railway CLI
railway logs
```

Or view logs in Railway dashboard → Your Service → Deployments → Logs
