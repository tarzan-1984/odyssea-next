type ActivateApplicationValue = string | number | boolean | null | undefined;

/** True when the driver has opened the mobile app at least once (`users.last_active_app`). */
export function driverUsesMobileAppFromLastActive(
	lastActiveApp: string | Date | null | undefined
): boolean {
	if (lastActiveApp == null) return false;
	if (lastActiveApp instanceof Date) {
		return !Number.isNaN(lastActiveApp.getTime());
	}
	return String(lastActiveApp).trim() !== "";
}

export function driverUsesMobileApp(
	activateApplication: ActivateApplicationValue
): boolean {
	if (activateApplication === 1 || activateApplication === true) {
		return true;
	}
	if (typeof activateApplication === "string") {
		const normalized = activateApplication.trim().toLowerCase();
		return normalized === "1" || normalized === "true";
	}
	return false;
}

type DriverMobileAppIconProps = {
	usesApp: boolean;
	className?: string;
};

export default function DriverMobileAppIcon({
	usesApp,
	className = "shrink-0 w-5 h-5 text-gray-900 dark:text-white",
}: DriverMobileAppIconProps) {
	const ariaLabel = usesApp
		? "Uses mobile application"
		: "Does not use mobile application";

	if (usesApp) {
		return (
			<svg
				className={className}
				role="img"
				aria-label={ariaLabel}
				xmlns="http://www.w3.org/2000/svg"
				shapeRendering="geometricPrecision"
				textRendering="geometricPrecision"
				imageRendering="optimizeQuality"
				fillRule="evenodd"
				clipRule="evenodd"
				viewBox="0 0 397 511.911"
			>
				<path
					fill="currentColor"
					d="M62.087 0h168.92c17.125 0 32.753 6.988 43.891 18.212 11.293 11.306 18.184 26.85 18.184 43.89v36.586c-2.371-.11-4.755-.173-7.154-.173-4.28 0-8.515.188-12.704.538V61.507H19.771v364.164h253.453v-26.146c4.189.35 8.424.537 12.704.537a154.3 154.3 0 007.154-.172v49.934c0 17.138-6.975 32.766-18.184 43.891-11.322 11.321-26.85 18.196-43.891 18.196H62.087c-17.138 0-32.765-6.972-43.89-18.196C6.89 482.421 0 466.878 0 449.824V62.018c0-17.14 6.975-32.767 18.197-43.905C29.49 6.819 44.949 0 62.087 0zm84.376 445.096c14.046 0 25.523 11.308 25.523 25.523 0 14.061-11.306 25.538-25.523 25.538-14.046 0-25.538-11.307-25.538-25.538 0-14.031 11.309-25.523 25.538-25.523z"
				/>
				<path
					fill="#00A912"
					d="M285.928 138.216c61.364 0 111.072 49.739 111.072 111.072 0 61.364-49.74 111.072-111.072 111.072-61.364 0-111.073-49.74-111.073-111.072 0-61.366 49.74-111.072 111.073-111.072zm-35.903 94.85l19.688 18.593 49.388-50.017c3.857-3.916 6.274-7.055 11.025-2.161l15.426 15.803c5.068 5.01 4.809 7.945.032 12.608l-67.062 66.023c-10.075 9.875-8.32 10.48-18.538.347l-35.921-35.722c-2.132-2.304-1.902-4.634.428-6.937l17.907-18.569c2.713-2.856 4.874-2.607 7.627.032z"
				/>
			</svg>
		);
	}

	return (
		<svg
			className={className}
			role="img"
			aria-label={ariaLabel}
			xmlns="http://www.w3.org/2000/svg"
			shapeRendering="geometricPrecision"
			textRendering="geometricPrecision"
			imageRendering="optimizeQuality"
			fillRule="evenodd"
			clipRule="evenodd"
			viewBox="0 0 397 511.546"
		>
			<path
				fill="currentColor"
				d="M62.043 0h168.8c17.112 0 32.728 6.983 43.859 18.199 11.285 11.298 18.171 26.831 18.171 43.859v36.559a155.489 155.489 0 00-7.149-.172c-4.277 0-8.509.188-12.695.537V61.463H19.757v363.905h253.272V399.24c4.186.349 8.418.537 12.695.537 2.397 0 4.78-.063 7.149-.173v49.9c0 17.125-6.97 32.741-18.171 43.858-11.314 11.314-26.831 18.184-43.859 18.184h-168.8c-17.126 0-32.742-6.967-43.859-18.184C6.885 482.077 0 466.545 0 449.504V61.974C0 44.846 6.97 29.23 18.184 18.1 29.469 6.814 44.917 0 62.043 0zm84.316 444.778c14.036 0 25.505 11.301 25.505 25.505 0 14.051-11.299 25.52-25.505 25.52-14.036 0-25.52-11.298-25.52-25.52 0-14.021 11.3-25.505 25.52-25.505z"
			/>
			<path
				fill="#F44336"
				d="M285.724 137.837c61.478 0 111.276 49.83 111.276 111.276 0 61.476-49.83 111.276-111.276 111.276-61.476 0-111.274-49.832-111.274-111.276 0-61.478 49.831-111.276 111.274-111.276zm-47.196 90.05c-3.921-3.86-7.067-6.284-2.162-11.043l15.832-15.455c5.016-5.077 7.959-4.818 12.63-.03l21.34 21.339 21.209-21.208c3.863-3.923 6.284-7.066 11.043-2.164l15.455 15.832c5.077 5.018 4.818 7.961.032 12.632l-21.324 21.325 21.324 21.323c4.786 4.671 5.045 7.614-.032 12.632l-15.455 15.83c-4.759 4.904-7.18 1.761-11.043-2.162l-21.209-21.208-21.34 21.34c-4.671 4.787-7.614 5.046-12.63-.031l-15.832-15.457c-4.905-4.76-1.759-7.181 2.162-11.044l21.226-21.223-21.226-21.226z"
			/>
		</svg>
	);
}
