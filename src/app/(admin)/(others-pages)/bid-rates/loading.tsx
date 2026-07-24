export default function BidRatesLoading() {
	return (
		<div className="animate-pulse space-y-4">
			<div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-800" />
			<div className="h-9 w-32 rounded-lg bg-gray-200 dark:bg-gray-800" />
			<div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
				<div className="mb-4 h-5 w-28 rounded bg-gray-200 dark:bg-gray-800" />
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, index) => (
						<div
							key={index}
							className="h-24 rounded-xl border border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-gray-900/50"
						/>
					))}
				</div>
			</div>
		</div>
	);
}
