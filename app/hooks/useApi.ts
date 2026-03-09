import { ApiService } from "@/api/apiService";
import { useMemo } from "react"; // think of usememo like a singleton, it ensures only one instance exists

export const useApi = () => {
  return useMemo(() => new ApiService(), []); // only if ApiService changes, the memo gets updated and useEffect in app/users/page.tsx gets triggered
};
