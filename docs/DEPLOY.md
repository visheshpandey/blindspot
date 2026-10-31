# Deploying Blindspot (free tiers)

The frontend is deployed on Vercel (https://frontend-one-xi-29.vercel.app) and runs in sample/recorded-run mode. The backend still needs to be deployed on Render to enable live analysis. Both hosts below have free plans; check their current terms before you add a card. Never put API keys in the repo: set them in each host's dashboard.

## Backend: Render (free web service)

1. Push the repo to GitHub, then on Render choose **New → Blueprint** and select the repo. [render.yaml](../render.yaml) at the repo root defines the service.
2. Set the secret environment variables in the dashboard:
   - `GEMINI_API_KEY`: your Google AI Studio key (free).
   - `ALLOWED_ORIGINS`: your frontend URL, for example `https://blindspot.vercel.app` (no trailing slash).
3. When it is live, open `https://<your-service>.onrender.com/health`. It should say `"llm_ok": true`.

Notes: free Render services sleep after about 15 minutes idle and take ~30–60 s to wake. Open `/health` a minute before a demo. Case results are kept in memory, so they are lost on restart; the frontend keeps each user's history in their own browser.

## Frontend: Vercel (free)

1. **Add New → Project**, import the repo, set the **Root Directory** to `frontend`. Vercel detects Vite.
2. Add the environment variable `VITE_API_BASE_URL` = your Render URL (no trailing slash).
3. Deploy. Routing uses `#/...` hash routes, so no rewrite rules are needed and refresh/back work.

### Deploying the frontend from the command line

```bash
cd frontend && vercel deploy --prod --yes
```

`frontend/.vercelignore` stops local `.env` files being uploaded (a local `VITE_API_BASE_URL=http://localhost:8000` once ended up inside a production bundle). Production config belongs in the Vercel dashboard: `vercel env add VITE_API_BASE_URL production`, then redeploy.

## After deploying

- Put both URLs in the README and SUBMISSION.md.
- Open the frontend, turn on **Demo mode**, and press **Catch the traps** once.
- If the backend is asleep or the AI is out of quota, Demo mode keeps the demo working from the recorded runs.
