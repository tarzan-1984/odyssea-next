"use client";

import React from "react";
import {
	FlagEn,
	FlagSp,
	FlagAr,
	FlagUa,
	FlagPt,
	FlagFr,
	FlagRu,
} from "@/icons";

/** Map API language code to flag component (en, es, ar, uk, ua, pt, fr, ru) */
const FLAG_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
	en: FlagEn,
	es: FlagSp,
	sp: FlagSp,
	ar: FlagAr,
	uk: FlagUa,
	ua: FlagUa,
	pt: FlagPt,
	fr: FlagFr,
	ru: FlagRu,
};

interface LanguageFlagIconProps {
	/** Language code from API (e.g. "en", "es") */
	language: string | null | undefined;
	className?: string;
}

/**
 * Renders a flag icon for the driver's language. Returns null if language is unknown.
 */
export default function LanguageFlagIcon({ language, className }: LanguageFlagIconProps) {
	if (!language || typeof language !== "string") return null;
	// API may send "en" or "en,es" - use first language
	const firstLang = language.split(",")[0]?.trim().toLowerCase();
	if (!firstLang) return null;
	const Flag = FLAG_MAP[firstLang];
	if (!Flag) return null;
	return <Flag className={className ?? "h-4 w-4 inline-block shrink-0"} aria-hidden />;
}
