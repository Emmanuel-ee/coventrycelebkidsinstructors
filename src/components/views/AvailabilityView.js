import React from 'react';

const AvailabilityView = ({
  isLeadInstructor,
  availabilityRuleDate,
  availabilityRuleOccasion,
  onRuleDateChange,
  onRuleOccasionChange,
  onAddAllowedDate,
  isSavingAvailabilityRules,
  sortedAllowedAvailabilityDates,
  formatAvailabilityRuleLabel,
  onRemoveAllowedDate,
  availabilityForm,
  onAvailabilityFormChange,
  availabilityEditId,
  onSubmitAvailability,
  isSubmittingAvailability,
  onResetAvailabilityForm,
  selectableAvailabilityOptions,
  myAvailability,
  formatAvailabilityStatus,
  onEditAvailability,
  getEditLabel,
  onResetApproval,
  onDeleteAvailability,
  getDeleteLabel,
  deleteRequest,
  updateRequest,
  renderDeleteRequestForm,
  renderUpdateRequestForm,
  pendingAvailability,
  approvalReasons,
  onApprovalReasonChange,
  onApproveAvailability,
  onDeclineAvailability,
  approvedAvailability,
  approvedAvailabilityCalendar,
  onBack,
}) => (
  <section className="panel">
    <div className="panel__heading">
      <div>
        <h2>Availability</h2>
        <p className="panel__intro">Submit your availability and view the approved schedule.</p>
      </div>
      <button type="button" className="ghost" onClick={onBack}>
        ← Back
      </button>
    </div>
    <div className="availability-rules">
      <div>
        <h3>Availability rules</h3>
        <p className="muted">
          Availability is required every Sunday for all instructors. Other days must be enabled by
          the lead instructor.
        </p>
      </div>
      {isLeadInstructor && (
        <div className="availability-rules__controls">
          <label>
            Allow extra date
            <input type="date" value={availabilityRuleDate} onChange={onRuleDateChange} />
          </label>
          <label>
            Occasion
            <input
              type="text"
              value={availabilityRuleOccasion}
              onChange={onRuleOccasionChange}
              placeholder="e.g. Special service"
            />
          </label>
          <button
            type="button"
            className="ghost"
            onClick={onAddAllowedDate}
            disabled={isSavingAvailabilityRules}
          >
            {isSavingAvailabilityRules ? 'Saving…' : 'Add date'}
          </button>
        </div>
      )}
      {sortedAllowedAvailabilityDates.length === 0 ? (
        <p className="empty">No extra dates enabled yet.</p>
      ) : (
        <div className="availability-rules__list">
          {sortedAllowedAvailabilityDates.map((dateValue) => (
            <div key={dateValue} className="availability-rules__chip">
              <span>{formatAvailabilityRuleLabel(dateValue)}</span>
              {isLeadInstructor && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onRemoveAllowedDate(dateValue)}
                  disabled={isSavingAvailabilityRules}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    <form className="form availability-form" onSubmit={onSubmitAvailability}>
      <div className="form__grid">
        <label>
          Date
          <select
            name="date"
            value={availabilityForm.date}
            onChange={onAvailabilityFormChange}
            disabled={Boolean(availabilityEditId)}
            required
          >
            <option value="">Select a day</option>
            {selectableAvailabilityOptions.map((option) => (
              <option key={option.date} value={option.date}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Start time
          <input
            type="time"
            name="startTime"
            value={availabilityForm.startTime}
            onChange={onAvailabilityFormChange}
            required
          />
        </label>
        <label>
          End time
          <input
            type="time"
            name="endTime"
            value={availabilityForm.endTime}
            onChange={onAvailabilityFormChange}
            required
          />
        </label>
        <label className="form__full">
          Notes (optional)
          <textarea
            name="notes"
            value={availabilityForm.notes}
            onChange={onAvailabilityFormChange}
            placeholder="Add any extra details"
          />
        </label>
        {availabilityEditId && (
          <label className="form__full">
            Update reason
            <textarea
              name="changeReason"
              value={availabilityForm.changeReason}
              onChange={onAvailabilityFormChange}
              placeholder="Why are you updating this availability?"
              required
            />
          </label>
        )}
      </div>
      <div className="panel__actions">
        <button type="submit" className="primary" disabled={isSubmittingAvailability}>
          {isSubmittingAvailability
            ? 'Submitting…'
            : availabilityEditId
              ? 'Update availability'
              : 'Submit availability'}
        </button>
        {availabilityEditId && (
          <button type="button" className="ghost" onClick={onResetAvailabilityForm}>
            Cancel edit
          </button>
        )}
      </div>
    </form>

    <div className="availability-section">
      <h3>My submissions</h3>
      {myAvailability.length === 0 ? (
        <p className="empty">No availability submitted yet.</p>
      ) : (
        <div className="list">
          {myAvailability.map((entry) => (
            <div key={entry.id} className="card availability-card">
              <div>
                <div className="availability-card__title">
                  <strong>{entry.date}</strong>
                  <span className={`availability-status availability-status--${entry.status}`}>
                    {formatAvailabilityStatus(entry.status)}
                  </span>
                </div>
                <p className="muted">
                  {entry.startTime} - {entry.endTime}
                </p>
                {entry.approvalReason && (
                  <p className="muted">Disapproval reason: {entry.approvalReason}</p>
                )}
                {entry.changeReason && (
                  <p className="muted">Update reason: {entry.changeReason}</p>
                )}
                {entry.notes && <p className="muted">{entry.notes}</p>}
              </div>
              <div className="panel__actions availability-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onEditAvailability(entry)}
                  disabled={entry.status === 'pending_delete'}
                >
                  {getEditLabel(entry)}
                </button>
                {entry.status === 'pending' && (
                  <button type="button" className="ghost" onClick={() => onResetApproval(entry)}>
                    Reset approval
                  </button>
                )}
                <button type="button" className="ghost" onClick={() => onDeleteAvailability(entry)}>
                  {getDeleteLabel(entry)}
                </button>
              </div>
              {deleteRequest.entry?.id === entry.id && renderDeleteRequestForm(entry)}
              {updateRequest.entry?.id === entry.id && renderUpdateRequestForm(entry)}
            </div>
          ))}
        </div>
      )}
    </div>

    {isLeadInstructor && (
      <div className="availability-section">
        <h3>Pending approvals</h3>
        {pendingAvailability.length === 0 ? (
          <p className="empty">No pending availability.</p>
        ) : (
          <div className="list">
            {pendingAvailability.map((entry) => (
              <div key={entry.id} className="card availability-card">
                <div>
                  <div className="availability-card__title">
                    <strong>{entry.instructorName || 'Instructor'}</strong>
                    <span className={`availability-status availability-status--${entry.status}`}>
                      {formatAvailabilityStatus(entry.status)}
                    </span>
                  </div>
                  <p className="muted">
                    {entry.date} · {entry.startTime} - {entry.endTime}
                  </p>
                  {entry.approvalReason && (
                    <p className="muted">Disapproval reason: {entry.approvalReason}</p>
                  )}
                  {entry.changeReason && (
                    <p className="muted">Update reason: {entry.changeReason}</p>
                  )}
                  {entry.notes && <p className="muted">{entry.notes}</p>}
                </div>
                <div className="availability-approval">
                  <label>
                    Disapproval reason (required to decline)
                    <textarea
                      value={approvalReasons[entry.id] || ''}
                      onChange={(event) => onApprovalReasonChange(entry.id, event.target.value)}
                      placeholder="Why are you declining this availability?"
                      required
                    />
                  </label>
                </div>
                <div className="panel__actions">
                  {entry.status === 'pending_delete' ? (
                    <>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onApproveAvailability(entry)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onDeclineAvailability(entry)}
                      >
                        Deny
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onApproveAvailability(entry)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => onDeclineAvailability(entry)}
                      >
                        Decline
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}

    <div className="availability-section">
      <h3>Approved availability calendar</h3>
      {approvedAvailability.length === 0 ? (
        <p className="empty">No approved availability yet.</p>
      ) : (
        <div className="availability-calendar">
          {approvedAvailabilityCalendar.map((day) => (
            <div key={day.dateKey} className="availability-day">
              <div className="availability-day__header">
                <strong>{day.label}</strong>
                {day.dateKey !== 'unscheduled' && <span className="muted">{day.dateKey}</span>}
              </div>
              <div className="availability-day__slots">
                {day.entries.map((entry) => (
                  <div key={entry.id} className="availability-slot">
                    <div>
                      <div className="availability-slot__name">
                        {entry.instructorName || 'Instructor'}
                      </div>
                      <div className="availability-slot__time">
                        {entry.startTime && entry.endTime
                          ? `${entry.startTime} - ${entry.endTime}`
                          : 'Time not set'}
                      </div>
                    </div>
                    {entry.notes && <div className="availability-slot__notes">{entry.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </section>
);

export default AvailabilityView;
