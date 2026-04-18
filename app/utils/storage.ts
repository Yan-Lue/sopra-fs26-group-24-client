// Utility functions for handling localStorage and sessionStorage operations
// parseStorageValue attempts to parse a JSON string, but falls back to returning the raw string if parsing fails
// clearSessionClientState removes all session-related data from both localStorage and sessionStorage for a given session code

export const parseStorageValue = <T,>(raw: string | null): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
};

export const clearSessionClientState = (sessionCode: string) => {
  const userIdRaw = localStorage.getItem("userId");
  const parsedUserId = userIdRaw ? Number(userIdRaw) : NaN;

  if (localStorage.getItem("sessionCode") === sessionCode) {
    localStorage.removeItem("sessionCode");
  }

  localStorage.removeItem("hostId");

  if (!Number.isNaN(parsedUserId)) {
    localStorage.removeItem(`historySaved:${sessionCode}:${parsedUserId}`);
  }

  sessionStorage.removeItem(`joinedSession:${sessionCode}`);
  sessionStorage.removeItem(`joinedUsers:${sessionCode}`);
  sessionStorage.removeItem(`sessionFilters:${sessionCode}`);
  sessionStorage.removeItem(`timePerRound:${sessionCode}`);
  sessionStorage.removeItem(`currentMovie:${sessionCode}`);
  sessionStorage.removeItem(`votedMovieIds:${sessionCode}`);
  sessionStorage.removeItem(`joinedUsernames:${sessionCode}`);
  sessionStorage.removeItem(`sessionName`);
};