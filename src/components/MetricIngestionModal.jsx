import React, { useEffect, useMemo, useRef, useState } from 'react';
import './MetricIngestionModal.css';

const FALLBACK_ACCEPT = 'image/*,video/*,application/pdf';

export function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toAcceptValue(allowedTypes) {
  if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) return FALLBACK_ACCEPT;

  const normalized = allowedTypes
    .map((entry) => String(entry || '').trim().toLowerCase())
    .map((entry) => {
      if (entry === 'image') return 'image/*';
      if (entry === 'video') return 'video/*';
      if (entry === 'pdf') return 'application/pdf';
      return entry;
    })
    .filter(Boolean);

  return normalized.length ? normalized.join(',') : FALLBACK_ACCEPT;
}

function matchesAllowedType(file, allowedTypes) {
  if (!Array.isArray(allowedTypes) || allowedTypes.length === 0) return true;
  const mime = String(file?.type || '').toLowerCase();

  return allowedTypes.some((raw) => {
    const type = String(raw || '').trim().toLowerCase();
    if (type === 'image') return mime.startsWith('image/');
    if (type === 'video') return mime.startsWith('video/');
    if (type === 'pdf') return mime === 'application/pdf';
    if (type.endsWith('/*')) return mime.startsWith(type.replace('*', ''));
    return mime === type;
  });
}

function mergeFiles(existingFiles, incomingFiles) {
  const byKey = new Map(existingFiles.map((file) => [`${file.name}-${file.size}-${file.lastModified}`, file]));
  incomingFiles.forEach((file) => byKey.set(`${file.name}-${file.size}-${file.lastModified}`, file));
  return Array.from(byKey.values());
}

function shouldUseTextarea(field) {
  if (field.type !== 'text') return false;
  const token = `${field.key} ${field.label}`.toLowerCase();
  const longKeywords = ['description', 'remarks', 'summary', 'details', 'address'];
  return field.label.length > 56 || longKeywords.some((keyword) => token.includes(keyword));
}

function AttachmentDropzone({ schemaAttachments, files, onFilesChange, error }) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const accept = toAcceptValue(schemaAttachments?.allowed_types);

  const addFiles = (incoming) => {
    const next = mergeFiles(files, Array.from(incoming || []));
    onFilesChange(next);
  };

  return (
    <section className="xfi-section xfi-section-soft">
      <div className="xfi-section-title-row">
        <h3 className="xfi-section-title">
          {schemaAttachments?.label || 'Attachments'}
          {schemaAttachments?.required ? ' *' : ''}
        </h3>
      </div>

      <div
        className={`xfi-dropzone ${isDragging ? 'is-dragging' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
        }}
      >
        <p>Drop files here or <span>click to browse</span></p>
        <small>Allowed: {accept}</small>
      </div>

      <input
        ref={inputRef}
        className="xfi-hidden-file-input"
        type="file"
        multiple
        accept={accept}
        onChange={(event) => addFiles(event.target.files)}
      />

      {files.length > 0 && (
        <ul className="xfi-file-chips">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`} className="xfi-chip">
              <span className="xfi-chip-name" title={file.name}>{file.name}</span>
              <button
                type="button"
                className="xfi-chip-remove"
                onClick={(event) => {
                  event.stopPropagation();
                  onFilesChange(files.filter((item) => item !== file));
                }}
                aria-label={`Remove ${file.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {schemaAttachments?.notes && <p className="xfi-help-text">{schemaAttachments.notes}</p>}
      {error && <p className="xfi-error-text">{error}</p>}
    </section>
  );
}

export function resolveSchema(floorId, formConfig) {
  const form = formConfig?.forms_by_floor_id?.[floorId];
  if (!form) throw new Error(`No form found for floorId: ${floorId}`);

  return {
    schema: {
      fields: form.fields || [],
      attachments: form.attachments || {},
    },
    metricTitle: form.title || form.metric_code || 'Metric Form',
    metricCode: form.metric_code || '',
    fullTitle: form.full_title || '',
  };
}

export function validate(values, schema, files) {
  const errors = {};

  (schema?.fields || []).forEach((field) => {
    if (field.type === 'date_range') {
      const fromVal = values[`${field.key}_from`];
      const toVal = values[`${field.key}_to`];

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
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
      } catch {
        errors[field.key] = `${field.label} must be a valid URL.`;
      }
    }
  });

  const attachmentRules = schema?.attachments || {};
  const minFiles = Number(attachmentRules.min_files || (attachmentRules.required ? 1 : 0));
  if ((files?.length || 0) < minFiles) errors.attachments = `Please attach at least ${minFiles} file(s).`;

  const invalid = (files || []).filter((file) => !matchesAllowedType(file, attachmentRules.allowed_types));
  if (invalid.length > 0) errors.attachments = 'Some attachments have unsupported file types.';

  return errors;
}

export function buildHtmlTable(values, schema, metricTitle, floorId, metricCode = '') {
  const rows = (schema?.fields || [])
    .map((field) => {
      let displayValue = values[field.key];
      if (field.type === 'date_range') {
        const fromVal = values[`${field.key}_from`] || '-';
        const toVal = values[`${field.key}_to`] || '-';
        displayValue = `${fromVal} to ${toVal}`;
      }
      return `<tr><td>${escapeHtml(field.label)}</td><td>${escapeHtml(String(displayValue ?? '-'))}</td></tr>`;
    })
    .join('');

  const header = `<div><strong>${escapeHtml(metricTitle)}</strong> (${escapeHtml(metricCode)}) - Floor: ${escapeHtml(floorId)}</div>`;
  return `${header}<table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}

const normalizeFloorIdForSchema = (id) => {
  if (!id) return id;
  const parts = id.split("_").filter(Boolean);
  // If already short (e.g., "c3_313" / "c5_513"), keep as-is
  if (parts.length <= 2) return id;
  // Trim prefix like "tpc" and keep last 2 tokens
  return parts.slice(-2).join("_");
};

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
    const schemaFloorId = normalizeFloorIdForSchema(floorId);
    try {
      return resolveSchema(schemaFloorId, formConfig);
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

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const schema = resolved?.schema;
  const metricTitle = resolved?.metricTitle || 'Metric Form';
  const metricCode = resolved?.metricCode || '';

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!schema || resolved?.error) return;

    const newErrors = validate(values, schema, files);
    setErrors(newErrors);
    setSubmitError('');
    if (Object.keys(newErrors).length > 0) return;

    const inputInfo = {
      floor_id: floorId,
      ...(blockId ? { block_id: blockId } : {}),
      block_type: blockType || '0',
      title: metricTitle,
      description: buildHtmlTable(values, schema, metricTitle, floorId, metricCode),
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
        headers: { Authorization: `Bearer ${bearerToken}` },
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
    <div className="xfi-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="xfi-modal-panel" onClick={(event) => event.stopPropagation()}>
        <header className="xfi-modal-header">
          <div className="xfi-header-title-row">
            <h2>{metricTitle} <span>({metricCode})</span></h2>
            <span className="xfi-floor-pill">Floor ID: {floorId}</span>
          </div>
          <button type="button" className="xfi-close-btn" onClick={onClose}>×</button>
        </header>

        {resolved?.error ? (
          <div className="xfi-error-banner">{resolved.error}</div>
        ) : isSuccess ? (
          <div className="xfi-success-state">
            <p>Submitted (Queued)</p>
            <span>Your evidence has been accepted for async ingestion.</span>
            <div className="xfi-actions-row">
              <button type="button" className="xfi-primary" onClick={() => setIsSuccess(false)}>Add another</button>
              <button type="button" className="xfi-secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="xfi-form">
            {resolved?.fullTitle && <p className="xfi-description">{resolved.fullTitle}</p>}

            <section className="xfi-section">
              <h3 className="xfi-section-title">Evidence details</h3>
              <div className="xfi-grid">
                {(schema?.fields || []).map((field) => {
                  const fieldClass = 'xfi-col-full';

                  if (field.type === 'date_range') {
                    return (
                      <div key={field.key} className={`xfi-field ${fieldClass}`}>
                        <label className="xfi-label">{field.label}{field.required ? ' *' : ''}</label>
                        <div className="xfi-date-range-modern">
                          <div>
                            <small>From</small>
                            <input
                              className="xfi-input"
                              type="date"
                              value={values[`${field.key}_from`] || ''}
                              onChange={(e) => setValues((prev) => ({ ...prev, [`${field.key}_from`]: e.target.value }))}
                            />
                          </div>
                          <div>
                            <small>To</small>
                            <input
                              className="xfi-input"
                              type="date"
                              value={values[`${field.key}_to`] || ''}
                              onChange={(e) => setValues((prev) => ({ ...prev, [`${field.key}_to`]: e.target.value }))}
                            />
                          </div>
                        </div>
                        {errors[field.key] && <p className="xfi-error-text">{errors[field.key]}</p>}
                      </div>
                    );
                  }

                  const inputType =
                    field.type === 'number' || field.type === 'year'
                      ? 'number'
                      : field.type === 'date'
                      ? 'date'
                      : field.type === 'url'
                      ? 'url'
                      : 'text';

                  return (
                    <div key={field.key} className={`xfi-field ${fieldClass}`}>
                      <label className="xfi-label" htmlFor={field.key}>{field.label}{field.required ? ' *' : ''}</label>
                      {shouldUseTextarea(field) ? (
                        <textarea
                          id={field.key}
                          className="xfi-input xfi-textarea"
                          rows={3}
                          value={values[field.key] || ''}
                          onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        />
                      ) : (
                        <input
                          id={field.key}
                          className="xfi-input"
                          type={inputType}
                          min={field.type === 'year' ? 1900 : undefined}
                          max={field.type === 'year' ? 2100 : undefined}
                          value={values[field.key] || ''}
                          onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                        />
                      )}
                      {errors[field.key] && <p className="xfi-error-text">{errors[field.key]}</p>}
                    </div>
                  );
                })}
              </div>
            </section>

            <AttachmentDropzone
              schemaAttachments={schema?.attachments}
              files={files}
              onFilesChange={setFiles}
              error={errors.attachments}
            />

            {submitError && <p className="xfi-error-banner">{submitError}</p>}

            <div className="xfi-actions-row">
              <button type="button" className="xfi-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
              <button type="submit" className="xfi-primary" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
