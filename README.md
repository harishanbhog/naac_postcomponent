# xFloor NAAC Metric Ingestion Add-on (React 18)

This repository contains a micro-frontend style modal component that can be opened from an xFloor metric floor "New Post" action.

## Files

- `src/components/MetricIngestionModal.jsx` – main modal component and helper functions.
- `src/components/MetricIngestionModal.css` – plain CSS styling (no Tailwind).
- `src/xFloorNaacFormConfig.json` – sample local dynamic form config.
- `src/example/ExampleUsage.jsx` – embedding example snippet.

## Integration flow

1. Host app opens `<MetricIngestionModal />` with the selected `floorId`.
2. Modal resolves schema from `xFloorNaacFormConfig`.
3. User fills dynamic fields and attaches media files.
4. Component converts values into an escaped HTML table for `description`.
5. Component sends `multipart/form-data` to `POST /api/memory/events` with:
   - `input_info` JSON string
   - `app_id`
   - `user_id`
   - `files[]`

A `200` response is treated as accepted/queued.
