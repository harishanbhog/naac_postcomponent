# xFloor NAAC Metric Ingestion Add-on (React 18)

Micro-frontend modal component for xFloor metric-floor "New Post" ingestion.

## Files

- `src/components/MetricIngestionModal.jsx` – modal + helper functions.
- `src/components/MetricIngestionModal.css` – plain CSS styling (no Tailwind).
- `src/xFloorNaacFormConfig.json` – sample config using `forms_by_floor_id` format.
- `src/example/ExampleUsage.jsx` – embedding example.

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
