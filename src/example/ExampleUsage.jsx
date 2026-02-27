import React, { useState } from 'react';
import MetricIngestionModal from '../components/MetricIngestionModal';
import xFloorNaacFormConfig from '../xFloorNaacFormConfig.json';

export default function ExampleUsage() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <h1>xFloor Metric Feed</h1>
      <button type="button" onClick={() => setIsOpen(true)}>
        New Post (floor c3_313)
      </button>

      <MetricIngestionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        floorId="c3_313"
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
