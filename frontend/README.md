# Face-X Detection — Frontend

React 18 + TypeScript + Vite 5 + Tailwind CSS 3. Four routes: `/`, `/detect`, `/results`, `/about`.

## Run

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 — /api is proxied to http://127.0.0.1:8000
npm run typecheck  # tsc -b
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ (also proxies /api)
```

Start the FastAPI server on port 8000 first. Without it, the site still works,
but it shows the backend as offline and disables analysis.

For a production build served from a different origin than the API, set
`VITE_API_BASE_URL` (see `.env.example`). The backend must then allow that origin via CORS.

## Backend contract (`src/services/api.ts`)

| Endpoint | Method | Used for |
| --- | --- | --- |
| `/api/health` | GET | `{ status, device?, gpu_name? }` — header status pill, Detect page |
| `/api/models` | GET | `{ models: [{ id, name, status, input_size?, is_default?, note? }] }` — only `status: "ready"` models are selectable |
| `/api/analyze` | POST multipart | fields `file` (image) and `model_id` |

`/api/analyze` response:

```json
{
  "success": true,
  "filename": "face.jpg",
  "model_used": "swinv2_tiny_window16_256",
  "prediction": "Fake",
  "confidence": 98.42,
  "probabilities": { "Fake": 98.42, "Real": 1.58 },
  "inference_time_ms": 42.6,
  "device": "cuda"
}
```

Optional fields are rendered only when present: `face_detected` (bool), `heatmap`
(PNG data URL or raw base64), `warnings` (string[]). Probabilities may be 0–100 or
0–1 fractions; fractions are rescaled. Errors should use FastAPI's `{"detail": "..."}`
or `{"success": false, "message": "..."}`. These messages are shown to the user verbatim.

Every response is validated at runtime. The UI never invents a prediction,
score, heatmap or model status.

## Structure

```
src/
  components/   Layout (header/footer), Dropzone, ModelSelector, StatusPill,
                WindowAttentionVisual (decorative hero), ui.tsx (Button, Badge, Alert, …)
  context/      BackendContext (health + models), AnalysisContext (staged image + last result, in memory)
  data/         project.ts — static About-page content transcribed from PROJECT_MASTER_CONTEXT.md
  lib/          imageValidation.ts (type, magic bytes, 10 MB, decode), hooks.ts
  pages/        Home, Detect, Results, About, NotFound
  services/     api.ts (typed client + parsers), apiTypes.ts
```
