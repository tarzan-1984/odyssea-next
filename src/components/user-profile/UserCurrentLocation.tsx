"use client";
import React, { useEffect, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Label from "../form/Label";
import { useCurrentUser, useUpdateUserField } from "@/stores/userStore";
import { useForm } from "react-hook-form";
import { UserData, UserUpdateFormData } from "@/app-api/api-types";
import users from "@/app-api/users";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";

interface IUserCurrentLocationCardProp {
	user: UserData | null;
}
export default function UserCurrentLocationCard({user}: IUserCurrentLocationCardProp) {
	const { isOpen, openModal, closeModal } = useModal();
	const [loading, setLoading] = useState(false);
	const [resultMessage, setResultMessage] = useState<{
		text: string;
		type: "success" | "error";
	} | null>(null);

	// Get user data from Zustand store
	const currentUser = useCurrentUser();
	const updateUserField = useUpdateUserField();

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<Partial<UserUpdateFormData>>({});

	useEffect(() => {
		if (user) {
			reset({
				current_location: {
					zipcode: user?.organized_data?.current_location.zipcode || "",
					city: user?.organized_data?.current_location.city || "",
					state: user?.organized_data?.current_location.state || "",
					coordinates: {
						lat: user?.organized_data?.current_location.coordinates.lat || "",
						lng: user?.organized_data?.current_location.coordinates.lng || "",
					}
				},
			});
		}
	}, [user, reset]);

	const onSubmit = async (data: Partial<UserUpdateFormData>) => {
		if (!user?.id) return;

		setLoading(true);
		setResultMessage(null);

		try {
			const result = await users.updateUser(user.id, data);

			if (result.success) {
				setResultMessage({
					text: "Address information updated successfully",
					type: "success",
				});
			} else {
				setResultMessage({ text: "Failed to update data", type: "error" });
			}
		} catch (error) {
			console.error("Network or unexpected error:", error);
			setResultMessage({ text: "Network error. Please try again.", type: "error" });
		} finally {
			setLoading(false);
		}
	};

	const currentLocationFields = [
		{
			label: "City",
			value: user?.organized_data?.current_location?.city,
			key: "city",
		},
		{
			label: "Coordinates (lat / lng)",
			value: user?.organized_data?.current_location?.coordinates,
			key: "coordinates",
			lat: user?.organized_data?.current_location?.coordinates.lat,
			lng: user?.organized_data?.current_location?.coordinates.lng,
		},
		{
			label: "State",
			value: user?.organized_data?.current_location?.state,
			key: "state",
		},
		{
			label: "Zipcode",
			value: user?.organized_data?.current_location?.zipcode,
			key: "zipcode",
		},
	];

	return (
		<>
			<div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
				<div className="flex justify-between flex-wrap gap-6 lg:gap-10">
					<h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 order-1">
						Current location
					</h4>

					{ currentUser?.role === 'ADMINISTRATOR' &&
						<button
							onClick={openModal}
							className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto order-3 lg:order-2"
						>
							<svg
								className="fill-current"
								width="18"
								height="18"
								viewBox="0 0 18 18"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									fillRule="evenodd"
									clipRule="evenodd"
									d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
									fill=""
								/>
							</svg>
							Edit
						</button>
					}

					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-7 2xl:gap-x-32 basis-full order-2 lg:order-3">
						{currentLocationFields.map(field => (
							<div key={field.label}>
								<p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
									{field.label}
								</p>
								<p className="text-sm font-medium text-gray-800 dark:text-white/90">
									{field.key === "coordinates" &&
									field.value &&
									typeof field.value !== "string"
										? `${field.value.lat} / ${field.value.lng}`
										: String(field.value ?? "-")}{" "}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>

			<Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
				<div className="relative w-full p-4 overflow-y-auto bg-white no-scrollbar rounded-3xl dark:bg-gray-900 lg:p-11">
					<div className="px-2 pr-14">
						<h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
							Edit Current location
						</h4>
						<p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
							Update your details to keep your profile up-to-date.
						</p>
					</div>
					<form className="flex flex-col" onSubmit={handleSubmit(onSubmit)}>
						<div className="px-2 overflow-y-auto custom-scrollbar">
							<div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
								<Label>
									City
									<input
										type="text"
										{...register("current_location.city")}
										className="input-style"
									/>
									{errors.current_location?.city && (
										<p className="text-error-500 text-sm mt-1">
											{errors.current_location.city.message}
										</p>
									)}
								</Label>

								<Label>
									Coordinates latitude
									<input
										type="text"
										{...register("current_location.coordinates.lat")}
										className="input-style"
									/>
									{errors.current_location?.coordinates?.lat && (
										<p className="text-error-500 text-sm mt-1">
											{errors.current_location.coordinates.lat.message}
										</p>
									)}
								</Label>

								<Label>
									Coordinates longitude
									<input
										type="text"
										{...register("current_location.coordinates.lng")}
										className="input-style"
									/>
									{errors.current_location?.coordinates?.lng && (
										<p className="text-error-500 text-sm mt-1">
											{errors.current_location.coordinates.lng.message}
										</p>
									)}
								</Label>

								<Label>
									Last updated
									<input
										type="text"
										{...register("current_location.last_updated")}
										className="input-style"
									/>
									{errors.current_location?.last_updated && (
										<p className="text-error-500 text-sm mt-1">
											{errors.current_location.last_updated.message}
										</p>
									)}
								</Label>

								<Label>
									Zipcode
									<input
										type="text"
										{...register("current_location.zipcode")}
										className="input-style"
									/>
									{errors.current_location?.zipcode && (
										<p className="text-error-500 text-sm mt-1">
											{errors.current_location.zipcode.message}
										</p>
									)}
								</Label>
							</div>
						</div>
						<div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
							<Button size="sm" variant="outline" onClick={closeModal}>
								Close
							</Button>
							<Button type="submit" size="sm" disabled={loading}>
								Save Changes
							</Button>
						</div>

						{resultMessage && (
							<div
								className={`fixed top-5 right-5 px-4 py-2 rounded-lg shadow-lg animate-fadeOut
									${resultMessage.type === "success" ? "bg-success-500" : "bg-error-500"}
								`}
							>
								<p className="text-white">{resultMessage.text}</p>
							</div>
						)}
					</form>
					{loading && (
						<div className="absolute w-full h-full bg-white top-0 left-0 z-1 flex justify-center items-center">
							<SpinnerOne />
						</div>
					)}
				</div>
			</Modal>
		</>
	);
}
