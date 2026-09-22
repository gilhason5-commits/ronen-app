import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			// NOT setting a default staleTime here: this codebase uses
			// `initialData: []` as an empty-state placeholder on nearly every
			// query. With any nonzero staleTime, React Query treats that
			// placeholder as fresh real data and skips the actual fetch on
			// mount — every list silently renders empty until staleTime
			// elapses. (Tried 30s here; it broke every page. Fixing this
			// properly would mean switching every query to `placeholderData`
			// instead of `initialData`, which is out of scope for this pass.)
		},
	},
});