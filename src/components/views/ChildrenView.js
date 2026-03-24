import React from 'react';

const ChildrenView = ({
  classFilter,
  onClassFilterChange,
  classOptions,
  childSearch,
  onSearchChange,
  groupedChildren,
  teacherLookup,
  onBack,
  onOpenChild,
  onCardKeyDown,
}) => (
  <section className="panel">
    <div className="panel__heading">
      <h2>Celebkids / Teens</h2>
      <div className="panel__actions">
        <button type="button" className="ghost" onClick={onBack} aria-label="Back">
          ←
        </button>
        <select
          className="search"
          value={classFilter}
          onChange={onClassFilterChange}
          aria-label="Filter by class"
        >
          {classOptions.map((option) => (
            <option key={option} value={option}>
              {option === 'all' ? 'All classes' : option}
            </option>
          ))}
        </select>
        <input
          className="search"
          type="search"
          placeholder="Search children"
          value={childSearch}
          onChange={onSearchChange}
        />
      </div>
    </div>
    <div className="list">
      {groupedChildren.length === 0 ? (
        <p className="empty">No children found.</p>
      ) : (
        groupedChildren.map((group) => (
          <div key={group.category} className="list-section">
            <h3 className="list-section__title">{group.category}</h3>
            <div className="list">
              {group.children.map((child) => (
                <article
                  key={child.id}
                  className={`card${child.signedIn ? ' card--signedin' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenChild(child)}
                  onKeyDown={(event) => onCardKeyDown(event, () => onOpenChild(child))}
                >
                  <div>
                    <div className="card__title">
                      <h4>{child.name}</h4>
                      {child.signedIn && <span className="badge badge--signedin">Signed in</span>}
                    </div>
                    <div className="meta">
                      <span>Age: {child.age || 'Not provided'}</span>
                      <span>Guardian: {child.guardianName || 'No guardian listed'}</span>
                      <span>Contact: {child.guardianContact || 'No contact listed'}</span>
                      <span>Assigned: {teacherLookup[child.teacherId] || 'Unassigned'}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  </section>
);

export default ChildrenView;
