"use client";

import React, { useState } from "react";
import Image from "next/image";

interface UserAvatarProps {
	src?: string;
	alt?: string;
	firstName?: string;
	lastName?: string;
	width?: number;
	height?: number;
	className?: string;
	user?: {
		firstName: string;
		lastName: string;
		profilePhoto?: string;
	};
	size?: "sm" | "md" | "lg";
}

export default function UserAvatar({
	src,
	alt,
	firstName,
	lastName,
	width,
	height,
	className = "",
	user,
	size = "md",
}: UserAvatarProps) {
	// Use user object if provided, otherwise use individual props
	const finalFirstName = user?.firstName || firstName || "";
	const finalLastName = user?.lastName || lastName || "";
	const finalSrc = user?.profilePhoto || src;
	const finalAlt = alt || `${finalFirstName} ${finalLastName}`;

	// Size configurations
	const sizeConfig = {
		sm: { width: 32, height: 32, textSize: "text-xs" },
		md: { width: 40, height: 40, textSize: "text-sm" },
		lg: { width: 48, height: 48, textSize: "text-base" },
	};

	const config = sizeConfig[size];
	const finalWidth = width || config.width;
	const finalHeight = height || config.height;
	const [imageError, setImageError] = useState(false);
	const [imageLoaded, setImageLoaded] = useState(false);

	// Generate initials from first and last name
	const getInitials = (first: string, last: string): string => {
		return `${first.charAt(0).toUpperCase()}${last.charAt(0).toUpperCase()}`;
	};

	// Generate background color based on name
	const getBackgroundColor = (first: string, last: string): string => {
		const colors = [
			"bg-red-500",
			"bg-blue-500",
			"bg-green-500",
			"bg-yellow-500",
			"bg-purple-500",
			"bg-pink-500",
			"bg-indigo-500",
			"bg-teal-500",
			"bg-orange-500",
			"bg-cyan-500",
		];

		// Simple hash function to get consistent color for same name
		const name = `${first}${last}`.toLowerCase();
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}

		return colors[Math.abs(hash) % colors.length];
	};

	const handleImageError = () => {
		setImageError(true);
	};

	const handleImageLoad = () => {
		setImageLoaded(true);
	};

	// Show initials if no src, image error, or image not loaded yet
	const showInitials = !finalSrc || imageError || !imageLoaded;

	return (
		<div
			className={`relative overflow-hidden rounded-full ${className}`}
			style={{ width: finalWidth, height: finalHeight }}
		>
			{showInitials ? (
				<div
					className={`flex items-center justify-center w-full h-full text-white font-semibold ${config.textSize} ${getBackgroundColor(finalFirstName, finalLastName)}`}
					style={{ fontSize: `${Math.min(finalWidth, finalHeight) * 0.4}px` }}
				>
					{getInitials(finalFirstName, finalLastName)}
				</div>
			) : (
				<Image
					width={finalWidth}
					height={finalHeight}
					src={finalSrc}
					alt={finalAlt}
					className="object-cover w-full h-full"
					onError={handleImageError}
					onLoad={handleImageLoad}
				/>
			)}
		</div>
	);
}
