"use client";

import React, { useState } from "react";
import Image from "next/image";

interface UserAvatarProps {
	src?: string;
	alt: string;
	firstName: string;
	lastName: string;
	width: number;
	height: number;
	className?: string;
}

export default function UserAvatar({
	src,
	alt,
	firstName,
	lastName,
	width,
	height,
	className = "",
}: UserAvatarProps) {
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
	const showInitials = !src || imageError || !imageLoaded;

	return (
		<div
			className={`relative overflow-hidden rounded-full ${className}`}
			style={{ width, height }}
		>
			{showInitials ? (
				<div
					className={`flex items-center justify-center w-full h-full text-white font-semibold ${getBackgroundColor(firstName, lastName)}`}
					style={{ fontSize: `${Math.min(width, height) * 0.4}px` }}
				>
					{getInitials(firstName, lastName)}
				</div>
			) : (
				<Image
					width={width}
					height={height}
					src={src}
					alt={alt}
					className="object-cover w-full h-full"
					onError={handleImageError}
					onLoad={handleImageLoad}
				/>
			)}
		</div>
	);
}
