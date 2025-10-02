"use client";
import React, { useEffect, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
// import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useCurrentUser, useUpdateUserField } from "@/stores/userStore";
import { useForm } from "react-hook-form";
import { UserUpdateFormData } from "@/app-api/api-types";
import users from "@/app-api/users";
import SpinnerOne from "@/app/(admin)/(ui-elements)/spinners/SpinnerOne";
import { string } from "yup";
import {UserData} from "@/app-api/api-types";

interface IUserContactCardProp {
	user: UserData | null;
}

export default function UserContactCard({user}: IUserContactCardProp) {
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

	/*useEffect(() => {
		if (currentUser) {
			reset({
				contact: {
					driver_phone: currentUser?.organized_data?.contact.driver_phone || "",
					driver_email: currentUser?.organized_data?.contact.driver_email || "",
					home_location: currentUser?.organized_data?.contact.home_location || "",
					city: currentUser?.organized_data?.contact.city || "",
					city_state_zip: currentUser?.organized_data?.contact.city_state_zip || "",
					date_of_birth: currentUser?.organized_data?.contact.date_of_birth || "",
					languages: currentUser?.organized_data?.contact.languages || "",
					team_driver: {
						name: currentUser?.organized_data?.contact.team_driver.name || "",
					},
					emergency_contact: {
						name: currentUser?.organized_data?.contact?.emergency_contact?.name || "",
						phone: currentUser?.organized_data?.contact?.emergency_contact?.phone || "",
						relation:
							currentUser?.organized_data?.contact?.emergency_contact?.relation || "",
					},
				},
			});
		}
	}, [currentUser, reset]);*/

	const onSubmit = async (data: Partial<UserUpdateFormData>) => {
		if (!user?.id) return;

		setLoading(true);
		setResultMessage(null);

		try {
			const result = await users.updateUser(user.id, data);

			if (result.success) {
				setResultMessage({
					text: "Vehicle information updated successfully",
					type: "success",
				});
			} else {
				setResultMessage({ text: "Failed to update vehicle", type: "error" });
			}
		} catch (error) {
			console.error("Network or unexpected error:", error);
			setResultMessage({ text: "Network error. Please try again.", type: "error" });
		} finally {
			setLoading(false);
		}
	};

	let contactFields = [];

	if (user?.role === 'DRIVER') {
		contactFields = [
			{ label: "Phone", value: user?.organized_data?.contact.driver_phone },
			{ label: "Email", value: user?.organized_data?.contact.driver_email },
			{ label: "Home Location", value: user?.organized_data?.contact.home_location },
			{ label: "City", value: user?.organized_data?.contact.city },
			{ label: "State", value: user?.organized_data?.contact.city_state_zip },
			{ label: "Date of Birth", value: user?.organized_data?.contact.date_of_birth },
			{ label: "Languages", value: user?.organized_data?.contact.languages },
			{ label: "Team Driver", value: user?.organized_data?.contact.team_driver.name },
			{ label: "Preferred distance", value: user?.organized_data?.contact.preferred_distance },
		];
	} else {
		contactFields = [
			{ label: "Phone", value: user?.organized_data?.contact.driver_phone },
			{ label: "Email", value: user?.email },
			{ label: "Home Location", value: user?.location}
		];
	}

	const emergencyContactFields = [
		{
			label: "Name",
			value: user?.organized_data?.contact?.emergency_contact?.name,
		},
		{
			label: "Phone",
			value: user?.organized_data?.contact?.emergency_contact?.phone,
		},
		{
			label: "Relation",
			value: user?.organized_data?.contact?.emergency_contact?.relation,
		},
	];

	return (
		<>
			<div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
				<div className="flex justify-between flex-wrap gap-6 lg:gap-10">
					<h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 order-1">
						Contact
					</h4>

					{/*{currentUser?.id !== user?.id && currentUser?.role === 'ADMINISTRATOR' &&
						<button
							onClick={openModal}
							className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto order-5 lg:order-2"
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
					}*/}

					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-7 2xl:gap-x-32 basis-full order-2 lg:order-3">
						{contactFields.map(field => (
							<div key={field.label}>
								<p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
									{field.label}
								</p>
								<p className="text-sm font-medium text-gray-800 dark:text-white/90">
									{field.value ?? "-"}
								</p>
							</div>
						))}
					</div>

					{user?.role === 'DRIVER' &&
						<>
							<h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 basis-full order-3 lg:order-4">
								Emergency contact
							</h4>

							<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-7 2xl:gap-x-32 basis-full order-4 lg:order-5">
								{emergencyContactFields.map(field => (
									<div key={field.label}>
										<p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
											{field.label}
										</p>
										<p className="text-sm font-medium text-gray-800 dark:text-white/90">
											{field.value ?? "-"}
										</p>
									</div>
								))}
							</div>
						</>
					}

				</div>
			</div>

			<Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
				<div className="relative w-full p-4 overflow-y-auto bg-white no-scrollbar rounded-3xl dark:bg-gray-900 lg:p-11 max-h-150">
					<div className="px-2 pr-14">
						<h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
							Edit Contact
						</h4>
						<p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
							Update your details to keep your profile up-to-date.
						</p>
					</div>
					<form className="flex flex-col" onSubmit={handleSubmit(onSubmit)}>
						<div className="px-2 overflow-y-auto custom-scrollbar">
							<div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2 mb-7">
								<Label>
									Phone
									<input
										type="text"
										{...register("contact.driver_phone")}
										className="input-style"
									/>
									{errors.contact?.driver_phone && (
										<p className="text-error-500 text-sm mt-1">
											{errors.contact.driver_phone.message}
										</p>
									)}
								</Label>

								<Label>
									Email
									<input
										type="text"
										{...register("contact.driver_email")}
										className="input-style"
									/>
									{errors.contact?.driver_email && (
										<p className="text-error-500 text-sm mt-1">
											{errors.contact.driver_email.message}
										</p>
									)}
								</Label>

								<Label>
									Home Location
									<input
										type="text"
										{...register("contact.home_location")}
										className="input-style"
									/>
									{errors.contact?.home_location && (
										<p className="text-error-500 text-sm mt-1">
											{errors.contact.home_location.message}
										</p>
									)}
								</Label>

								<Label>
									City
									<input
										type="text"
										{...register("contact.city")}
										className="input-style"
									/>
									{errors.contact?.city && (
										<p className="text-error-500 text-sm mt-1">
											{errors.contact.city.message}
										</p>
									)}
								</Label>

								<Label>
									State
									<input
										type="text"
										{...register("contact.city_state_zip")}
										className="input-style"
									/>
									{errors.contact?.city_state_zip && (
										<p className="text-error-500 text-sm mt-1">
											{errors.contact.city_state_zip.message}
										</p>
									)}
								</Label>

								<Label>
									Date of Birth
									<input
										type="text"
										{...register("contact.date_of_birth")}
										className="input-style"
									/>
									{errors.contact?.date_of_birth && (
										<p className="text-error-500 text-sm mt-1">
											{errors.contact.date_of_birth.message}
										</p>
									)}
								</Label>

								<Label>
									Languages
									<input
										type="text"
										{...register("contact.languages")}
										className="input-style"
									/>
									{errors.contact?.languages && (
										<p className="text-error-500 text-sm mt-1">
											{errors.contact.languages.message}
										</p>
									)}
								</Label>

								<Label>
									Preferred distance
									<input
										type="text"
										{...register("contact.preferred_distance")}
										className="input-style"
									/>
									{errors.contact?.preferred_distance && (
										<p className="text-error-500 text-sm mt-1">
											{errors.contact.preferred_distance.message}
										</p>
									)}
								</Label>
							</div>

							<h5 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white/90">
								Edit Emergency Contact
							</h5>

							<div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
								<Label>
									Name
									<input
										type="text"
										{...register("contact.emergency_contact.name")}
										className="input-style"
									/>
									{errors.contact?.emergency_contact?.name && (
										<p className="text-error-500 text-sm mt-1">
											{errors.contact.emergency_contact.name.message}
										</p>
									)}
								</Label>

								<Label>
									Phone
									<input
										type="text"
										{...register("contact.emergency_contact.phone")}
										className="input-style"
									/>
									{errors.contact?.emergency_contact?.phone && (
										<p className="text-error-500 text-sm mt-1">
											{errors.contact.emergency_contact.phone.message}
										</p>
									)}
								</Label>

								<Label>
									Relation
									<input
										type="text"
										{...register("contact.emergency_contact.relation")}
										className="input-style"
									/>
									{errors.contact?.emergency_contact?.relation && (
										<p className="text-error-500 text-sm mt-1">
											{errors.contact.emergency_contact.relation.message}
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
