import React, { useEffect, useMemo, useState } from 'react';
import './MetricIngestionModal.css';

export function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function resolveSchema(floorId, formConfig) {
  const floorInfo = formConfig?.floor_id_index?.[floorId];
  if (!floorInfo) {
    throw new Error(`No floor mapping found for floorId: ${floorId}`);
  }

  const criterion = formConfig?.metrics?.[floorInfo.criterion_code];
  const metric = criterion?.children?.[floorInfo.metric_code];
  const schema = metric?.form_schema;

  if (!schema) {
    throw new Error(`No form schema found for floorId: ${floorId}`);
  }

  return {
    info: floorInfo,
    schema,
    metricTitle: metric?.title || floorInfo.metric_code,
    metricCode: floorInfo.metric_code,
  };
}

export function validate(values, schema, files) {
  const errors = {};

  (schema?.fields || []).forEach((field) => {
    if (field.type === 'date_range') {
      const fromKey = `${field.key}_from`;
      const toKey = `${field.key}_to`;
      const fromVal = values[fromKey];
      const toVal = values[toKey];

      if (field.required && (!fromVal || !toVal)) {
        errors[field.key] = `${field.label} requires both start and end dates.`;
        return;
      }

      if ((fromVal && !toVal) || (!fromVal && toVal)) {
        errors[field.key] = `${field.label} requires both start and end dates.`;
        return;
      }

      if (fromVal && toVal && new Date(fromVal) > new Date(toVal)) {
        errors[field.key] = `${field.label} start date cannot be after end date.`;
      }
      return;
    }

    const value = values[field.key];
    if (field.required && String(value ?? '').trim() === '') {
      errors[field.key] = `${field.label} is required.`;
      return;
    }

    if (field.type === 'url' && value) {
      try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          throw new Error('Invalid protocol');
        }
      } catch {
        errors[field.key] = `${field.label} must be a valid URL.`;
      }
    }
  });

  const attachmentRules = schema?.attachments;
  if (attachmentRules?.required || attachmentRules?.min_files) {
    const minFiles = Number(attachmentRules.min_files || 0);
    if ((files?.length || 0) < minFiles) {
      errors.attachments = `Please attach at least ${minFiles} file(s).`;
    }
  }

  return errors;
}

export function buildHtmlTable(values, schema, metricTitle, floorId) {
  const rows = (schema?.fields || [])
    .map((field) => {
      let displayValue = values[field.key];

      if (field.type === 'date_range') {
        const fromVal = values[`${field.key}_from`] || '-';
        const toVal = values[`${field.key}_to`] || '-';
        displayValue = `${fromVal} to ${toVal}`;
      }

      const safeLabel = escapeHtml(field.label);
      const safeValue = escapeHtml(String(displayValue ?? '-'));
      return `<tr><td>${safeLabel}</td><td>${safeValue}</td></tr>`;
    })
    .join('');

  const header = `<div><strong>${escapeHtml(metricTitle)}</strong> (${escapeHtml(
    schema?.metric_code || ''
  )}) - Floor: ${escapeHtml(floorId)}</div>`;

  return `${header}<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const FILE_ACCEPT = 'image/*,video/*,application/pdf';

export default function MetricIngestionModal({
  isOpen,
  onClose,
  floorId,
  bearerToken,
  appId,
  userId,
  formConfig,
  apiBaseUrl = 'https://appfloor.in',
  blockId,
  blockType = '0',
}) {
  const [values, setValues] = useState({});
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const resolved = useMemo(() => {
    if (!isOpen || !floorId || !formConfig) return null;
    try {
      return resolveSchema(floorId, formConfig);
    } catch (error) {
      return { error: error.message };
    }
  }, [isOpen, floorId, formConfig]);

  useEffect(() => {
    if (!isOpen) return;
    setValues({});
    setFiles([]);
    setErrors({});
    setSubmitError('');
    setIsSuccess(false);
  }, [isOpen, floorId]);

  if (!isOpen) return null;

  const schema = resolved?.schema;
  const metricTitle = resolved?.metricTitle || 'Metric Form';
  const metricCode = resolved?.metricCode || '';

  const onChangeField = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!schema || resolved?.error) return;

    const newErrors = validate(values, schema, files);
    setErrors(newErrors);
    setSubmitError('');

    if (Object.keys(newErrors).length > 0) return;

    const htmlDescription = buildHtmlTable(
      values,
      { ...schema, metric_code: metricCode },
      metricTitle,
      floorId
    );

    const inputInfo = {
      floor_id: floorId,
      ...(blockId ? { block_id: blockId } : {}),
      block_type: blockType || '0',
      title: metricTitle,
      description: htmlDescription,
    };

    const fd = new FormData();
    fd.append('input_info', JSON.stringify(inputInfo));
    fd.append('app_id', appId);
    fd.append('user_id', userId);
    files.forEach((file) => fd.append('files[]', file));

    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/memory/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
        body: fd,
      });

      if (response.status === 200) {
        setIsSuccess(true);
        return;
      }

      const fallbackMessage = `Ingestion failed (${response.status}).`;
      try {
        const payload = await response.json();
        setSubmitError(payload?.message || fallbackMessage);
      } catch {
        setSubmitError(fallbackMessage);
      }
    } catch (error) {
      setSubmitError(error?.message || 'Network error while submitting ingestion event.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="xfi-modal-overlay" role="dialog" aria-modal="true">
      <div className="xfi-modal-panel">
        <div className="xfi-modal-header">
          <h2>NAAC Evidence Ingestion</h2>
          <button type="button" className="xfi-close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {resolved?.error ? (
          <div className="xfi-error-banner">{resolved.error}</div>
        ) : isSuccess ? (
          <div className="xfi-success-state">
            <p>Submitted (Queued)</p>
            <div className="xfi-actions-row">
              <button
                type="button"
                className="xfi-primary"
                onClick={() => {
                  setValues({});
                  setFiles([]);
                  setErrors({});
                  setSubmitError('');
                  setIsSuccess(false);
                }}
              >
                Add another
              </button>
              <button type="button" className="xfi-secondary" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="xfi-form">
            <p className="xfi-meta">
              <strong>{metricTitle}</strong> ({metricCode}) — Floor ID: {floorId}
            </p>

            {(schema?.fields || []).map((field) => {
              if (field.type === 'date_range') {
                return (
                  <div key={field.key} className="xfi-field-group">
                    <label>{field.label}{field.required ? ' *' : ''}</label>
                    <div className="xfi-date-range">
                      <input
                        type="date"
                        value={values[`${field.key}_from`] || ''}
                        onChange={(e) => onChangeField(`${field.key}_from`, e.target.value)}
                      />
                      <span>to</span>
                      <input
                        type="date"
                        value={values[`${field.key}_to`] || ''}
                        onChange={(e) => onChangeField(`${field.key}_to`, e.target.value)}
                      />
                    </div>
                    {errors[field.key] && <p className="xfi-error-text">{errors[field.key]}</p>}
                  </div>
                );
              }

              const inputTypeMap = {
                text: 'text',
                number: 'number',
                year: 'number',
                date: 'date',
                url: 'url',
              };

              return (
                <div key={field.key} className="xfi-field-group">
                  <label htmlFor={field.key}>{field.label}{field.required ? ' *' : ''}</label>
                  <input
                    id={field.key}
                    type={inputTypeMap[field.type] || 'text'}
                    min={field.type === 'year' ? 1900 : undefined}
                    max={field.type === 'year' ? 2100 : undefined}
                    value={values[field.key] || ''}
                    onChange={(e) => onChangeField(field.key, e.target.value)}
                    required={false}
                  />
                  {errors[field.key] && <p className="xfi-error-text">{errors[field.key]}</p>}
                </div>
              );
            })}

            <div className="xfi-field-group">
              <label>
                Attachments
                {schema?.attachments?.required ? ' *' : ''}
              </label>
              <input
                type="file"
                multiple
                accept={FILE_ACCEPT}
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              {files.length > 0 && (
                <ul className="xfi-file-list">
                  {files.map((file) => (
                    <li key={`${file.name}-${file.size}`}>{file.name}</li>
                  ))}
                </ul>
              )}
              {errors.attachments && <p className="xfi-error-text">{errors.attachments}</p>}
            </div>

            {submitError && <p className="xfi-error-banner">{submitError}</p>}

            <div className="xfi-actions-row">
              <button type="button" className="xfi-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="xfi-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
