import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';

const ChildView = ({
  selectedChild,
  teacherLookup,
  qrCodeValue,
  isUpdatingChildStatus,
  onBack,
  onSignIn,
  onSignOut,
}) => (
  <section className="panel">
    <div className="panel__heading">
      <h2>{selectedChild.name}</h2>
      <div className="panel__actions">
        <button type="button" className="ghost" onClick={onBack}>
          Back to children
        </button>
        <button type="button" className="ghost" disabled={isUpdatingChildStatus} onClick={onSignIn}>
          Sign in
        </button>
        <button type="button" className="ghost" disabled={isUpdatingChildStatus} onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
    <div className="card card--stack">
      <div>
        <div className="meta">
          <span>Class: {selectedChild.classCategory || 'Unassigned'}</span>
          <span>Guardian: {selectedChild.guardianName || 'No guardian listed'}</span>
          <span>Contact: {selectedChild.guardianContact || 'No contact listed'}</span>
          <span>Assigned: {teacherLookup[selectedChild.teacherId] || 'Unassigned'}</span>
        </div>
        <p className="muted">Last status: {selectedChild.lastStatus || 'No activity yet'}</p>
      </div>
      <div className="qr-code">
        <QRCodeCanvas value={qrCodeValue} size={180} includeMargin />
        <p className="muted">Scan to open child record.</p>
      </div>
    </div>
  </section>
);

export default ChildView;
