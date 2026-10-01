import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// Queries have no initialData/placeholderData: components default
			// `data = []` when destructuring, and isLoading stays true until the
			// real data arrives — so a first visit shows a loading state instead
			// of a misleading "nothing found" (initialData counted as loaded
			// data, and in React Query v5 so does placeholderData). No default
			// staleTime: screens show cached data instantly on return and
			// refresh it in the background, so nothing is stale after a save
			// made on another screen under a different query key.
		},
	},
});