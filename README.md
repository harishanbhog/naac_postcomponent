# xFloor NAAC Metric Ingestion Add-on (React 18)

Micro-frontend modal component for xFloor metric-floor "New Post" ingestion.

## Files

- `src/components/MetricIngestionModal.jsx` – modal + helper functions.
- `src/components/MetricIngestionModal.css` – plain CSS styling (no Tailwind).
- `src/xFloorNaacFormConfig.json` – sample config using `forms_by_floor_id` format.
- `src/example/ExampleUsage.jsx` – embedding example with floorId input + resolved form preview.

## Expected form config shape

```json
{
  "forms_by_floor_id": {
    "c1_113": {
      "floor_id": "c1_113",
      "metric_code": "1.1.3",
      "title": "Teacher Participation",
      "fields": [{ "key": "year", "type": "year", "required": true }],
      "attachments": {
        "required": true,
        "min_files": 1,
        "allowed_types": ["image", "video", "pdf"]
      }
    }
  }
}
```

## API behavior

On submit, component sends multipart `POST /api/memory/events` with:

- `input_info` (JSON string)
- `app_id`
- `user_id`
- `files[]`

HTTP `200` is handled as accepted/queued.

## Build and run on local Windows PC

This repository is a component-only package (no `package.json`). To run locally, create a React host app and copy these files in.

```powershell
npm create vite@latest naac-post-runner -- --template react
cd .\naac-post-runner
npm install
mkdir .\src\components
mkdir .\src\example
```

Copy files from this repo to the Vite app:

- `src/components/MetricIngestionModal.jsx`
- `src/components/MetricIngestionModal.css`
- `src/example/ExampleUsage.jsx`
- `src/xFloorNaacFormConfig.json`

Then replace `src/App.jsx` with:

```jsx
import ExampleUsage from './example/ExampleUsage';

export default function App() {
  return <ExampleUsage />;
}
```

Run locally:

```powershell
npm run dev
```

Build production bundle:

```powershell
npm run build
npm run preview
```
