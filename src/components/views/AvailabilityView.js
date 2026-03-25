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
  onAvailabilityDateToggle,
  onAvailabilityDatesSet,
  availabilityEditId,
  onSubmitAvailability,
  isSubmittingAvailability,
  onResetAvailabilityForm,
  selectableAvailabilityOptions,
  myAvailability,
  formatAvailabilityStatus,
  onDeleteAvailability,
  getDeleteLabel,
  deleteRequest,
  renderDeleteRequestForm,
  pendingAvailability,
  approvalReasons,
  onApprovalReasonChange,
  onApproveAvailability,
  onDeclineAvailability,
  approvedAvailability,
  approvedAvailabilityCalendar,
  onBack,
}) => {
  const [showAllDates, setShowAllDates] = React.useState(false);
  const isSunday = React.useCallback((dateValue) => {
    if (!dateValue) {
      return false;
    }
    const parsed = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }
    return parsed.getDay() === 0;
  }, []);

  const sundayDates = React.useMemo(
    () => selectableAvailabilityOptions.filter((option) => isSunday(option.date)),
    [isSunday, selectableAvailabilityOptions]
  );

  const formatAvailabilityDate = React.useCallback(
    (dateValue) => (dateValue ? formatAvailabilityRuleLabel(dateValue) : ''),
    [formatAvailabilityRuleLabel]
  );

  const getOccasionLabel = React.useCallback(
    (dateValue) => {
      if (!dateValue) {
        return '';
      }
      const label = formatAvailabilityRuleLabel(dateValue);
      const parts = label.split(' — ');
      return parts.length > 1 ? parts.slice(1).join(' — ') : '';
    },
    [formatAvailabilityRuleLabel]
  );

  const visibleOptions = React.useMemo(() => {
    if (availabilityEditId || showAllDates) {
      return selectableAvailabilityOptions;
    }
    return selectableAvailabilityOptions.slice(0, 4);
  }, [availabilityEditId, selectableAvailabilityOptions, showAllDates]);

  const selectedDatesOrdered = React.useMemo(() => {
    const selectedSet = new Set(availabilityForm.selectedDates);
    const ordered = selectableAvailabilityOptions
      .map((option) => option.date)
      .filter((dateValue) => selectedSet.has(dateValue));
    availabilityForm.selectedDates.forEach((dateValue) => {
      if (!selectedSet.has(dateValue)) {
        ordered.push(dateValue);
      }
    });
    return ordered;
  }, [availabilityForm.selectedDates, selectableAvailabilityOptions]);

  const hasMoreDates = selectableAvailabilityOptions.length > 4;

  return (
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
          {availabilityEditId ? (
            <label>
              Date
              <select
                name="date"
                value={availabilityForm.date}
                onChange={onAvailabilityFormChange}
                disabled
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
          ) : (
            <div className="form__full">
              <div className="form__label">Select days</div>
              <div className="availability-options">
                {visibleOptions.map((option) => (
                  <label key={option.date} className="availability-option">
                    <input
                      type="checkbox"
                      value={option.date}
                      checked={availabilityForm.selectedDates.includes(option.date)}
                      onChange={() => onAvailabilityDateToggle(option.date)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <div className="availability-options__actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() =>
                    onAvailabilityDatesSet(
                      Array.from(
                        new Set([
                          ...availabilityForm.selectedDates,
                          ...sundayDates.map((option) => option.date),
                        ])
                      )
                    )
                  }
                  disabled={sundayDates.length === 0}
                >
                  Select all Sundays
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => onAvailabilityDatesSet([])}
                  disabled={availabilityForm.selectedDates.length === 0}
                >
                  Clear selection
                </button>
                {hasMoreDates && (
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setShowAllDates((prev) => !prev)}
                  >
                    {showAllDates ? 'Show fewer days' : 'Show more days'}
                  </button>
                )}
              </div>
              {availabilityForm.selectedDates.length === 0 && (
                <p className="muted">Choose one or more dates to continue.</p>
              )}
            </div>
          )}
          {!availabilityEditId && selectedDatesOrdered.length > 0 && (
            <div className="form__full">
              <div className="form__label">Review selected dates</div>
              <ul className="availability-review">
                {selectedDatesOrdered.map((dateValue) => {
                  const label = selectableAvailabilityOptions.find(
                    (option) => option.date === dateValue
                  )?.label;
                  return <li key={dateValue}>{label || dateValue}</li>;
                })}
              </ul>
            </div>
          )}
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
                  <strong>{formatAvailabilityDate(entry.date)}</strong>
                  <span className={`availability-status availability-status--${entry.status}`}>
                    {formatAvailabilityStatus(entry.status)}
                  </span>
                </div>
                {entry.approvalReason && (
                  <p className="muted">Disapproval reason: {entry.approvalReason}</p>
                )}
                {entry.changeReason && (
                  <p className="muted">Update reason: {entry.changeReason}</p>
                )}
                {entry.notes && <p className="muted">{entry.notes}</p>}
              </div>
              <div className="panel__actions availability-actions">
                <button type="button" className="ghost" onClick={() => onDeleteAvailability(entry)}>
                  {getDeleteLabel(entry)}
                </button>
              </div>
              {deleteRequest.entry?.id === entry.id && renderDeleteRequestForm(entry)}
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
                  <p className="muted">{formatAvailabilityDate(entry.date)}</p>
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
                {day.dateKey !== 'unscheduled' && getOccasionLabel(day.dateKey) && (
                  <span className="muted">{getOccasionLabel(day.dateKey)}</span>
                )}
              </div>
              <div className="availability-day__slots">
                {day.entries.map((entry) => (
                  <div key={entry.id} className="availability-slot">
                    <div>
                      <div className="availability-slot__name">
                        {entry.instructorName || 'Instructor'}
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
};

export default AvailabilityView;
