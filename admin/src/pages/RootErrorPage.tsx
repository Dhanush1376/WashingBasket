import { useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { Icon } from '@/components/ui/Icon';

export function RootErrorPage() {
  const error = useRouteError();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  let title = 'Unexpected Application Error';
  let message =
    'We encountered an unexpected issue while loading this page. Your data and active sessions remain completely safe.';
  let technical = '';
  let statusBadge = 'Application Fault';

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Page Not Found';
      message = "The requested page URL could not be found or may have been moved.";
      statusBadge = '404 Not Found';
    } else {
      title = `Error ${error.status}: ${error.statusText || 'Request Failed'}`;
      message = error.data?.message || 'The application service encountered an issue processing your request.';
      statusBadge = `HTTP ${error.status}`;
    }
    technical = JSON.stringify(error, null, 2);
  } else if (error instanceof Error) {
    technical = `${error.name}: ${error.message}\n\nStack Trace:\n${error.stack || 'No stack trace available'}`;
    statusBadge = error.name || 'Runtime Error';
  } else if (typeof error === 'string') {
    technical = error;
  } else {
    technical = JSON.stringify(error, null, 2);
  }

  const handleCopyDetails = () => {
    const payload = `=== WashingBasket Admin Error Report ===\nTime: ${new Date().toISOString()}\nURL: ${window.location.href}\nStatus: ${statusBadge}\nDetails:\n${technical}`;
    navigator.clipboard?.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="root-error-screen">
      <div className="root-error-container">
        {/* Header Branding */}
        <div className="root-error-brand">
          <img src="/logo.png" alt="WashingBasket" width={40} height={40} className="root-error-logo" />
          <div className="root-error-brand-text">
            <span className="root-error-wordmark">
              <span style={{ color: '#FFA742' }}>W</span>ashing<span style={{ color: '#FFA742' }}>B</span>asket
            </span>
            <span className="root-error-portal-badge">Admin Portal</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="root-error-card">
          <div className="root-error-hero">
            <div className="root-error-icon-disc">
              <Icon name="alert" size={32} color="#DC2626" strokeWidth={2.2} />
            </div>
            <div className="root-error-status-pill">{statusBadge}</div>
          </div>

          <h1 className="root-error-title">{title}</h1>
          <p className="root-error-desc">{message}</p>

          {/* Action Buttons */}
          <div className="root-error-actions">
            <button type="button" className="root-error-btn root-error-btn--primary" onClick={handleReload}>
              <Icon name="refresh" size={16} />
              <span>Reload page</span>
            </button>
            <button type="button" className="root-error-btn root-error-btn--secondary" onClick={handleGoHome}>
              <Icon name="home" size={16} />
              <span>Return to Dashboard</span>
            </button>
          </div>

          {/* Developer / Technical Diagnostics Dropdown */}
          <div className="root-error-diagnostics">
            <button
              type="button"
              className="root-error-diagnostics-toggle"
              onClick={() => setShowDetails(!showDetails)}
              aria-expanded={showDetails}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="sliders" size={14} />
                <span>Technical details & diagnostics</span>
              </div>
              <Icon name={showDetails ? 'chevronDown' : 'chevronRight'} size={14} />
            </button>

            {showDetails ? (
              <div className="root-error-diagnostics-body">
                <div className="root-error-diagnostics-top">
                  <span className="root-error-diagnostics-url" title={window.location.href}>
                    {window.location.pathname}
                  </span>
                  <button type="button" className="root-error-copy-btn" onClick={handleCopyDetails}>
                    <Icon name={copied ? 'check' : 'copy'} size={13} />
                    <span>{copied ? 'Copied' : 'Copy diagnostic report'}</span>
                  </button>
                </div>
                <pre className="root-error-pre">
                  <code>{technical}</code>
                </pre>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer Support Note */}
        <div className="root-error-footer">
          <span>Need engineering assistance? Contact support or copy the diagnostic report above.</span>
        </div>
      </div>
    </div>
  );
}
export default RootErrorPage;

