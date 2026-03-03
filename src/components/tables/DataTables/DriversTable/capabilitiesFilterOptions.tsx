import type { ReactNode } from "react";
import Image from "next/image";
import {
	CdlIcon,
	Change9Icon,
	HazmatIcon,
	TsaIcon,
	TwicIcon,
	TankerEndorsement,
	Ppe,
	DockHigh,
	Etrack,
	PalletJack,
	Ramp,
	LoadBars,
	Liftgate,
	Canada,
	Mexico,
	RealId,
	Printer,
	Sleeper,
	TeamIcon,
} from "@/icons";
import macroPointIcon from "@/icons/additional/macropoint.png";
import tuckerTools from "@/icons/additional/tucker-tools.png";
import AlaskaIcon from "@/icons/additional/usa-alaska.svg";
import SideDoorIcon from "@/icons/additional/side_door.svg";

export interface CapabilityOption {
	value: string;
	text: string;
	selected: boolean;
	icon?: ReactNode;
}

export const CAPABILITIES_OPTIONS: CapabilityOption[] = [
	{ value: "cdl", text: "CDL", selected: false, icon: <CdlIcon className="h-4 w-4" /> },
	{ value: "hazmat", text: "Hazmat", selected: false, icon: <HazmatIcon className="h-4 w-4" /> },
	{ value: "tsa", text: "TSA", selected: false, icon: <TsaIcon className="h-4 w-4" /> },
	{ value: "twic", text: "TWIC", selected: false, icon: <TwicIcon className="h-4 w-4" /> },
	{
		value: "tanker-endorsement",
		text: "Tanker endorsement",
		selected: false,
		icon: (
			<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
				<TankerEndorsement className="h-5 w-5" />
			</span>
		),
	},
	{
		value: "ppe",
		text: "PPE",
		selected: false,
		icon: (
			<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
				<Ppe className="h-5 w-5" />
			</span>
		),
	},
	{ value: "dock-high", text: "Dock High", selected: false, icon: <DockHigh className="h-4 w-4" /> },
	{
		value: "e-track",
		text: "E-tracks",
		selected: false,
		icon: (
			<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
				<Etrack className="h-5 w-5" />
			</span>
		),
	},
	{
		value: "pallet-jack",
		text: "Pallet jack",
		selected: false,
		icon: (
			<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
				<PalletJack className="h-5 w-5" />
			</span>
		),
	},
	{
		value: "ramp",
		text: "Ramp",
		selected: false,
		icon: (
			<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
				<Ramp className="h-5 w-5" />
			</span>
		),
	},
	{
		value: "load-bars",
		text: "Load bars",
		selected: false,
		icon: (
			<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
				<LoadBars className="h-5 w-5" />
			</span>
		),
	},
	{
		value: "liftgate",
		text: "Liftgate",
		selected: false,
		icon: (
			<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
				<Liftgate className="h-5 w-5" />
			</span>
		),
	},
	{ value: "team", text: "Team", selected: false, icon: <TeamIcon className="h-4 w-4" /> },
	{ value: "canada", text: "Canada", selected: false, icon: <Canada className="h-4 w-4" /> },
	{ value: "mexico", text: "Mexico", selected: false, icon: <Mexico className="h-4 w-4" /> },
	{ value: "alaska", text: "Alaska", selected: false, icon: <AlaskaIcon className="h-4 w-4" /> },
	{ value: "real_id", text: "Real ID", selected: false, icon: <RealId className="h-4 w-4" /> },
	{
		value: "macropoint",
		text: "MacroPoint",
		selected: false,
		icon: <Image src={macroPointIcon} alt="MacroPoint" className="h-4 w-4" />,
	},
	{
		value: "tucker-tools",
		text: "Trucker Tools",
		selected: false,
		icon: <Image src={tuckerTools} alt="Trucker Tools" className="h-4 w-4" />,
	},
	{ value: "change-9", text: "Change 9", selected: false, icon: <Change9Icon className="h-4 w-4" /> },
	{
		value: "sleeper",
		text: "Sleeper",
		selected: false,
		icon: (
			<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
				<Sleeper className="h-5 w-5" />
			</span>
		),
	},
	{
		value: "printer",
		text: "Printer",
		selected: false,
		icon: (
			<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
				<Printer className="h-5 w-5" />
			</span>
		),
	},
	{
		value: "side_door",
		text: "Side door",
		selected: false,
		icon: (
			<span className="inline-flex h-7 w-7 items-center justify-center rounded bg-white dark:bg-white">
				<SideDoorIcon className="h-5 w-5" />
			</span>
		),
	},
];
