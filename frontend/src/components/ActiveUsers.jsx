// components/ActiveUsers.jsx - Active Collaborators Avatar List Component

import React from 'react';

const ActiveUsers = ({ users }) => {
  // If no users are connected, return null.
  if (!users || users.length === 0) return null;

  // Limit the display to a maximum of 4 avatars to avoid UI crowding.
  const displayLimit = 4;
  const displayUsers = users.slice(0, displayLimit);
  const overflowCount = users.length - displayLimit;

  /**
   * Helper to get initials from a name string (e.g. "John Doe" -> "JD")
   * @param {string} name - User's name.
   */
  const getInitials = (name) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200/65 px-3 py-1.5 rounded-lg shadow-sm">
      {/* Active Dot Indicator */}
      <span className="flex h-2 w-2 relative mr-1">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      
      <span className="text-xs text-slate-500 font-semibold mr-2 hidden sm:inline">Editing now:</span>

      {/* Avatar Stack */}
      <div className="flex -space-x-2 overflow-hidden">
        {displayUsers.map((user) => (
          <div
            key={user.socketId}
            className="inline-flex items-center justify-center h-8 w-8 rounded-full border-2 border-white text-white text-xs font-bold shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:z-10 group relative cursor-pointer"
            style={{ backgroundColor: user.color || '#6366f1' }}
          >
            {getInitials(user.name)}

            {/* Hover Tooltip Card */}
            <div className="absolute top-9 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 text-white text-[10px] sm:text-xs px-2.5 py-1 rounded shadow-md whitespace-nowrap z-50 animate-in fade-in duration-100">
              <p className="font-semibold">{user.name}</p>
              <p className="opacity-70 text-[9px] sm:text-[10px]">{user.email}</p>
            </div>
          </div>
        ))}

        {/* Overflow Count Badge */}
        {overflowCount > 0 && (
          <div className="inline-flex items-center justify-center h-8 w-8 rounded-full border-2 border-white bg-slate-200 text-slate-600 text-xs font-bold shadow-sm" title={`${overflowCount} more user(s) online`}>
            +{overflowCount}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveUsers;
