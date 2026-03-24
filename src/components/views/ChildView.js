import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const ChildView = ({
  selectedChild,
  teacherLookup,
  qrCodeValue,
  onBack,
}) => (
  <section className="panel">
    <div className="panel__heading">
      <h2>{selectedChild.name}</h2>
      <div className="panel__actions">
        <button type="button" className="ghost" onClick={onBack}>
          Back to children
        </button>
      </div>
    </div>
    <div className="card card--stack detail-card">
      <div className="detail-card__header">
        <div>
          <h3>Child details</h3>
          <p className="muted">Review guardian and class information.</p>
        </div>
        <span className={`badge ${selectedChild.signedIn ? 'badge--signedin' : 'badge--pending'}`}>
          {selectedChild.signedIn ? 'Signed in' : 'Signed out'}
        </span>
      </div>
      <div className="detail-grid">
        <div className="detail-item">
          <span className="detail-label">Class</span>
          <span>{selectedChild.classCategory || 'Unassigned'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Guardian</span>
          <span>{selectedChild.guardianName || 'No guardian listed'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Contact</span>
          <span>{selectedChild.guardianContact || 'No contact listed'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Assigned</span>
          <span>{teacherLookup[selectedChild.teacherId] || 'Unassigned'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Last status</span>
          <span>{selectedChild.lastStatus || 'No activity yet'}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Last check-in</span>
          <span>
            {selectedChild.lastActionAt
              ? new Date(selectedChild.lastActionAt).toLocaleString()
              : 'Not recorded'}
          </span>
        </div>
      </div>
      <div className="qr-code">
        <QRCodeCanvas value={qrCodeValue} size={180} includeMargin />
        <p className="muted">Scan to open child record.</p>
      </div>
    </div>
  </section>
);

export default ChildView;
