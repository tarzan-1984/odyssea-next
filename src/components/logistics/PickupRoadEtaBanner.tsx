"use client";

import type { PickupRoadEtaResult } from "@/hooks/usePickupRoadEta";
import { TrackingMapTopBannerLane } from "./TrackingMapTopBannerLane";

type PickupRoadEtaBannerProps = {
	status: "idle" | "loading" | "ready" | "error";
	eta: PickupRoadEtaResult | null;
	pickupAddressLabel?: string | null;
	title?: string;
	loadingLabel?: string;
	/** Leave top-right lane clear for Load history panel (25vw + offset). */
	reserveRightForHistory?: boolean;
};

const DEFAULT_LOADING = "Calculating estimated arrival at pickup…";

export default function PickupRoadEtaBanner({
	status,
	eta,
	pickupAddressLabel,
	loadingLabel = DEFAULT_LOADING,
	reserveRightForHistory = false,
}: PickupRoadEtaBannerProps) {
	if (status === "idle") return null;

	const routeName = eta?.routeLabel?.trim() || "";
	const headline = routeName || "Fastest route";
	const paceLabel = eta?.avoidsTraffic ? "Avoids traffic" : "Fastest route";
	const detailParts = [routeName ? paceLabel : null, eta?.distanceLabel].filter(
		(part): part is string => Boolean(part)
	);
	const showTolls = Boolean(eta?.hasTolls || eta?.tollNotice);

	return (
		<TrackingMapTopBannerLane reserveRightForHistory={reserveRightForHistory}>
			<div className="w-full max-w-[440px] rounded-2xl bg-white px-[18px] py-4 text-left font-[Manrope,sans-serif] shadow-[0_6px_18px_rgba(20,36,59,0.12)] [overflow-wrap:anywhere]">
				{status === "loading" && (
					<p className="text-center text-sm font-medium text-[#152238]">{loadingLabel}</p>
				)}
				{status === "error" && (
					<p className="text-center text-sm font-medium text-[#637899]">
						Unable to estimate road arrival time right now.
					</p>
				)}
				{status === "ready" && eta ? (
					<>
						<div className="flex items-start gap-3">
							<EtaGlyph />
							<div className="min-w-0 flex-1 pt-px">
								<p className="text-[10px] font-medium uppercase tracking-[0.02em] text-[#6F7C91]">
									Estimated arrival
								</p>
								<p className="text-[16px] font-bold leading-[22px] text-[#3D6EF5]">
									{eta.arrivalLabel}
								</p>
							</div>
							{eta.drivingLabel ? (
								<span className="mt-1 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-[#FFF0F2] px-3.5 text-[11px] font-semibold text-[#E5484D]">
									<DurationGlyph />
									{eta.drivingLabel}
								</span>
							) : null}
						</div>
						<div className="my-4 h-px bg-[#DDE5F1]" />
						<div className="flex items-start gap-3">
							<RouteGlyph />
							<div className="min-w-0 flex-1">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="text-[13px] font-semibold leading-[18px] text-[#152238]">
											{headline}
										</p>
										{detailParts.length > 0 ? (
											<p className="mt-0.5 text-[11px] font-medium leading-[13px] text-[#637899]">
												{detailParts.join("  ·  ")}
											</p>
										) : null}
									</div>
									{showTolls ? (
										<span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-xl bg-[#FFF6E7] px-2 text-[9px] font-semibold text-[#AE5104]">
											<InfoGlyph />
											{eta.tollNotice || "This route has tolls"}
										</span>
									) : null}
								</div>
								{pickupAddressLabel ? (
									<p className="mt-3 flex items-start gap-1.5 text-[12px] font-normal leading-4 text-[#718096]">
										<PinGlyph />
										<span>{pickupAddressLabel}</span>
									</p>
								) : null}
							</div>
						</div>
					</>
				) : null}
			</div>
		</TrackingMapTopBannerLane>
	);
}

function EtaGlyph() {
	return (
		<svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
			<rect width="34" height="34" rx="10" fill="#EEF3FF" />
			<path
				d="M22.0753 14.5955L22.8358 13.835C23.0555 13.6153 23.0555 13.259 22.8358 13.0392C22.616 12.8195 22.2597 12.8195 22.04 13.0392L21.3492 13.73C20.3562 12.7467 19.0325 12.0988 17.5625 11.966V10.8125H18.125C18.4355 10.8125 18.6875 10.5605 18.6875 10.25C18.6875 9.9395 18.4355 9.6875 18.125 9.6875H15.875C15.5645 9.6875 15.3125 9.9395 15.3125 10.25C15.3125 10.5605 15.5645 10.8125 15.875 10.8125H16.4375V11.966C13.289 12.2517 10.8125 14.903 10.8125 18.125C10.8125 21.5367 13.5883 24.3125 17 24.3125C20.4117 24.3125 23.1875 21.5367 23.1875 18.125C23.1875 16.8133 22.7743 15.5975 22.0753 14.5955ZM17 23.1875C14.2085 23.1875 11.9375 20.9165 11.9375 18.125C11.9375 15.3335 14.2085 13.0625 17 13.0625C19.7915 13.0625 22.0625 15.3335 22.0625 18.125C22.0625 20.9165 19.7915 23.1875 17 23.1875ZM19.0033 18.7513C18.905 18.9485 18.7063 19.0625 18.5 19.0625C18.4152 19.0625 18.3298 19.0437 18.2487 19.0033L16.7487 18.2533C16.5582 18.158 16.4375 17.963 16.4375 17.75V15.5C16.4375 15.1895 16.6895 14.9375 17 14.9375C17.3105 14.9375 17.5625 15.1895 17.5625 15.5V17.4028L18.7513 17.9967C19.0295 18.1363 19.1427 18.4738 19.0033 18.7513Z"
				fill="#3D6EF5"
			/>
		</svg>
	);
}

function DurationGlyph() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path
				d="M8.66669 4.83333C8.39335 4.83333 8.16669 5.06 8.16669 5.33333V7.64C8.16669 8.03333 8.36002 8.39333 8.68669 8.61333L10.3867 9.74667C10.4734 9.8 10.5667 9.83333 10.6667 9.83333C10.8267 9.83333 10.9867 9.75333 11.08 9.61333C11.2334 9.38667 11.1734 9.07333 10.94 8.92L9.24002 7.78667C9.19335 7.75333 9.16669 7.70667 9.16669 7.64667V5.34C9.16669 5.06667 8.94002 4.84 8.66669 4.84V4.83333Z"
				fill="#E5484D"
			/>
			<path
				d="M8.66665 2.16667C5.85332 2.16667 3.45998 4.17333 2.93998 6.89333L2.35331 6.30667C2.15998 6.11333 1.83998 6.11333 1.64665 6.30667C1.45331 6.5 1.45331 6.82 1.64665 7.01334L2.99331 8.34667C3.08665 8.44 3.21331 8.49333 3.34665 8.49333C3.47998 8.49333 3.60665 8.44 3.69998 8.34667L5.01998 7.01334C5.21331 6.82 5.21331 6.5 5.01998 6.30667C4.82665 6.11333 4.50665 6.11333 4.31331 6.30667L4.04665 6.57333C4.65331 4.58 6.51332 3.15333 8.66665 3.15333C11.3333 3.15333 13.5 5.32 13.5 7.98667C13.5 10.6533 11.3333 12.82 8.66665 12.82C7.19332 12.82 5.81331 12.16 4.89998 11.0067C4.72665 10.7933 4.41331 10.7533 4.19998 10.9267C3.98665 11.1 3.94665 11.4133 4.11998 11.6267C5.22665 13.02 6.88665 13.8133 8.67332 13.8133C11.8866 13.8133 14.5066 11.2 14.5066 7.98C14.5066 4.76 11.88 2.16667 8.66665 2.16667Z"
				fill="#E5484D"
			/>
		</svg>
	);
}

function RouteGlyph() {
	return (
		<svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
			<rect width="34" height="34" rx="10" fill="#EEF3FF" />
			<path
				d="M11.75 12.6875H14.9375V11C14.9375 10.2763 15.5262 9.6875 16.25 9.6875H17C17.7238 9.6875 18.3125 10.2763 18.3125 11V12.6875H20.2865C20.7035 12.6875 21.1063 12.812 21.4497 13.0468L22.7173 13.9123C23.2468 14.2737 23.5625 14.8723 23.5625 15.5128C23.5625 16.163 23.2393 16.766 22.6992 17.1252L21.4408 17.9645C21.101 18.1918 20.7057 18.311 20.2962 18.311H18.3125V23.186H20.75C21.0605 23.186 21.3125 23.438 21.3125 23.7485C21.3125 24.059 21.0605 24.311 20.75 24.311H12.5C12.1895 24.311 11.9375 24.059 11.9375 23.7485C11.9375 23.438 12.1895 23.186 12.5 23.186H14.9375V18.311H11.75C11.0262 18.311 10.4375 17.7222 10.4375 16.9985V13.9985C10.4375 13.2748 11.0262 12.686 11.75 12.686V12.6875ZM17.1875 11C17.1875 10.8965 17.1035 10.8125 17 10.8125H16.25C16.1465 10.8125 16.0625 10.8965 16.0625 11V12.6875H17.1875V11ZM16.0625 23.1875H17.1875V18.3125H16.0625V23.1875ZM11.5625 17C11.5625 17.1035 11.6465 17.1875 11.75 17.1875H20.2962C20.4822 17.1875 20.6615 17.1335 20.816 17.03L22.076 16.19C22.3025 16.0392 22.4375 15.7865 22.4375 15.5135C22.4375 15.2442 22.3047 14.9937 22.0827 14.8415L20.8145 13.976C20.6585 13.8688 20.4762 13.8125 20.2865 13.8125H11.75C11.6465 13.8125 11.5625 13.8965 11.5625 14V17Z"
				fill="#3D6EF5"
			/>
		</svg>
	);
}

function InfoGlyph() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path
				d="M8 1.5C4.416 1.5 1.5 4.416 1.5 8C1.5 11.584 4.416 14.5 8 14.5C11.584 14.5 14.5 11.584 14.5 8C14.5 4.416 11.584 1.5 8 1.5ZM8 13.5C4.96733 13.5 2.5 11.0327 2.5 8C2.5 4.96733 4.96733 2.5 8 2.5C11.0327 2.5 13.5 4.96733 13.5 8C13.5 11.0327 11.0327 13.5 8 13.5ZM8.5 7.33333V10.6667C8.5 10.9427 8.276 11.1667 8 11.1667C7.724 11.1667 7.5 10.9427 7.5 10.6667V7.33333C7.5 7.05733 7.724 6.83333 8 6.83333C8.276 6.83333 8.5 7.05733 8.5 7.33333ZM8.53333 5.33333C8.53333 5.62733 8.294 5.86667 8 5.86667C7.706 5.86667 7.46667 5.62733 7.46667 5.33333C7.46667 5.03933 7.706 4.8 8 4.8C8.294 4.8 8.53333 5.03933 8.53333 5.33333Z"
				fill="#AE5104"
			/>
		</svg>
	);
}

function PinGlyph() {
	return (
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-px shrink-0">
			<path
				d="M7.99998 4.16667C6.62131 4.16667 5.49998 5.28801 5.49998 6.66667C5.49998 8.04534 6.62131 9.16667 7.99998 9.16667C9.37865 9.16667 10.5 8.04534 10.5 6.66667C10.5 5.28801 9.37865 4.16667 7.99998 4.16667ZM7.99998 8.16667C7.17265 8.16667 6.49998 7.49401 6.49998 6.66667C6.49998 5.83934 7.17265 5.16667 7.99998 5.16667C8.82731 5.16667 9.49998 5.83934 9.49998 6.66667C9.49998 7.49401 8.82731 8.16667 7.99998 8.16667ZM7.99331 1.69267C5.14798 1.69267 2.83331 4.00734 2.83331 6.85467C2.83331 9.92534 4.53531 12.6947 7.27531 14.0813L7.47331 14.182C7.63865 14.2653 7.81931 14.3073 7.99998 14.3073C8.18065 14.3073 8.36198 14.266 8.52731 14.182L8.72531 14.082C11.4646 12.6953 13.1673 9.92601 13.1673 6.85534V6.85334C13.1673 4.00801 10.8526 1.69334 7.99398 1.69334L7.99331 1.69267ZM12.1666 6.85467C12.1666 9.54667 10.6746 11.974 8.27331 13.1893L8.07598 13.2893C8.02798 13.3133 7.97131 13.3127 7.92531 13.2893L7.72731 13.1893C5.32531 11.9733 3.83398 9.54601 3.83398 6.85267C3.83398 4.55867 5.69998 2.69267 8.00731 2.69267C10.3013 2.69267 12.1673 4.55867 12.1673 6.85267L12.1666 6.85467Z"
				fill="#637899"
			/>
		</svg>
	);
}
