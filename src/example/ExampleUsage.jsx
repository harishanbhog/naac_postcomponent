import React, { useMemo, useState } from 'react';
import MetricIngestionModal from '../components/MetricIngestionModal';
import xFloorNaacFormConfig from '../xFloorNaacFormConfig.json';

export default function ExampleUsage() {
  const [isOpen, setIsOpen] = useState(false);
  const [floorId, setFloorId] = useState('c1_113');

  const selectedForm = useMemo(
    () => xFloorNaacFormConfig?.forms_by_floor_id?.[floorId] || null,
    [floorId]
  );

  return (
    <div style={{ maxWidth: '880px', margin: '32px auto', fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
      <h1 style={{ marginBottom: '10px' }}>xFloor Metric Feed</h1>
      <p style={{ marginTop: 0, color: '#475569' }}>
        Enter a floor ID, verify the resolved form, then click New Post.
      </p>

      <label htmlFor="floor-id-input" style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>
        Floor ID
      </label>
      <input
        id="floor-id-input"
        type="text"
        value={floorId}
        onChange={(e) => setFloorId(e.target.value.trim())}
        placeholder="e.g. c1_113"
        style={{
          width: '100%',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '10px 12px',
          marginBottom: '12px',
        }}
      />

      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '14px',
        }}
      >
        {selectedForm ? (
          <>
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
              Resolved: {selectedForm.title} ({selectedForm.metric_code})
            </p>
            <pre
              style={{
                margin: 0,
                maxHeight: '220px',
                overflow: 'auto',
                background: '#0f172a',
                color: '#f8fafc',
                padding: '10px',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            >
              {JSON.stringify(selectedForm, null, 2)}
            </pre>
          </>
        ) : (
          <p style={{ margin: 0, color: '#991b1b' }}>No form found for floorId: {floorId || '(empty)'}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={!floorId}
        style={{
          border: '1px solid #1d4ed8',
          borderRadius: '10px',
          background: '#2563eb',
          color: '#fff',
          padding: '10px 14px',
          cursor: 'pointer',
        }}
      >
        New Post ({floorId || 'Enter floor ID'})
      </button>

      <MetricIngestionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        floorId={floorId}
        bearerToken="<XFLOOR_BEARER_TOKEN>"
        appId="<APP_ID>"
        userId="<USER_ID>"
        formConfig={xFloorNaacFormConfig}
        apiBaseUrl="https://appfloor.in"
        blockId="default_feeds_block"
        blockType="0"
      />
    </div>
  );
}
